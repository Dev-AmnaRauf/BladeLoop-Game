/**
 * The ball has to travel on every refresh of the screen, not only on the ones
 * a simulation step happened to land in.
 *
 * The world moves in whole sixtieths so that a dropped frame costs smoothness
 * and never speed. A phone panel does not: nearly everything sold now refreshes
 * at 90Hz or 120Hz, and even a 60 never lands its frames quite evenly. Drawing
 * the last whole step on every one of those refreshes therefore stands the ball
 * perfectly still for a third of them on a 90 and half of them on a 120, and
 * then moves it two steps at once -- which is exactly the stutter that reads as
 * the game being choppy, whatever frame rate the profiler says it is holding.
 *
 * So the drawing is handed how far past the last step each frame fell and
 * interpolates. These pin that: the loop's own accumulator is played out at
 * each refresh rate, `viewOf` is asked where to draw, and what is checked is
 * that the answer moves every single time and by roughly the same amount.
 */
import { CLIMB, FIXED_DT, MAX_STEPS } from '../config';
import { createWorld, restartFromDeath, step, viewOf } from '../engine';
import type { World } from '../types';

/**
 * Where the drawing puts the ball on each refresh of a `hz` screen.
 *
 * The first few frames are thrown away. A world that has not been stepped
 * yet has both ends of the interpolation in the same place, so it is drawn
 * standing still until there is a step behind it to slide from -- which is
 * true and harmless, and not what these are measuring.
 */
function drawnAt(w: World, hz: number, frames: number) {
  let acc = 0;
  const out: number[] = [];
  const warm = 4;
  for (let i = 0; i < frames + warm; i++) {
    acc += Math.min(1 / hz, FIXED_DT * MAX_STEPS);
    let steps = 0;
    while (acc >= FIXED_DT && steps < MAX_STEPS) {
      step(w, FIXED_DT);
      acc -= FIXED_DT;
      steps++;
    }
    if (i >= warm) out.push(viewOf(w, acc / FIXED_DT).camY);
  }
  return out;
}

/** Gaps between consecutive drawn positions: one entry per refresh but the first. */
function gaps(pts: number[]) {
  return pts.slice(1).map((v, i) => v - pts[i]);
}

function playing() {
  const w = createWorld();
  w.pace = 1;
  w.props = [];
  w.spikes = false;
  return w;
}

describe('the drawing moves on every refresh', () => {
  for (const hz of [60, 90, 120]) {
    test(`${hz}Hz: no frame is ever drawn in the same place as the last`, () => {
      const steps = gaps(drawnAt(playing(), hz, 240));
      expect(Math.min(...steps)).toBeGreaterThan(0);
      // And every frame carries about its share of a second's worth of travel,
      // rather than a full step on some frames and none on others.
      const want = CLIMB / hz;
      for (const s of steps) {
        expect(s).toBeGreaterThan(want * 0.5);
        expect(s).toBeLessThan(want * 1.5);
      }
    });
  }

  test('a 90Hz screen draws the ball 90 times a second, not 60', () => {
    const moved = gaps(drawnAt(playing(), 90, 180)).filter(s => s > 0).length;
    expect(moved).toBe(179);
  });

  test('a 120Hz screen draws it 120 times a second', () => {
    const moved = gaps(drawnAt(playing(), 120, 240)).filter(s => s > 0).length;
    expect(moved).toBe(239);
  });
});

describe('what is put somewhere is never drawn sliding there', () => {
  test('a respawn draws at the lane it was put in, whatever the frame fell on', () => {
    const w = playing();
    for (let i = 0; i < 300; i++) step(w, FIXED_DT);
    w.status = 'dead';
    w.deathY = w.ball.y;
    restartFromDeath(w);
    // Mid-step is the case that would streak: both ends of the interpolation
    // have to be the place the ball was put, not the place it died.
    for (const alpha of [0, 0.5, 1]) {
      const v = viewOf(w, alpha);
      expect(v.ballX).toBeCloseTo(w.ball.x, 6);
      expect(v.ballY).toBeCloseTo(w.ball.y, 6);
      expect(v.camY).toBeCloseTo(w.camY, 6);
    }
  });

  test('a fresh world has nothing to interpolate from', () => {
    const w = createWorld();
    const v = viewOf(w, 0);
    expect(v.ballY).toBe(w.ball.y);
    expect(v.camY).toBe(w.camY);
    expect(v.t).toBe(w.t);
  });
});

describe('interpolating never runs ahead of the simulation', () => {
  test('the drawn state is between the last step and this one, and never past it', () => {
    const w = playing();
    for (let i = 0; i < 120; i++) step(w, FIXED_DT);
    const lo = viewOf(w, 0);
    const hi = viewOf(w, 1);
    expect(hi.camY).toBe(w.camY);
    expect(hi.t).toBe(w.t);
    for (const alpha of [-0.5, 0, 0.25, 0.75, 1, 1.5]) {
      const v = viewOf(w, alpha);
      expect(v.camY).toBeGreaterThanOrEqual(lo.camY);
      expect(v.camY).toBeLessThanOrEqual(hi.camY);
      expect(v.t).toBeGreaterThanOrEqual(lo.t);
      expect(v.t).toBeLessThanOrEqual(hi.t);
    }
  });
});
