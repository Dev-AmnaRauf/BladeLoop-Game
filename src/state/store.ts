/**
 * A tiny persisted store, shared by every slice of saved state.
 *
 * Each slice is one plain object behind one AsyncStorage key. The load is
 * kicked off at import time and callers never await it: reads return the
 * defaults until the saved values land, at which point every subscriber is
 * told and re-renders with the real numbers. That ordering matters for a game
 * -- the first frame must not wait on disk -- and it is the same for progress,
 * settings and the leaderboard cache, so it lives here once.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  /** Replace the whole slice, defaults included. Used by "reset progress". */
  reset(): void;
  subscribe(cb: () => void): () => void;
  /** Resolves once the saved values have loaded (or failed to). */
  hydrated(): Promise<void>;
  /** Hook form, for components. */
  use(): T;
}

export function createStore<T extends object>(
  key: string,
  defaults: T,
  /** Fixes up an older saved shape before it is merged over the defaults. */
  migrate?: (saved: Record<string, unknown>) => Partial<T>,
): Store<T> {
  let state = defaults;
  /** True once the saved values have loaded, so an early write cannot clobber
   * disk with the defaults before the real value arrives. */
  let ready = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach(l => l());

  function persist() {
    if (!ready) return;
    AsyncStorage.setItem(key, JSON.stringify(state)).catch(() => {
      // Best-effort: a failed save just means this session isn't kept.
    });
  }

  const hydration = AsyncStorage.getItem(key)
    .then(raw => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      state = { ...defaults, ...(migrate ? migrate(saved) : (saved as Partial<T>)) };
      emit();
    })
    .catch(() => {
      // No saved data (or it's corrupt) -- stick with the defaults.
    })
    .then(() => {
      ready = true;
    });

  const get = () => state;
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  return {
    get,
    set(patch) {
      state = { ...state, ...patch };
      emit();
      persist();
    },
    reset() {
      state = defaults;
      emit();
      persist();
    },
    subscribe,
    hydrated: () => hydration,
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}
