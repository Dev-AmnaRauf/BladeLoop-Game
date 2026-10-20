import { NativeModules } from 'react-native';

/**
 * Which way up the phone is held, asked for rather than followed.
 *
 * The game is read upright and played sideways, and no manifest attribute or
 * `Info.plist` key can say that: both are fixed for the life of the activity,
 * and this app wants one answer on the front page and another in a run. So the
 * turn is asked for at the two moments it belongs to -- see
 * `src/services/Orientation.ts`, which is the only thing that should call this.
 *
 * A plain `NativeModules` lookup, deliberately. This app is bridgeless, but
 * the JS side of it has no `global.__turboModuleProxy` -- measured on the
 * device -- so a module registered as a TurboModule is invisible from here and
 * `TurboModuleRegistry.get` finds nothing. Everything JS can actually reach
 * comes through the interop's `nativeModuleProxy`, which is what this reads,
 * and `OrientationPackage` registers the Android half as a legacy module to
 * match. See `android/app/src/main/java/com/bladeloop/game/OrientationModule.kt`.
 *
 * Undefined rather than absent on a platform that has not implemented it (iOS
 * today) and in a test, and the service treats that as a phone that does not
 * turn.
 */
export interface Orientation {
  /** `'portrait'` or `'landscape'`; anything else hands the phone back. */
  lock(mode: string): void;
}

const NativeOrientation: Orientation | undefined = (
  NativeModules as { NativeOrientation?: Orientation }
).NativeOrientation;

export default NativeOrientation;
