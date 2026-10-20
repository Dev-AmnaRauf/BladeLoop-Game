/**
 * What the Play Games door has to get right is all about what it does when it
 * cannot open: a build whose native module never came up, a phone with no Play
 * Games on it, and a player who changed their mind at the sheet all have to
 * leave the login screen usable rather than throwing out of it.
 *
 * The mock wears the exact shape of `react-native-google-play-games` -- the
 * functions on the default export, and rejections carrying the `code` strings
 * its native module actually rejects with. If that shape drifts these fail,
 * rather than the app failing on a device.
 */
import { Platform } from 'react-native';

/** A rejection shaped like one from the native side, `code` and all. */
function mockFail(code: string) {
  return Object.assign(new Error(code), { code });
}

const mockNative = {
  isAuthenticated: jest.fn<Promise<boolean>, []>(),
  signIn: jest.fn<Promise<unknown>, []>(),
  getPlayer: jest.fn<Promise<unknown>, []>(),
};

jest.mock('react-native-google-play-games', () => ({
  __esModule: true,
  default: mockNative,
  ...mockNative,
}));

import * as PlayGames from '../PlayGames';

const PLAYER = { id: 'p-1', displayName: 'BladeRunner', title: null };

beforeEach(() => {
  // The suite runs as iOS by default, and this is an Android-only service.
  (Platform as { OS: string }).OS = 'android';
  PlayGames.reset();
  mockNative.isAuthenticated.mockReset().mockResolvedValue(false);
  mockNative.signIn.mockReset().mockResolvedValue(PLAYER);
  mockNative.getPlayer.mockReset().mockResolvedValue(PLAYER);
});

afterAll(() => {
  (Platform as { OS: string }).OS = 'ios';
});

test('a phone already signed in is recognised without being asked again', async () => {
  mockNative.isAuthenticated.mockResolvedValue(true);

  await expect(PlayGames.probe()).resolves.toEqual({
    available: true,
    player: { id: 'p-1', name: 'BladeRunner' },
  });
  expect(PlayGames.isAvailable()).toBe(true);
  // The door is open, but nothing was opened: no sheet is put in front of a
  // player who is already through it.
  expect(mockNative.signIn).not.toHaveBeenCalled();
});

test('a phone that can sign in but has not yet offers the door and nobody behind it', async () => {
  await expect(PlayGames.probe()).resolves.toEqual({ available: true, player: null });
  expect(mockNative.getPlayer).not.toHaveBeenCalled();
});

test('a player whose name will not load still has a door to walk through', async () => {
  // The question the probe answers is whether it opens, not who is behind it,
  // and that half has already been answered by the time this fails.
  mockNative.isAuthenticated.mockResolvedValue(true);
  mockNative.getPlayer.mockRejectedValue(mockFail('E_GET_PLAYER_FAILED'));

  await expect(PlayGames.probe()).resolves.toEqual({ available: true, player: null });
});

test('a JS bundle ahead of the native build says the door is not there', async () => {
  // What a missing TurboModule actually looks like: the package's JS loads
  // fine and the first call into it rejects.
  mockNative.isAuthenticated.mockRejectedValue(new Error('TurboModule not found'));

  await expect(PlayGames.probe()).resolves.toEqual({ available: false, player: null });
  expect(PlayGames.isAvailable()).toBe(false);
});

test('the answer is remembered, so a second open costs nothing', async () => {
  await PlayGames.probe();
  await PlayGames.probe();

  expect(mockNative.isAuthenticated).toHaveBeenCalledTimes(1);
});

test('a probe with no activity in front of it is not the device answering', async () => {
  // Play Games needs a foreground activity. A probe that lands while the app
  // is on its way out has been told nothing, so it must not be the answer the
  // login screen gets for the rest of the session.
  mockNative.isAuthenticated.mockRejectedValueOnce(mockFail('E_NO_ACTIVITY'));

  await expect(PlayGames.probe()).resolves.toEqual({ available: false, player: null });
  mockNative.isAuthenticated.mockResolvedValue(true);
  await expect(PlayGames.probe()).resolves.toEqual({
    available: true,
    player: { id: 'p-1', name: 'BladeRunner' },
  });
});

test('signing in hands back the player', async () => {
  await expect(PlayGames.signIn()).resolves.toEqual({ id: 'p-1', name: 'BladeRunner' });
  expect(PlayGames.isAvailable()).toBe(true);
});

/**
 * Run `signIn` with the clock made to jump `ms` between the call going out and
 * its answer coming back, so the two things Play Games spells the same way can
 * be told apart the way the service tells them apart.
 */
function signInAfter(ms: number) {
  let now = 1_000_000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  mockNative.signIn.mockImplementation(() => {
    now += ms;
    return Promise.reject(mockFail('E_SIGN_IN_CANCELLED'));
  });
  return PlayGames.signIn().finally(() => clock.mockRestore());
}

test('a dismissed sign-in is not a failure', async () => {
  // Long enough that a person was looking at a sheet and decided against it.
  await expect(signInAfter(4000)).resolves.toBeNull();
});

test('a refusal that calls itself a cancel is not taken for one', async () => {
  // Play Games answers a misconfigured game -- wrong signing certificate, or a
  // game that was never set up in Play Console -- with a *successful* sign-in
  // whose `isAuthenticated` is false, which the native module turns into the
  // same E_SIGN_IN_CANCELLED a real dismissal gives. Taken at face value that
  // makes the button dead: pressed, nothing happens, nothing said. The clock is
  // what separates them -- no player reads and dismisses a sheet this fast.
  mockNative.isAuthenticated.mockResolvedValue(true);
  await PlayGames.probe();

  await expect(signInAfter(120)).rejects.toThrow('would not open a sign-in');
  // And the door goes with it, the same as any other failure: it has just been
  // shown not to open.
  expect(PlayGames.isAvailable()).toBe(false);
});

test('a sign-in that actually failed throws, and takes the door with it', async () => {
  mockNative.isAuthenticated.mockResolvedValue(true);
  await PlayGames.probe();
  expect(PlayGames.isAvailable()).toBe(true);

  mockNative.signIn.mockRejectedValue(mockFail('E_SIGN_IN_FAILED'));
  await expect(PlayGames.signIn()).rejects.toThrow();
  // The service has just been told it cannot open the door; it must not keep
  // claiming it can.
  expect(PlayGames.isAvailable()).toBe(false);
});

test('there is no door at all on iOS', async () => {
  PlayGames.reset();
  (Platform as { OS: string }).OS = 'ios';

  await expect(PlayGames.probe()).resolves.toEqual({ available: false, player: null });
  // Not even reached for: every call into the package throws there.
  expect(mockNative.isAuthenticated).not.toHaveBeenCalled();
  await expect(PlayGames.signIn()).rejects.toThrow('not available in this build');
});
