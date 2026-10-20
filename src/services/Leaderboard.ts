/**
 * The global board.
 *
 * One document per device under `scores/{uid}`, holding only that device's
 * best. A run does not write on every death -- only when it beats what this
 * device has already sent -- so a long session costs one write, not fifty.
 *
 * The same row carries the player's country and city, which is what lets the
 * one collection serve three boards: the world, their country, and their city.
 * The narrower two are the same query with a filter on the front, so a city
 * board costs exactly what the world board costs.
 *
 * Everything here is best-effort. The board is a nice-to-have on top of a game
 * that has to keep working on a plane: a failed read falls back to the last
 * list this device saw, and a failed write is kept and retried the next time
 * the app has a reason to talk to Firebase. No call rejects, so no caller
 * needs a try/catch around it.
 */
import { DOCS, auth, fromFields, timedFetch, toFields } from './firebase';
import * as Region from './Region';
import { createStore } from '../state/store';
import { MAX_NAME, getSettings } from '../state/settings';

export interface Entry {
  uid: string;
  name: string;
  score: number;
  runs: number;
  /** ISO country code the row was set in, or '' when it was never known. */
  country: string;
  city: string;
}

/** Which of the three boards is being asked for. */
export type Scope = 'world' | 'country' | 'city';

export const SCOPES: Scope[] = ['world', 'country', 'city'];

/** Rows fetched and shown. Deep enough to find yourself on a quiet board. */
export const BOARD_SIZE = 50;
/** A board this fresh is shown without going back to the network. */
const STALE_MS = 60000;

/** One board's worth of rows, and when they were fetched. */
interface Page {
  entries: Entry[];
  /** Epoch ms of the last successful fetch; 0 when there has never been one. */
  fetchedAt: number;
}

const EMPTY: Page = { entries: [], fetchedAt: 0 };

interface BoardCache {
  world: Page;
  country: Page;
  city: Page;
  /** Highest score this device has successfully put on the board. */
  submitted: number;
  /** A better score that has not made it up yet. 0 when there is none. */
  queued: number;
  /** Where this device sat on the whole board, or 0 when it is not known. */
  rank: number;
  /** The name and place the row went up under, so a change can be pushed. */
  sentAs: string;
}

// v2: the cache used to be one flat list, from before the board had scopes.
const store = createStore<BoardCache>('bladeloop.board.v2', {
  world: EMPTY,
  country: EMPTY,
  city: EMPTY,
  submitted: 0,
  queued: 0,
  rank: 0,
  sentAs: '',
});

export const useBoard = store.use;
export const getBoard = store.get;

/** The rows of one board, whichever of the three it is. */
export function page(scope: Scope, cache: BoardCache = store.get()): Page {
  return cache[scope] ?? EMPTY;
}

