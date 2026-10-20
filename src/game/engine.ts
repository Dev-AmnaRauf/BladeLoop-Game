import {
  BALL_R,
  BONUS_SECS,
  BRACKET_GAP,
  BULLET_LIFE,
  BULLET_R,
  BULLET_SPEED,
  CEIL_X,
  CLIMB,
  DRAG_BAND,
  FALL_G,
  FIXED_DT,
  FLAG_COINS,
  FLAG_SCORE,
  FLOOR_X,
  HALF_W,
  LIFT,
  LEAN_BLEED,
  LEAN_MAX,
  BALL_DRIFT,
  RESPAWN_BACKUP,
  RESPAWN_CLEAR,
  RESPAWN_SETTLE,
  RISE_MAX,
  SINK_MAX,
  SPEED_RATE,
  SPIKE_H,
  spikeState,
  BLADE_BOB_RATE,
  CAPSULE_BOB_RATE,
  CAPSULE_HH,
  CAPSULE_OFFSET,
  RAIL_MIN,
  TRAIL_LEN,
  TRAIL_POINTS,
  WIND_FORCE,
  WIND_MAX,
  clamp,
  distToSeg,
  lerp,
  paceShape,
  runGear,
  pingPong,
  wheelBand,
} from './config';
import { OPENING_Y, buildLevel, levelAt, type BuildOpts } from './level';
import type { Prop, Snapshot, World } from './types';

const TAU = Math.PI * 2;
/** Turrets only wake up once the ball is roughly this close. */
const TURRET_RANGE = 620;
const TURRET_PERIOD = 2.4;

export function createWorld(level = 1, opts?: BuildOpts): World {
  const w: World = {
    t: 0,
    level: levelAt(level).n,
    // There is no title card and no ready state to tap through: a fresh world
    // is already a run in progress, with the tutorial word riding over the top.
    status: 'playing',
    stages: [],
    props: [],
    bullets: [],
    particles: [],
    pops: [],
    ball: { x: 0, y: OPENING_Y, vx: 0, fly: 0, lead: 0, lean: 0, trail: [] },
    camY: OPENING_Y,
    startY: OPENING_Y,
    score: 0,
    banked: 0,
    runCoins: 0,
    settleUntil: 0,
    bonusUntil: 0,
    checkpoint: { y: OPENING_Y, score: 0, gear: 1, creep: 0 },
    nextId: 1,
    shakeUntil: 0,
    finishY: 0,
    pickup: 0,
    ballHidden: false,
    darkness: 0,
    pace: 1,
    gear: 1,
    speed: 1,
    creep: 0,
    windPush: 0,
    spikeClock: 0,
    spikes: true,
    deathY: OPENING_Y,
    buckets: new Map(),
    indexedFor: null,
    nearKey: -Infinity,
    near: [],
    prev: { t: 0, camY: OPENING_Y, ballX: 0, ballY: OPENING_Y },
  };
  buildLevel(w, level, opts);
  indexProps(w);
  return w;
}

/**
 * How many of the level's stars this run has in the bag.
 *
 * Counted off the props rather than tallied as they are taken, because a
 * respawn puts back every star below the point the run picks up from -- so a
 * counter would have to be unwound by hand on exactly the paths that are
 * easiest to forget, and this cannot drift from what is actually still lying
 * in the corridor.
 */
export function starsTaken(w: World) {
  let n = 0;
  for (const p of w.props) if (p.kind === 'star' && p.taken) n++;
  return n;
}

/**
 * Stars per corridor, filled in the first time the road asks for one.
 *
 * Keyed by the stretch of script the level is cut from rather than by its
 * number, because the endless levels past the authored twenty are those same
 * stretches dealt again: two levels with the same window hold the same stars,
 * so the road builds each corridor once however many stops wear it.
 */
const starTotals = new Map<string, number>();

/**
 * How many stars level `n` has lying in it, which is how many sockets the
 * road draws over that stop.
 *
 * It is worked out by building the level and counting, so it can never fall
 * out of step with what is authored, and kept, because the road asks for
 * every level every time it opens.
 */
export function starsIn(n: number) {
  const def = levelAt(n);
  const key = `${def.from}-${def.to}`;
  const known = starTotals.get(key);
  if (known !== undefined) return known;
  const total = createWorld(def.n).props.reduce((c, p) => c + (p.kind === 'star' ? 1 : 0), 0);
  starTotals.set(key, total);
  return total;
}

/**
 * Collapse the drawing's two states onto the one the world is actually in.
 *
 * Every frame between two steps is drawn somewhere along the line from the
 * last step to this one, which is what makes the ball travel smoothly across
 * a screen refreshing faster than the world is stepped. That line is only a
 * line while the ball is flying: put it somewhere outright -- a respawn, a
 * checkpoint, a fresh level -- and interpolating from wherever it died would
 * draw it streaking back across the corridor for a frame. So anything that
 * sets a position rather than integrating one calls this, and the frame after
 * it has nothing to interpolate: both ends are the same place.
 */
export function syncPrev(w: World) {
  w.prev.t = w.t;
  w.prev.camY = w.camY;
  w.prev.ballX = w.ball.x;
  w.prev.ballY = w.ball.y;
}

/**
 * Where to draw the world, `alpha` of the way through the step it is part way
 * into. 1 is the state the simulation is actually in.
 *
 * This is an interpolation and deliberately not an extrapolation. The drawing
 * therefore trails the simulation by up to one step -- around 8ms on average,
 * which nobody can feel on a tap -- where guessing forward off the ball's
 * velocity would cost nothing in lag but would fly the ball through a blade it
 * never actually reached and then snap it back.
 *
 * `t` is interpolated along with the positions because every blade in the
 * corridor is a pure function of it: a saw's angle, a pill's trip up its
 * line, a bracket's turn. Handing the drawing a time between two steps
 * therefore moves the whole corridor as smoothly as it moves the ball, rather
 * than leaving the ball gliding over a set of blades that still tick.
 */
export function viewOf(w: World, alpha: number): Snapshot {
  const a = clamp(alpha, 0, 1);
  const p = w.prev;
  return {
    t: lerp(p.t, w.t, a),
    camY: lerp(p.camY, w.camY, a),
    ballX: lerp(p.ballX, w.ball.x, a),
    ballY: lerp(p.ballY, w.ball.y, a),
  };
}

// --- the depth index --------------------------------------------------------

/**
 * Depth of one bucket, in world px. Five of them either side of the ball is
 * more than the deepest viewport can show, so the drawing can share the same
 * window as the collision without anything popping in at the bottom edge.
 */
const BUCKET = 700;
/**
 * How far past its anchor a prop is filed. Nothing reaches further than this
 * from where it is pinned, so a bucket lookup can never miss a hitbox.
 */
