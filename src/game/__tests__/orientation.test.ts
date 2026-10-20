/**
 * The shape of the window the run is drawn into.
 *
 * The game is locked to landscape (`sensorLandscape`, and the two landscape
 * keys in `Info.plist`) and the corridor is flown across it: the screen's
 * short side holds the corridor and its two walls, and its long side is how
 * much of the run is on screen. The tall shapes below are still reachable -- a
 * tablet, split screen, a freeform window -- and a flip end for end goes
 * through the same path.
 *
 * Whichever it is, it is a resize and nothing else: the activity is not
 * restarted, so the world in `worldRef` is the same object at the new size,
 * and the only thing the new shape may touch is `pace`. These pin that -- that
 * a level is the same level in a window of any shape, that the corridor and
 * the ball both fit the viewport they are drawn into, and that a drag is worth
 * the same share of the run whatever the shape is.
 */
import {
  AUTHOR_HALF_W,
  CAM_ANCHOR,
  CLIMB,
  DESIGN_LOOK,
  DRAG_BAND,
  DRAG_GAIN,
  FIXED_DT,
  HALF_W,
  SPREAD,
  VIEW_SPAN,
  WALL_PAD,
  lookahead,
  paceFor,
  viewScale,
} from '../config';
import { climbAt, createWorld, step, steerBy } from '../engine';
import type { World } from '../types';

/**
 * Real landscape windows, in dp, as `useWindowDimensions` reports them: a
 * small 16:9 phone, the 19.5:9 and 20:9 shapes most phones sold now are, a big
 * phone, a 4:3 tablet and an unfolded foldable.
 */
const WINDOWS: [number, number][] = [
  [568, 320],
  [640, 360],
  [780, 360],
  [800, 360],
  [915, 412],
  [956, 440],
  [1024, 768],
  [1104, 884],
];

function run(w: World, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) step(w, FIXED_DT);
}

/** What the screen does every frame: read the shape, hand it to the world. */
function hold(w: World, screenW: number, screenH: number) {
  w.pace = paceFor(screenW, screenH);
}

describe('the run on a screen of any shape', () => {
  it('is never outside the band the pace clamp promises', () => {
    for (const [w, h] of WINDOWS) {
      expect(paceFor(w, h)).toBeGreaterThanOrEqual(0.9);
      expect(paceFor(w, h)).toBeLessThanOrEqual(1.15);
    }
  });

  it('never runs faster on the screen that shows less of what is coming', () => {
    const sorted = [...WINDOWS].sort((a, b) => lookahead(...a) - lookahead(...b));
    for (let i = 1; i < sorted.length; i++) {
      expect(paceFor(...sorted[i])).toBeGreaterThanOrEqual(paceFor(...sorted[i - 1]) - 1e-9);
    }
  });

  it('runs faster held sideways than held upright, on the same phone', () => {
    // 412 x 915: the shape most phones sold now are. This is the whole reason
    // the game is locked sideways, and it is the opposite of what the same
    // test asked while the run was flown down the screen: the long side is now
    // the warning, so holding the phone the long way round is what buys the
    // player the corridor the levels were authored against.
    const w = createWorld();
    hold(w, 915, 412);
    const sideways = climbAt(w, w.ball.y);
    hold(w, 412, 915);
    const upright = climbAt(w, w.ball.y);
    expect(sideways).toBeGreaterThan(upright);
    // But not by the whole of the difference: the floor under `paceFor` is
    // there so a window that shows little still runs at a pace worth playing.
    expect(upright / sideways).toBeGreaterThan(0.85);
  });

  it('leaves the corridor exactly as it was', () => {
    // The level is authored in world px. A turn changes how much of it is on
    // screen and must not change a single thing that is in it.
    const upright = createWorld(4);
    const sideways = createWorld(4);
    hold(upright, 412, 915);
    hold(sideways, 915, 412);
    expect(sideways.props.length).toBe(upright.props.length);
    for (let i = 0; i < upright.props.length; i++) {
      expect(sideways.props[i].x).toBe(upright.props[i].x);
      expect(sideways.props[i].y).toBe(upright.props[i].y);
      expect(sideways.props[i].kind).toBe(upright.props[i].kind);
    }
  });

  it('keeps the run going across a turn taken part way down it', () => {
    const w = createWorld();
    // An untouched ball rides the floor, and these are about the turn, not it.
    w.spikes = false;
    hold(w, 915, 412);
    run(w, 6);
    const was = { x: w.ball.x, y: w.ball.y, camY: w.camY, score: w.score };
    hold(w, 412, 915);
    expect(w.ball.x).toBe(was.x);
    expect(w.ball.y).toBe(was.y);
    expect(w.camY).toBe(was.camY);
    expect(w.score).toBe(was.score);
    expect(w.status).toBe('playing');
  });

  it('carries the run on from where it was, at the new pace', () => {
    const w = createWorld();
    // An untouched ball rides the floor, and these are about the turn, not it.
    w.spikes = false;
    hold(w, 915, 412);
    run(w, 6);
    const at = w.camY;
    hold(w, 412, 915);
    run(w, 1);
    // A second of corridor at the upright pace, and the ball still flying.
    expect(w.camY - at).toBeCloseTo(CLIMB * paceFor(412, 915) * w.speed, 0);
  });
});

