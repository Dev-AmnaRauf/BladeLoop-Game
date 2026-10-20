import { RESPAWN_BACKUP, RESPAWN_CLEAR, SPEED_MAX, STAGE_H } from '../config';
import {
  createWorld,
  hitAt,
  idleLane,
  respawnDepth,
  respawnReach,
  respawnSpot,
  restartFromDeath,
} from '../engine';
import { LEVELS } from '../level';

/**
 * A retry has to be survivable.
 *
 * `respawnSpot` reads the corridor ahead of where the ball would be set down
 * and, while that depth has no lane worth landing in, walks back up it. What
 * this guards is the thing that went wrong without it: a death on a stretch
 * with no clear lane at all put the ball straight back inside the hazard that
 * had just killed it, so RETRY HERE died on the frame it was pressed, every
 * time, and the level could not be got past at all.
 *
 * The lane picker is still best-effort about the whole respawn window -- a
 * corridor can be legitimately tight for longer than the ball can fall
 * through it. What is not best-effort, and is what this asserts, is that the
 * ball is never *put inside* something, and that the retry never hands back
 * progress by setting down above the start of the level.
 */
// One lap of the level's window, for the reason the level audit gives: one lap
// of every window is every script stage in the game. Retries in the dealt
// hurdles between them are flown by `hurdles.test.ts`.
describe.each(LEVELS)('level $n ($name) retry', def => {
  const w = createWorld(def.n, { laps: 1, allFlags: true });
  w.pace = 1;
  const endY = w.stages[w.stages.length - 1].yEnd;

  it('never sets the ball down inside a hazard', () => {
    const bad: string[] = [];
    for (let deathY = w.startY + 150; deathY < endY; deathY += 150) {
      const want = Math.max(w.startY, deathY - RESPAWN_BACKUP);
      const spot = respawnSpot(w, want, w.startY);
      if (spot.y > want || spot.y < w.startY) {
        bad.push(`death y=${deathY} put the ball at ${spot.y}, outside ${w.startY}..${want}`);
        continue;
      }
      const hit = hitAt(w, w.t, spot.x, spot.y);
      if (hit) {
        bad.push(
          `death y=${deathY} (stage ${Math.floor(deathY / STAGE_H)}) set down at ` +
            `${Math.round(spot.x)},${Math.round(spot.y)} inside ${hit.kind}@${hit.y}`,
        );
      }
    }
    expect(bad.slice(0, 8)).toEqual([]);
  }, 60000);

  it('survives the first moment of the retry, with no hand on the screen', () => {
    // The ball falls from wherever it is put, with no hand on the screen, for
    // the whole window the lane was picked to survive. Dying inside that is the
    // death loop this exists to rule out: before the search backed up, a retry
    // on level 6 lasted 0.3s before it was killed again, at the same spot,
    // every time it was pressed.
    //
    // Flown at every gear the flags can reach. A retry is set down at the
    // level's opening pace and winds back up to the gear the run had, so the
    // line is `respawnDepth` rather than a flat rate -- and the whole point of
    // that wind-up is that this window stays inside the distance the corridor
    // was authored to be survivable over, however fast the run had got.
    //
    // Each gear above the first starts its sweep far enough down that the whole
    // backup search fits above it. That is not a corner being cut: a gear above
    // the first is minutes and tens of thousands of px into a level, so the
    // corridor above a retry is never in short supply -- where it *is* in short
    // supply, at the top of the level, the run is always in first gear. This
    // audit flies one lap of the window, so the same stages sit at the top of
    // this world that sit deep inside a real one, and without the offset the
    // fast gears would be asked a question the game never asks: retry into this
    // stage at quadruple pace, with nowhere to back up to.
    const GRACE = RESPAWN_CLEAR;
    const bad: string[] = [];
    for (let gear = 1; gear <= SPEED_MAX; gear++) {
      w.gear = gear;
      const from = w.startY + 150 + (gear > 1 ? respawnReach(w) : 0);
      for (let deathY = from; deathY < endY; deathY += 150) {
        w.deathY = deathY;
        w.status = 'dead';
        w.gear = gear;
        restartFromDeath(w);
        for (let t = 0; t <= GRACE; t += 0.05) {
          // Both axes move now. `respawnDepth` is where along the run an
          // untouched ball is, and `idleLane` is where across the corridor it
          // has fallen to by then -- the lane it was set down in is only where
          // that fall starts.
          const hit = hitAt(w, w.t + t, idleLane(w.ball.x, t), respawnDepth(w, w.ball.y, t));
          if (hit) {
            bad.push(
              `x${gear} death y=${deathY} retried at ${Math.round(w.ball.y)} and hit ${hit.kind}`,
            );
            break;
          }
        }
      }
    }
    w.gear = 1;
    w.speed = 1;
    expect(bad.slice(0, 8)).toEqual([]);
  }, 240000);
});
