import { createWorld, gearPos, hitAt } from '../engine';
import { LEVELS } from '../level';
import type { Prop, World } from '../types';

const TAU = Math.PI * 2;

/**
 * The hexagon is a cage, not a wall.
 *
 * It is the one piece of big furniture with the hazard *inside* it: two small
 * blades strung across rails, sliding about the middle of the shape. The
 * player is meant to read the cage, pick the gap the blades have left and fly
 * through it -- which is only a question at all if the outline lets the ball
 * in. While the outline collided, the only answer was to go round the whole
 * shape, and the blades the player was actually being asked about could not
 * be reached without dying on the way to them.
 *
 * So: nothing ever dies on a hexagon, and the blades in it still kill. Both
 * halves matter -- the first on its own would be a shape with no teeth.
 */
function cages(w: World) {
  return (w.props as Prop[]).filter(p => p.kind === 'hexagon');
}

/** The blades strung across one cage: the gears sitting inside its bounds. */
function bladesIn(w: World, cage: Prop) {
  return (w.props as Prop[]).filter(
    p =>
      p.kind === 'gear' &&
      Math.abs(p.x - cage.x) <= cage.radius &&
      Math.abs(p.y - cage.y) <= cage.radius,
  );
}

// One lap of each level's window, for the reason the other audits give: one
// lap of every window is every script stage in the game. The dealt hurdles
// build their hexagons with the same `hexagon()`.
describe.each(LEVELS)('level $n ($name) hexagons', def => {
  const w = createWorld(def.n, { laps: 1, allFlags: true });

  it('never ends a run on the cage itself', () => {
    const bad: string[] = [];
    for (const cage of cages(w)) {
      // Walk the outline itself -- corners and edge midpoints included -- at a
      // spread of times, since the blades inside are moving and the question
      // is about every moment the ball could be crossing.
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        const x = cage.x + Math.cos(a) * cage.radius;
        const y = cage.y + Math.sin(a) * cage.radius;
        for (let t = 0; t < 2; t += 0.25) {
          const hit = hitAt(w, t, x, y);
          if (hit?.kind === 'hexagon') {
            bad.push(`hex@${hit.y} outline ${a.toFixed(2)}rad t=${t.toFixed(2)}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('still dies on the blades inside it', () => {
    const missed: string[] = [];
    for (const cage of cages(w)) {
      const blades = bladesIn(w, cage);
      // A cage with nothing in it would be scenery the run could ignore.
      if (!blades.length) {
        missed.push(`hex@${cage.y} has no blades`);
        continue;
      }
      for (const b of blades) {
        for (const t of [0, 0.37, 1.1]) {
          const g = gearPos(b, t);
          if (!hitAt(w, t, g.x, g.y)) missed.push(`blade@${b.y} t=${t} is harmless`);
        }
      }
    }
    expect(missed).toEqual([]);
  });
});