const BUCKET_PAD = 320;
/** Buckets either side of the ball's own that a sweep is handed. */
const NEAR_SPAN = 2;

/** File every prop under each bucket its hitbox can reach into. */
export function indexProps(w: World) {
  w.buckets.clear();
  w.nearKey = -Infinity;
  w.indexedFor = w.props;
  for (const p of w.props) {
    const lo = Math.floor((p.y - BUCKET_PAD) / BUCKET);
    const hi = Math.floor((p.y + p.span + BUCKET_PAD) / BUCKET);
    for (let b = lo; b <= hi; b++) {
      const list = w.buckets.get(b);
      if (list) list.push(p);
      else w.buckets.set(b, [p]);
    }
  }
}

/**
 * The props that can matter at depth `y`: everything within a bucket or two.
 * The window is rebuilt only when the ball crosses a bucket boundary, so the
 * per-frame cost is one array walk of what is actually on screen.
 */
export function propsNear(w: World, y: number): Prop[] {
  // A caller that swapped the prop list out from under the index -- the tests
  // stand a world up this way -- gets it rebuilt rather than a stale answer.
  if (w.indexedFor !== w.props) indexProps(w);
  const key = Math.floor(y / BUCKET);
  if (key === w.nearKey) return w.near;
  const seen = new Set<Prop>();
  const out: Prop[] = [];
  for (let b = key - NEAR_SPAN; b <= key + NEAR_SPAN; b++) {
    const list = w.buckets.get(b);
    if (!list) continue;
    for (const p of list) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  w.nearKey = key;
  w.near = out;
  return out;
}

// --- pacing -----------------------------------------------------------------

export function stageAt(w: World, y: number) {
  // The stages are not all the same depth any more -- a dealt hurdle is as
  // deep as it is -- so this is a walk of the list rather than a division. They
  // are laid down in order and never overlap, so a binary search is exact.
  const st = w.stages;
  if (!st.length) return 0;
  let lo = 0;
  let hi = st.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (st[mid].yStart <= y) lo = mid;
    else hi = mid - 1;
  }
  return clamp(lo, 0, st.length - 1);
}

/**
 * Scroll rate at a given depth. The audit flies ahead of the ball, so it
 * cannot go through `climbRate`, which only knows about where the ball is.
 *
 * It reads `speed`, which eases toward the level's pace hump (`paceAt`): the
 * opening pace at the start and at the finish, a third quicker through the
 * middle. The hump is read off how far through the level the ball is, so the
 * same stretch arrives at the same pace every time it is flown.
 */
export function climbAt(w: World, _y: number) {
  return CLIMB * w.pace * w.speed;
}

/**
 * The pace the level's hump asks for at depth `y`: the opening pace at the top
 * and at the dish, `SPEED_MAX` through the middle. See `paceShape`.
 */
export function paceAt(w: World, y: number) {
  const span = w.finishY - w.startY;
  if (span <= 0) return 1;
  return paceShape(clamp((y - w.startY) / span, 0, 1));
}

/**
 * Ease the descent toward the pace the level's hump asks for where the ball
 * is. Only ever called on a frame the run is actually being played.
 *
 * The easing is linear rather than a lerp, at `SPEED_RATE`. The hump itself
 * moves far slower than that, so in play `speed` simply sits on it; the ramp
 * only shows after a respawn, which winds up from the opening pace.
 */
function stepSpeed(w: World, dt: number) {
  w.creep = 0;
  w.gear = paceAt(w, w.ball.y);
  const want = runGear(w.gear, w.creep);
  if (w.speed === want) return;
  const by = SPEED_RATE * dt;
  w.speed = w.speed < want ? Math.min(want, w.speed + by) : Math.max(want, w.speed - by);
}

/**
 * The descent the ball actually feels. Same as `climbAt` once a run is under
 * way; for the first `RESPAWN_SETTLE` seconds after a respawn it eases up from
 * a standstill, so picking a failed run back up is a push off rather than a
 * jolt. Only the drawing speed is eased -- the level is unchanged, so nothing
 * the player has to dodge moves differently.
 */
export function climbRate(w: World) {
  const full = climbAt(w, w.ball.y);
  const left = w.settleUntil - w.t;
  if (left <= 0) return full;
  // Smoothstep from 0 to 1 across the window, so both ends are gentle.
  const u = clamp(1 - left / RESPAWN_SETTLE, 0, 1);
  return full * u * u * (3 - 2 * u);
}

// --- prop motion ------------------------------------------------------------

/**
 * Where a blade currently sits on its rail: it telescopes toward and away
 * from the pipe at a fixed height, the way the reference draws it, rather
 * than climbing the pipe.
 */
export function gearPos(p: Prop, t: number) {
  // A ringed blade has no rail: the ring is its track, and it goes round the
  // pipe on it. `side` sets which way round it starts.
  if (p.ring > 0) {
    const a = (t * p.rate + p.phase) * TAU;
    return {
      x: p.x + Math.cos(a) * p.ring * p.side,
      y: p.y + Math.sin(a) * p.ring,
    };
  }
  const max = Math.max(RAIL_MIN, p.reach);
  const u = pingPong(t * p.rate + p.phase);
  const dist = RAIL_MIN + u * (max - RAIL_MIN);
  // The rock is on its own slow clock, so a blade that also slides along its
  // rail does not do both in lockstep. Collision reads this too, which is why
  // it has to live here rather than in the drawing.
  const rock = p.bob ? Math.sin((t * BLADE_BOB_RATE + p.phase) * Math.PI * 2) * p.bob : 0;
  return { x: p.x + p.side * dist, y: p.y + rock };
}

/**
 * Where a drifting prop currently sits. The big rings slide left and right
 * across the corridor rather than hanging at a fixed x, so both the drawing
 * and the hitbox have to ask for the swung position, never `p.x`.
 */
export function swayX(p: Prop, t: number) {
  if (!p.sway) return p.x;
  return p.x + p.sway * (pingPong(t * p.rate + p.phase) * 2 - 1);
}

/** Full reach of a gear's rail, for drawing the light guide line. */
export function railReach(p: Prop) {
  return Math.max(RAIL_MIN, p.reach);
}

/** Where a capsule blade sits beside its pipe. It never slides sideways. */
export function capsuleX(p: Prop) {
  return p.x + p.side * CAPSULE_OFFSET;
}

/**
 * Where a capsule blade currently sits along its pipe. It runs up and down its
 * line on its own clock -- brisker than the saws' rock, because a pill this
 * big moving that little read as parked while the corridor swept past it.
 * Collision reads this too.
 */
export function capsuleY(p: Prop, t: number) {
  if (!p.bob) return p.y;
  return p.y + Math.sin((t * CAPSULE_BOB_RATE + p.phase) * Math.PI * 2) * p.bob;
}

