/**
 * Buzz.
 *
 * React Native's own `Vibration` module rather than a haptics library: the
 * game wants three lengths of nudge, which the built-in API covers on both
 * platforms with no extra dependency and no rebuild. A device with the setting
 * off, or with no motor, simply gets nothing.
 */
import { Platform, Vibration } from 'react-native';
import { getSettings } from '../state/settings';

/**
 * How long each nudge runs, in ms.
 *
 * iOS ignores a duration and always plays its own fixed buzz, so these are
 * really Android's numbers; they are kept short because the game fires them
 * mid-run and a long one would still be going when the next blade arrives.
 */
const LENGTHS = { light: 10, medium: 22, heavy: 45 } as const;

export type Strength = keyof typeof LENGTHS;

export function buzz(strength: Strength = 'light') {
  if (!getSettings().vibrate) return;
  try {
    Vibration.vibrate(LENGTHS[strength]);
  } catch {
    // No motor, or a platform that refuses: nothing to fall back to.
  }
}

/**
 * The death buzz: two beats rather than one long one, so it reads as an event
 * and not as the phone ringing. iOS has no pattern support, so it gets the
 * single heavy nudge instead.
 */
export function death() {
  if (!getSettings().vibrate) return;
  try {
    if (Platform.OS === 'android') Vibration.vibrate([0, 28, 60, 40]);
    else Vibration.vibrate(LENGTHS.heavy);
  } catch {
    // As above.
  }
}

/** Stop anything still running. For teardown and for the settings switch. */
export function cancel() {
  try {
    Vibration.cancel();
  } catch {
    // Nothing was running.
  }
}