/** Drops anything that would look wrong in a row of the board. */
function cleanName(raw: string) {
  const name = Array.from(raw)
    // Control characters would render as blanks or boxes on someone else's
    // device, and the name goes out to every player who opens the board.
    .filter(ch => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .trim()
    .slice(0, MAX_NAME);
  return name || 'Anonymous';
}

async function readJson(url: string, init: RequestInit) {
  const res = await timedFetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function equals(field: string, value: string) {
  return {
    fieldFilter: {
      field: { fieldPath: field },
      op: 'EQUAL',
      value: { stringValue: value },
    },
  };
}

/**
 * The `where` that narrows the world board down to one country or one city.
 * Undefined for the world board itself.
 */
function scopeFilter(scope: Scope, region: Region.Region) {
  if (scope === 'world') return undefined;
  if (scope === 'country') return equals('country', region.country);
  return {
    compositeFilter: {
      op: 'AND',
      filters: [equals('country', region.country), equals('city', region.city)],
    },
  };
}

/** True when the player's place is known well enough to ask for this board. */
export function canShow(scope: Scope, region: Region.Region) {
  if (scope === 'world') return true;
  if (scope === 'country') return !!region.country;
  return !!region.country && !!region.city;
}

/**
 * The top of one board, read from the network and falling back to the last one
 * this device saw. `live` says which of the two the caller got, so the screen
 * can own up to showing something stale.
 */
export async function fetchTop(
  scope: Scope = 'world',
  limit = BOARD_SIZE,
): Promise<{ entries: Entry[]; live: boolean }> {
  const cached = page(scope);
  if (cached.entries.length && Date.now() - cached.fetchedAt < STALE_MS) {
    return { entries: cached.entries, live: true };
  }

  // The narrow boards need somewhere to point at before they can be asked for.
  const region = scope === 'world' ? Region.getRegion() : await Region.resolve();
  if (!canShow(scope, region)) return { entries: [], live: false };

  const session = await auth();
  if (!session) return { entries: cached.entries, live: false };

  try {
    const where = scopeFilter(scope, region);
    const rows = await readJson(`${DOCS}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.idToken}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'scores' }],
          ...(where ? { where } : {}),
          orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
          limit,
        },
      }),
    });

    const entries: Entry[] = (rows as { document?: { name: string; fields: never } }[])
      // A query that matches nothing comes back as a single row with no
      // document on it, rather than as an empty list.
      .filter(r => r.document)
      .map(r => {
        const doc = r.document!;
        const f = fromFields(doc.fields);
        return {
          uid: doc.name.split('/').pop() ?? '',
          name: String(f.name ?? 'Anonymous'),
          score: Number(f.score ?? 0),
          runs: Number(f.runs ?? 0),
          country: String(f.country ?? ''),
          city: String(f.city ?? ''),
        };
      });

    store.set({
      [scope]: { entries, fetchedAt: Date.now() },
    } as Partial<BoardCache>);
    return { entries, live: true };
  } catch {
    return { entries: cached.entries, live: false };
  }
}

/**
 * How far down the whole board a score sits, counting the rows above it. Only
 * worth asking once the player is off the end of the fetched page; returns 0
 * when the answer is not available.
 */
export async function fetchRank(score: number): Promise<number> {
  const session = await auth();
  if (!session || score <= 0) return 0;
  try {
    const res = await readJson(`${DOCS}:runAggregationQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.idToken}` },
      body: JSON.stringify({
        structuredAggregationQuery: {
          aggregations: [{ alias: 'above', count: {} }],
          structuredQuery: {
            from: [{ collectionId: 'scores' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'score' },
                op: 'GREATER_THAN',
                value: { integerValue: String(Math.floor(score)) },
              },
            },
          },
        },
      }),
    });
    const above = Number(res?.[0]?.result?.aggregateFields?.above?.integerValue ?? NaN);
    if (!Number.isFinite(above)) return 0;
    const rank = above + 1;
    store.set({ rank });
    return rank;
  } catch {
    return 0;
  }
}

export type SubmitResult = 'sent' | 'queued' | 'skipped' | 'off';

/** What the row would go up as, so a rename or a move can be spotted. */
function identity(region: Region.Region) {
  return `${cleanName(getSettings().name)}|${region.country}|${region.city}`;
}

/**
 * Put a score on the board if it is worth putting there.
 *
 * `skipped` means the board already has something at least this good from this
 * device, under the same name and from the same place; `queued` means it is
 * kept for the next attempt; `off` means the player turned board submissions
 * off in settings.
 */
export async function submit(score: number, runs: number): Promise<SubmitResult> {
  if (!getSettings().submitScores) return 'off';

  const cache = store.get();
  const target = Math.max(Math.floor(score), cache.queued);
  // Whatever place is already known, never a lookup: a score is written the
  // moment a run ends, and it must not wait on the network to say where it
  // was set. A place that lands later is pushed up by `syncName`.
  const region = Region.getRegion();
  const who = identity(region);
  if (target <= cache.submitted && who === cache.sentAs) return 'skipped';

  const session = await auth();
  if (!session) {
    store.set({ queued: target });
    return 'queued';
  }

  // A rename pushes the row up again, and must not walk the score backwards
  // while doing it.
  const best = Math.max(target, cache.submitted);

  try {
    await readJson(`${DOCS}/scores/${session.uid}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.idToken}` },
      body: JSON.stringify({
        fields: toFields({
          name: cleanName(getSettings().name),
          score: best,
          runs: Math.floor(runs),
          country: region.country,
          city: region.city,
          at: new Date().toISOString(),
        }),
      }),
    });
    // The boards this device is holding no longer include its own new score,
    // so let the next open go and fetch fresh ones.
    store.set({
      submitted: best,
      queued: 0,
      sentAs: who,
      world: EMPTY,
      country: EMPTY,
      city: EMPTY,
    });
    return 'sent';
  } catch {
    store.set({ queued: target });
    return 'queued';
  }
}

/** Force the next `fetchTop` to go to the network instead of the cache. */
export function invalidate() {
  const cache = store.get();
  store.set({
    world: { ...page('world', cache), fetchedAt: 0 },
    country: { ...page('country', cache), fetchedAt: 0 },
    city: { ...page('city', cache), fetchedAt: 0 },
  });
}

/**
 * Retry a score that never made it up. Cheap and silent when there is nothing
 * waiting, so it is safe to call on every app open and every board open.
 */
export async function flush(runs: number) {
  const { queued } = store.get();
  if (!queued) return;
  await submit(queued, runs);
}

/**
 * Push a renamed -- or moved -- player onto their existing row, so the board
 * does not keep showing the name they just changed or the city they left. Also
 * how a row that went up before the place was known gets one: `submit` returns
 * `skipped` when nothing about the row has changed, so this is free otherwise.
 * Does nothing until they have a row.
 */
export async function syncName(runs: number) {
  const { submitted } = store.get();
  if (!submitted) return;
  await submit(submitted, runs);
}

/**
 * The device has moved to a different Firebase account, and so to a different
 * row. What this device put on the old one is owed to the new one: it goes up
 * as queued, on the next `flush` or the next run, whichever comes first.
 */
export function rehome() {
  const { submitted, queued } = store.get();
  store.set({
    submitted: 0,
    queued: Math.max(submitted, queued),
    sentAs: '',
    rank: 0,
  });
}

/** This device's row on the board, once it has one. */
export async function myUid() {
  return (await auth())?.uid ?? null;
}