/** Corner `i` of a rotating frame with `sides` edges. */
export function frameCorner(p: Prop, t: number, i: number, sides: number) {
  const a = p.angle + p.spin * t + (i * TAU) / sides;
  return { x: p.x + Math.cos(a) * p.radius, y: p.y + Math.sin(a) * p.radius };
}

/** The two halves of a bracket frame, left box first. */
export const BRACKET_HALVES: (1 | -1)[] = [-1, 1];

/**
 * Which edge a half leaves open. The mouths face each other, so the left box
 * is `[` -- open on its right -- and the right box is `]`.
 */
export function bracketSide(half: 1 | -1): 1 | -1 {
  return half === -1 ? 1 : -1;
}

/**
 * Corners of one half of a bracket frame, half-width `size/2` and half-height
 * `radius`, in drawing order (TL, TR, BR, BL).
 *
 * Both halves are offset from the prop's own centre and then turned about it,
 * so the `[ ]` tumbles as one rigid piece: the pair never opens up or drifts
 * apart, whatever angle it is caught at.
 */
export function bracketCorners(p: Prop, t: number, half: 1 | -1) {
  const a = p.angle + p.spin * t;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const hw = p.size / 2;
  const hh = p.radius;
  // Where this half sits along the pair's own width: its half-width clear of
  // the channel down the middle.
  const ox = half * (hw + BRACKET_GAP / 2);
  const at = (lx: number, ly: number) => ({
    x: p.x + (ox + lx) * ca - ly * sa,
    y: p.y + (ox + lx) * sa + ly * ca,
  });
  return [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)];
}

/** True where either half of a frame is solid, false in its mouth or channel. */
function bracketHit(p: Prop, t: number, bx: number, by: number) {
  for (const half of BRACKET_HALVES) {
    const [tl, tr, br, bl] = bracketCorners(p, t, half);
    // side === 1 leaves the right edge open; side === -1 leaves the left open.
    const edges =
      bracketSide(half) === 1
        ? [
            [tl, tr],
            [br, bl],
            [bl, tl],
          ]
        : [
            [tl, tr],
            [tr, br],
            [br, bl],
          ];
    for (const [u, v] of edges) {
      if (distToSeg(bx, by, u.x, u.y, v.x, v.y) < BALL_R + 6) return true;
    }
  }
  return false;
}

/** 0..1 through a repeating cycle, safe for a negative clock or phase. */
function cycle(t: number, rate: number, phase: number) {
  const u = t * rate + phase;
  return u - Math.floor(u);
}

/**
 * Where a dropping saw is across the corridor. It leaves its wall from just
 * behind it and speeds up as it goes, the way a thing let go of does, until
 * it has passed into the far wall -- and then the next one is let go.
 */
export function dropX(p: Prop, t: number) {
  const u = cycle(t, p.rate, p.phase);
  const from = p.side * (HALF_W + p.radius);
  return from - p.side * 2 * (HALF_W + p.radius) * u ** 1.5;
}

/** Where a pendulum's blade is: at the end of its arm, swung off straight out. */
export function pendulumPos(p: Prop, t: number) {
  const a = p.angle * Math.sin((t * p.rate + p.phase) * TAU);
  return { x: p.x - p.side * p.reach * Math.cos(a), y: p.y + p.reach * Math.sin(a) };
}

/** Blade `i` of an orbiter, evenly spaced round its hub. */
export function orbiterPos(p: Prop, t: number, i: number) {
  const a = (t * p.rate + p.phase + i / Math.max(1, p.count)) * TAU;
  return { x: p.x + Math.cos(a) * p.reach, y: p.y + Math.sin(a) * p.reach };
}

/** Where a zipper's saw is along its track. */
export function zipperY(p: Prop, t: number) {
  return p.y + p.span * pingPong(t * p.rate + p.phase);
}

/**
 * How far out of its wall a crusher is, 0 to 1: a quick slam out, a hold, a
 * slow draw back in, and a rest against the wall before the next one. The
 * rest is the opening; the hold is the part to be under the other side of.
 */
export function crusherOut(p: Prop, t: number) {
  const u = cycle(t, p.rate, p.phase);
  if (u < 0.12) return (u / 0.12) ** 2;
  if (u < 0.4) return 1;
  if (u < 0.75) {
    const k = (u - 0.4) / 0.35;
    return 1 - k * k * (3 - 2 * k);
  }
  return 0;
}

/** The face of a crusher across the corridor: how far its block has come out to. */
export function crusherFace(p: Prop, t: number) {
  return p.x - p.side * p.reach * crusherOut(p, t);
}

// --- input ------------------------------------------------------------------

/**
 * Nudge the ball along the corridor by `dx` world px -- the distance the
 * finger has just travelled, not the place it has travelled to.
 *
 * The finger slides across the glass and the ball slides the same way along
 * the run: forward toward what is coming, back toward more warning. That is
 * the whole of this control, and it carries no position at all. The ball used
 * to be put wherever the finger was, which meant a thumb landing anywhere
 * threw the ball across the screen to meet it -- and with every touch also
 * being a tap, that happened on every single tap. A delta cannot do that: a
 * finger that lands and does not move moves nothing, and the ball only ever
 * gets to where it is by travelling there.
 *
 * Applied outright rather than fed into an acceleration, because the ball has
 * to come to rest on the frame the finger does. Anything that ramped in or out
 * would leave the ball a few px downstream of where the player let go.
 *
 * The ends of the band are hard: a drag into one parks the ball against it and
 * the rest of the travel is thrown away rather than banked, so dragging back
 * answers immediately instead of first spending what was pushed into it.
 *
 * `lean` is set from what actually moved, and is read by nothing but the
 * drawing -- it is how far the ball leans into its travel. `stepSteer` bleeds
 * it back to nothing once the finger stops.
 */
export function steerBy(w: World, dx: number) {
  if (w.status !== 'playing') return;
  const before = w.ball.lead;
  w.ball.lead = clamp(before + dx, -DRAG_BAND, DRAG_BAND);
  // The ball's place on this axis is the camera plus the lead and nothing
  // else, so it is put back in agreement here rather than a frame later: a
  // drag taken between two steps has to read as having happened at once.
  w.ball.y = w.camY + w.ball.lead;
  w.ball.lean = clamp((w.ball.lead - before) / FIXED_DT, -LEAN_MAX, LEAN_MAX);
}

