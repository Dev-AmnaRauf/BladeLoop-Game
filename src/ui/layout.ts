import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clamp } from '../game/config';

/**
 * How the pages measure the window they are drawn into.
 *
 * The game is sideways throughout -- `sensorLandscape` on Android, the two
 * landscape keys in `Info.plist`, and one ask at launch through
 * `services/Orientation`. That settles the *shape* of every page in it: short
 * and wide, rather than the tall narrow one a phone hands an app by default.
 *
 * Two things follow, and this module is both of them.
 *
 * The first is that height is the scarce axis and width is the plentiful one.
 * A page that stacks its parts down the screen -- a logo, a character, a
 * column of buttons -- is stacking them into 360dp instead of 844, which does
 * not fit at any type size worth reading. So the pages lay those parts out
 * *across* instead, and `tight` is what tells them to.
 *
 * The second is that a plentiful axis is not a licence to use all of it. A row
 * of text run across 900dp is unreadable, and a button stretched to the same
 * width reads as a banner. `col` is the widest a column of content is allowed
 * to get, and the pages centre themselves in it.
 *
 * `ui` is the third, smaller thing: a mild scale on the decorative furniture
 * -- the wordmark, the orbit of blades, the character -- so a small phone held
 * sideways does not have the same absolute pixels crammed into less room, and
 * a tablet does not draw a phone's page in the middle of a large screen. It is
 * deliberately gentle and deliberately clamped. Type, hit targets and the
 * spacing between rows are *not* scaled by it: a 44dp tap target is 44dp on
 * every device, and shrinking body text to win back vertical space is how a
 * page ends up unreadable on exactly the phone that could least afford it.
 */

/**
 * The short axis the pages are drawn against, in dp.
 *
 * A modern phone held sideways: 360 is what a 1080x2400 screen at 3x comes to
 * across its short side, which is the commonest shape this game will run on.
 * It is the height at which `ui` is exactly 1 and the pages are drawn at the
 * sizes their styles actually spell.
 */
export const PAGE_H = 360;

/**
 * The widest a column of content may get, in dp.
 *
 * Wide enough for a leaderboard row with a name, a place and a score on it,
 * and narrow enough that a line of text in it is still a line rather than a
 * paragraph laid end to end.
 */
export const COL_MAX = 520;

/** Side margin a page keeps off the edge of the screen, before any inset. */
export const GUTTER = 16;

/**
 * Below this height a page lays itself out across the screen rather than down
 * it, in dp.
 *
 * It is the tallest of the stacked pages measured, not a round number. The
 * front page is the tall one: the corner band it must clear (64), the
 * wordmark and its ribbon (175), the orbit of blades (190) and the column of
 * pills (154). The first three scale with `ui`, which is at its ceiling of
 * 1.25 on anything this tall, so the stack comes to about 674dp -- plus a
 * tablet's top inset, which is where the rest of the headroom goes.
 *
 * Picking this too low is the failure mode that matters, and it is a silent
 * one: a window of, say, 600dp would keep the stacked layout, draw it at the
 * full 1.25 scale, and run its last button off the bottom of the screen with
 * nothing to scroll. Every phone held sideways (320-440) is well under this;
 * every tablet and unfolded foldable is over it.
 */
export const TIGHT_H = 720;

/** The gentle scale on decorative furniture. See the module comment. */
export function uiScale(h: number) {
  return clamp(h / PAGE_H, 0.82, 1.25);
}

export interface Layout {
  /** The window, in dp. */
  w: number;
  h: number;
  /**
   * The safe area, in dp.
   *
   * `left` and `right` are the ones that matter here and the ones a portrait
   * app never sees: held sideways it is the cutout, the curve of the corners
   * and the gesture bar that move to the sides, and they are exactly where a
   * page pins its back button and its corner controls.
   */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Side margin including the inset on that side: what a page pads by. */
  gutL: number;
  gutR: number;
  /** Scale for decorative furniture, 1 at `PAGE_H`. Never for type. */
  ui: number;
  /** True on a phone held sideways: lay out across, not down. */
  tight: boolean;
  /** Width of the centred column a page's content sits in. */
  col: number;
}

/**
 * Read the window, once, for a page to lay itself out against.
 *
 * `useWindowDimensions` re-renders on a resize, and a resize is what a flip
 * end for end is now that the activity is never recreated -- so a page that
 * reads its shape through this follows the phone without anything else having
 * to tell it to.
 */
export function useLayout(): Layout {
  const { width: w, height: h } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const gutL = GUTTER + insets.left;
  const gutR = GUTTER + insets.right;
  return {
    w,
    h,
    top: insets.top,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
    gutL,
    gutR,
    ui: uiScale(h),
    tight: h < TIGHT_H,
    col: Math.min(COL_MAX, Math.max(0, w - gutL - gutR)),
  };
}
