import { HURDLE_GAP, LANE_MIN, RESPAWN_CLEAR, SPEED_MAX, gears } from '../config';
import {
  createWorld,
  hitAt,
  idleLane,
  respawnDepth,
  respawnReach,
  restartFromDeath,
  respawnX,
} from '../engine';
import { HURDLES, LEVELS, SCRIPT, SIGNATURES, layHurdle } from '../level';
import type { Prop } from '../types';
import { crowding, pinches } from './lanes';

/**
 * The fresh hurdles a level deals between its script stages.
 *
 * The script stages are audited by `levelAudit.test.ts`, a lap of each level's
 * own window at a time. The hurdles are not in those laps, so they are held to
 * the same rules here: each one flown on its own, every way the dealer can lay
 * it, and each level checked for the things the deck promises -- that nothing
 * is laid twice running, that the corridor never goes quiet for longer than a
 * hurdle gap, and that a retry anywhere in it has somewhere to land.
 */

/** Seeds per hurdle and wall: enough to see every pick each hurdle makes. */
const SEEDS = 4;

function seeded(seed: number) {
  let a = seed * 48271;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}

// The signature set pieces are dealt the same way and held to the same rules.
const DEALT = [...HURDLES, ...Object.values(SIGNATURES)];

describe.each(DEALT.map(h => [h.name, h] as const))('hurdle %s', (_name, hurdle) => {
  // Every way round and several deals of each, laid a long way apart so each
  // one is flown on its own.
  const w = createWorld(1, { laps: 1 });
  w.pace = 1;
  w.props = [];
  w.ball.y = -300;
  let top = 0;
  // Dealt cold and hot: the heat leans the picks toward one end or the other,
  // so flying both ends covers what a level deals at its opening and its middle.
  for (const s of [1, -1] as const) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const heat = seed % 2 ? 1 : 0;
      const band = layHurdle(w, { hurdle, s }, top, seeded(seed + 1), heat);
      top = band.bottom + 2 * HURDLE_GAP;
    }
  }

  it('leaves a lane at every depth', () => {
    const tight = pinches(w, LANE_MIN, top).map(
      p => `y=${Math.round(p.y)} lane=${p.width} :: ${p.blame.join(' ')}`,
    );
    expect(tight.slice(0, 8)).toEqual([]);
  }, 120000);

  it('keeps its own shapes apart', () => {
    expect(crowding(w)).toEqual([]);
  });
});

/** How far along the run a prop is drawn, for the quiet-corridor check. */
function drawn(p: Prop): [number, number] | null {
  switch (p.kind) {
    case 'gear':
      return [p.y - p.radius - p.ring, p.y + p.radius + p.ring];
    case 'capsule':
    case 'bigWheel':
    case 'bracket':
    case 'triangle':
    case 'hexagon':
    case 'turret':
      return [p.y - p.radius, p.y + p.radius];
    case 'pipe':
    case 'wind':
      return [p.y, p.y + p.span];
    case 'dropSaw':
    case 'crusher':
      return [p.y - p.size / 2, p.y + p.size / 2];
    case 'pendulum':
    case 'orbiter':
      return [p.y - p.reach - p.radius, p.y + p.reach + p.radius];
    case 'zipper':
      return [p.y - p.radius, p.y + p.span + p.radius];
    default:
      return null;
  }
}

