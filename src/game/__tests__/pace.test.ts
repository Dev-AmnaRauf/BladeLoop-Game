import {
  BALL_DRIFT,
  CEIL_X,
  CLIMB,
  DRAG_BAND,
  FIXED_DT,
  FLOOR_X,
  RESPAWN_BACKUP,
  RESPAWN_CLEAR,
  SPEED_MAX,
} from '../config';
import {
  climbAt,
  createWorld,
  paceAt,
  hitAt,
  respawnDepth,
  respawnX,
  restartFromDeath,
  step,
} from '../engine';
import type { Prop, World } from '../types';

/** A hazard parked at a point, with no motion of its own to reason about. */
function hazard(x: number, y: number): Prop {
  return {
    id: 1,
    kind: 'turret',
    x,
    y,
    span: 0,
    radius: 0,
    reach: 0,
    angle: 0,
    spin: 0,
    rate: 0,
    sway: 0,
    phase: 0,
    side: 1,
    ring: 0,
    bob: 0,
    size: 40,
    count: 0,
    taken: false,
    cooldown: 999,
  };
}

function run(w: World, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) step(w, FIXED_DT);
}

describe('the descent', () => {
  it('starts and finishes at the same pace, quicker through the middle', () => {
    const w = createWorld();
    const span = w.finishY - w.startY;
    expect(paceAt(w, w.startY)).toBeCloseTo(1, 6);
    expect(paceAt(w, w.finishY)).toBeCloseTo(1, 6);
    expect(paceAt(w, w.startY + span * 0.5)).toBeCloseTo(SPEED_MAX, 6);
    // Rising through the opening and falling through the close, never past the top.
    let peak = 0;
    for (let i = 0; i <= 100; i++) peak = Math.max(peak, paceAt(w, w.startY + (span * i) / 100));
    expect(peak).toBeCloseTo(SPEED_MAX, 6);
    expect(paceAt(w, w.startY + span * 0.25)).toBeGreaterThan(1);
    expect(paceAt(w, w.startY + span * 0.8)).toBeGreaterThan(1);
  });

  it('covers the same ground at the finish as at the start', () => {
    const first = createWorld();
    first.pace = 1;
    // Nothing to fly into in either world: this is about the rate, not the run.
    first.props = [];
    const fromTop = (() => {
      const y0 = first.ball.y;
      run(first, 2);
      return first.ball.y - y0;
    })();

    const later = createWorld();
    later.pace = 1;
    later.props = [];
    // Set down near the dish, where the hump has come back to the opening pace.
    later.ball.y = later.finishY - 600;
    later.camY = later.ball.y;
    const y0 = later.ball.y;
    run(later, 2);
    expect(later.ball.y - y0).toBeCloseTo(fromTop, 3);
  });

  it('runs a third quicker through the middle of the level', () => {
    const w = createWorld();
    w.pace = 1;
    w.props = [];
    w.spikes = false;
    w.ball.y = (w.startY + w.finishY) / 2;
    w.camY = w.ball.y;
    // Long enough for the ease to reach the hump.
    run(w, 10);
    expect(climbAt(w, w.ball.y)).toBeCloseTo(CLIMB * SPEED_MAX, 3);
  });

  it('never runs past the top of the hump', () => {
    const w = createWorld();
    w.pace = 1;
    w.props = [];
    let top = 0;
    for (let i = 0; i < 400 / FIXED_DT && w.status === 'playing'; i++) {
      step(w, FIXED_DT);
      top = Math.max(top, w.speed);
    }
    expect(top).toBeLessThanOrEqual(SPEED_MAX + 1e-9);
  });

  it('does not wind the corridor on behind a card', () => {
    const w = createWorld();
    w.pace = 1;
    w.props = [];
    run(w, 10);
    const held = w.speed;
    const at = w.ball.y;
    w.status = 'dead';
    run(w, 30);
    expect(w.speed).toBe(held);
    expect(w.ball.y).toBe(at);
  });

  it('advances by the step it is handed, not by the clock', () => {
    // Two worlds given the same number of fixed steps land in the same place,
    // however the frames those steps arrived in were chunked. This is what
    // keeps a phone dropping frames from running the level in slow motion.
    const smooth = createWorld();
    smooth.props = [];
    smooth.pace = 1;
    for (let i = 0; i < 120; i++) step(smooth, FIXED_DT);

    const stuttering = createWorld();
    stuttering.props = [];
    stuttering.pace = 1;
    // The same 120 steps, arriving in ragged frames: some on time, some late
    // enough to have to catch up on three at once.
    let left = 120;
    for (let frame = 0; left > 0; frame++) {
      const steps = Math.min(left, [1, 3, 2, 1, 3][frame % 5]);
      for (let i = 0; i < steps; i++) step(stuttering, FIXED_DT);
      left -= steps;
    }
    expect(stuttering.ball.y).toBeCloseTo(smooth.ball.y, 6);
  });
});