/**
 * A tap throws the ball up the screen. This is the whole of the vertical
 * control, and there is nothing else in it.
 *
 * One finger landing is one jump, fired the instant it lands. Leaving that
 * finger down does nothing more -- gravity has the ball back on the very next
 * frame, whether or not the hand is still on the glass -- so height is kept by
 * timing taps against the fall and by nothing else. A second finger landing
 * while the first is still down is its own tap and its own jump, which is what
 * lets a player steer with one thumb and jump with the other.
 *
 * The fall the tap is answering is thrown away rather than subtracted from, so
 * the first tap out of a long drop always reads as landing; taps on top of a
 * rise stack instead, up to `RISE_MAX`, which is what makes tapping faster
 * climb faster.
 *
 * Like `steerBy`, it carries no position at all. Where the finger landed is
 * never asked -- the screen only reports that it landed -- so no amount of
 * tapping can move the ball to the finger, and the ball only ever gets
 * anywhere by flying there.
 */
export function lift(w: World) {
  if (w.status !== 'playing') return;
  w.ball.vx = clamp(Math.max(w.ball.vx, 0) + LIFT, 0, RISE_MAX);
}

/**
 * How far the ball has fallen `t` seconds after being set down, if the player
 * never taps at all.
 *
 * A respawn is the one moment the hand is reliably off the screen, so this --
 * and not the lane it was set down in -- is the line the lane picker and the
 * level audit both have to keep clear. Free fall until the ball reaches
 * `SINK_MAX` and a steady sink after that, capped at the whole corridor since
 * nothing can fall further than from the ceiling to the floor.
 */
export function idleSink(t: number) {
  const toTerminal = SINK_MAX / FALL_G;
  const fallen =
    t <= toTerminal
      ? 0.5 * FALL_G * t * t
      : 0.5 * SINK_MAX * toTerminal + SINK_MAX * (t - toTerminal);
  return Math.min(fallen, CEIL_X - FLOOR_X);
}

/**
 * Where across the corridor an unattended ball set down in lane `x` is `t`
 * seconds later: on its way to the floor, and resting there once it arrives.
 *
 * This is the shape a respawn really has now. The fall used to be along the
 * run, so an untouched ball drifted a little further down the same lane and
 * the lane it was put in was the lane it stayed in; the fall is across the
 * corridor instead, so *every* lane ends at the floor and what the picker is
 * really choosing is a lane whose whole path down is clear.
 */
export function idleLane(x: number, t: number) {
  return Math.max(FLOOR_X, x - idleSink(t));
}

/**
 * How far the corridor scrolls in the `secs` after a respawn.
 *
 * Not simply `climbAt * secs`, because a respawn is set down at the level's
 * opening pace and winds back up to the gear the run had reached -- see
 * `restartFromDeath`. The wind-up takes a couple of seconds per rung of the
 * ladder and the respawn window is a couple of seconds long, so the whole of
 * the window is spent inside the ramp: reading it at the flat gear would put
 * the ball further down the corridor than it will actually be, and reading it
 * at the opening pace would put it short.
 *
 * So this integrates the ramp exactly. The lane picker and both audits ask it,
 * which is what keeps "this lane is clear for the window" the same claim in all
 * three places.
 *
 * It ignores the shorter `RESPAWN_SETTLE` easing laid on top by `climbRate`,
 * which only ever makes the real ball travel less far than this says.
 */
export function respawnTravel(w: World, secs: number) {
  const k = CLIMB * w.pace;
  // The pace the wind-up is heading for, creep included: the creep is the
  // corridor's, not the flags', and a respawn resumes into it. It moves by
  // about a fifth of a per cent across a window this short, so taking it as
  // the constant it nearly is keeps the integration exact enough to be the
  // same claim the lane picker makes.
  const g = runGear(w.gear, w.creep);
  // How long the wind-up itself lasts: one `SPEED_EASE` per rung, so it is a
  // function of how far up the ladder the run had got rather than a fixed
  // couple of seconds.
  const rampSecs = (g - 1) / SPEED_RATE;
  if (secs <= rampSecs) return k * (secs + (SPEED_RATE * secs * secs) / 2);
  const ramp = k * (rampSecs + (SPEED_RATE * rampSecs * rampSecs) / 2);
  return ramp + k * g * (secs - rampSecs);
}

/**
 * How far along the corridor an unattended ball set down at `y` is `t` seconds
 * later.
 *
 * The scroll and nothing else: a hand off the glass is a ball with no lead, so
 * it rides the camera exactly. Where it is *across* the corridor by then is
 * `idleLane`'s answer, and the two together are the line the lane picker flies.
 */
export function respawnDepth(w: World, y: number, t: number) {
  return y + respawnTravel(w, t);
}

// --- run control ------------------------------------------------------------

/**
 * Restart from the last flag instead of the very beginning.
 *
 * It asks `respawnSpot` rather than `respawnX`, so the depth is open to being
 * moved up the corridor as well as the lane being chosen -- exactly as a retry
 * does. It used to take the flag's own depth as given, on the grounds that a
 * flag is authored in clear air; that held while the corridor ran at one pace,
 * and stopped holding the moment the flags started winding it up. The window
 * the ball has to survive is quoted in seconds, so at the top gear it reaches
 * two or three times further down the corridor than the flag can see, and the
 * clear air a flag stands in is not that deep.
 *
 * Moving up is safe in a way moving down would not be: the flag has already
 * been taken, so passing it again scores nothing, banks nothing and changes no
 * gear, and the player is never handed back ground they had already made.
 */
export function restartFromCheckpoint(w: World) {
  const cp = w.checkpoint;
  // The gear first, and the descent back at the opening pace: both are read by
  // the lane search below, so they have to be what the run will actually have.
  w.gear = paceAt(w, cp.y);
  w.creep = 0;
  w.speed = 1;
  const { x, y } = respawnSpot(w, cp.y, w.startY);
  w.status = 'playing';
  w.ballHidden = false;
  w.ball.y = y;
  w.ball.x = x;
  w.ball.fly = x;
  w.ball.lead = 0;
  // Set down with no lean and nothing held: the lane the picker chose is only
  // worth choosing if the ball actually starts down it.
  w.ball.lean = 0;
  w.windPush = 0;
  // The floor starts the retry bare, with a full rest before the spikes rise.
  w.spikeClock = 0;
  // Set down at rest: the ball starts the retry in the lane the picker chose
  // and falls away from there, so the player gets the same first tap every
  // time.
  w.ball.vx = 0;
  w.ball.trail.length = 0;
  w.camY = y;
  w.score = cp.score;
  w.bullets = [];
  w.particles = [];
  w.pops = [];
  // Ease the descent back up rather than resuming at full speed, and drop any
  // leftover shake from the death, so the run picks up smoothly.
  w.settleUntil = w.t + RESPAWN_SETTLE;
  w.shakeUntil = 0;
  w.bonusUntil = 0;
  // Pickups past where the ball is set down come back; the ones already banked
  // stay gone. Quoted off the spot rather than off the flag, since the search
  // may have backed up above it.
  for (const p of w.props) {
    if ((p.kind === 'star' || p.kind === 'tvBox') && p.y > y) p.taken = false;
  }
  // The ball has been put here rather than flown here, so there is no line
  // between where it was and where it is for the drawing to slide along.
  syncPrev(w);
}

