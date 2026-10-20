/**
 * The board talks to Firestore over plain HTTPS, so these drive it through a
 * stubbed `fetch` and check the two things that actually cost money or lose a
 * score: that a write only goes up when it is worth going up, and that a
 * device with no network keeps the score for later instead of dropping it.
 */
type Json = Record<string, unknown>;

interface Call {
  url: string;
  method: string;
  body: Json;
}

const calls: Call[] = [];

function ok(data: Json | Json[]) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(''),
  } as unknown as Response);
}

/** A `fetch` that signs anyone in and accepts whatever the routes below say. */
function route(handler: (url: string) => Promise<Response> | null) {
  globalThis.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : {},
    });
    if (url.includes('accounts:signUp')) {
      return ok({ localId: 'u1', refreshToken: 'r1', idToken: 't1', expiresIn: '3600' });
    }
    const res = handler(url);
    if (res) return res;
    return Promise.reject(new Error(`unrouted ${url}`));
  }) as unknown as typeof fetch;
}

/** A fresh copy of the board, with nothing cached and nobody signed in. */
async function load() {
  jest.resetModules();
  calls.length = 0;
  const Board = require('../Leaderboard') as typeof import('../Leaderboard');
  const Region = require('../Region') as typeof import('../Region');
  const settings = require('../../state/settings') as typeof import('../../state/settings');
  await settings.settings.hydrated();
  return { Board, Region, settings };
}

/** The place lookup, answering with somewhere the narrow boards can use. */
function inKarachi(url: string) {
  return url.includes('ipapi')
    ? ok({ country_code: 'PK', country_name: 'Pakistan', city: 'Karachi' })
    : null;
}

afterEach(() => {
  // @ts-expect-error -- putting the environment back the way it was found.
  delete globalThis.fetch;
});

test('a better score is written as an integer under this device uid', async () => {
  const { Board } = await load();
  route(url => (url.endsWith('/scores/u1') ? ok({}) : null));

  await expect(Board.submit(120, 4)).resolves.toBe('sent');

  const write = calls.find(c => c.method === 'PATCH');
  expect(write?.url).toContain('/documents/scores/u1');
  // Firestore sorts integers and doubles separately, so the score has to go up
  // as an integer or the board would order it into its own group.
  expect(write?.body).toMatchObject({
    fields: { score: { integerValue: '120' }, runs: { integerValue: '4' } },
  });
});

test('a run that does not beat what is already up costs no write', async () => {
  const { Board } = await load();
  route(url => (url.endsWith('/scores/u1') ? ok({}) : null));

  await Board.submit(120, 4);
  const before = calls.length;

  await expect(Board.submit(90, 5)).resolves.toBe('skipped');
  expect(calls).toHaveLength(before);
});

test('an unnamed player goes up as Anonymous', async () => {
  const { Board } = await load();
  route(url => (url.endsWith('/scores/u1') ? ok({}) : null));

  await Board.submit(10, 1);
  const write = calls.find(c => c.method === 'PATCH');
  expect(write?.body).toMatchObject({ fields: { name: { stringValue: 'Anonymous' } } });
});

test('a score set offline is kept and sent on the next flush', async () => {
  const { Board } = await load();
  globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;

  await expect(Board.submit(200, 6)).resolves.toBe('queued');

  route(url => (url.endsWith('/scores/u1') ? ok({}) : null));
  await Board.flush(6);

  const write = calls.find(c => c.method === 'PATCH');
  expect(write?.body).toMatchObject({ fields: { score: { integerValue: '200' } } });
});

test('turning submissions off keeps the run on the device', async () => {
  const { Board, settings } = await load();
  settings.setSetting('submitScores', false);
  route(() => null);

  await expect(Board.submit(500, 9)).resolves.toBe('off');
  expect(calls).toHaveLength(0);
});

test('a query reads the rows and ignores the empty one', async () => {
  const { Board } = await load();
  route(url =>
    url.endsWith(':runQuery')
      ? ok([
          {
            document: {
              name: 'projects/p/databases/(default)/documents/scores/u2',
              fields: {
                name: { stringValue: 'Bee' },
                score: { integerValue: '40' },
                runs: { integerValue: '3' },
              },
            },
          },
          // A query that matches nothing still returns a row -- one carrying a
          // read time and no document.
          { readTime: '2026-01-01T00:00:00Z' },
        ])
      : null,
  );

  const { entries, live } = await Board.fetchTop();
  expect(live).toBe(true);
  // A row written before the board knew about places still reads back.
  expect(entries).toEqual([
    { uid: 'u2', name: 'Bee', score: 40, runs: 3, country: '', city: '' },
  ]);
});

test('a score carries the place it was set in', async () => {
  const { Board, Region } = await load();
  route(url => inKarachi(url) ?? (url.endsWith('/scores/u1') ? ok({}) : null));
  await Region.resolve();

  await Board.submit(60, 2);

  const write = calls.find(c => c.method === 'PATCH');
  expect(write?.body).toMatchObject({
    fields: { country: { stringValue: 'PK' }, city: { stringValue: 'Karachi' } },
  });
});

test('moving pushes the row up again at the same score', async () => {
  const { Board, Region } = await load();
  route(url => inKarachi(url) ?? (url.endsWith('/scores/u1') ? ok({}) : null));
  await Board.submit(60, 2);

  // The place lands after the first write, which is what a first run looks
  // like: the run ends before the lookup comes back.
  await Region.resolve();
  await expect(Board.syncName(2)).resolves.toBeUndefined();

  const writes = calls.filter(c => c.method === 'PATCH');
  expect(writes).toHaveLength(2);
  // The second write must not walk the score back to what triggered it.
  expect(writes[1].body).toMatchObject({
    fields: { score: { integerValue: '60' }, city: { stringValue: 'Karachi' } },
  });
});

test('the city board asks only for rows set in that city', async () => {
  const { Board, Region } = await load();
  route(url => inKarachi(url) ?? (url.endsWith(':runQuery') ? ok([]) : null));
  await Region.resolve();

  await Board.fetchTop('city');

  const query = calls.find(c => c.url.endsWith(':runQuery'));
  expect(query?.body).toMatchObject({
    structuredQuery: {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'country' }, value: { stringValue: 'PK' } } },
            { fieldFilter: { field: { fieldPath: 'city' }, value: { stringValue: 'Karachi' } } },
          ],
        },
      },
    },
  });
});

test('a board with nowhere to point at is never asked for', async () => {
  const { Board } = await load();
  // No place lookup routed, so the app never finds out where it is.
  route(url => (url.endsWith(':runQuery') ? ok([]) : null));

  const { entries, live } = await Board.fetchTop('country');

  expect(entries).toEqual([]);
  expect(live).toBe(false);
  expect(calls.filter(c => c.url.endsWith(':runQuery'))).toHaveLength(0);
});

test('an unreachable board falls back to the last one seen', async () => {
  const { Board } = await load();
  route(url => (url.endsWith(':runQuery') ? ok([{ document: null }]) : null));
  await Board.fetchTop();

  // Something is cached now; take the network away and ask again.
  Board.invalidate();
  globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;

  const { live } = await Board.fetchTop();
  expect(live).toBe(false);
});
