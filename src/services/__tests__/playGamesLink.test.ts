/**
 * Attaching a Play Games player to Firebase. What has to hold is the board
 * row: a first link keeps the device on the account -- and the row -- it
 * already had, a player who already has an account elsewhere moves over to it
 * with their best score owed to the new row, and a project that refuses the
 * trade leaves the player signed in and asks again next launch.
 */
// A module, so these names stay out of the other suites' way.
export {};

type Json = Record<string, unknown>;

const calls: { url: string; body: Json }[] = [];

function ok(data: Json) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(''),
  } as unknown as Response);
}

function refused(message: string) {
  return Promise.resolve({
    ok: false,
    status: 400,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(JSON.stringify({ error: { message } })),
  } as unknown as Response);
}

const mockNative = {
  requestServerAuthCode: jest.fn<Promise<string>, [string]>(),
  log: jest.fn<void, [string]>(),
};

jest.mock('../../native/NativePlayGamesAuth', () => ({
  __esModule: true,
  default: mockNative,
}));

/**
 * A `fetch` that signs the device in anonymously as `anon`, lets the board
 * write, and answers the Play Games trade with `idp`.
 */
function route(idp: (body: Json) => Promise<Response>) {
  globalThis.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    if (url.includes('accounts:signUp')) {
      return ok({
        localId: 'anon',
        refreshToken: 'r0',
        idToken: 't-anon',
        expiresIn: '3600',
      });
    }
    if (url.includes('accounts:signInWithIdp')) return idp(body);
    if (url.includes('/scores/')) return ok({});
    return Promise.reject(new Error(`unrouted ${url}`));
  }) as unknown as typeof fetch;
}

async function load() {
  jest.resetModules();
  calls.length = 0;
  // A fresh registry has a fresh `Platform`, and this is an Android-only door.
  (require('react-native').Platform as { OS: string }).OS = 'android';
  const PlayGames = require('../PlayGames') as typeof import('../PlayGames');
  const Board = require('../Leaderboard') as typeof import('../Leaderboard');
  const acct = require('../../state/account') as typeof import('../../state/account');
  const settings = require('../../state/settings') as typeof import('../../state/settings');
  await settings.settings.hydrated();
  await acct.account.hydrated();
  return { PlayGames, Board, acct };
}

const idpCalls = () => calls.filter(c => c.url.includes('signInWithIdp'));

beforeEach(() => {
  let n = 0;
  mockNative.requestServerAuthCode
    .mockReset()
    .mockImplementation(() => Promise.resolve(`code-${++n}`));
});

test('a first link keeps the device on its own account and row', async () => {
  route(() =>
    ok({
      localId: 'anon',
      refreshToken: 'r1',
      idToken: 't1',
      expiresIn: '3600',
    }),
  );
  const { PlayGames, Board, acct } = await load();
  await Board.submit(120, 4);
  acct.signInAsPlayGames('BladeRunner', 'p-1');

  await expect(PlayGames.linkFirebase()).resolves.toBe(true);

  const [link] = idpCalls();
  expect(link.body.idToken).toBe('t-anon');
  expect(link.body.postBody).toBe('code=code-1&providerId=playgames.google.com');
  expect(Board.getBoard().submitted).toBe(120);
  expect(acct.getAccount().linked).toBe(true);
});

test('a player with an account elsewhere moves to it and takes their best along', async () => {
  route(body =>
    body.idToken
      ? refused('FEDERATED_USER_ID_ALREADY_LINKED')
      : ok({
          localId: 'pg',
          refreshToken: 'r2',
          idToken: 't2',
          expiresIn: '3600',
        }),
  );
  const { PlayGames, Board, acct } = await load();
  await Board.submit(120, 4);
  acct.signInAsPlayGames('BladeRunner', 'p-1');

  await expect(PlayGames.linkFirebase()).resolves.toBe(true);

  const [link, signIn] = idpCalls();
  expect(link.body.postBody).toContain('code=code-1');
  // A code is spent by the refused link, so the sign-in asks for a new one.
  expect(signIn.body.idToken).toBeUndefined();
  expect(signIn.body.postBody).toContain('code=code-2');
  expect(Board.getBoard()).toMatchObject({ submitted: 0, queued: 120 });
  expect(await Board.myUid()).toBe('pg');
});

test('a refused trade leaves the player in, unlinked, to be tried again', async () => {
  route(() => refused('OPERATION_NOT_ALLOWED'));
  const { PlayGames, acct } = await load();
  acct.signInAsPlayGames('BladeRunner', 'p-1');

  await expect(PlayGames.linkFirebase()).resolves.toBe(false);
  expect(acct.getAccount()).toMatchObject({
    provider: 'playgames',
    linked: false,
  });

  route(() =>
    ok({
      localId: 'anon',
      refreshToken: 'r1',
      idToken: 't1',
      expiresIn: '3600',
    }),
  );
  await PlayGames.ensureLinked();
  expect(acct.getAccount().linked).toBe(true);

  // Once it has taken, a launch does not go back to Firebase for it.
  calls.length = 0;
  await PlayGames.ensureLinked();
  expect(idpCalls()).toHaveLength(0);
});

test('nobody but a Play Games player is linked', async () => {
  route(() =>
    ok({
      localId: 'anon',
      refreshToken: 'r1',
      idToken: 't1',
      expiresIn: '3600',
    }),
  );
  const { PlayGames, acct } = await load();
  acct.signInAsGuest();

  await PlayGames.ensureLinked();
  expect(mockNative.requestServerAuthCode).not.toHaveBeenCalled();
});