/** Lanes tried when picking somewhere to put the ball back, in px. */
const LANE_STEP = 11;
/** How far past the grace window a respawn lane has to stay clear. */
const LANE_LOOKAHEAD = 0.35;

/**
 * Which lane to put the ball back in at depth `y`, taking that depth as given.
 *
 * Both ways back into a run go through `respawnSpot` now, which may move the
 * depth as well; this is what the audits ask when the question really is about
 * one depth -- is the air a flag stands in good enough to be put back into.
 */
export function respawnX(w: World, y: number): number {
  return laneAt(w, y).x;
}

/**
 * The best lane at depth `y`, and how long it stays clear.
 *
 * A respawn used to drop straight onto the middle of the corridor, which is
 * only safe if the level happens to be authored that way at that depth. The
 * player's hand is very often not on the screen for the first moment after a
 * death, so instead the corridor is read ahead: every lane is flown down the
 * line a ball nobody taps actually takes -- the scroll along the run and
 * `idleSink` across it -- for `RESPAWN_CLEAR`, and the one that stays clear
 * longest wins, nearest the middle among equals.
 *
 * This is the whole of a respawn's safety now. The ball used to be immune for
 * the same window on top of this, which meant a badly picked lane cost
 * nothing; it is solid from the first frame, so the lane this picks is the run.
 *
 * `clear` is capped at the window that is actually flown, so a lane that
 * survives the whole of it comes back at the cap rather than at Infinity --
 * which is what lets `respawnSpot` tell "safe" from "the least bad of a bad
 * row" without caring how much further than safe it actually is.
 */
function laneAt(w: World, y: number): { x: number; clear: number } {
  const lanes: number[] = [];
  for (let x = FLOOR_X; x <= CEIL_X; x += LANE_STEP) lanes.push(x);
  // Time is the outer loop on purpose: every lane is asked about the same
  // depth at once, so the prop window is walked once per step and not once
  // per lane.
  const window = RESPAWN_CLEAR + LANE_LOOKAHEAD;
  const firstHit = lanes.map(() => window);
  let open = lanes.length;
  for (let t = 0; t <= window && open > 0; t += 0.05) {
    const depth = respawnDepth(w, y, t);
    for (let i = 0; i < lanes.length; i++) {
      if (firstHit[i] < window) continue;
      if (hitAt(w, w.t + t, idleLane(lanes[i], t), depth)) {
        firstHit[i] = t;
        open--;
      }
    }
  }
  let best = 0;
  for (let i = 1; i < lanes.length; i++) {
    const gap = firstHit[i] - firstHit[best];
    const nearer = Math.abs(lanes[i]) < Math.abs(lanes[best]);
    if (gap > 1e-9 || (Math.abs(gap) < 1e-9 && nearer)) best = i;
  }
  return { x: lanes[best], clear: firstHit[best] };
}

/** How far back up the corridor one step of the retry search moves, in px... */
const BACKUP_STEP = 120;
/**
 * ...or this much of a second's descent at the run's gear, whichever is more.
 *
 * The step used to be the flat 120px, which at the level's opening pace is a
 * second of corridor and eight steps is eight seconds of it. At the top gear
 * the same 120px is a quarter of a second, so the whole search covered two
 * seconds of run -- less than the window it is searching for -- and a retry in
 * a wide stretch settled for the least bad depth it could see and died there.
 * What the search is really looking for is somewhere the furniture is standing
 * differently, and how far away that is, is a length of *run*.
 *
 * The px floor keeps the opening pace on exactly the 120 it always had.
 */
const BACKUP_SECS = 1;
/** How many of those steps it may take before it settles for the best it saw. */
const BACKUP_TRIES = 8;

function backupStep(w: World) {
  return Math.max(BACKUP_STEP, CLIMB * w.pace * runGear(w.gear, w.creep) * BACKUP_SECS);
}

/**
 * Furthest up the corridor a retry can reach from where the run ended.
 *
 * The audits ask: a retry only has its whole search available where there is
 * that much corridor above it, and near the top of a level there is not. In
 * the game that gap never matters, because the top of a level is only ever
 * flown in first gear -- it takes minutes and tens of thousands of px of
 * descent to earn a second one.
 */
export function respawnReach(w: World) {
  return RESPAWN_BACKUP + BACKUP_TRIES * backupStep(w);
}

/**
 * Where to set the ball down for a retry: a depth at or above `y` with a lane
 * that survives the whole respawn window, and the best one seen if there is
 * no such depth within reach.
 *
 * `laneAt` alone is only as good as the depth it is asked about. Some places
 * in the corridor have no clear lane at all -- two frames abreast, one
 * of them turning side-on across a launcher's line -- and a retry that lands
 * on one kills the ball before the player's hand is back on the glass, which
 * lands them on the same spot again. That is the game getting stuck: a death
 * loop nothing on the card can break, at the one moment the player is pressing
 * the same button over and over. So the search walks back up the corridor a
 * step at a time until it finds air, and only takes the least bad depth once
 * it has run out of room. It never walks past `floor` -- the start of the
 * level -- so a retry can never hand back progress the player already made.
 */
export function respawnSpot(w: World, y: number, floor: number): { x: number; y: number } {
  let bestY = Math.max(floor, y);
  let bestLane = laneAt(w, bestY);
  const upBy = backupStep(w);
  for (let i = 1; i <= BACKUP_TRIES && bestLane.clear < RESPAWN_CLEAR; i++) {
    const up = y - i * upBy;
    if (up < floor) break;
    const lane = laneAt(w, up);
    if (lane.clear > bestLane.clear) {
      bestY = up;
      bestLane = lane;
    }
  }
  return { x: bestLane.x, y: bestY };
}

/**
 * Pick the run back up where it ended, a little way back up the corridor so
 * the ball is not put back inside whatever it hit. This is what an ordinary
 * retry does now: a failed run resumes at the blade that beat it rather than
 * sending the player through everything they already cleared.
 */
