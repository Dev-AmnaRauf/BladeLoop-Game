import {
  BALL_R,
  HALF_W,
  LANE_MIN,
  RESPAWN_CLEAR,
  STAGE_H,
  bracketReach,
  gears,
} from '../config';
import { createWorld, hitAt, idleLane, respawnDepth, respawnX } from '../engine';
import { LEVELS } from '../level';
import type { Prop } from '../types';
import { crowding, pinches, sweep } from './lanes';

// The corridor must never pinch below `LANE_MIN` -- see its own note in
// `config.ts` for what a lane is measured in and why the floor is where it is.
// It used to be `2 * BALL_R`, which is the ball's own width and no more.

/**
 * A turning frame has to leave a lane at *every* angle, not only the ones a
 * lap of the audit happens to catch it at.
 *
 * This is the one shape in the game big enough for the question to matter: it
 * turns, so sooner or later it is met lying flat across the corridor, and at
 * that turn the only way past is the wall lane either side of it. A level runs
 * for minutes and lays its window down twenty-odd times, each lap meeting the
 * same frame a different distance round its turn, so "the lap I flew was fine"
 * is not an answer. The arithmetic is: half the spine, plus the ball and the
 * collision slack, has to leave `LANE_MIN` before the wall.
 */
it('leaves a lane past a frame at every angle it can turn to', () => {
  expect(HALF_W - BALL_R - bracketReach()).toBeGreaterThanOrEqual(LANE_MIN);
});

// Every level is audited, not just the first: the script was cut into five and
// each cut is a corridor a player has to be able to fly down on its own.
//
// One lap of the window, with every authored flag left in place.
//
// A full level is its script stages, each laid once, with fresh hurdles dealt
// between them for five minutes or more, so what is flown here is a fraction of
// what is played. That is on purpose, and it is not a hole: every script stage
// belongs to exactly one level's window, so one lap of each window flies every
// script stage in the game, and the dealt hurdles are flown on their own by
// `hurdles.test.ts`. Flying every level whole would cost hours.
//
// `allFlags` keeps the ones a full-length level thins out to the speed ladder,
// so every authored flag position still gets its retry lane checked.
describe.each(LEVELS)('level $n ($name)', def => {
  const w = createWorld(def.n, { laps: 1, allFlags: true });
  w.pace = 1;
  // Down to the dish, which on a level cut mid-script sits past the last
  // authored stage rather than inside it.
  const endY = Math.max(w.finishY, w.stages[w.stages.length - 1].yEnd - 80);

  // One lap of the window, flown: the frames are met at whatever angle this
  // lap puts them at, and the arithmetic above is what covers the rest.
  it('never pinches the corridor below the floor', () => {
    const perStage: number[] = w.stages.map(() => 1e9);
    let runT = 0;
    sweep(w, endY, s => {
      const si = Math.min(w.stages.length - 1, Math.floor(s.y / STAGE_H));
      if (s.width < perStage[si]) perStage[si] = s.width;
      runT = s.t;
    });
    const lanes = w.stages.map((st, i) => `${st.name}=${perStage[i]}`).join(' ');
    console.log(
      `run length ${runT.toFixed(1)}s; narrowest lane per stage (floor ${LANE_MIN}): ${lanes}`,
    );

    const tight = pinches(w, LANE_MIN, endY).map(
      s =>
        `y=${Math.round(s.y)} (stage ${Math.floor(s.y / STAGE_H)}) lane=${
          s.width
        } :: ${s.blame.join(' ')}`,
    );
    expect(tight.slice(0, 12)).toEqual([]);
  }, 120000);

  it('does not drop a respawn straight into a hazard', () => {
    // A respawn reads the corridor and picks a lane, then falls across it: no
    // hand is on the screen yet, so the line to check is the scroll along the
    // run and the sink of a ball nobody is tapping across it. Nothing is immune any more -- the ball
    // is solid from the first frame it is put back -- so the whole window has
    // to be clear, not just the part past where an immunity used to run out.
    //
    // Checked at every gear the flags can put the descent in: the window is
    // quoted in seconds, so a second of corridor is a little more of it at the
    // top of the ladder than at the opening pace. The line flown is
    // `respawnDepth`, which is the one a respawn actually takes: set down at
    // the opening pace and winding up to the run's gear, exactly as
    // `restartFromDeath` and `restartFromCheckpoint` leave it.
    const bad: string[] = [];
    for (const gear of gears()) {
      w.gear = gear;
      w.speed = 1;
      for (const p of w.props as Prop[]) {
        if (p.kind !== 'flag') continue;
        const x = respawnX(w, p.y);
        for (let t = 0; t <= RESPAWN_CLEAR; t += 0.05) {
          const hit = hitAt(w, w.t + t, idleLane(x, t), respawnDepth(w, p.y, t));
          if (hit) {
            bad.push(
              `gear ${gear.toFixed(2)} flag y=${p.y} lane ${x} +${t.toFixed(1)}s hits ${hit.kind}@${
                hit.y
              }`,
            );
            break;
          }
        }
      }
    }
    w.gear = 1;
    w.speed = 1;
    expect(bad).toEqual([]);
  });

  it('keeps the big shapes from crowding each other', () => {
    // One lap of the window. The whole level is checked too, and by the same
    // arithmetic -- see the suite below, which is what covers the joins a
    // full-length level makes between stages out of different stretches.
    expect(crowding(w)).toEqual([]);
  });
});

// The corridor a level actually lays down, end to end, rather than one lap of
// its window.
//
// The sweeps above are flown a lap at a time because flying eighty stages of
// corridor twenty times over runs into hours. This does not fly anything: it
// is the same crowding arithmetic read straight off the props, which costs
// nothing, so it can afford the whole level.
//
// What it is here for is the joins. A level opens on the corridor behind it,
// deals fresh hurdles through the middle, and closes on its own window -- so
// things meet that the script never writes one under the other. They are meant
// to be kept a `HURDLE_GAP` apart; this is what says that they are. It is what
// caught a frame sitting 48 px inside a spoked ring when stretches were first
// cut together.
describe.each(LEVELS)('level $n ($name), end to end', def => {
  it('never crowds two shapes, across a join or anywhere else', () => {
    expect(crowding(createWorld(def.n))).toEqual([]);
  });
});
