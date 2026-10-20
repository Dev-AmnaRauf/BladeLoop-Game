/**
 * Where the player is, for the country and city boards.
 *
 * The board wants a country and a city next to a score, and it wants them
 * without asking for the location permission -- a game that pops a system
 * prompt on the first run loses players, and a leaderboard is not worth that.
 * So the place is looked up from the IP address instead: rough, free, and
 * accurate enough to put someone on the right city board.
 *
 * Everything here is best-effort and nothing rejects. A device that cannot
 * reach the lookup falls back to the country its locale is set to, and one
 * that cannot manage even that plays on the world board like everyone else.
 */
import { NativeModules, Platform } from 'react-native';
import { createStore } from '../state/store';
import { timedFetch } from './firebase';

export interface Region {
  /** ISO 3166-1 alpha-2, upper case. Empty when it is not known. */
  country: string;
  /** The country in words, for the label under the board. */
  countryName: string;
  /** The city in words. Empty when only the country could be worked out. */
  city: string;
  /** Epoch ms of the last lookup that came back off the network. */
  at: number;
}

/**
 * TODO: swap for your own endpoint before a big release. ipapi.co is free up
 * to a daily cap and needs no key, which is what the game wants while it is
 * small -- but the cap is per project, not per device.
 */
const LOOKUP_URL = 'https://ipapi.co/json/';

/** A place this fresh is used as-is. People do not move countries weekly. */
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

/** Longest city name kept, matching what the security rules will accept. */
export const MAX_PLACE = 32;

const store = createStore<Region>('bladeloop.region.v1', {
  country: '',
  countryName: '',
  city: '',
  at: 0,
});

export const useRegion = store.use;
export const getRegion = store.get;

/** Drops anything that would look wrong in a row everybody downloads. */
function cleanPlace(raw: unknown) {
  return Array.from(String(raw ?? ''))
    .filter(ch => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .trim()
    .slice(0, MAX_PLACE);
}

/**
 * The country the device itself is set to. No network, no permission -- but
 * it is where the phone was bought or configured, not where it is, so it is
 * only ever the fallback.
 */
function localeCountry() {
  const s = NativeModules.SettingsManager?.settings;
  const tag =
    Platform.OS === 'ios'
      ? s?.AppleLocale ?? (Array.isArray(s?.AppleLanguages) ? s.AppleLanguages[0] : '')
      : NativeModules.I18nManager?.localeIdentifier;
  // en_PK, en-PK, en-Latn-PK -- take the two-letter region wherever it sits.
  const match = /[-_]([A-Za-z]{2})(?:[-_@]|$)/.exec(String(tag ?? ''));
  return match ? match[1].toUpperCase() : '';
}

async function lookup(): Promise<Region> {
  try {
    const res = await timedFetch(LOOKUP_URL, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>;
      const country = cleanPlace(body.country_code).toUpperCase().slice(0, 2);
      if (/^[A-Z]{2}$/.test(country)) {
        const next: Region = {
          country,
          countryName: cleanPlace(body.country_name) || country,
          city: cleanPlace(body.city),
          at: Date.now(),
        };
        store.set(next);
        return next;
      }
    }
  } catch {
    // Offline, blocked, or over the daily cap -- fall through to the locale.
  }

  const cur = store.get();
  if (cur.country) return cur;

  const country = localeCountry();
  if (!country) return cur;
  // `at` is deliberately left at 0: this is a guess, so the next open should
  // still go and ask for the real thing.
  const next: Region = { ...cur, country, countryName: country, city: '' };
  store.set(next);
  return next;
}

/** In-flight lookup, so a burst of callers shares one round trip. */
let pending: Promise<Region> | null = null;

/**
 * The player's place, from the cache when it is fresh and from the network
 * when it is not. Never rejects: a failed lookup resolves to whatever is
 * known, which may be nothing at all.
 */
export async function resolve(force = false): Promise<Region> {
  await store.hydrated();
  const cur = store.get();
  if (!force && cur.country && Date.now() - cur.at < FRESH_MS) return cur;
  if (!pending) {
    pending = lookup().finally(() => {
      pending = null;
    });
  }
  return pending;
}

/** "Karachi, PK" -- what the board shows the player about themselves. */
export function placeLabel(region: Region = store.get()) {
  if (!region.country) return '';
  return region.city ? `${region.city}, ${region.country}` : region.countryName || region.country;
}