export function restartFromDeath(w: World) {
  // The pace the hump runs at where the run ended, which is what the retry
  // winds back up to.
  w.gear = paceAt(w, w.deathY);
  w.creep = 0;
  // The descent picks back up at the level's opening pace and winds up to the
  // gear the run had reached, at the same `SPEED_RATE` a flag winds it up at.
  //
  // This matters much less than it did while a gear was a whole multiple of
  // the descent -- the top of the ladder is a quarter faster than the opening
  // now, not four times -- but it is still what the respawn window is quoted
  // against: the window is a couple of seconds of unattended fall, and the
  // lane picker only promises a lane stays clear for as far as the ball will
  // actually travel in them. Winding up from the opening pace is the line the
  // picker flies, so it is the line the ball has to take.
  //
  // Set before the search, because the search reads it.
  w.speed = 1;
  // `RESPAWN_BACKUP` is where the retry would like to start; the search is
  // free to go further up than that, and never further down.
  const { x, y } = respawnSpot(w, Math.max(w.startY, w.deathY - RESPAWN_BACKUP), w.startY);
  w.status = 'playing';
  w.ballHidden = false;
  w.ball.y = y;
  w.ball.x = x;
  w.ball.fly = x;
  w.ball.lead = 0;
  // Set down with no lean and nothing held: the lane the picker chose is only
  // worth choosing if the ball actually starts down it.
  w.ball.lean = 0;
  w.windPush = 0;
  // The floor starts the retry bare, with a full rest before the spikes rise.
  w.spikeClock = 0;
  // Set down at rest: the ball starts the retry in the lane the picker chose
  // and falls away from there, so the player gets the same first tap every
  // time.
  w.ball.vx = 0;
  w.ball.trail.length = 0;
  w.camY = y;
  w.bullets = [];
  w.particles = [];
  w.pops = [];
  // Ease the descent back up rather than resuming at full speed, and drop any
  // leftover shake from the death, so the run picks up smoothly.
  w.settleUntil = w.t + RESPAWN_SETTLE;
  w.shakeUntil = 0;
  w.bonusUntil = 0;
  // Anything below is ahead of the ball again, so its pickups come back.
  for (const q of w.props) {
    if ((q.kind === 'star' || q.kind === 'tvBox') && q.y > y) q.taken = false;
  }
  // Put here, not flown here -- nothing for the drawing to interpolate from.
  syncPrev(w);
}

// --- the loop ---------------------------------------------------------------

export function step(w: World, dtRaw: number) {
  // Where everything the drawing interpolates stood before this step moved it.
  // Taken first, so it is the start of the step whatever the step goes on to
  // do -- including the ones that end the run.
  syncPrev(w);
  // Never let a stalled frame tunnel the ball through a blade.
  const dt = Math.min(dtRaw, 1 / 30);
  w.t += dt;
  w.pickup = 0;

  stepParticles(w, dt);
  stepPops(w, dt);
  stepDarkness(w, dt);

  if (w.status !== 'playing') {
    w.camY = holdCamera(lerp(w.camY, w.ball.y, Math.min(1, dt * 6)), w.ball.y);
    stepBullets(w, dt);
    return;
  }

  // Wind the descent toward its gear before the frame is flown, so the ball
  // and the corridor are never a step out of agreement about the pace.
  stepSpeed(w, dt);
  const climb = climbRate(w);
  const mult = w.t < w.bonusUntil ? 2 : 1;

  w.spikeClock += dt;
  stepFlight(w, dt, climb);
  stepSteer(w, dt);
  stepWind(w, dt);
  recordTrail(w);
  w.score += (climb / 45) * dt * mult;

  stepTurrets(w, dt);
  stepBullets(w, dt);

  pickups(w, mult);
  hitTest(w);
}

/**
 * The corridor scrolls on its own; the ball flies through it.
 *
 * The camera is the level's clock and is no longer allowed to chase the ball
 * -- it would swallow the whole control if it did, following every tap up the
 * screen so the ball never appeared to move. It advances at the scroll rate
 * and nothing else, and the ball's own rise and fall is measured against it.
 *
 * The corridor's own two walls are the ceiling and the floor. Reaching either
 * is not a death: the ball simply rests against it, and the run carries on at
 * whatever height the player has left it at. Nothing about the scroll depends
 * on any of it, so the level's pacing is untouched.
 */
function stepFlight(w: World, dt: number, climb: number) {
  w.camY += climb * dt;
  // Gravity, every frame and with nothing able to switch it off: a finger on
  // the glass is a nudge and never a brake, so the ball is always either on
  // its way up out of the last tap or on its way back down.
  w.ball.vx = clamp(w.ball.vx - FALL_G * dt, -SINK_MAX, RISE_MAX);
  w.ball.fly += w.ball.vx * dt;

  if (w.ball.fly < FLOOR_X) {
    w.ball.fly = FLOOR_X;
    if (w.ball.vx < 0) w.ball.vx = 0;
  } else if (w.ball.fly > CEIL_X) {
    w.ball.fly = CEIL_X;
    if (w.ball.vx > 0) w.ball.vx = 0;
  }

  // Along the run the ball rides the camera exactly, offset by whatever the
  // drag has left on it. There is no velocity to integrate here on purpose --
  // see `steerBy`.
  w.ball.y = w.camY + w.ball.lead;
}

/**
 * Keep the camera within `BALL_DRIFT` of the ball, so the ball can never ride
 * further than that up or down the screen from its anchor.
 *
 * The chase alone is enough while the ball is falling, but it is a lerp: put
 * the ball somewhere else outright and the camera needs several frames to
 * arrive, and the ball is drawn wherever the gap says in the meantime. This is
 * the ceiling and the floor on that gap.
 */
function holdCamera(camY: number, ballY: number) {
  return clamp(camY, ballY - BALL_DRIFT, ballY + BALL_DRIFT);
}

/**
 * What is left of the drag step now that it sets the ball's lead outright: the
 * lean coming back off.
 *
 * There is deliberately no integration here. `steerBy` has already put `lead`
 * where the finger's travel says it goes, and a step that added any more
 * motion on top would be the ball carrying on after the thumb had stopped --
 * which is the one thing this control scheme exists to prevent.
 *
 * `lean` is therefore not a velocity the ball is flying at; it is a reading of
 * how fast the last drag was moving it, kept only so the ball can be drawn
 * leaning that way. A finger that stops sends no more events, so without this
 * the ball would sit frozen mid-turn for as long as the thumb rested. Bleeding
 * it off returns the ball to upright in about a sixth of a second and changes
 * nothing about where it is.
 */
function stepSteer(w: World, dt: number) {
  const { ball } = w;
  const bleed = LEAN_BLEED * dt;
  ball.lean = Math.abs(ball.lean) <= bleed ? 0 : ball.lean - Math.sign(ball.lean) * bleed;
}

