import type { Animated } from 'react-native';

/**
 * How long past an animation's own length its handover is allowed to take
 * before the clock does it instead, in ms.
 */
const GRACE = 400;

/**
 * Play `anim` and hand over exactly once -- on the animation, or on the clock
 * behind it.
 *
 * A screen that fades itself out and then calls the next screen up is the
 * normal way one of these leaves, and `Animated` is not a promise that it ever
 * finishes: interrupted -- by the app being sent to the background halfway
 * through, by the native driver dropping an animation whose view was detached
 * and re-attached -- it can call back with `finished: false`, or never call
 * back at all. Whatever it was about to hand over to then never happens, and
 * the player is left on a screen whose buttons all do nothing, with no way out
 * but killing the app.
 *
 * So the fade is a courtesy and the clock is the contract. `ms` is the
 * animation's own duration; the handover happens a little past it either way,
 * and only once.
 *
 * Returns the call that stands the clock down, for a caller that unmounts
 * before either has fired.
 */
export function playThen(anim: Animated.CompositeAnimation, ms: number, done: () => void) {
  let handed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const hand = () => {
    if (handed) return;
    handed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    done();
  };

  timer = setTimeout(hand, ms + GRACE);
  anim.start(hand);
  return () => {
    handed = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
