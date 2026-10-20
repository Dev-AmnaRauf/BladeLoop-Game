/**
 * Player-facing preferences: what makes noise, what buzzes, what leaves the
 * device, and the name a score goes onto the board under.
 *
 * Kept apart from `progress` on purpose. Progress is what the player earned
 * and a reset wipes it; settings are how they like the app and survive that
 * reset. The two also change on very different clocks -- progress moves every
 * run, settings only when someone opens the sheet.
 */
import { createStore } from './store';

export interface Settings {
  /** Name shown on the leaderboard. Empty until the player picks one. */
  name: string;
  /** One-shot sound effects. */
  sfx: boolean;
  /** The background loop. */
  music: boolean;
  /** Short buzz on a death, a pickup and a button. */
  vibrate: boolean;
  /** Consent for usage analytics. Off means nothing is reported at all. */
  analytics: boolean;
  /** Whether a finished run's score is sent to the global board. */
  submitScores: boolean;
}

export const MAX_NAME = 14;

const DEFAULTS: Settings = {
  name: '',
  sfx: true,
  music: true,
  vibrate: true,
  // Opt-out rather than opt-in: the sheet makes the switch easy to find, and a
  // store that requires a consent prompt gets one wired to this flag.
  analytics: true,
  submitScores: true,
};

export const settings = createStore<Settings>('bladeloop.settings.v1', DEFAULTS);

export const getSettings = settings.get;
export const useSettings = settings.use;

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  settings.set({ [key]: value } as Partial<Settings>);
}

/** Trimmed and capped, so a name is safe to put straight on the board. */
export function setName(raw: string) {
  settings.set({ name: raw.trim().slice(0, MAX_NAME) });
}

/** What to label this player's row with when they never picked a name. */
export function displayName() {
  return getSettings().name || 'YOU';
}

/**
 * True when every sound is off. The floating speaker button is a master
 * switch over the two audio settings rather than a third one that could
 * disagree with them: pressing it silences both, and pressing it again brings
 * both back.
 */
export function isMuted() {
  const s = getSettings();
  return !s.sfx && !s.music;
}

export function toggleMuted() {
  const on = isMuted();
  settings.set({ sfx: on, music: on });
}