/**
 * Wind shoves the ball across the corridor while it is inside a band, and
 * hands back every px of it once the ball is clear.
 *
 * It is kept out of `vx` on purpose: folding it into the flight would leave
 * the ball carrying the gust's momentum out of the band with it, when what the
 * band is meant to be is a fixed shove that the player flies against while
 * they are inside it. So the ball keeps two positions on this axis: `fly` is
 * the line it has flown itself, which is all gravity and the taps ever touch,
 * and `x` is that line with the gust laid over the top of it. Leaving the band
 * lets `windPush` ease back to nothing and the ball is handed every px of it
 * back, having never had any of it as speed.
 *
 * It matters more than it used to. The shove and the fall are the same axis
 * now, so a gust folded into `vx` would not be a shove at all -- it would be
 * gravity the player could not out-fly, or an updraught they could ride.
 */
function stepWind(w: World, dt: number) {
  const push = windAt(w, w.ball.x, w.ball.y);
  if (push) {
    w.windPush = clamp(w.windPush + push * WIND_FORCE * dt, -WIND_MAX, WIND_MAX);
  } else if (w.windPush) {
    // Out of the band it eases back rather than snapping the ball across.
    const ease = Math.min(Math.abs(w.windPush), WIND_FORCE * dt);
    w.windPush -= Math.sign(w.windPush) * ease;
  }
  w.ball.x = clamp(w.ball.fly + w.windPush, FLOOR_X, CEIL_X);
}

/**
 * Which way the wind blows at a point, as -1, 0 or 1 scaled by how deep into
 * the band it is. The edges ramp so the ball is nudged rather than yanked.
 */
export function windAt(w: World, x: number, y: number) {
  let push = 0;
  for (const p of propsNear(w, y)) {
    if (p.kind !== 'wind' || p.taken) continue;
    if (y < p.y || y > p.y + p.span) continue;
    if (Math.abs(x - p.x) > p.size / 2) continue;
    const edge = Math.min(y - p.y, p.y + p.span - y);
    push += p.side * clamp(edge / 60, 0, 1);
  }
  return push;
}

/** Keep a short history of where the ball has been, for the tail. */

function recordTrail(w: World) {
  const tr = w.ball.trail;
  tr.unshift(w.ball.x, w.ball.y);
  if (tr.length > TRAIL_POINTS * 2) tr.length = TRAIL_POINTS * 2;
  // Cut the tail off once it has used up its length, so a fast stretch never
  // trails a long elbow behind the ball.
  let used = 0;
  for (let i = 2; i < tr.length; i += 2) {
    used += Math.hypot(tr[i] - tr[i - 2], tr[i + 1] - tr[i - 1]);
    if (used > TRAIL_LEN) {
      // Shorten this last segment so the tail ends at exactly the cap.
      const over = used - TRAIL_LEN;
      const seg = Math.hypot(tr[i] - tr[i - 2], tr[i + 1] - tr[i - 1]) || 1;
      const k = 1 - over / seg;
      tr[i] = tr[i - 2] + (tr[i] - tr[i - 2]) * k;
      tr[i + 1] = tr[i - 1] + (tr[i + 1] - tr[i - 1]) * k;
      tr.length = i + 2;
      break;
    }
  }
}

/** Ease into (and out of) the inverted stretch instead of snapping. */
function stepDarkness(w: World, dt: number) {
  const s = w.stages[stageAt(w, w.camY)];
  const target = s && s.dark ? 1 : 0;
  w.darkness += (target - w.darkness) * Math.min(1, dt * 1.6);
}

// --- turrets and their shots ------------------------------------------------

function stepTurrets(w: World, dt: number) {
  for (const p of propsNear(w, w.ball.y)) {
    if (p.kind !== 'turret') continue;
    if (p.phase > 0) p.phase = Math.max(0, p.phase - dt);
    if (Math.abs(p.y - w.ball.y) > TURRET_RANGE) continue;
    p.cooldown -= dt;
    if (p.cooldown > 0) continue;
    p.cooldown = TURRET_PERIOD;
    // The muzzle glows red for a beat as the shot leaves.
    p.phase = 0.5;
    fire(w, p);
  }
}

/**
 * One shot, on the launcher's own line.
 *
 * The ball is not an input. See `BULLET_SPEED` in `config.ts` for why the
 * shots stopped being aimed.
 */
function fire(w: World, p: Prop) {
  w.bullets.push({
    id: w.nextId++,
    x: p.x,
    y: p.y,
    vx: Math.cos(p.angle) * BULLET_SPEED,
    vy: Math.sin(p.angle) * BULLET_SPEED,
    life: BULLET_LIFE,
  });
}

function stepBullets(w: World, dt: number) {
  if (!w.bullets.length) return;
  const keep = [];
  for (const b of w.bullets) {
    b.life -= dt;
    // Spent, out of the corridor, or far enough along the run to be nobody's
    // problem. The wall is the usual one: a shot crosses and is gone, rather
    // than flying on invisibly for the rest of its life.
    const gone = Math.abs(b.x) > HALF_W + BULLET_R;
    if (b.life <= 0 || gone || Math.abs(b.y - w.camY) > 1600) {
      burst(w, b.x, b.y, 12, 0);
      continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // A wisp of dark smoke behind the shot, the way the reference draws it.
    // Rated per second, not per frame, so a fast device is not the one paying
    // for the extra dots.
    if (Math.random() < dt * 26) {
      w.particles.push({
        id: w.nextId++,
        x: b.x - b.vx * 0.02,
        y: b.y - b.vy * 0.02,
        vx: -b.vx * 0.08,
        vy: -b.vy * 0.08,
        life: 0.22 + Math.random() * 0.12,
        size: 2.5 + Math.random() * 2.5,
        hue: 0,
      });
    }
    keep.push(b);
  }
  w.bullets = keep;
}

// --- particles and score chips ----------------------------------------------

export function burst(w: World, x: number, y: number, n: number, hue: 0 | 1) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + Math.random() * 0.6;
    const sp = 40 + Math.random() * 130;
    w.particles.push({
      id: w.nextId++,
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.5,
      size: 3 + Math.random() * 4,
      hue,
    });
  }
}

function stepParticles(w: World, dt: number) {
  if (!w.particles.length) return;
  const keep = [];
  for (const q of w.particles) {
    q.life -= dt;
    if (q.life <= 0) continue;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 180 * dt;
    q.vx *= 0.96;
    keep.push(q);
  }
  w.particles = keep;
}

export function pop(w: World, x: number, y: number, label: string) {
  w.pops.push({ id: w.nextId++, x, y, label, life: 0.9 });
}

function stepPops(w: World, dt: number) {
  if (!w.pops.length) return;
  const keep = [];
  for (const q of w.pops) {
    q.life -= dt;
    if (q.life <= 0) continue;
    // Drift against the fall so the chip reads as rising.
    q.y -= 55 * dt;
    keep.push(q);
  }
  w.pops = keep;
}

// --- pickups and gates ------------------------------------------------------