describe.each(LEVELS)('level $n ($name), dealt', def => {
  const w = createWorld(def.n);
  const names = w.stages.map(st => st.name);

  it('lays every script stage at most once', () => {
    const scripted = names.filter(n => SCRIPT.includes(n));
    expect(scripted.length).toBe(new Set(scripted).size);
  });

  it('never deals the same hurdle twice running', () => {
    const twice = names.filter((n, i) => i > 0 && n.startsWith('fresh_') && n === names[i - 1]);
    expect(twice).toEqual([]);
  });

  it('deals a spread of hurdles, not one on repeat', () => {
    // The level's own set pieces are meant to come round again and again --
    // that is what makes them its signature -- so the spread is of the rest.
    const fresh = names.filter(n => n.startsWith('fresh_') && !n.startsWith('fresh_sig'));
    const counts = new Map<string, number>();
    for (const n of fresh) counts.set(n, (counts.get(n) ?? 0) + 1);
    expect(counts.size).toBeGreaterThanOrEqual(4);
    // No one hurdle is more than a third of what the level deals.
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(Math.ceil(fresh.length / 3));
  });

  it('deals its own signature, and only its own', () => {
    const own = new Set(def.sig.map(k => 'fresh_' + SIGNATURES[k].name));
    const sigs = names.filter(n => n.startsWith('fresh_sig'));
    expect(sigs.filter(n => !own.has(n))).toEqual([]);
    // Every set piece it has turns up, and often: about one dealt stage in three.
    expect(new Set(sigs)).toEqual(own);
    const fresh = names.filter(n => n.startsWith('fresh_'));
    expect(sigs.length).toBeGreaterThanOrEqual(fresh.length / 3);
  });

  it('never goes quiet between two hurdles', () => {
    // Walk everything drawn in depth order; where the dealt stretches meet,
    // the widest run of empty corridor is the hurdle gap plus the air a
    // drawn shape leaves inside its own reach.
    const spans = w.props.map(drawn).filter((s): s is [number, number] => !!s);
    spans.sort((a, b) => a[0] - b[0]);
    const quiet: string[] = [];
    let reach = spans[0][1];
    for (const [a, b] of spans) {
      const st = w.stages.find(s => s.yStart <= reach && reach < s.yEnd);
      const dealt = st?.name.startsWith('fresh_');
      if (dealt && a - reach > HURDLE_GAP + 120)
        quiet.push(`${Math.round(a - reach)}px at ${reach}`);
      reach = Math.max(reach, b);
    }
    expect(quiet).toEqual([]);
  });

  it('puts every flag where a retry from it survives', () => {
    const bad: string[] = [];
    for (const gear of gears()) {
      w.gear = gear;
      w.speed = 1;
      for (const p of w.props) {
        if (p.kind !== 'flag') continue;
        const x = respawnX(w, p.y);
        for (let t = 0; t <= RESPAWN_CLEAR; t += 0.05) {
          const hit = hitAt(w, w.t + t, idleLane(x, t), respawnDepth(w, p.y, t));
          if (hit) {
            bad.push(`gear ${gear.toFixed(2)} flag y=${p.y} +${t.toFixed(1)}s hits ${hit.kind}`);
            break;
          }
        }
      }
    }
    w.gear = 1;
    expect(bad).toEqual([]);
  });
});

// A retry anywhere in the dealt corridor, not only at a flag. Flown on a few
// levels rather than all twenty: it is the same deck and the same floor rule
// everywhere, and a whole level of deaths every 150px is a slow thing to fly.
describe.each([1, 4, 14])('level %i, retry in the dealt corridor', n => {
  const w = createWorld(n);
  w.pace = 1;
  const dealt = w.stages.filter(st => st.name.startsWith('fresh_'));

  it('survives the first moment of every retry', () => {
    const bad: string[] = [];
    for (const gear of [1, SPEED_MAX]) {
      w.gear = gear;
      const from = dealt[0].yStart + respawnReach(w);
      const to = dealt[dealt.length - 1].yEnd;
      for (let deathY = from; deathY < to; deathY += 150) {
        w.deathY = deathY;
        w.status = 'dead';
        w.gear = gear;
        restartFromDeath(w);
        for (let t = 0; t <= RESPAWN_CLEAR; t += 0.05) {
          const hit = hitAt(w, w.t + t, idleLane(w.ball.x, t), respawnDepth(w, w.ball.y, t));
          if (hit) {
            bad.push(
              `x${gear} death y=${deathY} retried at ${Math.round(w.ball.y)}, hit ${hit.kind}`,
            );
            break;
          }
        }
      }
    }
    expect(bad.slice(0, 8)).toEqual([]);
  }, 240000);
});
