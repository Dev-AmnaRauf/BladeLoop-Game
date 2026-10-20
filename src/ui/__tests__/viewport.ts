/**
 * The window every UI suite renders into.
 *
 * The game is locked to landscape on every screen -- `sensorLandscape` in the
 * manifest, the two landscape keys in `Info.plist`, and one ask at launch
 * through `services/Orientation`. So a suite that rendered a page into the
 * tall narrow window Jest hands it by default would be looking at a layout
 * that no device will ever draw: the pages read their own shape and lay
 * themselves out across the screen rather than down it. See `ui/layout`.
 *
 * There are two halves to saying that, and a suite needs both. `METRICS` is
 * the safe area, which `SafeAreaProvider` takes as `initialMetrics`; `land()`
 * is the window itself, which `useWindowDimensions` reads off `Dimensions`
 * and which nothing about the provider touches.
 */
import { Dimensions } from 'react-native';

/** A phone held sideways, in dp: the shape the game actually ships in. */
export const WIDE = { width: 844, height: 390 };

/**
 * The safe area that goes with it.
 *
 * Held sideways the cutout, the curve of the corners and the gesture bar are
 * all down the *sides* of the screen rather than across the top and bottom,
 * which is the opposite of what a portrait app sees and exactly where a page
 * pins its back button and its corner controls.
 */
export const METRICS = {
  frame: { x: 0, y: 0, ...WIDE },
  insets: { top: 0, left: 47, right: 34, bottom: 0 },
};

/** What Jest hands a suite before anything says otherwise: a tall window. */
const TALL = Dimensions.get('window');

/**
 * Put the window sideways for this test.
 *
 * `Dimensions` is module state and survives between suites in a worker, so
 * this is paired with `upright()` in a teardown rather than left standing.
 */
export function land(size: { width: number; height: number } = WIDE) {
  const d = { ...size, scale: 3, fontScale: 1 };
  Dimensions.set({ window: d, screen: d });
}

/** Put it back the way it was found. */
export function upright() {
  Dimensions.set({ window: TALL, screen: TALL });
}