describe('the corridor across the window it is drawn into', () => {
  // What `GameView` draws into: the corridor and its walls are fitted to the
  // screen's short side, so the viewport across the corridor is that side with
  // the scale divided back out -- which is `VIEW_SPAN` wherever the scale is
  // not clamped, and more than it where it is.
  const crossW = (h: number) => h / viewScale(h);
  const share = (h: number) => (2 * HALF_W) / crossW(h);
  /** The water outside one wall, in world px: what `Walls` has to draw in. */
  const band = (h: number) => (crossW(h) - 2 * HALF_W) / 2;

  it('never draws a wall off the edge of the screen', () => {
    // The failure this pins is silent and total: a corridor taller than the
    // window is one whose walls, and the lines and launchers bolted to them,
    // are off the glass -- the player flies into hazards they cannot see and
    // the run is unplayable on exactly the phone it was drawn for.
    for (const [, h] of WINDOWS) {
      expect(band(h)).toBeGreaterThanOrEqual(WALL_PAD - 1e-9);
      expect(share(h)).toBeLessThan(0.95);
    }
  });

  it('fills the short side with the corridor rather than with water', () => {
    // The corridor is the picture now. It used to be a third of a sideways
    // window with bands of water either side, because the run was flown down
    // the screen and the width had nothing else to do; the run is flown across
    // instead, so the width is the warning and the corridor gets the height.
    // On a phone it is fitted exactly, walls and all -- `viewScale` is not
    // clamped anywhere in that range, so the corridor is the screen.
    for (const [, h] of WINDOWS.filter(([, y]) => y <= 440)) {
      expect(crossW(h)).toBeCloseTo(VIEW_SPAN, 6);
      expect(share(h)).toBeGreaterThan(0.9);
    }
    // A tablet is the one shape that keeps a real band of water, because the
    // scale ceiling stops there: blown up any further the corridor would fill
    // the height by spending the warning, and the warning is what the long
    // side is for.
    expect(share(884)).toBeGreaterThan(0.55);
  });

  it('spends the long side on what is coming', () => {
    // The other half of the bargain. A phone held sideways shows very nearly
    // the run the levels were authored against, which is what makes the same
    // hurdle readable at the same distance it always was.
    for (const [w, h] of WINDOWS) {
      expect(lookahead(w, h)).toBeGreaterThan(0.8 * DESIGN_LOOK);
    }
    expect(lookahead(800, 360)).toBeGreaterThan(DESIGN_LOOK * 0.99);
  });

  it('is flown at the width the stages were authored at', () => {
    // `SPREAD` was 2 for a while, which spent the width a landscape window
    // buys but loosened every hurdle that turns: a hexagon, a ring or a
    // tumbling frame cannot be stretched along one axis, so each of them
    // blocked half the share of a doubled corridor. The column is the tuned
    // one, and anything that quietly widens it again fails here rather than
    // twenty levels into a playtest.
    expect(SPREAD).toBe(1);
    expect(HALF_W).toBe(AUTHOR_HALF_W);
  });

  it('is the same corridor whatever the window is', () => {
    // It is a world measurement and nothing reads the screen to arrive at it.
    // The share above changes with the window; the corridor itself must not,
    // or two players on two phones are flying two different levels.
    expect(HALF_W).toBe(AUTHOR_HALF_W * SPREAD);
    expect(new Set(WINDOWS.map(() => HALF_W)).size).toBe(1);
  });
});

describe('the ball inside the viewport it is drawn into', () => {
  it('flies between the two walls and nowhere else', () => {
    // The corridor is the whole of the room on this axis, and it is fitted to
    // the screen -- so a ball that is inside the corridor is on the glass, on
    // every shape, with no second band to keep in step with.
    for (const [, h] of WINDOWS) {
      expect(2 * HALF_W * viewScale(h)).toBeLessThanOrEqual(h + 1e-9);
    }
  });

  it('can never be dragged off the front of the screen, however narrow it is', () => {
    // `CAM_ANCHOR` is where the camera line sits along the viewport and the
    // drag carries the ball `DRAG_BAND` either side of it.
    for (const [w, h] of WINDOWS) {
      expect((1 - CAM_ANCHOR) * lookahead(w, h)).toBeGreaterThan(DRAG_BAND);
    }
  });

  it('can never be dragged off the back of it either', () => {
    for (const [w, h] of WINDOWS) {
      expect(CAM_ANCHOR * lookahead(w, h)).toBeGreaterThan(DRAG_BAND);
    }
  });
});

describe('a drag', () => {
  it('is worth the same share of the run on a screen of any shape', () => {
    // What `GameScreen` does with a finger's travel: divide the view scale out
    // before it reaches the world, so a px of finger is not a px of world.
    const travel = (w: World, screenPx: number, screenH: number) => {
      const before = w.ball.lead;
      steerBy(w, (screenPx * DRAG_GAIN) / viewScale(screenH));
      return w.ball.lead - before;
    };

    for (const [, h] of WINDOWS) {
      const w = createWorld();
      // A drag of a tenth of the design run, on this screen's own scale. Kept
      // under `DRAG_BAND` on purpose: what is under test is the conversion,
      // and a travel that clamped would be testing the clamp instead.
      const want = 0.1 * DESIGN_LOOK;
      const finger = want * viewScale(h);
      expect(travel(w, finger, h)).toBeCloseTo(want, 6);
    }
  });

  it('holds the ball inside its band whichever way the phone is held', () => {
    for (const [, h] of WINDOWS) {
      const w = createWorld();
      steerBy(w, (9999 * DRAG_GAIN) / viewScale(h));
      expect(w.ball.lead).toBeCloseTo(DRAG_BAND, 6);
    }
  });
});
