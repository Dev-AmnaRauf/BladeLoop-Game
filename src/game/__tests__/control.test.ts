import {
  CEIL_X,
  CLIMB,
  DRAG_BAND,
  FALL_G,
  FLOOR_X,
  LIFT,
  LEAN_BLEED,
  LEAN_MAX,
  SINK_MAX,
  WIND_MAX,
} from '../config';
import { createWorld, lift, steerBy, step } from '../engine';
import type { Prop, World } from '../types';

/** A world with the level stripped out, so only the controls are under test. */
function bare() {
  const w = createWorld();
  w.pace = 1;
  w.props = [];
  // The floor's spikes have tests of their own; these leave the ball resting
  // on the floor for seconds at a time.
  w.spikes = false;
  return w;
}

function run(w: World, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w, 1 / 60);
}

/** How far ahead of the camera the drag has the ball. */
function lead(w: World) {
  return w.ball.y - w.camY;
}

/** A wind band sitting on the ball, blowing toward the ceiling. */
function gust(w: World): Prop {
  return {
    id: 1,
    kind: 'wind',
    x: 0,
    y: w.ball.y - 20,
    span: 4000,
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
    size: 400,
    count: 0,
    taken: false,
    cooldown: 0,
  };
}

describe('drag to nudge', () => {
  it('moves the ball by however far the finger travelled', () => {
    const ahead = bare();
    steerBy(ahead, 40);
    step(ahead, 1 / 60);
    expect(lead(ahead)).toBeCloseTo(40, 6);

    const behind = bare();
    steerBy(behind, -40);
    step(behind, 1 / 60);
    expect(lead(behind)).toBeCloseTo(-40, 6);
  });

  it('never puts the ball where a touch merely landed', () => {
    const w = bare();
    // A finger that lands and does not move reports no travel, and the ball
    // does not budge. This is the whole reason the drag is a delta: every
    // touch is also a tap, and a tap must never throw the ball along the run
    // to meet the thumb that jumped it.
    steerBy(w, 0);
    run(w, 0.5);
    expect(lead(w)).toBeCloseTo(0, 6);
  });

  it('adds travel up rather than jumping to any one reading', () => {
    const w = bare();
    for (let i = 0; i < 10; i++) steerBy(w, 6);
    step(w, 1 / 60);
    expect(lead(w)).toBeCloseTo(60, 6);
  });

  it('stops on the frame the finger does, with no coast past it', () => {
    const w = bare();
    steerBy(w, 70);
    step(w, 1 / 60);
    const parked = lead(w);

    // The finger stopping is the player saying "here", so the ball is left
    // exactly there -- not a few px further along the run.
    run(w, 2);
    expect(lead(w)).toBeCloseTo(parked, 6);
  });

  it('holds the ball inside the band however far it is dragged', () => {
    const w = bare();
    steerBy(w, 10000);
    step(w, 1 / 60);
    expect(lead(w)).toBeCloseTo(DRAG_BAND, 6);

    // Travel pushed into the end of the band is thrown away rather than
    // banked, so dragging back answers on the first px instead of spending
    // the overshoot.
    steerBy(w, -10);
    step(w, 1 / 60);
    expect(lead(w)).toBeCloseTo(DRAG_BAND - 10, 6);

    steerBy(w, -10000);
    step(w, 1 / 60);
    expect(lead(w)).toBeCloseTo(-DRAG_BAND, 6);
  });

  it('leaves the ball riding the camera when nobody drags anything', () => {
    const w = bare();
    const startY = w.ball.y;
    run(w, 1);
    expect(w.ball.y).toBeGreaterThan(startY);
    expect(lead(w)).toBeCloseTo(0, 6);
  });

  it('ignores a drag once the run is over', () => {
    const w = bare();
    steerBy(w, 40);
    step(w, 1 / 60);
    // Read off the ball itself rather than off its lead: once the run is over
    // the camera eases toward the ball, so the gap between them closes whether
    // or not anything moved the ball.
    const parked = w.ball.y;
    w.status = 'dead';
    steerBy(w, -80);
    run(w, 1);
    expect(w.ball.y).toBeCloseTo(parked, 6);
  });

  it('leans into the travel, and comes back upright once the finger stops', () => {
    const w = bare();
    // `lean` is a reading of the drag for the drawing to lean on, never a
    // speed the ball is flying at -- so it is capped, and it bleeds away on
    // its own.
    steerBy(w, 70);
    expect(w.ball.lean).toBeCloseTo(LEAN_MAX, 6);

    step(w, 1 / 60);
    expect(w.ball.lean).toBeCloseTo(LEAN_MAX - LEAN_BLEED / 60, 6);

    const leaning = lead(w);
    run(w, 0.4);
    expect(w.ball.lean).toBe(0);
    // ...and bleeding it off moved the ball not one px.
    expect(lead(w)).toBeCloseTo(leaning, 6);
  });

  it('drags and flies at once, without either fighting the other', () => {
    const w = bare();
    run(w, 1);
    const rested = w.ball.x;

    steerBy(w, 50);
    lift(w);
    run(w, 0.2);
    expect(w.ball.x).toBeGreaterThan(rested);
    expect(lead(w)).toBeCloseTo(50, 6);
  });
});

