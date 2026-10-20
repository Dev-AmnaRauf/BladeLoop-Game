import { BALL_R, BRACKET_GAP, HALF_W, PIPE_R, distToSeg } from '../config';
import { climbAt, hitAt } from '../engine';
import type { Prop, World } from '../types';

export interface Spot {
  y: number;
  t: number;
  width: number;
  /** Where the widest lane sits across the corridor. */
  at: number;
  /** The props walling the lane in, for working out what to move. */
  blame: string[];
}

/**
 * Widest run of clear corridor at this instant, and what bounds it.
 *
 * This asks the engine's own `hitAt` rather than keeping a second copy of the
 * collision rules, so the audit cannot quietly drift away from the game.
 */
export function widestLane(w: World, t: number, y: number): Spot {
  const lo = -HALF_W + BALL_R;
  const hi = HALF_W - BALL_R;
  let best = 0;
  let bestAt = 0;
  let run = 0;
  const near = new Set<Prop>();

  for (let x = lo; x <= hi; x += 1) {
    const hit = hitAt(w, t, x, y);
    if (hit) {
      near.add(hit);
      if (run > best) {
        best = run;
        bestAt = x - run / 2;
      }
      run = 0;
    } else {
      run += 1;
    }
  }
  if (run > best) {
    best = run;
    bestAt = hi - run / 2;
  }
  return {
    y,
    t,
    width: best,
    at: bestAt,
    blame: [...near].map(p => `${p.kind}@${Math.round(p.x)},${Math.round(p.y)}`),
  };
}

/** Walk the descent, sampling the corridor as the run would meet it. */
export function sweep(w: World, endY: number, each: (s: Spot) => void) {
  const dt = 1 / 60;
  let t = 0;
  let y = w.ball.y;
  while (y < endY) {
    each(widestLane(w, t, y));
    y += climbAt(w, y) * dt;
    t += dt;
  }
}

/** Every depth where the corridor pinches below `floor`, one per run of them. */
export function pinches(w: World, floor: number, endY: number) {
  const found: Spot[] = [];
  sweep(w, endY, s => {
    if (s.width >= floor) return;
    const last = found[found.length - 1];
    // Consecutive tight depths are one pinch; keep the narrowest of each.
    if (last && s.y - last.y < 120) {
      if (s.width < last.width) found[found.length - 1] = s;
    } else {
      found.push(s);
    }
  });
  return found;
}

/**
 * How much air the standalone furniture has to leave round itself, in px.
 *
 * The bounds below are rough circles, so this is a guard against furniture
 * that visibly crowds rather than an exact contact test. It is two balls
 * wide: at 22 a column of hexagons 210px apart passed, and on the phone the
 * ball could not get between them.
 */
export const MIN_CLEAR = 44;

/** The dish's own allowance against the last line: see `crowding`. */
const MIN_PLATE_CLEAR = 22;

/**
 * How wide a piece of furniture reads, for the crowding check. `-1` for
 * anything that is meant to sit against its line -- blades, pills, T-bars --
 * which is how they are left out of it.
 */
function bound(p: Prop) {
  switch (p.kind) {
    case 'triangle':
    case 'square':
    case 'hexagon':
      return p.radius;
    // Only ever half the corners point at a neighbour at once, so the
    // circumscribed circle would cry wolf; the half-width is the fair call.
    // A frame is the `[ ]` pair, so that is both boxes and the channel.
    case 'bracket':
      return Math.max(p.size + BRACKET_GAP / 2, p.radius);
    case 'bigWheel':
      return p.reach;
    case 'plate':
      return p.size / 2;
    default:
      return -1;
  }
}

/**
 * Every pair of standalone shapes in the world that sit closer than `clear`.
 *
 * Lines, frames, rings and the dish should read as separate objects with air
 * between them. This is pure geometry over the props -- no corridor is flown
 * -- so it is cheap enough to run over a whole level rather than over one lap
 * of its window, which is what catches a pair of stages crowding each other
 * across the join between them.
 */
export function crowding(w: World, clear = MIN_CLEAR) {
  const blobs = (w.props as Prop[]).filter(p => bound(p) > 0);
  const pipes = (w.props as Prop[]).filter(p => p.kind === 'pipe');
  const tight: string[] = [];

  for (let i = 0; i < blobs.length; i++) {
    const a = blobs[i];
    for (const q of pipes) {
      const gap = distToSeg(a.x, a.y, q.x, q.y, q.x, q.y + q.span) - bound(a) - PIPE_R;
      // The dish is the finish, not something to fly between: the last line
      // only has to read as separate from it.
      if (gap < (a.kind === 'plate' ? MIN_PLATE_CLEAR : clear)) tight.push(`${a.kind}@${a.y} vs pipe@${q.y} gap=${Math.round(gap)}`);
    }
    for (let j = i + 1; j < blobs.length; j++) {
      const b = blobs[j];
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - bound(a) - bound(b);
      if (gap < clear) {
        tight.push(`${a.kind}@${a.y} vs ${b.kind}@${b.y} gap=${Math.round(gap)}`);
      }
    }
  }

  // Lines against each other. Two that share an x are one line carrying on
  // across a stage boundary, which is deliberate; anything else has to read as
  // a separate line, not as a kink or a staircase in the same one.
  for (let i = 0; i < pipes.length; i++) {
    for (let j = i + 1; j < pipes.length; j++) {
      const a = pipes[i];
      const b = pipes[j];
      const dx = Math.abs(a.x - b.x);
      if (dx < 6) continue;
      const overlaps = a.y <= b.y + b.span && b.y <= a.y + a.span;
      const dy = overlaps ? 0 : Math.max(a.y - (b.y + b.span), b.y - (a.y + a.span));
      const gap = Math.hypot(dx, dy) - 2 * PIPE_R;
      if (gap < clear) tight.push(`pipe@${a.y} vs pipe@${b.y} gap=${Math.round(gap)}`);
    }
  }
  return tight;
}
