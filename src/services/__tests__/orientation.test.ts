/**
 * Sideways, and nothing else.
 *
 * The service is the only thing that talks to the native module, and the
 * screen calls it from a render that happens sixty times a second -- so what
 * matters here is that it asks once per change and never in between, and that
 * a phone which cannot answer does not take the game down with it.
 *
 * The game itself now only ever asks for landscape: every screen in it is laid
 * out for a short, wide viewport. The service is still a general one -- it
 * takes a way round, not a boolean -- so the portrait cases below are what
 * keeps that honest rather than a thing the game does.
 */
const mockLock = jest.fn();

/** Swapped per test: a phone that turns, one with no module, one that throws. */
let mockNative: { lock: (mode: string) => void } | null = { lock: mockLock };

jest.mock('../../native/NativeOrientation', () => ({
  __esModule: true,
  get default() {
    return mockNative;
  },
}));

import * as Orientation from '../Orientation';

beforeEach(() => {
  mockLock.mockClear();
  mockNative = { lock: mockLock };
  Orientation.reset();
});

describe('asking the phone to turn', () => {
  /**
   * Null rather than a way round. The activity comes up sideways on its own --
   * `sensorLandscape` in the manifest -- so were this seeded with the answer
   * the game is about to ask for, the guard below would swallow that ask and
   * iOS, whose native half is not built, would never hear it.
   */
  it('starts having asked for nothing at all', () => {
    expect(Orientation.heldWay()).toBeNull();
  });

  it('asks the first time, on a phone nobody has asked yet', () => {
    Orientation.lock('landscape');
    expect(mockLock).toHaveBeenCalledTimes(1);
    expect(mockLock).toHaveBeenCalledWith('landscape');
  });

  it('asks once for a run, and not again on every frame of it', () => {
    Orientation.lock('landscape');
    Orientation.lock('landscape');
    Orientation.lock('landscape');
    expect(mockLock).toHaveBeenCalledTimes(1);
    expect(mockLock).toHaveBeenCalledWith('landscape');
    expect(Orientation.heldWay()).toBe('landscape');
  });

  it('asks again when the way round actually changes', () => {
    Orientation.lock('landscape');
    Orientation.lock('portrait');
    expect(mockLock.mock.calls.map(c => c[0])).toEqual(['landscape', 'portrait']);
  });

  it('does not ask for the way the phone is already held', () => {
    Orientation.lock('portrait');
    mockLock.mockClear();
    Orientation.lock('portrait');
    expect(mockLock).not.toHaveBeenCalled();
  });
});

describe('a phone that cannot answer', () => {
  it('is not a crash when the module is missing, as on iOS today', () => {
    mockNative = null;
    expect(() => Orientation.lock('landscape')).not.toThrow();
    // Still recorded: the game carries on believing it asked, and the phone
    // simply turns with the player instead.
    expect(Orientation.heldWay()).toBe('landscape');
  });

  it('is not a crash when the module throws', () => {
    mockNative = {
      lock: () => {
        throw new Error('no activity');
      },
    };
    expect(() => Orientation.lock('landscape')).not.toThrow();
  });
});