describe('wind', () => {
  // Every one of these is read against a calm world flown for the same time,
  // because the gust now blows along the axis the ball falls down: the shove
  // is the gap between the two balls, and nothing else in the frame is.
  it('shoves the ball off its line, up to a limit', () => {
    const windy = bare();
    windy.props = [gust(windy)];
    const calm = bare();
    run(windy, 0.25);
    run(calm, 0.25);
    const early = windy.ball.x - calm.ball.x;
    expect(early).toBeGreaterThan(0);

    // It builds, then holds: wind moves the ball aside, it does not launch it.
    run(windy, 4);
    run(calm, 4);
    const late = windy.ball.x - calm.ball.x;
    expect(late).toBeGreaterThan(early);
    expect(late).toBeLessThanOrEqual(WIND_MAX + 1e-6);
  });

  it('can be answered by flying against it', () => {
    const w = bare();
    w.props = [gust(w)];
    run(w, 4);
    const shoved = w.ball.x;

    // The gust holds the ball off the floor; taps still climb from there, so
    // it is a shove the player flies against rather than a place they are put.
    for (let i = 0; i < 20; i++) {
      lift(w);
      step(w, 1 / 60);
    }
    expect(w.ball.x).toBeGreaterThan(shoved);
  });

  it('lets the ball go once it is clear of the band', () => {
    const w = bare();
    w.props = [gust(w)];
    run(w, 4);
    expect(w.ball.x).toBeGreaterThan(FLOOR_X);

    w.props = [];
    run(w, 2);
    expect(w.windPush).toBeCloseTo(0, 6);
    expect(w.ball.x).toBeCloseTo(FLOOR_X, 6);
  });

  it('is never carried out of the band as momentum', () => {
    const w = bare();
    w.props = [gust(w)];
    run(w, 4);
    // The shove is an offset laid over the flight, not part of it, so the ball
    // itself has no speed across the corridor to take with it.
    expect(w.ball.vx).toBe(0);
    expect(w.ball.fly).toBeCloseTo(FLOOR_X, 6);
  });
});

describe('tap to fly', () => {
  it('sinks to the floor when nobody taps', () => {
    const w = bare();
    run(w, 1);
    expect(w.ball.x).toBeCloseTo(FLOOR_X, 6);
  });

  it('throws the ball up the screen on a tap', () => {
    const w = bare();
    run(w, 1);
    const rested = w.ball.x;
    lift(w);
    run(w, 0.2);
    expect(w.ball.x).toBeGreaterThan(rested);
  });

  it('climbs higher the more the finger taps', () => {
    const one = bare();
    const many = bare();
    run(one, 1);
    run(many, 1);

    lift(one);
    run(one, 0.5);

    // Five taps across the same half second: each one lands on top of the last.
    for (let i = 0; i < 5; i++) {
      lift(many);
      run(many, 0.1);
    }

    expect(many.ball.x).toBeGreaterThan(one.ball.x);
  });

  it('falls back down as soon as the tapping stops', () => {
    const w = bare();
    for (let i = 0; i < 8; i++) {
      lift(w);
      run(w, 0.1);
    }
    const high = w.ball.x;
    run(w, 1);
    expect(w.ball.x).toBeLessThan(high);
  });

  it('never leaves the corridor, however hard it is tapped', () => {
    const w = bare();
    for (let i = 0; i < 200; i++) {
      lift(w);
      step(w, 1 / 60);
    }
    expect(w.ball.x).toBeCloseTo(CEIL_X, 6);

    run(w, 4);
    expect(w.ball.x).toBeCloseTo(FLOOR_X, 6);
  });

  it('answers a tap taken at full fall speed', () => {
    const w = bare();
    run(w, 2);
    expect(w.ball.vx).toBe(0); // resting on the floor
    // A tap out of a long drop throws the fall away rather than fighting it.
    w.ball.vx = -SINK_MAX;
    lift(w);
    expect(w.ball.vx).toBe(LIFT);
  });

  it('leaves the run itself alone, so the pacing is unchanged', () => {
    const w = bare();
    const startY = w.ball.y;
    const startCam = w.camY;
    run(w, 10);
    // The fall is across the corridor now, so it costs the ball nothing along
    // it: an untouched ball rides the scroll exactly.
    expect(w.ball.y - startY).toBeCloseTo(w.camY - startCam, 6);
    // And that scroll is the level's opening pace plus the sliver of creep ten
    // seconds of flying has bought -- a per cent or so of it, not a gear.
    expect(w.camY - startCam).toBeGreaterThan(CLIMB * 10);
    expect(w.camY - startCam).toBeLessThan(CLIMB * 10 * 1.02);
  });

  it('ignores taps once the run is over', () => {
    const w = bare();
    w.status = 'dead';
    lift(w);
    expect(w.ball.vx).toBe(0);
  });
});

describe('tap = up, no tap = down', () => {
  it('throws the ball up on the frame the tap lands', () => {
    const w = bare();
    run(w, 1); // resting on the floor
    const rested = w.ball.x;

    // The tap is the press itself, so the answer is on the same frame -- there
    // is no release to wait for and nothing is aimed at anything.
    lift(w);
    expect(w.ball.vx).toBe(LIFT);
    step(w, 1 / 60);
    expect(w.ball.x).toBeGreaterThan(rested);
  });

  it('hands the ball straight back to gravity after one tap', () => {
    const w = bare();
    lift(w);
    // Every frame after the tap is a frame of fall, with nothing able to
    // switch it off: one tap is one jump and no more.
    for (let i = 0; i < 4; i++) {
      const before = w.ball.vx;
      step(w, 1 / 60);
      expect(w.ball.vx).toBeCloseTo(before - FALL_G / 60, 6);
    }
  });

  it('keeps falling while a finger is dragging', () => {
    const w = bare();
    // A hand on the glass is a drag and nothing else: it never brakes the fall
    // and it never holds the ball up. Height is bought with taps or not at all.
    steerBy(w, 40);
    lift(w);
    run(w, 2);
    expect(w.ball.x).toBeCloseTo(FLOOR_X, 6);
    expect(lead(w)).toBeCloseTo(40, 6);
  });
});