describe('picking a failed run back up', () => {
  /**
   * The level these are flown down.
   *
   * Any level would do for a respawn, but not for a *crash*: level one is
   * short and wide enough that a ball held still rides it all the way to the
   * dish without ever meeting anything. Level two has hexagons and rods across
   * the middle, so a ball flown down the middle does meet one.
   *
   * It meets one a good deal further down than it used to, because a level no
   * longer opens on its own window: the first fifth of the descent is the
   * corridor behind it -- level one's, here -- which is exactly the stretch a
   * wall-hugger survives. So the crash is flown with two minutes of budget
   * rather than one, which clears the longest opening any level has.
   */
  const CRASH_LEVEL = 2;

  /** Fly the ball into the first thing that will have it. */
  function crash(w: World) {
    for (let i = 0; i < 60 * 120 && w.status === 'playing'; i++) {
      // Hold the middle: the wall lane past the hexagons has been widened so a
      // wall-hugger rides through it, but the middle is where the level's
      // shapes are, so this finds one soon enough without steering.
      w.ball.x = 0;
      w.ball.fly = 0;
      step(w, FIXED_DT);
    }
    expect(w.status).toBe('dead');
  }

  it('starts again from where the run ended, not from the top', () => {
    const w = createWorld(CRASH_LEVEL);
    w.pace = 1;
    crash(w);
    const diedAt = w.ball.y;

    restartFromDeath(w);
    expect(w.status).toBe('playing');
    // Just far enough back up the corridor to see what ended the run coming.
    expect(w.ball.y).toBeCloseTo(diedAt - RESPAWN_BACKUP, 6);
    expect(w.ball.y).toBeGreaterThan(w.startY);
  });

  it('puts the ball down in a lane that stays clear the whole way', () => {
    const w = createWorld(CRASH_LEVEL);
    w.pace = 1;
    crash(w);
    restartFromDeath(w);

    const x = w.ball.x;
    const y = w.ball.y;
    // Nobody has touched the screen yet, so it takes the line a ball nobody
    // taps takes: the scroll, plus the sink it makes down to its band floor.
    for (let t = 0; t <= RESPAWN_CLEAR; t += 0.05) {
      expect(hitAt(w, w.t + t, x, respawnDepth(w, y, t))).toBeNull();
    }
  });

  it('leaves a respawned ball solid, with nothing passing through it', () => {
    const w = createWorld(CRASH_LEVEL);
    w.pace = 1;
    crash(w);
    restartFromDeath(w);
    expect(w.status).toBe('playing');

    // A hazard sitting exactly where the ball was put back. A respawn used to
    // buy a couple of seconds of immunity, in which this did nothing at all
    // and the ball sailed straight through it.
    w.props = [hazard(w.ball.x, w.ball.y)];
    step(w, FIXED_DT);
    expect(w.status).toBe('dead');
  });

  it('agrees with the lane the picker chose', () => {
    const w = createWorld(CRASH_LEVEL);
    w.pace = 1;
    crash(w);
    const y = Math.max(w.startY, w.ball.y - RESPAWN_BACKUP);
    const want = respawnX(w, y);
    restartFromDeath(w);
    expect(w.ball.x).toBeCloseTo(want, 6);
    // The flown line has to agree with it, or the first frame would snap the
    // ball back to wherever it was before the crash.
    expect(w.ball.fly).toBeCloseTo(want, 6);
  });
});

describe('what the camera keeps on screen', () => {
  /**
   * Slack on the band edges, in px.
   *
   * The band is enforced by writing `camY + lead` straight into the ball, so
   * the ball is exactly on the edge -- but reading that back out as
   * `ball.y - camY` is a subtraction of two numbers thousands of px from the
   * origin, and at the depths a run reaches it comes back a hundredth of a
   * billionth over. That is the double, not the band.
   */
  const EPS = 1e-9;

  /** How far along the run the ball sits from its anchor, in px. */
  function drift(w: World) {
    return w.ball.y - w.camY;
  }

  it('holds the ball inside its band through an ordinary run', () => {
    const w = createWorld();
    w.pace = 1;
    w.props = [];
    for (let i = 0; i < 600; i++) {
      step(w, FIXED_DT);
      expect(Math.abs(drift(w))).toBeLessThanOrEqual(DRAG_BAND + EPS);
      // And the other axis is held by the corridor itself, which is the whole
      // of the room the ball flies in now.
      expect(w.ball.x).toBeGreaterThanOrEqual(FLOOR_X - EPS);
      expect(w.ball.x).toBeLessThanOrEqual(CEIL_X + EPS);
    }
  });

  it('hauls a ball set down outside the band straight back into it', () => {
    // Nothing in the run does this while it is still being played -- a respawn
    // moves the camera with the ball -- but the band is what makes that safe,
    // and it has to hold on the very first step rather than over several.
    for (const jump of [4000, -4000]) {
      const w = createWorld();
      w.pace = 1;
      w.props = [];
      w.ball.y += jump;
      step(w, FIXED_DT);
      expect(Math.abs(drift(w))).toBeLessThanOrEqual(DRAG_BAND + EPS);
    }
  });

  it('caps the drift when a finished run is set down somewhere else', () => {
    // The finish plate does exactly this: it puts the ball on the plate rather
    // than letting it fall there, and ends the run in the same breath. The
    // band no longer applies once the run is over, so the camera goes back to
    // chasing the ball, and `BALL_DRIFT` is the ceiling on how far it may lag.
    for (const jump of [4000, -4000]) {
      const w = createWorld();
      w.pace = 1;
      w.props = [];
      w.status = 'finished';
      w.ball.y += jump;
      for (let i = 0; i < 240; i++) {
        step(w, FIXED_DT);
        expect(Math.abs(drift(w))).toBeLessThanOrEqual(BALL_DRIFT + EPS);
      }
    }
  });
});
