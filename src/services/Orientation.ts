import NativeOrientation from '../native/NativeOrientation';

/**
 * The two ways a phone can be held. The game only ever asks for one of them --
 * it is sideways throughout -- and `'portrait'` stays in the type because the
 * native module takes a way round rather than a boolean, and a lock that could
 * only say one thing would be a lock nobody could read.
 */
export type Way = 'portrait' | 'landscape';

/**
 * What the phone was last asked for, or null before anything has been.
 *
 * Null rather than a way round: the activity comes up sideways on its own now
 * -- `sensorLandscape` in the manifest, the two landscape keys in
 * `Info.plist` -- so seeding this with the answer the game is about to ask
 * for would swallow that ask, and the platform whose native half is not built
 * yet would never hear it.
 */
let held: Way | null = null;

/**
 * Hold the phone this way until told otherwise.
 *
 * The game asks once, at launch, for landscape -- every screen in it is laid
 * out for a short, wide viewport. The guard is still here because the call
 * sits in a screen that re-renders every frame of a run, and an ask that
 * changes nothing is a configuration change on Android.
 *
 * Nothing here is worth a crash. A device whose module is missing (iOS today),
 * one whose activity has gone away under it, and a test with no native code at
 * all all end the same way: the phone turns with the player instead, which is
 * the behaviour the game had before this existed.
 */
export function lock(way: Way) {
  if (way === held) return;
  held = way;
  try {
    NativeOrientation?.lock(way);
  } catch {}
}

/** Whether this platform can be asked at all. False on iOS and in a test. */
export function isAvailable(): boolean {
  return NativeOrientation != null;
}

/** Which way the phone is being held to, or null if it was never asked. */
export function heldWay(): Way | null {
  return held;
}

/** Forgets the last ask, so a test can start from a phone nobody has asked. */
export function reset() {
  held = null;
}