function pickups(w: World, mult: number) {
  const { ball } = w;
  for (const p of propsNear(w, ball.y)) {
    if (p.taken) continue;

    if (p.kind === 'flag') {
      if (ball.y < p.y) continue;
      p.taken = true;
      // The checkpoint and the payout. The pace is the level's hump now, not
      // the flags', so taking one leaves the corridor's speed alone.
      w.score += FLAG_SCORE * mult;
      w.runCoins += FLAG_COINS;
      w.checkpoint = { y: p.y, score: w.score, gear: w.gear, creep: w.creep };
      // Flagged for the frame, so the screen can put up the one banner a run
      // gets: what was earned, and what just happened to the descent.
      w.pickup = 3;
      burst(w, ball.x, p.y, 22, 1);
      pop(w, ball.x, p.y, `+${FLAG_SCORE * mult}`);
      continue;
    }

    if (p.kind === 'plate') {
      if (ball.y < p.y) continue;
      p.taken = true;
      w.ball.y = p.y;
      w.status = 'finished';
      burst(w, ball.x, p.y, 20, 1);
      continue;
    }

    if (p.kind === 'star' || p.kind === 'tvBox') {
      if (Math.hypot(p.x - ball.x, p.y - ball.y) > p.radius + BALL_R) continue;
      p.taken = true;
      // 1 = coin, 2 = console: the console pays out five and starts the bonus.
      w.pickup = p.kind === 'star' ? 1 : 2;
      if (p.kind === 'star') {
        w.runCoins += 1;
        w.score += 5 * mult;
        pop(w, ball.x, p.y, `+${5 * mult}`);
      } else {
        w.runCoins += 5;
        w.score += 20 * mult;
        w.bonusUntil = w.t + BONUS_SECS;
        burst(w, ball.x, p.y, 16, 1);
        pop(w, ball.x, p.y, `+${20 * mult}`);
      }
    }
  }
}

// --- collisions -------------------------------------------------------------

function hitTest(w: World) {
  const bx = w.ball.x;
  const by = w.ball.y;

  for (const b of w.bullets) {
    if (Math.hypot(b.x - bx, b.y - by) < BULLET_R + BALL_R) return die(w);
  }

  // The floor's spikes, while they are up: anything touching them ends the run.
  const spikes = spikeState(w.spikeClock);
  if (w.spikes && spikes.lethal && bx - BALL_R < -HALF_W + SPIKE_H * spikes.out) return die(w);

  if (hitAt(w, w.t, bx, by)) die(w);
}

/**
 * The prop covering this point, if any. The run asks about the ball; the level
 * audit asks about wherever it is considering flying next.
 */
export function hitAt(w: World, t: number, bx: number, by: number): Prop | null {
  for (const p of propsNear(w, by)) {
    if (p.taken) continue;
    // Cull on Y first; nothing reaches more than a screen away from its anchor.
    if (by < p.y - 260 || by > p.y + p.span + 260) continue;

    switch (p.kind) {
      // No `pipe` case on purpose. A pipe is only the rail its blade rides:
      // brushing the bare line is a near miss, not a death. What is bolted to
      // it -- the gear, the capsule -- is still solid.

      case 'gear': {
        const g = gearPos(p, t);
        if (Math.hypot(g.x - bx, g.y - by) < BALL_R + p.radius) return p;
        break;
      }

      case 'capsule': {
        const cx = capsuleX(p);
        const cy = capsuleY(p, t);
        if (distToSeg(bx, by, cx, cy - CAPSULE_HH, cx, cy + CAPSULE_HH) < BALL_R + p.radius) {
          return p;
        }
        break;
      }

      case 'bigWheel': {
        const band = wheelBand(p.radius);
        const wx = swayX(p, t);
        const d = Math.hypot(bx - wx, by - p.y);
        if (Math.abs(d - p.radius) < BALL_R + band) return p;
        for (let i = 0; i < 4; i++) {
          const a = p.angle + p.spin * t + Math.PI / 4 + (i * TAU) / 4;
          const inner = p.radius - band;
          const hit =
            distToSeg(
              bx,
              by,
              wx + Math.cos(a) * inner,
              p.y + Math.sin(a) * inner,
              wx + Math.cos(a) * p.reach,
              p.y + Math.sin(a) * p.reach,
            ) <
            BALL_R + 6;
          if (hit) return p;
        }
        break;
      }

      // No `hexagon` case either, and for the pipe's reason: a hexagon is
      // the cage its blades are strung across rather than a blade itself. The
      // shape is read, the gap between the two saws sliding about inside it is
      // picked, and the ball is flown through -- which a lethal outline made
      // impossible, since the only way in is across an edge. The outline and
      // the rails inside it are scenery; the saws still end the run.
      case 'triangle':
      case 'square': {
        const sides = p.kind === 'triangle' ? 3 : 4;
        for (let i = 0; i < sides; i++) {
          const u = frameCorner(p, t, i, sides);
          const v = frameCorner(p, t, i + 1, sides);
          if (distToSeg(bx, by, u.x, u.y, v.x, v.y) < BALL_R + 6) return p;
        }
        break;
      }

      case 'bracket': {
        if (bracketHit(p, t, bx, by)) return p;
        break;
      }

      case 'turret':
        if (Math.hypot(p.x - bx, p.y - by) < BALL_R + p.size / 2) return p;
        break;

      case 'dropSaw':
        if (Math.hypot(dropX(p, t) - bx, p.y - by) < BALL_R + p.radius) return p;
        break;

      // The arm, like a pipe, is only what the blade rides on.
      case 'pendulum': {
        const b = pendulumPos(p, t);
        if (Math.hypot(b.x - bx, b.y - by) < BALL_R + p.radius) return p;
        break;
      }

      // So are the spokes: only the saws on the ends of them bite.
      case 'orbiter':
        for (let i = 0; i < p.count; i++) {
          const b = orbiterPos(p, t, i);
          if (Math.hypot(b.x - bx, b.y - by) < BALL_R + p.radius) return p;
        }
        break;

      case 'zipper':
        if (Math.hypot(p.x - bx, zipperY(p, t) - by) < BALL_R + p.radius) return p;
        break;

      case 'crusher': {
        const face = crusherFace(p, t);
        const lo = Math.min(p.x, face);
        const hi = Math.max(p.x, face);
        const dx = bx < lo ? lo - bx : bx > hi ? bx - hi : 0;
        const dy = Math.max(0, Math.abs(by - p.y) - p.size / 2);
        if (Math.hypot(dx, dy) < BALL_R) return p;
        break;
      }
    }
  }
  return null;
}

function die(w: World) {
  w.status = 'dead';
  w.deathY = w.ball.y;
  w.shakeUntil = w.t + 0.35;
  w.ballHidden = true;
  burst(w, w.ball.x, w.ball.y, 26, 0);
}
