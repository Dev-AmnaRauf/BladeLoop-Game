import {
  AUTHOR_HALF_W,
  BALL_R,
  BLADE_BOB,
  BRACKET_GAP,
  BRACKET_H,
  BRACKET_W,
  CAPSULE_BOB,
  CAPSULE_HH,
  CAPSULE_OFFSET,
  CLIMB,
  FLAG_GAP_SECS,
  FLOOR_X,
  HALF_W,
  HURDLE_GAP,
  RAIL_MIN,
  SHOT_SPREAD,
  SPREAD,
  STAGE_H,
  clamp,
  paceHeat,
  paceShape,
} from './config';
import type { Prop, PropKind, Stage, World } from './types';

/**
 * The level follows the reference run frame by frame, in its own order:
 *
 *   s01  a line off centre: two blades on rails, a coin, a tumbling triangle
 *   s02  the far-left line with pill blades, two spoked rings out to the right
 *   s03  three lines of small blades in quick succession, then the first flag
 *   s04  two lines: ringed blades and a pill on the left, long rails right
 *   s05  those lines running out, a flag, and the first hexagons arriving
 *   s06  the hexagon run, blades on the outer edge
 *   s07  more hexagons, with a flag standing in the middle of them
 *   s08  straight on with no flag: a capped line and three ringed blades
 *   s09  a flag first, then pill blades, the green launcher and open frames
 *   s10  the frames on their own
 *   s11  a flag, then the console -- taking it pays out and starts the bonus
 *   s12  past the banner: another console, more frames
 *   s13  a long line between two launchers
 *   s14  the launcher again over a line of pills
 *   s15  the last flag, pills, a launcher and one more frame
 *   s16  a short line and the dish
 *
 * Past that the reference runs out, and the corridor carries on in its own
 * vocabulary rather than borrowing a sixteenth idea from somewhere else. Each
 * later level takes one of the things the run already does and makes it the
 * whole of that level, which is what gives them names a player can hold on to:
 *
 *   s17-s19  the yard: spoked rings, the widest furniture in the game
 *   s20-s22  crossfire: launchers on both walls, shooting across each other
 *   s23-s25  the tunnel: wind, and frames to be blown through
 *   s26-s28  the gauntlet: hexagons and ringed blades, back to back
 *   s29-s32  the core: everything at once, and the first half's last dish
 *   s33-s35  pill works: the capsule lines, close and slow
 *   s36-s38  spin cycle: ringed blades, both walls, nothing else
 *   s39-s41  tumbledown: the frames on their own, turning
 *   s42-s44  ring road: the spoked rings again, at pace
 *   s45-s47  the gallery: launchers over lines, three to a stage
 *   s48-s50  headwind: the bands, with something to be blown into
 *   s51-s53  honeycomb: hexagons, one after another
 *   s54-s56  switchback: the lane changing wall every few seconds
 *   s57-s59  the grind: the tight furniture, back to back
 *   s60-s63  event horizon: every hazard in the game, and the last dish
 *
 * The second ten are the first ten's vocabulary read back at a harder pace
 * rather than ten new hazards: a hazard the player has never seen arriving
 * this far down is a hazard they meet for the first time with nine levels of
 * progress riding on it, which is the one thing a run of this length must not
 * do to them.
 */
export const SCRIPT: string[] = [
  's01_line',
  's02_wheels',
  's03_ringPipe',
  's04_twinRods',
  's05_rodsEnd',
  's06_hexRun',
  's07_hexFlag',
  's08_ringLadder',
  's09_turretFrames',
  's10_frameRun',
  's11_console',
  's12_afterBanner',
  's13_turretPair',
  's14_turretPills',
  's15_lastRun',
  's16_final',
  's17_wheelYard',
  's18_wheelRun',
  's19_wheelFlag',
  's20_crossfire',
  's21_crossPills',
  's22_crossFlag',
  's23_windGate',
  's24_windFrames',
  's25_windFlag',
  's26_gauntlet',
  's27_hexRings',
  's28_gauntletFlag',
  's29_coreOpen',
  's30_coreTurrets',
  's31_coreFrames',
  's32_coreFinal',
  's33_pillLine',
  's34_pillGate',
  's35_pillFlag',
  's36_ringWalk',
  's37_ringPairs',
  's38_ringFlag',
  's39_frameFall',
  's40_frameLine',
  's41_frameFlag',
  's42_wheelGate',
  's43_wheelRun',
  's44_wheelFlag',
  's45_gallery',
  's46_galleryPills',
  's47_galleryFlag',
  's48_gustGate',
  's49_gustWheels',
  's50_gustFlag',
  's51_comb',
  's52_combLines',
  's53_combFlag',
  's54_switch',
  's55_switchWind',
  's56_switchFlag',
  's57_grind',
  's58_grindRings',
  's59_grindFlag',
  's60_horizon',
  's61_horizonFire',
  's62_horizonWind',
  's63_horizonFinal',
];

/** Where stage one's tumbling triangle sits, below the opening line. */
export const TRIANGLE_Y = 790;
export const TRIANGLE_R = 102;

/** Turns per second a ringed blade makes round its pipe. */
const RING_ORBIT = 0.3;

/** How far the big rings swing either side of their anchor, and how fast. */
const WHEEL_SWAY = 30;
const WHEEL_DRIFT = 0.16;

/** Clear air a hexagon keeps between its widest corner and the wall. */
const HEX_MARGIN = 5;

/** How fast a blade on a pipe rail travels back and forth, and how it spins. */
const BLADE_SLIDE = 0.22;
const BLADE_SPIN = 7;

/**
 * Lay one prop down, turning the x the stage authored into the x it is flown
 * at.
 *
 * This is the one place the corridor is stretched, and it is deliberately the
 * narrowest place it could be put. Every prop in the game is built here, so
 * every authored position goes through it exactly once -- there is no second
 * copy of `SPREAD` anywhere a stage can see, and no stage can forget to apply
 * it. What comes out the other side is world space: `x` on a `Prop` means the
 * same thing to the collision, the camera and the audit as it always did.
 *
 * Only `x` is touched. `y` is the descent and is not stretched, and nothing in
 * `patch` is either -- a radius, a span, a size is a measurement of the shape
 * itself and belongs to the shape rather than to the corridor. The few
 * distances that do run *across* the corridor -- a rail's reach, a ring's
 * sway, a band's width, a line's cap -- are stretched by the helper that
 * authors them, just above, where it is visible which of the two a number is.
 */
function mk(w: World, kind: PropKind, x: number, y: number, patch: Partial<Prop> = {}): Prop {
  return {
    id: w.nextId++,
    kind,
    x: x * SPREAD,
    y,
    span: 0,
    radius: 15,
    reach: 0,
    angle: 0,
    spin: 0,
    rate: 0,
    sway: 0,
    phase: 0,
    side: 1,
    ring: 0,
    bob: 0,
    size: 30,
    count: 0,
    taken: false,
    cooldown: 0,
    ...patch,
  };
}

/**
 * Where the ball starts, above the first stage.
 *
 * The run-up is the clear air the ball opens in, before the first line: a
 * couple of seconds at the pace a level opens on. It used to carry a flag of
 * its own, standing over the first line as the reference has it. That flag is
 * gone: the flags are the speed ladder now, and one of them on the run-up
 * would double the descent before the player had read a single gap.
 */
export const OPENING_Y = -470;

/**
 * The levels, each a run of the script's stages.
 *
 * The level used to be one long descent through every stage in `SCRIPT`. It
 * is the same corridor, cut up -- so nothing here is filler: level one is the
 * opening lines and the first wheels, and level five is the launchers and the
 * frames that used to sit twenty stages down, where almost nobody ever saw
 * them. Each level is its own run with its own dish at the bottom, and
 * clearing it wins the star that level owns.
 *
 * The first five are the reference's own run. Everything after it is the game
 * carrying on in its own vocabulary, one idea per level. The last one is the
 * one the map crowns: it is not a different kind of fight, it is every other
 * level at once and the longest descent in the game.
 *
 * Twenty of them rather than ten, and the second ten are not a second game.
 * They are the same hazards on a shorter leash -- a level of nothing but
 * ringed blades, a level of nothing but frames -- which is what a run of this
 * length is actually made of: the player already knows every shape by level
 * eleven, so what is left to ask them is to read the same shapes faster and
 * with less room. Nothing new is introduced past level ten on purpose.
 *
 * `from`/`to` are indices into `SCRIPT`, `to` exclusive. `dark` is how much of
 * the level's close runs on the deeper palette, quoted as a number of the
 * window's own stages -- one for the short early levels and more as the run
 * gets long, so every level has a stretch that visibly turns before its dish.
 *
 * `secs` is how long the descent is meant to last, and it is what actually
 * decides how long the corridor is: stages are laid down until the planned
 * descent covers it. A level used to be its window and nothing else, which
 * came out at about twenty seconds of play -- an authored idea rather than a
 * level. It is now five to seven minutes, and the finale ten.
 *
 * What fills those minutes is not the window on repeat. Every script stage is
 * laid once: the descent opens on the corridor behind the level, fills its
 * middle and its close with fresh hurdles dealt from `HURDLES`, and finishes on
 * the level's own window -- see `buildLevel`. So the level has a beginning, a
 * middle and an end, and a hurdle the player has got past is not the hurdle
 * that comes next.
 */
export interface LevelDef {
  /** 1-based, the way the player is shown it. */
  n: number;
  name: string;
  from: number;
  to: number;
  dark: number;
  /** How long the descent should take, in seconds. */
  secs: number;
  /**
   * The level's signature: the set pieces it deals between its hurdles, and
   * that no other level deals in the same mix. See `SIGNATURES`.
   */
  sig: SigName[];
}

/**
 * How long the closing stretch runs on the deeper palette, in seconds: the
 * floor every level gets, and how much more the deepest `dark` adds on top.
 * A minute either side of it, which is long enough to read as the level
 * turning and short enough that most of the run is still the level's own
 * night.
 */
const DARK_SECS_MIN = 40;
const DARK_SECS_SPAN = 60;

/** Five minutes, six, seven, and the ten the finale runs for. */
const FIVE = 300;
const SIX = 360;
const SEVEN = 420;
const FINALE = 600;

export const LEVELS: LevelDef[] = [
  { n: 1, name: 'First Blades', from: 0, to: 3, dark: 1, secs: FIVE, sig: ['zipper'] },
  { n: 2, name: 'Rod Works', from: 3, to: 6, dark: 1, secs: FIVE, sig: ['pendulum'] },
  { n: 3, name: 'Hex Gardens', from: 6, to: 9, dark: 2, secs: FIVE, sig: ['orbiter'] },
  { n: 4, name: 'Frame Run', from: 9, to: 12, dark: 2, secs: FIVE, sig: ['rain'] },
  { n: 5, name: 'Last Descent', from: 12, to: 16, dark: 3, secs: SIX, sig: ['crusher'] },
  { n: 6, name: 'Wheel Yard', from: 16, to: 19, dark: 2, secs: FIVE, sig: ['fountain'] },
  { n: 7, name: 'Crossfire', from: 19, to: 22, dark: 2, secs: SIX, sig: ['zipper', 'crusher'] },
  { n: 8, name: 'Wind Tunnel', from: 22, to: 25, dark: 2, secs: SIX, sig: ['pendulum', 'rain'] },
  { n: 9, name: 'The Gauntlet', from: 25, to: 28, dark: 3, secs: SIX, sig: ['orbiter', 'rain'] },
  { n: 10, name: 'Core Breach', from: 28, to: 32, dark: 3, secs: SEVEN, sig: ['crusher', 'pendulum'] },
  { n: 11, name: 'Pill Works', from: 32, to: 35, dark: 2, secs: SIX, sig: ['rain', 'zipper'] },
  { n: 12, name: 'Spin Cycle', from: 35, to: 38, dark: 2, secs: SIX, sig: ['orbiter', 'fountain'] },
  { n: 13, name: 'Tumbledown', from: 38, to: 41, dark: 2, secs: SIX, sig: ['pendulum', 'fountain'] },
  { n: 14, name: 'Ring Road', from: 41, to: 44, dark: 2, secs: SIX, sig: ['zipper', 'orbiter'] },
  { n: 15, name: 'Shooting Gallery', from: 44, to: 47, dark: 2, secs: SEVEN, sig: ['crusher', 'rain'] },
  { n: 16, name: 'Headwind', from: 47, to: 50, dark: 2, secs: SEVEN, sig: ['fountain', 'zipper'] },
  { n: 17, name: 'Honeycomb', from: 50, to: 53, dark: 3, secs: SEVEN, sig: ['orbiter', 'crusher'] },
  { n: 18, name: 'Switchback', from: 53, to: 56, dark: 3, secs: SEVEN, sig: ['rain', 'fountain'] },
  {
    n: 19,
    name: 'The Grind',
    from: 56,
    to: 59,
    dark: 3,
    secs: SEVEN,
    sig: ['crusher', 'zipper', 'pendulum'],
  },
  {
    n: 20,
    name: 'Event Horizon',
    from: 59,
    to: 63,
    dark: 4,
    secs: FINALE,
    sig: ['rain', 'pendulum', 'orbiter', 'zipper', 'crusher', 'fountain'],
  },
];

/**
 * The level the map draws with a crown on it: the end of the authored run.
 *
 * It is a name for the last authored level rather than a different kind of
 * level: the corridor has one verb in it and a boss with a health bar would be
 * a second game bolted to the side of the first. What makes it the finale is
 * that it is the longest run and it uses every hazard the game has.
 *
 * It is no longer the last level the player can reach -- the road carries on
 * past it, without end -- but it is still the last one that was *written*, and
 * the crown marks that.
 */
export const BOSS_LEVEL = LEVELS[LEVELS.length - 1].n;

/** How many levels are authored by hand. Everything past this one is built. */
export const LEVEL_COUNT = LEVELS.length;

/**
 * Where the endless run draws its corridors from.
 *
 * The first five levels are the reference's own opening -- three short stages
 * apiece, the game teaching itself -- so recycling those past the finale would
 * drop a player who has just cleared twenty levels back into the tutorial. The
 * endless run therefore cycles levels six to twenty: the part of the script
 * that is already written at full difficulty.
 */
const ENDLESS_FROM = 6;
const ENDLESS_POOL = LEVELS.slice(ENDLESS_FROM - 1);

/** How a repeat of a corridor is marked on the road and on the cards. */
const REPEAT = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Built levels, kept so the road and the cards read the same object twice. */
const endless = new Map<number, LevelDef>();

/** True for a level past the authored ones: one this file builds on demand. */
export function isEndless(n: number) {
  return Math.round(n) > LEVEL_COUNT;
}

/**
 * A level past the authored twenty.
 *
 * It is one of the authored corridors again rather than a corridor generated
 * out of nothing. Every stage in the game is placed by hand and audited --
 * that a level is survivable at all is a fact about the stages in it, not
 * something a generator could promise -- so the endless run re-deals the
 * windows that are already written and already tested, in order, and the only
 * thing that moves with each lap is how much of the level runs on the deep
 * palette.
 *
 * That makes the run genuinely unlimited without ever handing the player a
 * corridor nobody has played.
 */
function buildEndless(n: number): LevelDef {
  const past = n - LEVEL_COUNT - 1;
  const src = ENDLESS_POOL[past % ENDLESS_POOL.length];
  const lap = Math.floor(past / ENDLESS_POOL.length) + 1;
  const stages = src.to - src.from;
  const mark = REPEAT[lap] ?? String(lap + 1);
  return {
    n,
    name: `${src.name} ${mark}`,
    from: src.from,
    to: src.to,
    // A deeper night each lap, up to the whole level running dark.
    dark: Math.min(stages, src.dark + lap),
    // The same descent the corridor was written for. The endless run deals
    // corridors again rather than stretching them, so a lap of the road is
    // the same length of run it was the first time round.
    secs: src.secs,
    sig: src.sig,
  };
}

/**
 * The level `n`, authored or built.
 *
 * Anything below level one is clamped up to it -- a save that came back
 * strange still opens a level -- but there is no ceiling any more: ask for
 * level three thousand and you get one.
 */
export function levelAt(n: number): LevelDef {
  const want = Math.max(1, Math.round(n) || 1);
  if (want <= LEVEL_COUNT) return LEVELS[clamp(want - 1, 0, LEVELS.length - 1)];
  const known = endless.get(want);
  if (known) return known;
  const built = buildEndless(want);
  endless.set(want, built);
  return built;
}

/**
 * How far past the last thing in a level its dish sits, in px: a hurdle gap
 * of clear air to the dish's near edge, and the dish's own radius.
 *
 * Only the script's own final stages bring a dish with them; every other level
 * has its dish set down here instead. It goes after a run-out rather than on
 * top of the last hazards, so a level never ends with the player threading a
 * gap and landing on the finish in the same breath -- but only a hurdle gap of
 * one, since a long empty stretch before the finish reads as the level having
 * run out of things to say.
 */
export const RUNOUT = HURDLE_GAP + 100;

/**
 * Stages that finish on a dish of their own.
 *
 * Three of them do: the end of the reference's run, the end of the first ten
 * levels, and the end of the game. Each is authored around its dish -- the
 * wind that blows the ball into it is part of the stage -- so none of them
 * wants the generic one dropped in the clear air past its last hazard.
 */
const CLOSING_STAGES = new Set(['s16_final', 's32_coreFinal', 's63_horizonFinal']);

/**
 * What a level hands out once, and only out of its own window.
 *
 * A star is worth one gem wherever it lies, and the road draws a socket for
 * every star a level holds. The console is worth five and a bonus window,
 * which is a fine thing to meet once in a level and a giveaway if the descent
 * keeps reaching back for it. So both are
 * laid the first time the level's own stage comes round and never again -- a
 * recalled stage, or an audit's second lap, holds the hazards only.
 */
const FIRST_LAP_ONLY = new Set<PropKind>(['star', 'tvBox']);

/**
 * How a level is laid down.
 *
 * The defaults are the game: the opening, the fresh hurdles and the level's
 * own window, as long as the level's own `secs` asks, with the flags thinned
 * to the speed ladder. The two overrides are for the audits, which fly the
 * script stages of every level in the game; the fresh hurdles have audits of
 * their own in `hurdles.test.ts`.
 */
export interface BuildOpts {
  /**
   * Lay the level's own window this many times and nothing else, instead of
   * the full descent.
   */
  laps?: number;
  /**
   * Keep every flag the stages author rather than thinning them to
   * `FLAG_GAP_SECS`. The audit wants every authored flag position checked,
   * including the ones a full-length level would drop.
   */
  allFlags?: boolean;
}

/**
 * Where a level's closing stretch begins, as a share of the descent it is
 * planned around.
 *
 * A level has three stretches. It opens on corridor the player has already
 * flown, spends its middle on fresh hurdles drawn from everything it and the
 * levels behind it know, and closes on fresh hurdles of its own idea alone,
 * finishing on its own window. Quoted as a share rather than a stage count,
 * because a stage is worth less time the further down the flag ladder it is
 * met, and because the same shape then holds for the five-minute levels and
 * for the ten-minute finale.
 */
const CLOSE_BEGINS = 0.7;

/**
 * How far back down the script a level reaches for the corridor it opens on.
 *
 * Two levels' worth of stages. Far enough back that the opening plainly is
 * not the level's own idea, and near enough that a player who has just
 * cleared level seventeen is not handed the first line of the game again --
 * the same reason the endless run deals from level six and not from level
 * one. Nothing *ahead* of the level is ever reached for: an opening is the
 * last place to meet a hazard for the first time.
 */
const RECALL = 6;

/**
 * How much floor has to stay clear past a flag, or past anything that reaches
 * down to the floor, before something else may reach it, in px.
 *
 * A retry is set down with no hand on the glass, so the ball falls to the
 * floor and rides it. The lane picker needs somewhere that ride stays clear
 * for the whole respawn window, and a corridor with no gaps in it would give
 * it nowhere: so the one thing the hurdles are never allowed to do is reach
 * the floor twice in quick succession. 400 is the window at the top of the
 * ladder with room to spare.
 */
const FLOOR_WINDOW = 400;

/**
 * The hazards a hurdle is built from, as the player learns them.
 *
 * A level may only lay a fresh hurdle made of things it or the levels behind
 * it have already shown -- the same rule the opening follows, for the same
 * reason.
 */
type Tag = 'rail' | 'ring' | 'pill' | 'wheel' | 'hex' | 'frame' | 'turret' | 'wind';

/** How far a frame's corner swings from its centre, at the worst turn. */
const FRAME_REACH = Math.hypot(BRACKET_W + BRACKET_GAP / 2, BRACKET_H / 2) + 6;

/**
 * How far along the run a prop can reach, as [first, last] depth, or null for
 * one that is only a marker.
 *
 * Everything that is drawn as a shape counts, lethal or not: a hexagon's cage
 * and a bare line are scenery to the collision, but a hurdle laid over the top
 * of one would still read as two shapes in the same air.
 */
function reachAlong(p: Prop): [number, number] | null {
  switch (p.kind) {
    case 'gear': {
      const d = p.ring > 0 ? p.ring + p.radius : p.radius + p.bob;
      return [p.y - d, p.y + d];
    }
    case 'capsule': {
      const d = p.bob + CAPSULE_HH + p.radius;
      return [p.y - d, p.y + d];
    }
    case 'bigWheel':
      return [p.y - p.reach - 6, p.y + p.reach + 6];
    case 'bracket':
      return [p.y - FRAME_REACH, p.y + FRAME_REACH];
    case 'triangle':
    case 'square':
      return [p.y - p.radius - 6, p.y + p.radius + 6];
    case 'hexagon':
      return [p.y - p.radius, p.y + p.radius];
    case 'turret':
      return [p.y - p.size / 2, p.y + p.size / 2];
    case 'pipe':
    case 'wind':
      return [p.y, p.y + p.span];
    case 'dropSaw':
      return [p.y - p.radius, p.y + p.radius];
    case 'pendulum': {
      const d = p.reach * Math.sin(p.angle) + p.radius;
      return [p.y - d, p.y + d];
    }
    case 'orbiter':
      return [p.y - p.reach - p.radius, p.y + p.reach + p.radius];
    case 'zipper':
      return [p.y - p.radius, p.y + p.span + p.radius];
    case 'crusher':
      return [p.y - p.size / 2, p.y + p.size / 2];
    default:
      return null;
  }
}

/**
 * The lowest a lethal part of a prop can get across the corridor, toward the
 * floor. Infinity for anything that cannot hurt the ball.
 */
function lowestReach(p: Prop): number {
  switch (p.kind) {
    case 'gear':
      if (p.ring > 0) return p.x - p.ring - p.radius;
      return p.side > 0 ? p.x + RAIL_MIN - p.radius : p.x - Math.max(RAIL_MIN, p.reach) - p.radius;
    case 'capsule':
      return p.x + p.side * CAPSULE_OFFSET - p.radius;
    case 'bigWheel':
      return p.x - p.sway - p.reach - 6;
    case 'bracket':
      return p.x - FRAME_REACH;
    case 'triangle':
    case 'square':
      return p.x - p.radius - 6;
    case 'turret':
      return p.x - p.size / 2;
    // Anything that comes out of the floor has reached it.
    case 'dropSaw':
      return -HALF_W;
    case 'pendulum':
      return p.side > 0 ? p.x - p.reach - p.radius : -HALF_W;
    case 'orbiter':
      return p.x - p.reach - p.radius;
    case 'zipper':
      return p.x - p.radius;
    case 'crusher':
      return p.side > 0 ? p.x - p.reach : -HALF_W;
    default:
      return Infinity;
  }
}

/** Where a run of props can touch the ball, padded by the ball itself. */
interface Band {
  top: number;
  bottom: number;
  /** The first and last depth anything in it can touch a ball riding the floor. */
  floorTop: number;
  floorBottom: number;
}

function bandOf(props: Prop[]): Band | null {
  let band: Band | null = null;
  for (const p of props) {
    const along = reachAlong(p);
    if (!along) continue;
    const top = along[0] - BALL_R;
    const bottom = along[1] + BALL_R;
    band ??= { top, bottom, floorTop: Infinity, floorBottom: -Infinity };
    band.top = Math.min(band.top, top);
    band.bottom = Math.max(band.bottom, bottom);
    // A ball resting on the floor sits at `FLOOR_X`, so anything whose edge
    // comes within a ball's width of that (and a few px of slack) is in its way.
    if (lowestReach(p) < FLOOR_X + BALL_R + 3) {
      band.floorTop = Math.min(band.floorTop, top);
      band.floorBottom = Math.max(band.floorBottom, bottom);
    }
  }
  return band;
}

function tagsOf(props: Prop[]): Tag[] {
  const tags = new Set<Tag>();
  for (const p of props) {
    if (p.kind === 'gear') tags.add(p.ring > 0 ? 'ring' : 'rail');
    else if (p.kind === 'capsule') tags.add('pill');
    else if (p.kind === 'bigWheel') tags.add('wheel');
    else if (p.kind === 'hexagon') tags.add('hex');
    else if (p.kind === 'bracket') tags.add('frame');
    else if (p.kind === 'turret') tags.add('turret');
    else if (p.kind === 'wind') tags.add('wind');
  }
  return [...tags];
}

/** What a script stage reaches, measured once off a copy laid at depth 0. */
const surveyed = new Map<string, { band: Band | null; tags: Tag[] }>();

function survey(name: string) {
  const known = surveyed.get(name);
  if (known) return known;
  const scratch = { props: [] as Prop[], nextId: 1 } as World;
  build(scratch, { index: 0, name, yStart: 0, yEnd: STAGE_H, dark: false });
  const props = scratch.props.filter(p => p.kind !== 'plate');
  const found = { band: bandOf(props), tags: tagsOf(props) };
  surveyed.set(name, found);
  return found;
}

/**
 * True if `next` may be laid straight under `prev`, with nothing in between:
 * the script writes the pair itself. Anything else is set down a
 * `HURDLE_GAP` clear of what came before it.
 */
function abuts(prev: string, next: string) {
  return SCRIPT[SCRIPT.indexOf(prev) + 1] === next;
}

/** Marks a stage laid by the hurdle deck rather than out of the script. */
const FRESH = 'fresh_';

export function buildLevel(w: World, level = 1, opts: BuildOpts = {}) {
  const def = levelAt(level);
  const own = SCRIPT.slice(def.from, def.to);
  const back = SCRIPT.slice(Math.max(0, def.from - RECALL), def.from);
  /** The level's own stages, which are the only ones that carry its pickups. */
  const mine = new Set(own);
  /** Script stages already laid. None is ever laid twice in a full level. */
  const laid = new Set<string>();

  // The corridor is walked as the run will meet it -- carrying the depth, the
  // elapsed time and the gear the flags have put the descent in -- because
  // where it stops, where it turns and where its flags go are all facts about
  // *time*: the same depth is worth a little less of it at the bottom of a
  // level than at the top.
  //
  // The clock starts where the ball does, up on the run-up, not at the top of
  // the first stage. The first flag is a whole flag gap in, not on the run-up.
  let y = OPENING_Y;
  let t = 0;
  let gear = 1;
  let lastFlagT = 0;
  /** Where the next stage starts. */
  let top = 0;
  /** The deepest anything laid so far can touch the ball. */
  let reach = -Infinity;
  /** The first depth something may reach the floor again. */
  let floorFrom = -Infinity;
  let prev: string | null = null;
  const want = def.secs;
  /** When the descent reaches the top of each stage, for the closing fade. */
  const entered: number[] = [];

  // The clock runs at the level's pace hump, read as a share of the planned
  // descent: close enough to the engine's reading of it, off depth, to decide
  // where the level turns and where it ends. Walked in short steps, because
  // the pace changes along the way.
  const advance = (to: number) => {
    while (y < to) {
      const step = Math.min(100, to - y);
      gear = paceShape(t / want);
      t += step / (CLIMB * gear);
      y += step;
    }
  };

  /** A new stage from `yStart`, closing any gap left after the last one. */
  const begin = (name: string, yStart: number, yEnd: number): Stage => {
    const last = w.stages[w.stages.length - 1];
    if (last) last.yEnd = yStart;
    advance(yStart);
    entered.push(t);
    const stage: Stage = { index: w.stages.length, name, yStart, yEnd, dark: false };
    w.stages.push(stage);
    top = yEnd;
    return stage;
  };

  const took = (band: Band | null) => {
    if (!band) return;
    reach = Math.max(reach, band.bottom);
    if (band.floorBottom > -Infinity)
      floorFrom = Math.max(floorFrom, band.floorBottom + FLOOR_WINDOW);
  };

  // --- a stage out of the script ---------------------------------------------
  const layStage = (name: string) => {
    const { band } = survey(name);
    // A pair the script writes one under the other goes down edge to edge, as
    // it was authored. Anything else is set a hurdle gap clear of what came
    // before -- and clear of the floor window, if it reaches the floor.
    let y0 = top;
    if (prev !== null && !abuts(prev, name) && band) {
      // After a dealt hurdle or set piece the stage may start inside its
      // run-out: a script stage often opens on air -- where its flag stood, or
      // ahead of its first frame -- so the gap is the hurdle gap and not the
      // two added up.
      if (prev.startsWith(FRESH)) y0 = w.stages[w.stages.length - 1].yStart + 1;
      y0 = Math.max(y0, reach + HURDLE_GAP - band.top);
      if (band.floorTop < Infinity) y0 = Math.max(y0, floorFrom - band.floorTop);
    }
    const stage = begin(name, y0, y0 + STAGE_H);

    const from = w.props.length;
    build(w, stage);
    // A pickup is laid the first time its stage comes round, and only out of
    // the level's own window: a recalled stage brings its hazards and nothing
    // else. The dish never comes with the stage -- where a level ends is
    // settled at the bottom of this function.
    const once = !laid.has(name) && mine.has(name);
    laid.add(name);
    const kept = w.props
      .slice(from)
      .filter(p => p.kind !== 'plate' && (once || !FIRST_LAP_ONLY.has(p.kind)));
    w.props.length = from;
    w.props.push(...kept);

    // Walk this stage's flags in depth order, timing the descent through each.
    // A flag too soon after the last one is dropped, and so is one close enough
    // to the dish that a checkpoint there would be handed out after the run is
    // as good as over.
    const flags = kept.filter(p => p.kind === 'flag').sort((a, b) => a.y - b.y);
    const dropped = new Set<Prop>();
    for (const f of flags) {
      advance(f.y);
      const early = t - lastFlagT < FLAG_GAP_SECS;
      const late = t > want - FLAG_GAP_SECS / 2;
      if (!opts.allFlags && (early || late)) {
        dropped.add(f);
        continue;
      }
      lastFlagT = t;
    }
    if (dropped.size) w.props = w.props.filter(p => !dropped.has(p));

    took(band && moved(band, y0));
    advance(stage.yEnd);
    prev = name;
  };

  // --- a fresh hurdle ----------------------------------------------------------
  const deck = dealer(rng(def.from * 7919 + 1));
  /**
   * Lay the first of `order(heat)` that fits and return it. With `strict`,
   * nothing is laid -- and null comes back -- if none of them fits as it is;
   * otherwise the first one is pushed down until it clears the floor window.
   */
  const layCards = (
    order: (heat: number) => Card[],
    offFloor: boolean,
    strict = false,
  ): Card | null => {
    // A flag, when one is due: in the gap before the hurdle, with the floor
    // kept clear past it so a retry from it has somewhere to land.
    const flagY = reach + HURDLE_GAP / 2;
    const flagT = t + (flagY - y) / (CLIMB * gear);
    if (flagT - lastFlagT >= FLAG_GAP_SECS && flagT <= want - FLAG_GAP_SECS / 2) {
      advance(flagY);
      flag(w, 0, flagY);
      lastFlagT = t;
      floorFrom = Math.max(floorFrom, flagY + FLOOR_WINDOW);
    }

    // The first card in the deck that fits: one that does not reach the floor
    // inside the window -- or, with `offFloor`, does not reach it at all -- or
    // failing any of those, the first one pushed down until it clears it.
    //
    // How hard it is dealt follows the pace hump: gentle while the level is
    // opening, at its hardest through the quick middle, gentle again as it
    // eases back toward the finish.
    const heat = paceHeat(t / want);
    const wantTop = reach + HURDLE_GAP;
    const cards = order(heat);
    const from = w.props.length;
    let band: Band | null = null;
    let chosen = cards[0];
    for (const card of cards) {
      band = layHurdle(w, card, wantTop, deck.rand, heat);
      if (offFloor ? band.floorTop === Infinity : band.floorTop >= floorFrom) {
        chosen = card;
        break;
      }
      w.props.length = from;
      band = null;
    }
    if (!band) {
      if (strict) return null;
      band = layHurdle(w, chosen, wantTop, deck.rand, heat);
      if (band.floorTop < floorFrom)
        band = shift(w.props.slice(from), band, floorFrom - band.floorTop);
    }

    const stage = begin(
      FRESH + chosen.hurdle.name,
      top,
      Math.max(top + 1, band.bottom + HURDLE_GAP / 2),
    );
    took(band);
    advance(stage.yEnd);
    prev = stage.name;
    return chosen;
  };

  const layFresh = (pool: Hurdle[], offFloor: boolean) => {
    deck.use(pool);
    // Ahead of a set piece that comes out of the floor, a hurdle that keeps
    // off it if the deck has one, so the set piece has the floor to itself.
    const next = sigs[sigTurn];
    const clearFloor = !offFloor && next !== undefined && FLOOR_SIGS.has(next);
    const chosen =
      (clearFloor && layCards(heat => deck.order(heat), true, true)) ||
      layCards(heat => deck.order(heat), offFloor)!;
    deck.take(chosen);
  };

  // --- a signature set piece -------------------------------------------------
  // The level's own, taken in turn when it has more than one. One that will
  // not fit where it is due -- a floor rain straight after a flag, say -- is
  // passed over for the next of the level's own, and failing all of them the
  // level deals an ordinary hurdle there instead.
  const sigs = def.sig.map(name => SIGNATURES[name]);
  let sigTurn = 0;
  const laySig = () => {
    if (!sigs.length) return false;
    const order = () =>
      sigs.flatMap((_, k) => {
        const hurdle = sigs[(sigTurn + k) % sigs.length];
        const s: 1 | -1 = deck.rand() < 0.5 ? 1 : -1;
        return [
          { hurdle, s },
          { hurdle, s: -s as 1 | -1 },
        ];
      });
    const chosen = layCards(order, false, true);
    if (!chosen) return false;
    sigTurn = (sigs.indexOf(chosen.hurdle) + 1) % sigs.length;
    return true;
  };

  /**
   * A set piece ahead of the script stage `name`, if the stage can follow it
   * a hurdle gap later. One that reaches the floor would push a stage that
   * reaches it too a whole floor window further on and leave empty corridor
   * between them, so there the set piece is taken back up and left out --
   * unless `filler` is given, in which case one ordinary hurdle that keeps
   * off the floor is laid between the two first, and the pair is taken back
   * up only if even that does not make room.
   */
  const sigBefore = (name: string, filler?: Hurdle[]) => {
    const saved = { y, t, gear, lastFlagT, top, reach, floorFrom, prev, sigTurn };
    const counts = [w.props.length, w.stages.length, entered.length];
    const lastEnd = w.stages[w.stages.length - 1]?.yEnd;
    // At the very top of a level nothing has been laid to measure a gap from:
    // the set piece goes down where the first stage would have started.
    if (reach === -Infinity) reach = top - HURDLE_GAP;
    if (!laySig()) {
      reach = saved.reach;
      return false;
    }
    const { band } = survey(name);
    if (!band || band.floorTop === Infinity) return true;
    const fits = () => reach + HURDLE_GAP - band.top + band.floorTop >= floorFrom;
    if (fits()) return true;
    if (filler) {
      layFresh(filler, true);
      if (fits()) return true;
    }
    ({ y, t, gear, lastFlagT, top, reach, floorFrom, prev, sigTurn } = saved);
    [w.props.length, w.stages.length, entered.length] = counts;
    if (lastEnd !== undefined) w.stages[w.stages.length - 1].yEnd = lastEnd;
    return false;
  };

  if (opts.laps !== undefined) {
    // The audits: the level's own window and nothing else, lap after lap.
    for (let k = 0; k < opts.laps * own.length; k++) layStage(own[k % own.length]);
  } else {
    // The opening: the corridor behind the level, once, in script order. The
    // first level has nothing behind it, so it opens on its own window. Past
    // the first, the level's signature comes first and between every couple
    // of recalled stages, so the level says what it is from its first breath
    // rather than a minute in.
    //
    // The first one may bring an ordinary hurdle in behind it, if that is what
    // it takes to fit the first recalled stage in after it.
    // The middle deals from everything the level knows; the close only from
    // hurdles that use the level's own hazards.
    const middle = hurdlesFor([...back, ...own]);
    let sigLast = false;
    (back.length ? back : own).forEach((name, i) => {
      sigLast = back.length > 0 && !sigLast && sigBefore(name, i === 0 ? middle : undefined);
      layStage(name);
    });
    // Whatever of the level's own window is left is what it closes on.
    const ending = own.filter(name => !laid.has(name));
    const closing = hurdlesFor([...back, ...own], own);
    // Signature and hurdle by turns, all the way down: the set piece to get
    // through, then the ordinary corridor, then the set piece again.
    let sigDue = true;
    for (let guard = 0; guard < 2000; guard++) {
      const left = (ending.length * STAGE_H) / (CLIMB * gear);
      if (ending.length ? t + left >= want : t >= want) break;
      const pool = t / want < CLOSE_BEGINS || closing.length < CLOSE_MIN ? middle : closing;
      // The last hurdle or two before the level's own window keep off the
      // floor, so the window goes down a hurdle gap after them rather than
      // being pushed a floor window further on.
      const last = ending.length > 0 && t + left + STAGE_H / 2 / (CLIMB * gear) >= want;
      if (sigDue && !last && laySig()) {
        sigDue = false;
        continue;
      }
      layFresh(pool, last);
      sigDue = true;
    }
    for (const name of ending) layStage(name);
  }

  // The closing stretch turns onto the deeper palette, and it is measured in
  // seconds of descent rather than in stages: `dark` is read as the share of
  // its window it always was, and spent on the clock -- a good minute of
  // corridor that has visibly turned before the dish.
  const total = w.stages.length;
  const darkSecs = DARK_SECS_MIN + DARK_SECS_SPAN * (def.dark / own.length);
  const deepFrom = entered.findIndex(at => t - at <= darkSecs);
  for (const st of w.stages) st.dark = deepFrom >= 0 && st.index >= Math.min(deepFrom, total - 1);

  const last = w.stages[w.stages.length - 1];
  // A level that runs out on a stage that closes a run of the script gets its
  // dish where that stage authors one, down among the hazards it has just laid
  // out; every other level gets one a hurdle gap past the last thing in it,
  // so it never ends with the player threading a gap and landing on the
  // finish in the same breath -- and never with a long empty run-out either.
  //
  // It is a wide dish -- 200 across, with the level's sign-off lettered on it
  // -- and it sits off to one side rather than in the middle because the
  // closing stages run their last line down the left of it, and the audit
  // wants air between the two. See `s16_final` for why 200 is as wide as the
  // plate can go.
  const scripted = CLOSING_STAGES.has(last.name);
  w.finishY = scripted ? last.yEnd - 70 : Math.max(last.yEnd, reach + RUNOUT);
  w.props.push(mk(w, 'plate', 60, w.finishY, { radius: 100, size: 200 }));
}

/**
 * The "small red target on a rod" that hangs off a line. `ring` draws the
 * faint circle some of them wear. Given a `rate` the blade runs left and
 * right along its own rod; at rate 0 it stays parked at the far end.
 */
function railHazard(
  w: World,
  x: number,
  y: number,
  side: 1 | -1,
  reach: number,
  ring = 0,
  rate = 0,
  phase = 0.5,
) {
  w.props.push(
    mk(w, 'gear', x, y, {
      side,
      rate,
      phase,
      radius: 11,
      size: 22,
      // The rail is a distance across the corridor rather than a part of the
      // blade, so it is stretched with the corridor: a line authored to hold
      // the ball out to the middle still holds it out to the middle.
      reach: reach * SPREAD,
      ring,
      bob: BLADE_BOB,
      spin: rate ? BLADE_SPIN : 0,
    }),
  );
}

/**
 * A blade that lives in a ring drawn round its line -- the look the reference
 * uses down the capped lines. The ring is its track: the blade goes round and
 * round the pipe on it, rather than sliding out along a rail. `side` only
 * picks which way it starts.
 */
function ringHazard(w: World, x: number, y: number, side: 1 | -1) {
  w.props.push(
    mk(w, 'gear', x, y, {
      side,
      rate: RING_ORBIT,
      // Off its depth, so a ladder of them runs out of step.
      phase: (((y / 310) % 1) + 1) % 1,
      radius: 11,
      size: 22,
      reach: 0,
      ring: 26,
      bob: 0,
      spin: BLADE_SPIN,
    }),
  );
}

/**
 * The red pill blade bolted beside a line. It does not slide, but it travels
 * up and down the line about its anchor. Two stacked close together are given
 * the same phase so they move as one and never ride over each other. `side`
 * is which side of the line it is bolted to.
 */
function capsule(w: World, x: number, y: number, phase = 0, side: 1 | -1 = 1) {
  w.props.push(
    mk(w, 'capsule', x, y, {
      side,
      radius: 17,
      bob: CAPSULE_BOB,
      phase,
    }),
  );
}

/** A blade that telescopes in and out along its rod. */
function slidingHazard(
  w: World,
  x: number,
  y: number,
  side: 1 | -1,
  dist: number,
  rate: number,
  phase = 0,
) {
  w.props.push(
    mk(w, 'gear', x, y, {
      side,
      rate,
      phase,
      radius: 13,
      size: 26,
      // Across the corridor, like every other rail. See `railHazard`.
      reach: dist * SPREAD,
      spin: 7,
      bob: BLADE_BOB,
    }),
  );
}

/**
 * A hexagon with rails strung across it and a blade running along each.
 * `gearSide` is the edge the blades start from; each rail is anchored on the
 * far edge so it reads as a bar spanning the whole shape, the way the
 * reference draws it. The blades of one hexagon run out of step with each
 * other, so the pair reads as two moving parts rather than one.
 */
function hexagon(w: World, x: number, y: number, radius: number, gearSide: 1 | -1, pairs = 2) {
  // Two of the six corners point straight at the walls, so a hexagon reaches a
  // full `radius` either side of its anchor -- over half the corridor at the
  // size the run uses them. Anchored where they used to be, the left ones were
  // drawn with a corner and part of two edges off the side of the screen, and
  // a blade would swing out of a shape the player could not see the edge of.
  // Whatever x the run asks for, the whole shape stays inside the walls.
  // The cage is the one piece of furniture whose *inside* is authored off its
  // own radius, so it is the one place the two spaces meet. Everything named
  // here is in authored units -- `mk` is still the only thing that stretches
  // -- which means the radius, a world measurement of the shape itself, is
  // divided back down before it is used as a position. Get this the wrong way
  // round and the rails drift out of the cage they belong to as `SPREAD`
  // changes; `hexagon.test.ts` is what catches that.
  const margin = (radius + HEX_MARGIN) / SPREAD;
  const cx = clamp(x, -AUTHOR_HALF_W + margin, AUTHOR_HALF_W - margin);
  w.props.push(mk(w, 'hexagon', cx, y, { radius }));
  const inset = (radius * 0.72) / SPREAD;
  const gap = radius * 0.32;
  for (let i = 0; i < pairs; i++) {
    const dy = pairs === 1 ? 0 : -gap + (i * gap * 2) / (pairs - 1);
    const phase = (((y / 700 + i * 0.5) % 1) + 1) % 1;
    railHazard(w, cx - gearSide * inset, y + dy, gearSide, inset * 2, 0, BLADE_SLIDE, phase);
  }
}

/** A line with a T-bar capping each end. */
function cappedPipe(w: World, x: number, y: number, span: number, cap = 130) {
  // The T-bar lies across the corridor, so it is stretched with it and caps
  // the line at the same width it always read at. Nothing collides with a
  // stand -- it is drawn and nothing else -- so this is a look rather than a
  // rule, and at the authored 130 a capped line would read as a long pipe with
  // two short nubs on it.
  const bar = cap * SPREAD;
  w.props.push(mk(w, 'stand', x, y, { size: bar }));
  w.props.push(mk(w, 'pipe', x, y, { span }));
  w.props.push(mk(w, 'stand', x, y + span, { size: bar }));
}

/**
 * A spoked ring drifting across the corridor. It never holds still: the
 * reference slides every one of them left and right as it comes down.
 */
function wheel(
  w: World,
  x: number,
  y: number,
  spin: number,
  phase: number,
  radius = 74,
  sway = WHEEL_SWAY,
) {
  w.props.push(
    mk(w, 'bigWheel', x, y, {
      radius,
      // Radial: the spokes' own reach out from the hub, part of the ring
      // rather than of the corridor, so it is left alone.
      reach: radius + 32,
      spin,
      // The drift across the corridor, which is not -- a ring authored to
      // wander a fifth of the way over still wanders a fifth of the way over.
      sway: sway * SPREAD,
      rate: WHEEL_DRIFT,
      phase,
    }),
  );
}

/**
 * The `[ ]` frame the reference tumbles down the corridor: two boxes with
 * their mouths facing each other, close enough to read as one piece, both
 * turning about the one centre at the one rate. It is a single prop, so the
 * two halves can never come apart or drift out of step.
 */
function bracket(w: World, x: number, y: number, spin: number) {
  w.props.push(mk(w, 'bracket', x, y, { size: BRACKET_W, radius: BRACKET_H / 2, spin }));
}

/**
 * A band of arrows that shoves the ball off its flown line while it is
 * inside. The player answers it by flying to the other side of the gap they
 * want, and letting the push carry the ball into it.
 */
function windZone(w: World, x: number, y: number, span: number, width: number, push: 1 | -1 = 1) {
  // `width` is how far across the corridor the band reaches; `span` is how
  // deep it runs. Only the first is stretched. `push` is the way it blows.
  w.props.push(mk(w, 'wind', x, y, { span, size: width * SPREAD, side: push }));
}

function flag(w: World, x: number, y: number) {
  w.props.push(mk(w, 'flag', x, y, { radius: 30 }));
}

function star(w: World, x: number, y: number) {
  w.props.push(mk(w, 'star', x, y, { radius: 20 }));
}

/**
 * The side launcher. `wall` is the edge it is bolted to; it fires inward.
 *
 * Its aim is set here, once, and never looks at the ball again -- see
 * `BULLET_SPEED` in `config.ts` for why the shots stopped being homing.
 * Straight across the corridor, tilted by a smooth function of the launcher's
 * own depth: two launchers a stage apart fire on visibly different lines, the
 * same launcher fires the same line every time, and a stretch flown twice is
 * flown against the same shots both times.
 */
function turret(w: World, wall: 1 | -1, y: number, cooldown: number) {
  const across = wall > 0 ? Math.PI : 0;
  w.props.push(
    mk(w, 'turret', wall * 149, y, {
      side: -wall as 1 | -1,
      size: 34,
      cooldown,
      angle: across + SHOT_SPREAD * Math.sin(y * 0.013),
    }),
  );
}

function build(w: World, stage: Stage) {
  const y0 = stage.yStart;
  const P = w.props;

  switch (stage.name) {
    // A single line left of centre, two blades on rails, a coin between them,
    // and the triangle easing in underneath.
    case 's01_line':
      P.push(mk(w, 'pipe', -92, y0, { span: 520 }));
      railHazard(w, -92, y0 + 130, 1, 76, 0, BLADE_SLIDE, 0);
      star(w, -20, y0 + 250);
      railHazard(w, -92, y0 + 380, 1, 76, 0, BLADE_SLIDE, 0.5);
      P.push(
        mk(w, 'triangle', 30, y0 + TRIANGLE_Y, {
          radius: TRIANGLE_R,
          spin: 0.22,
        }),
      );
      break;

    // The line moves out to the wall and wears pill blades; the two spoked
    // rings roll down the open side.
    // It all sits high in the stage, close under the triangle, so there is no
    // long empty stretch between the two.
    case 's02_wheels':
      P.push(mk(w, 'pipe', -132, y0, { span: 900 }));
      wheel(w, 52, y0 + 120, 0.3, 0, 79);
      capsule(w, -132, y0 + 290, 0);
      star(w, 120, y0 + 250);
      wheel(w, 52, y0 + 500, -0.3, 0.5, 79);
      capsule(w, -132, y0 + 760, 0.5);
      break;

    // Straight out of the rings: a line of small blades at once, a second
    // line running beside it, a third a little lower, and then the first flag
    // of the run standing in the middle before the next stage.
    case 's03_ringPipe':
      P.push(mk(w, 'pipe', -120, y0 + 20, { span: 500 }));
      railHazard(w, -120, y0 + 140, 1, 76, 0, BLADE_SLIDE, 0);
      railHazard(w, -120, y0 + 360, 1, 76, 0, BLADE_SLIDE, 0.5);
      P.push(mk(w, 'pipe', 40, y0 + 60, { span: 500 }));
      railHazard(w, 40, y0 + 220, 1, 76, 0, BLADE_SLIDE, 0.25);
      railHazard(w, 40, y0 + 440, 1, 76, 0, BLADE_SLIDE, 0.75);
      star(w, 120, y0 + 330);
      P.push(mk(w, 'pipe', -40, y0 + 640, { span: 260 }));
      railHazard(w, -40, y0 + 720, 1, 76, 0, BLADE_SLIDE, 0.4);
      railHazard(w, -40, y0 + 840, 1, 76, 0, BLADE_SLIDE, 0.9);
      flag(w, 0, y0 + 990);
      break;

    // Two lines at once: ringed blades and a pill on the left, long rails
    // reaching out of the right one.
    //
    // Neither is one rod any more. A line that ran the full stage fenced the
    // corridor off from the top of the screen to the bottom and never let go,
    // so each side is three short lines with clear air between them: the run
    // opens up twice on the way down, and the last one still meets the line
    // s05 carries on with.
    case 's04_twinRods':
      // The tail of that same big ring is still leaving the top right.
      wheel(w, 176, y0 + 20, 0.26, 0.7, 104, 16);
      P.push(mk(w, 'pipe', -110, y0 + 90, { span: 270 }));
      ringHazard(w, -110, y0 + 180, 1);
      P.push(mk(w, 'pipe', -110, y0 + 470, { span: 270 }));
      capsule(w, -110, y0 + 590, 0.5);
      P.push(mk(w, 'pipe', -110, y0 + 850, { span: STAGE_H - 850 }));
      ringHazard(w, -110, y0 + 950, 1);
      P.push(mk(w, 'pipe', 34, y0 + 160, { span: 250 }));
      railHazard(w, 34, y0 + 250, 1, 104, 0, BLADE_SLIDE, 0.2);
      P.push(mk(w, 'pipe', 34, y0 + 530, { span: 250 }));
      railHazard(w, 34, y0 + 620, 1, 104, 0, BLADE_SLIDE, 0.7);
      star(w, -40, y0 + 570);
      P.push(mk(w, 'pipe', 34, y0 + 900, { span: STAGE_H - 900 }));
      break;

    // Both lines run out, a flag marks the join, and the first hexagons climb
    // into frame from below.
    case 's05_rodsEnd':
      P.push(mk(w, 'pipe', -110, y0, { span: 520 }));
      capsule(w, -110, y0 + 70, 0.75);
      P.push(mk(w, 'pipe', 34, y0, { span: 420 }));
      railHazard(w, 34, y0 + 150, 1, 104, 0, BLADE_SLIDE, 0.45);
      ringHazard(w, -110, y0 + 330, 1);
      flag(w, -8, y0 + 520);
      hexagon(w, -76, y0 + 860, 84, 1);
      break;

    // The hexagon run: they hug the left wall with their blades on the outer
    // edge, then step back toward the middle.
    case 's06_hexRun':
      hexagon(w, -76, y0 + 160, 84, -1);
      hexagon(w, -66, y0 + 460, 84, -1);
      hexagon(w, -50, y0 + 760, 84, -1);
      hexagon(w, -40, y0 + 1060, 84, 1);
      break;

    // More of the same, with a flag standing between two of them.
    case 's07_hexFlag':
      hexagon(w, -20, y0 + 260, 84, 1);
      flag(w, -6, y0 + 420);
      hexagon(w, -76, y0 + 580, 84, -1);
      hexagon(w, -50, y0 + 880, 84, -1);
      break;

    // Straight out of the hexagons with no flag in between: a capped line
    // carrying three ringed blades.
    case 's08_ringLadder':
      cappedPipe(w, -109, y0 + 120, 820);
      ringHazard(w, -109, y0 + 260, 1);
      ringHazard(w, -109, y0 + 500, 1);
      star(w, 30, y0 + 500);
      ringHazard(w, -109, y0 + 740, 1);
      break;

    // A flag first this time, then a line of pill blades under the green
    // launcher, and the open frames start tumbling.
    case 's09_turretFrames':
      flag(w, -6, y0 + 80);
      P.push(mk(w, 'pipe', -58, y0, { span: 640 }));
      turret(w, 1, y0 + 180, 0.8);
      capsule(w, -58, y0 + 240);
      capsule(w, -58, y0 + 330);
      // Spaced wider apart than the rest of the run gives its frames: these two
      // sit on opposite sides of the corridor, and at the width the pair is now
      // drawn at they would otherwise close on each other as they turn.
      bracket(w, -30, y0 + 790, 0.32);
      bracket(w, 30, y0 + 1060, -0.36);
      break;

    // The frames on their own, with a short line cutting in near the end.
    case 's10_frameRun':
      bracket(w, -22, y0 + 260, 0.34);
      bracket(w, 26, y0 + 520, -0.38);
      star(w, -110, y0 + 660);
      bracket(w, -18, y0 + 790, 0.42);
      bracket(w, 34, y0 + 1050, -0.4);
      break;

    // The console hangs off its line. Taking it pays out and starts the
    // bonus.
    case 's11_console':
      P.push(mk(w, 'pipe', -92, y0 + 120, { span: 300 }));
      flag(w, -70, y0 + 40);
      P.push(mk(w, 'tvBox', -28, y0 + 300, { size: 44, radius: 28 }));
      bracket(w, -15, y0 + 700, 0.36);
      bracket(w, 22, y0 + 960, -0.4);
      break;

    // Past the banner the same beat comes round again: another console, then
    // more frames over a line.
    case 's12_afterBanner':
      P.push(mk(w, 'tvBox', -93, y0 + 80, { size: 44, radius: 28 }));
      bracket(w, -34, y0 + 320, 0.38);
      star(w, 90, y0 + 430);
      bracket(w, -18, y0 + 580, -0.42);
      flag(w, -6, y0 + 700);
      P.push(mk(w, 'pipe', -140, y0 + 760, { span: 340 }));
      bracket(w, 34, y0 + 900, 0.44);
      break;

    // A long line down the middle with a launcher watching each half.
    case 's13_turretPair':
      P.push(mk(w, 'pipe', -46, y0 + 140, { span: STAGE_H - 140 }));
      turret(w, 1, y0 + 140, 0.7);
      capsule(w, -46, y0 + 380);
      turret(w, 1, y0 + 620, 0.5);
      star(w, -120, y0 + 800);
      capsule(w, -46, y0 + 900, 0.5);
      break;

    // The launcher again, over a short line of stacked pills.
    case 's14_turretPills':
      turret(w, 1, y0 + 120, 0.6);
      P.push(mk(w, 'pipe', -54, y0 + 180, { span: 520 }));
      capsule(w, -54, y0 + 330);
      capsule(w, -54, y0 + 420);
      star(w, 60, y0 + 560);
      bracket(w, -15, y0 + 890, 0.4);
      break;

    // Last flag of the run, then pills, a launcher on the far side and one
    // more frame.
    case 's15_lastRun':
      flag(w, -6, y0 + 90);
      P.push(mk(w, 'pipe', -58, y0 + 220, { span: 560 }));
      capsule(w, -58, y0 + 340);
      capsule(w, -58, y0 + 430);
      turret(w, -1, y0 + 640, 0.7);
      slidingHazard(w, -58, y0 + 700, 1, 96, 0.3);
      bracket(w, 22, y0 + 960, -0.42);
      break;

    // One last launcher and a short line, then the dish off to the right.
    case 's16_final':
      turret(w, 1, y0 + 120, 0.6);
      star(w, 90, y0 + 500);
      // 140 rather than 180: the line has to stop well above the dish. The
      // dish is 200 across and is drawn at that size whatever the corridor
      // is, while its anchor and this line's are authored and came in with
      // the corridor when `SPREAD` went back to 1 -- so the air between the
      // two is the one thing in a closing stage that the narrow column
      // actually moved. The audit asks for 22px of it; at 180 there were 9.
      P.push(mk(w, 'pipe', -34, y0 + 790, { span: 140 }));
      // The last push of the run, blowing across the line and into the dish.
      windZone(w, -97, y0 + 780, 200, 120);
      P.push(mk(w, 'plate', 60, y0 + STAGE_H - 70, { radius: 100, size: 200 }));
      break;

    // --- level 6: the yard ------------------------------------------------
    //
    // The spoked rings are the widest thing the game owns and they drift while
    // they turn, so a level of them is a level about reading where a gap is
    // going to be rather than where it is. Only ever one ring across the
    // corridor at a time: two would fence it off outright.

    // Rings alternating sides, with a short line opposite each so the open
    // half is a lane rather than the whole rest of the corridor.
    case 's17_wheelYard':
      wheel(w, 58, y0 + 140, 0.3, 0, 79);
      P.push(mk(w, 'pipe', -136, y0 + 60, { span: 300 }));
      star(w, -60, y0 + 380);
      wheel(w, -58, y0 + 560, -0.3, 0.5, 79);
      P.push(mk(w, 'pipe', 136, y0 + 480, { span: 300 }));
      capsule(w, 136, y0 + 600, 0.25);
      wheel(w, 58, y0 + 960, 0.34, 0.25, 79);
      break;

    // The same, quicker, and with blades on the lines this time: the ring
    // takes one half of the corridor and the line's blade works the other.
    case 's18_wheelRun':
      P.push(mk(w, 'pipe', -132, y0 + 40, { span: 340 }));
      railHazard(w, -132, y0 + 150, 1, 76, 0, BLADE_SLIDE, 0.3);
      wheel(w, 62, y0 + 220, -0.36, 0.6, 74);
      star(w, -30, y0 + 470);
      wheel(w, -62, y0 + 640, 0.36, 0.1, 74);
      P.push(mk(w, 'pipe', 132, y0 + 560, { span: 340 }));
      railHazard(w, 132, y0 + 700, -1, 76, 0, BLADE_SLIDE, 0.8);
      break;

    // The yard opens out, and the flag stands in the clear air it leaves.
    case 's19_wheelFlag':
      wheel(w, -70, y0 + 120, 0.32, 0.2, 79);
      star(w, 90, y0 + 300);
      flag(w, 0, y0 + 520);
      wheel(w, 66, y0 + 820, -0.32, 0.7, 79);
      P.push(mk(w, 'pipe', -130, y0 + 760, { span: 260 }));
      break;

    // --- level 7: crossfire -----------------------------------------------
    //
    // Launchers on both walls. A shot tracks the ball for the first stretch
    // and then commits, so two of them firing across each other is a level
    // about keeping moving -- the one thing every other level punishes.

    // One wall at a time to open with, so the pattern is legible before it
    // doubles.
    case 's20_crossfire':
      turret(w, 1, y0 + 120, 0.8);
      P.push(mk(w, 'pipe', -40, y0 + 200, { span: 300 }));
      star(w, 96, y0 + 400);
      turret(w, -1, y0 + 520, 0.8);
      P.push(mk(w, 'pipe', 40, y0 + 600, { span: 300 }));
      turret(w, 1, y0 + 920, 0.6);
      break;

    // Both walls, over a line of pills: the ball has to be somewhere, and the
    // pills decide which half of the corridor that somewhere is in.
    case 's21_crossPills':
      turret(w, 1, y0 + 100, 0.6);
      turret(w, -1, y0 + 260, 0.6);
      P.push(mk(w, 'pipe', -50, y0 + 340, { span: 460 }));
      capsule(w, -50, y0 + 440);
      capsule(w, -50, y0 + 540, 0.5);
      star(w, 70, y0 + 640);
      turret(w, -1, y0 + 780, 0.5);
      P.push(mk(w, 'pipe', 50, y0 + 860, { span: 240 }));
      break;

    // The launchers thin out and the flag stands where neither can reach it
    // for long enough to matter.
    case 's22_crossFlag':
      turret(w, 1, y0 + 140, 0.7);
      slidingHazard(w, -120, y0 + 320, 1, 90, 0.3);
      P.push(mk(w, 'pipe', -120, y0 + 240, { span: 260 }));
      flag(w, 10, y0 + 600);
      turret(w, -1, y0 + 880, 0.7);
      star(w, -90, y0 + 940);
      break;

    // --- level 8: the tunnel ----------------------------------------------
    //
    // Wind is a fixed shove that holds while the ball is in the band, so the
    // answer to it is to fly to the wrong side of the gap and let the band
    // carry the ball into the right one. Frames turning in the middle of that
    // are what make it a level rather than a trick.

    // The gate: two bands blowing opposite ways, with clear air to read them
    // in before anything has to be threaded.
    case 's23_windGate':
      windZone(w, -100, y0 + 120, 240, 120);
      star(w, 60, y0 + 240);
      P.push(mk(w, 'pipe', 96, y0 + 420, { span: 260 }));
      windZone(w, 100, y0 + 620, 240, 120);
      capsule(w, 96, y0 + 520, 0.4);
      P.push(mk(w, 'pipe', -96, y0 + 900, { span: 200 }));
      break;

    // Frames in the band. The frame turns on its own clock and the wind does
    // not, so the two line up differently every run down.
    case 's24_windFrames':
      bracket(w, -10, y0 + 180, 0.4);
      windZone(w, -100, y0 + 420, 300, 120);
      star(w, 80, y0 + 520);
      bracket(w, 14, y0 + 700, -0.44);
      windZone(w, 100, y0 + 900, 200, 120);
      break;

    // The tunnel lets go, and the flag sits in the clear stretch after it.
    case 's25_windFlag':
      bracket(w, 0, y0 + 160, 0.46);
      flag(w, -4, y0 + 480);
      windZone(w, -100, y0 + 700, 260, 120);
      star(w, 74, y0 + 800);
      P.push(mk(w, 'pipe', 96, y0 + 960, { span: 140 }));
      break;

    // --- level 9: the gauntlet --------------------------------------------
    //
    // Hexagons with blades strung across them, and ringed blades on the lines
    // between. Nothing here is fast; all of it is close, and the level is
    // about the seconds between one shape and the next.

    case 's26_gauntlet':
      hexagon(w, -60, y0 + 140, 84, 1);
      star(w, 110, y0 + 330);
      hexagon(w, 60, y0 + 440, 84, -1);
      // The line stops well short of the hexagon under it: a hexagon reaches a
      // full radius either side of its anchor, so one sitting under the tail
      // of a line is two shapes sharing the same air rather than two obstacles
      // with a gap between them.
      P.push(mk(w, 'pipe', -130, y0 + 620, { span: 240 }));
      ringHazard(w, -130, y0 + 740, 1);
      hexagon(w, -50, y0 + 1000, 84, 1);
      break;

    // The hexagons step aside for a ladder of ringed blades, then come back.
    case 's27_hexRings':
      P.push(mk(w, 'pipe', -118, y0 + 60, { span: 420 }));
      ringHazard(w, -118, y0 + 160, 1);
      ringHazard(w, -118, y0 + 380, -1);
      P.push(mk(w, 'pipe', 118, y0 + 60, { span: 420 }));
      ringHazard(w, 118, y0 + 270, 1);
      star(w, 0, y0 + 560);
      hexagon(w, 40, y0 + 760, 84, -1);
      hexagon(w, -40, y0 + 990, 84, 1);
      break;

    // A flag, and then the gauntlet's last shape on the way out of it.
    case 's28_gauntletFlag':
      flag(w, 6, y0 + 120);
      hexagon(w, -56, y0 + 400, 84, 1);
      P.push(mk(w, 'pipe', 128, y0 + 580, { span: 240 }));
      capsule(w, 128, y0 + 700, 0.6);
      star(w, -100, y0 + 800);
      hexagon(w, 40, y0 + 980, 84, -1);
      break;

    // --- level 10: the core -----------------------------------------------
    //
    // The longest run in the game and the only one that uses every hazard in
    // it. There is no boss to fight -- there is nowhere in a falling corridor
    // to put one -- so what closes the game is the corridor itself, at every
    // width it knows, with the last dish at the bottom.

    // It opens the way the game opened: a line and a blade, so the player is
    // in familiar water for a few seconds before it turns.
    case 's29_coreOpen':
      P.push(mk(w, 'pipe', -100, y0 + 80, { span: 380 }));
      railHazard(w, -100, y0 + 180, 1, 84, 0, BLADE_SLIDE, 0);
      railHazard(w, -100, y0 + 380, 1, 84, 0, BLADE_SLIDE, 0.5);
      star(w, 96, y0 + 300);
      wheel(w, 56, y0 + 620, 0.34, 0.3, 74);
      flag(w, -10, y0 + 940);
      break;

    // Launchers over a ringed line, which is the tightest the corridor gets
    // all game: the lane is real, but it has to be held.
    case 's30_coreTurrets':
      turret(w, 1, y0 + 120, 0.55);
      P.push(mk(w, 'pipe', -56, y0 + 200, { span: 420 }));
      ringHazard(w, -56, y0 + 300, 1);
      turret(w, -1, y0 + 480, 0.55);
      star(w, 110, y0 + 560);
      P.push(mk(w, 'pipe', 56, y0 + 700, { span: 300 }));
      capsule(w, 56, y0 + 820, 0.5);
      turret(w, 1, y0 + 1000, 0.5);
      break;

    // Frames in a crosswind, which is level eight's idea with level seven's
    // launcher standing over it.
    case 's31_coreFrames':
      bracket(w, -8, y0 + 160, 0.48);
      windZone(w, -100, y0 + 400, 280, 120);
      turret(w, -1, y0 + 520, 0.7);
      star(w, 70, y0 + 620);
      bracket(w, 12, y0 + 780, -0.5);
      flag(w, 0, y0 + 1020);
      break;

    // The last stage in the game: one hexagon, one launcher, and the wind
    // that blows the ball across the final line and into the dish.
    case 's32_coreFinal':
      hexagon(w, -50, y0 + 160, 84, 1);
      turret(w, 1, y0 + 420, 0.6);
      star(w, 100, y0 + 520);
      // Short of the dish, for the reason `s16_final` gives.
      P.push(mk(w, 'pipe', -34, y0 + 790, { span: 140 }));
      windZone(w, -97, y0 + 780, 200, 120);
      P.push(mk(w, 'plate', 60, y0 + STAGE_H - 70, { radius: 100, size: 200 }));
      break;

    // --- level 11: pill works ---------------------------------------------
    //
    // The pill is the one hazard that does not slide, spin or shoot: it sits
    // against its line and rides up and down it. A level of them is the
    // quietest in the game and the one that asks for the steadiest hand --
    // the lane beside a pill is always there, it is simply narrow, and the
    // only way to lose it is to stop paying attention.

    // One line at a time, each with its lane down the open side.
    case 's33_pillLine':
      P.push(mk(w, 'pipe', -120, y0 + 60, { span: 420 }));
      capsule(w, -120, y0 + 180, 0);
      capsule(w, -120, y0 + 300, 0.5);
      star(w, 60, y0 + 240);
      P.push(mk(w, 'pipe', 120, y0 + 620, { span: 400 }));
      railHazard(w, 120, y0 + 720, -1, 90, 0, BLADE_SLIDE, 0.3);
      capsule(w, 120, y0 + 900, 0.25);
      break;

    // The line steps in off the wall, so the lane is on both sides of it
    // rather than against one: two pills stacked as one, then a blade
    // reaching the other way out of the same rod.
    case 's34_pillGate':
      P.push(mk(w, 'pipe', -40, y0 + 40, { span: 460 }));
      capsule(w, -40, y0 + 160, 0);
      capsule(w, -40, y0 + 250, 0);
      railHazard(w, -40, y0 + 420, -1, 96, 0, BLADE_SLIDE, 0.6);
      star(w, 110, y0 + 330);
      P.push(mk(w, 'pipe', 60, y0 + 700, { span: 340 }));
      capsule(w, 60, y0 + 820, 0.5);
      railHazard(w, 60, y0 + 950, -1, 96, 0, BLADE_SLIDE, 0.2);
      break;

    // The flag first, in the clear air the level opens with, and then the
    // lines run out one at a time.
    case 's35_pillFlag':
      flag(w, 0, y0 + 120);
      P.push(mk(w, 'pipe', -130, y0 + 320, { span: 300 }));
      capsule(w, -130, y0 + 420, 0.4);
      star(w, 80, y0 + 520);
      P.push(mk(w, 'pipe', 110, y0 + 760, { span: 260 }));
      railHazard(w, 110, y0 + 860, -1, 84, 0, BLADE_SLIDE, 0.7);
      break;

    // --- level 12: spin cycle ---------------------------------------------
    //
    // Ringed blades and nothing else. A ringed blade owns a circle rather than
    // a lane, and it is the one hazard whose next position is worth reading
    // ahead: it comes back round on its own clock, so the level is about
    // arriving at the line when the blade is on the far side of it.

    // One line to a wall, two blades to a line, turning opposite ways.
    case 's36_ringWalk':
      P.push(mk(w, 'pipe', -112, y0 + 60, { span: 420 }));
      ringHazard(w, -112, y0 + 160, 1);
      ringHazard(w, -112, y0 + 380, -1);
      star(w, 40, y0 + 280);
      P.push(mk(w, 'pipe', 112, y0 + 620, { span: 420 }));
      ringHazard(w, 112, y0 + 720, 1);
      ringHazard(w, 112, y0 + 940, -1);
      break;

    // The capped line the reference wears its ringed blades down, and a
    // shorter one under it on the other wall.
    case 's37_ringPairs':
      cappedPipe(w, -100, y0 + 80, 560);
      ringHazard(w, -100, y0 + 200, 1);
      ringHazard(w, -100, y0 + 420, 1);
      star(w, 90, y0 + 340);
      P.push(mk(w, 'pipe', 96, y0 + 760, { span: 300 }));
      ringHazard(w, 96, y0 + 880, -1);
      break;

    // A flag in the clear, then one last line on each wall.
    case 's38_ringFlag':
      flag(w, -4, y0 + 140);
      P.push(mk(w, 'pipe', -120, y0 + 380, { span: 340 }));
      ringHazard(w, -120, y0 + 470, 1);
      star(w, 70, y0 + 560);
      P.push(mk(w, 'pipe', 120, y0 + 760, { span: 300 }));
      ringHazard(w, 120, y0 + 860, -1);
      break;

    // --- level 13: tumbledown ---------------------------------------------
    //
    // The frames, on their own, with almost nothing else in the corridor. A
    // frame is the one hazard with a way *through* it as well as round it, and
    // with nothing else on screen the level is the player learning to read
    // which of the two the frame is about to offer.

    case 's39_frameFall':
      bracket(w, -14, y0 + 200, 0.38);
      star(w, 108, y0 + 360);
      bracket(w, 18, y0 + 500, -0.42);
      bracket(w, -10, y0 + 800, 0.44);
      P.push(mk(w, 'pipe', 140, y0 + 980, { span: 120 }));
      break;

    // A line to open with, so the stage is not four frames in a row, and then
    // the frames again with the corridor to themselves.
    case 's40_frameLine':
      P.push(mk(w, 'pipe', -130, y0 + 40, { span: 300 }));
      railHazard(w, -130, y0 + 140, 1, 88, 0, BLADE_SLIDE, 0.2);
      bracket(w, 6, y0 + 480, 0.46);
      star(w, -100, y0 + 620);
      bracket(w, -12, y0 + 780, -0.4);
      P.push(mk(w, 'pipe', 138, y0 + 980, { span: 120 }));
      break;

    case 's41_frameFlag':
      bracket(w, 0, y0 + 180, 0.4);
      flag(w, -6, y0 + 500);
      star(w, 96, y0 + 620);
      bracket(w, 14, y0 + 820, -0.46);
      P.push(mk(w, 'pipe', -136, y0 + 980, { span: 120 }));
      break;

    // --- level 14: ring road ----------------------------------------------
    //
    // The spoked rings again, the way level six had them, but without the
    // clear air level six left round them: every ring here has a line on the
    // far wall, so the half of the corridor the ring is not in is a lane
    // rather than the whole rest of the screen.

    case 's42_wheelGate':
      wheel(w, -56, y0 + 160, 0.32, 0.1, 74);
      P.push(mk(w, 'pipe', 134, y0 + 80, { span: 280 }));
      star(w, 96, y0 + 420);
      wheel(w, 56, y0 + 560, -0.32, 0.6, 74);
      P.push(mk(w, 'pipe', -134, y0 + 700, { span: 260 }));
      capsule(w, -134, y0 + 800, 0.3);
      wheel(w, 40, y0 + 980, 0.36, 0.25, 74);
      break;

    case 's43_wheelRun':
      P.push(mk(w, 'pipe', -128, y0 + 60, { span: 320 }));
      railHazard(w, -128, y0 + 160, 1, 80, 0, BLADE_SLIDE, 0.15);
      wheel(w, 60, y0 + 300, -0.34, 0.4, 74);
      star(w, -60, y0 + 520);
      wheel(w, -60, y0 + 700, 0.34, 0.9, 74);
      P.push(mk(w, 'pipe', 128, y0 + 820, { span: 260 }));
      capsule(w, 128, y0 + 940, 0.6);
      break;

    case 's44_wheelFlag':
      wheel(w, 52, y0 + 140, 0.3, 0.5, 79);
      star(w, -90, y0 + 320);
      flag(w, 0, y0 + 480);
      P.push(mk(w, 'pipe', -132, y0 + 640, { span: 280 }));
      capsule(w, -132, y0 + 740, 0.2);
      wheel(w, 48, y0 + 940, -0.3, 0.15, 79);
      break;

    // --- level 15: the gallery --------------------------------------------
    //
    // Launchers, three to a stage, alternating walls over lines that decide
    // which half of the corridor the ball has to answer them from. A shot
    // tracks the ball before it commits, so standing still is what loses this
    // level and a line the player is squeezed against is where they do it.

    case 's45_gallery':
      turret(w, -1, y0 + 140, 0.7);
      P.push(mk(w, 'pipe', -46, y0 + 220, { span: 320 }));
      railHazard(w, -46, y0 + 320, 1, 96, 0, BLADE_SLIDE, 0.3);
      star(w, 120, y0 + 460);
      turret(w, 1, y0 + 620, 0.6);
      P.push(mk(w, 'pipe', 40, y0 + 700, { span: 300 }));
      capsule(w, 40, y0 + 820, 0.5);
      turret(w, -1, y0 + 980, 0.7);
      break;

    case 's46_galleryPills':
      turret(w, 1, y0 + 120, 0.55);
      P.push(mk(w, 'pipe', -56, y0 + 200, { span: 480 }));
      capsule(w, -56, y0 + 300, 0);
      capsule(w, -56, y0 + 390, 0);
      star(w, 96, y0 + 520);
      turret(w, -1, y0 + 640, 0.55);
      P.push(mk(w, 'pipe', 60, y0 + 700, { span: 260 }));
      slidingHazard(w, 60, y0 + 780, 1, 92, 0.3);
      turret(w, 1, y0 + 1000, 0.5);
      break;

    case 's47_galleryFlag':
      turret(w, 1, y0 + 140, 0.6);
      flag(w, -10, y0 + 420);
      star(w, 100, y0 + 560);
      P.push(mk(w, 'pipe', -120, y0 + 700, { span: 300 }));
      ringHazard(w, -120, y0 + 800, 1);
      turret(w, -1, y0 + 960, 0.7);
      break;

    // --- level 16: headwind -----------------------------------------------
    //
    // Level eight's bands, with the thing they blow the ball into always in
    // frame: a line, a ring, a pill. The band is a fixed shove rather than a
    // gust, so the answer is always to fly to the wrong side of the gap and
    // let the wind put the ball in it -- which is a thing the player has to
    // decide before they are in the band, not while they are.

    case 's48_gustGate':
      windZone(w, -100, y0 + 140, 260, 120);
      star(w, -70, y0 + 300);
      P.push(mk(w, 'pipe', 110, y0 + 300, { span: 260 }));
      capsule(w, 110, y0 + 400, 0.3);
      windZone(w, 100, y0 + 640, 260, 120);
      P.push(mk(w, 'pipe', -110, y0 + 800, { span: 260 }));
      ringHazard(w, -110, y0 + 900, 1);
      break;

    case 's49_gustWheels':
      windZone(w, -100, y0 + 120, 280, 120);
      wheel(w, 50, y0 + 320, 0.32, 0.3, 74);
      star(w, -96, y0 + 520);
      windZone(w, 100, y0 + 620, 280, 120);
      wheel(w, -50, y0 + 820, -0.32, 0.8, 74);
      P.push(mk(w, 'pipe', 140, y0 + 980, { span: 120 }));
      break;

    case 's50_gustFlag':
      bracket(w, -6, y0 + 200, 0.42);
      windZone(w, -100, y0 + 420, 240, 120);
      flag(w, 0, y0 + 540);
      star(w, 90, y0 + 660);
      windZone(w, 100, y0 + 800, 240, 120);
      P.push(mk(w, 'pipe', -130, y0 + 860, { span: 220 }));
      capsule(w, -130, y0 + 960, 0.5);
      break;

    // --- level 17: honeycomb ----------------------------------------------
    //
    // Hexagons, one after another, the way level three met its first ones --
    // except there is no clear stage between them any more. Each one is a
    // shape with two blades running across it, and the lane is whichever side
    // of the corridor the shape is not standing in.

    case 's51_comb':
      hexagon(w, -60, y0 + 140, 84, 1);
      star(w, 110, y0 + 330);
      hexagon(w, 60, y0 + 400, 84, -1);
      hexagon(w, -60, y0 + 660, 84, 1);
      hexagon(w, 50, y0 + 920, 84, -1);
      break;

    case 's52_combLines':
      hexagon(w, -50, y0 + 160, 84, 1);
      P.push(mk(w, 'pipe', 128, y0 + 340, { span: 240 }));
      capsule(w, 128, y0 + 440, 0.4);
      star(w, -110, y0 + 520);
      hexagon(w, 40, y0 + 700, 84, -1);
      hexagon(w, -56, y0 + 950, 84, 1);
      break;

    case 's53_combFlag':
      hexagon(w, 46, y0 + 180, 84, -1);
      flag(w, -10, y0 + 420);
      star(w, 96, y0 + 560);
      P.push(mk(w, 'pipe', -126, y0 + 640, { span: 240 }));
      ringHazard(w, -126, y0 + 740, 1);
      hexagon(w, 30, y0 + 980, 84, 1);
      break;

    // --- level 18: switchback ---------------------------------------------
    //
    // One lane, changing wall every few seconds. Nothing in this level is
    // wide and nothing in it is fast; what it asks for is the crossing, over
    // and over, with the bands in the middle stage deciding how early the
    // player has to start each one.

    case 's54_switch':
      P.push(mk(w, 'pipe', -120, y0 + 60, { span: 300 }));
      railHazard(w, -120, y0 + 160, 1, 92, 0, BLADE_SLIDE, 0.1);
      star(w, 0, y0 + 400);
      P.push(mk(w, 'pipe', 120, y0 + 440, { span: 300 }));
      railHazard(w, 120, y0 + 540, -1, 92, 0, BLADE_SLIDE, 0.6);
      P.push(mk(w, 'pipe', -120, y0 + 820, { span: 280 }));
      railHazard(w, -120, y0 + 920, 1, 92, 0, BLADE_SLIDE, 0.35);
      break;

    case 's55_switchWind':
      windZone(w, -100, y0 + 160, 240, 120);
      P.push(mk(w, 'pipe', 116, y0 + 260, { span: 280 }));
      ringHazard(w, 116, y0 + 360, 1);
      star(w, -90, y0 + 440);
      windZone(w, 100, y0 + 640, 240, 120);
      P.push(mk(w, 'pipe', -116, y0 + 740, { span: 280 }));
      ringHazard(w, -116, y0 + 840, -1);
      break;

    case 's56_switchFlag':
      flag(w, 4, y0 + 140);
      P.push(mk(w, 'pipe', -40, y0 + 380, { span: 360 }));
      capsule(w, -40, y0 + 480, 0);
      star(w, 110, y0 + 560);
      railHazard(w, -40, y0 + 660, -1, 96, 0, BLADE_SLIDE, 0.5);
      turret(w, 1, y0 + 880, 0.6);
      break;

    // --- level 19: the grind ----------------------------------------------
    //
    // The close furniture, back to back: a ringed line, a hexagon, a launcher
    // over the top of both. It is the tightest the corridor gets before the
    // last level, and the one stage in it with nothing in the middle is the
    // one with the flag on it.

    case 's57_grind':
      P.push(mk(w, 'pipe', -110, y0 + 60, { span: 360 }));
      ringHazard(w, -110, y0 + 160, 1);
      railHazard(w, -110, y0 + 340, 1, 88, 0, BLADE_SLIDE, 0.4);
      star(w, 80, y0 + 260);
      hexagon(w, 30, y0 + 620, 84, -1);
      P.push(mk(w, 'pipe', -130, y0 + 860, { span: 240 }));
      capsule(w, -130, y0 + 960, 0.3);
      break;

    case 's58_grindRings':
      turret(w, 1, y0 + 120, 0.6);
      P.push(mk(w, 'pipe', -60, y0 + 200, { span: 400 }));
      ringHazard(w, -60, y0 + 300, 1);
      ringHazard(w, -60, y0 + 500, -1);
      star(w, 100, y0 + 420);
      hexagon(w, -20, y0 + 800, 84, 1);
      turret(w, -1, y0 + 1000, 0.6);
      break;

    case 's59_grindFlag':
      hexagon(w, 40, y0 + 160, 84, -1);
      flag(w, -6, y0 + 420);
      star(w, -110, y0 + 540);
      P.push(mk(w, 'pipe', 120, y0 + 640, { span: 300 }));
      capsule(w, 120, y0 + 740, 0.4);
      railHazard(w, 120, y0 + 920, -1, 88, 0, BLADE_SLIDE, 0.7);
      break;

    // --- level 20: event horizon ------------------------------------------
    //
    // The last level in the game, and the longest. Level ten was every hazard
    // at once for the first time; this is every hazard at once with ten levels
    // of practice behind it, and the only thing it adds is that it does not
    // let up between stages. The dish at the bottom of it is the last one
    // there is.

    // It opens on the game's oldest shape -- a line with a blade on it -- and
    // has turned into a ring and a frame by the time the stage is out.
    case 's60_horizon':
      P.push(mk(w, 'pipe', -100, y0 + 80, { span: 380 }));
      railHazard(w, -100, y0 + 180, 1, 84, 0, BLADE_SLIDE, 0);
      ringHazard(w, -100, y0 + 380, 1);
      star(w, 90, y0 + 300);
      wheel(w, 50, y0 + 640, 0.34, 0.3, 74);
      bracket(w, -10, y0 + 960, 0.44);
      break;

    // Launchers over a ringed line, with a hexagon waiting under them: the
    // tightest air in the game, and the only place all three meet.
    case 's61_horizonFire':
      turret(w, 1, y0 + 120, 0.5);
      P.push(mk(w, 'pipe', -56, y0 + 200, { span: 420 }));
      capsule(w, -56, y0 + 300, 0);
      ringHazard(w, -56, y0 + 500, 1);
      star(w, 110, y0 + 420);
      turret(w, -1, y0 + 660, 0.5);
      hexagon(w, 34, y0 + 860, 84, -1);
      turret(w, 1, y0 + 1040, 0.55);
      break;

    // Frames in a crosswind with a launcher standing over them, and the last
    // flag in the game at the bottom of it.
    case 's62_horizonWind':
      bracket(w, -8, y0 + 160, 0.48);
      windZone(w, -100, y0 + 400, 280, 120);
      turret(w, -1, y0 + 520, 0.6);
      star(w, 80, y0 + 620);
      bracket(w, 14, y0 + 780, -0.5);
      flag(w, 0, y0 + 1020);
      break;

    // The last stage there is: a hexagon, a ring, a launcher, and the wind
    // that blows the ball across the final line and into the dish -- the same
    // way the reference's own run ended, forty-seven stages earlier.
    case 's63_horizonFinal':
      hexagon(w, -30, y0 + 180, 84, 1);
      wheel(w, 66, y0 + 460, -0.34, 0.4, 74);
      star(w, -110, y0 + 620);
      turret(w, 1, y0 + 700, 0.55);
      // Short of the dish, for the reason `s16_final` gives.
      P.push(mk(w, 'pipe', -34, y0 + 790, { span: 140 }));
      windZone(w, -97, y0 + 780, 200, 120);
      P.push(mk(w, 'plate', 60, y0 + STAGE_H - 70, { radius: 100, size: 200 }));
      break;
  }
}

// --- fresh hurdles ------------------------------------------------------------
//
// A level used to be its script stages dealt out again and again for five
// minutes, so the same hurdle came round every thirty seconds and the player
// learned the level as a loop. Each script stage is now laid once, and the
// minutes between are filled from the deck below: small hurdles built out of
// the same pieces, each dealt with its own wall, count, spacing and timing.
//
// A hurdle is one piece of furniture -- a line and its blades, a pair of
// rings, a run of hexagons -- and never more than that at any one depth, so
// the lane past it is the lane its own geometry leaves. Every one is written
// to leave `LANE_MIN` at every depth whatever the dealer picks, and
// `hurdles.test.ts` flies every one of them, both ways round, to hold it to
// that. Two hurdles never share air: each is set down a `HURDLE_GAP` clear of
// the last, which is also the most empty corridor a level now has.
//
// `s` is the wall the hurdle leans on, and the whole hurdle mirrors with it:
// at `1` its lines stand on the floor with their blades reaching up, at `-1`
// they hang from the ceiling reaching down.

type Rand = () => number;

interface Hurdle {
  name: string;
  /** What the level has to have shown before it may deal this. */
  needs: Tag[];
  /**
   * Lines on both walls at once, or launchers across each other: held back
   * while a level is opening, and dealt through its middle.
   */
  hard?: boolean;
  /** `heat` is how hard to deal it, 0 to 1: see `lean`. */
  lay(w: World, y: number, s: 1 | -1, r: Rand, heat: number): void;
}

interface Card {
  hurdle: Hurdle;
  s: 1 | -1;
}

function pick<T>(r: Rand, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

/**
 * Pick from `xs`, listed easiest first, leaning toward the easy end at heat 0
 * and the hard end at heat 1. Every entry can still come up at any heat, so
 * the heat changes how often a hurdle is dealt hard -- never what it can be,
 * which is what `hurdles.test.ts` flies.
 */
function lean<T>(r: Rand, xs: readonly T[], heat: number): T {
  const u = r() ** (2 ** (1 - 2 * heat));
  return xs[Math.min(xs.length - 1, Math.floor(u * xs.length))];
}

/** A line: a pipe from `y`, `span` deep. */
function line(w: World, x: number, y: number, span: number) {
  w.props.push(mk(w, 'pipe', x, y, { span }));
}

export const HURDLES: Hurdle[] = [
  // Two or three blades sliding out of one line, spaced so only one is ever
  // abreast of the ball.
  {
    name: 'railLine',
    needs: ['rail'],
    lay(w, y, s, r, heat) {
      const x = -s * pick(r, [118, 122, 126]);
      const n = lean(r, [2, 3], heat);
      const gap = lean(r, [250, 235, 220], heat);
      const reach = lean(r, [72, 80, 88], heat);
      const phase = r();
      line(w, x, y, (n - 1) * gap + 180);
      for (let i = 0; i < n; i++) {
        railHazard(w, x, y + 90 + i * gap, s, reach, 0, BLADE_SLIDE, (phase + i * 0.5) % 1);
      }
    },
  },
  // One blade that telescopes the length of its rod, on a line of its own.
  {
    name: 'slider',
    needs: ['rail'],
    lay(w, y, s, r, heat) {
      const x = -s * pick(r, [112, 118]);
      const n = lean(r, [1, 2], heat);
      line(w, x, y, n * 260 + 40);
      for (let i = 0; i < n; i++) {
        slidingHazard(w, x, y + 130 + i * 260, s, lean(r, [88, 96], heat), 0.3, r());
      }
    },
  },
  // Pills on a line: a stacked pair riding as one, or spread out and out of
  // step with each other.
  {
    name: 'pillLine',
    needs: ['pill'],
    lay(w, y, s, r, heat) {
      const x = -s * pick(r, [116, 122, 128]);
      const n = lean(r, [2, 3], heat);
      const stacked = r() < 0.5;
      const gap = stacked ? 150 : 210;
      const phase = r();
      line(w, x, y, (n - 1) * gap + 200);
      for (let i = 0; i < n; i++) {
        capsule(w, x, y + 100 + i * gap, stacked ? phase : (phase + i * 0.5) % 1, s);
      }
    },
  },
  // A pill and a blade on the same line, in either order.
  {
    name: 'railPill',
    needs: ['rail', 'pill'],
    lay(w, y, s, r) {
      const x = -s * pick(r, [118, 124]);
      const gap = pick(r, [210, 230]);
      const pillFirst = r() < 0.5;
      line(w, x, y, gap + 200);
      const pillY = y + 100 + (pillFirst ? 0 : gap);
      const bladeY = y + 100 + (pillFirst ? gap : 0);
      capsule(w, x, pillY, r(), s);
      railHazard(w, x, bladeY, s, pick(r, [76, 84]), 0, BLADE_SLIDE, r());
    },
  },
  // Pill lines on both walls, overlapping, so the lane runs down the middle.
  {
    name: 'twinPills',
    hard: true,
    needs: ['pill'],
    lay(w, y, s, r) {
      const off = pick(r, [140, 180]);
      const a = r();
      const b = r();
      line(w, -s * 126, y, 360);
      capsule(w, -s * 126, y + 90, a, s);
      capsule(w, -s * 126, y + 270, (a + 0.5) % 1, s);
      line(w, s * 126, y + off, 360);
      capsule(w, s * 126, y + off + 90, b, -s as 1 | -1);
      capsule(w, s * 126, y + off + 270, (b + 0.5) % 1, -s as 1 | -1);
    },
  },
  // Ringed blades going round one line, alternating the way they turn.
  {
    name: 'ringLine',
    needs: ['ring'],
    lay(w, y, s, r, heat) {
      const x = -s * pick(r, [92, 96]);
      const n = lean(r, [2, 3], heat);
      const gap = lean(r, [260, 240], heat);
      line(w, x, y, (n - 1) * gap + 200);
      for (let i = 0; i < n; i++) ringHazard(w, x, y + 100 + i * gap, (i % 2 ? -s : s) as 1 | -1);
    },
  },
  // The capped line the reference wears its ringed blades down.
  {
    name: 'cappedRings',
    needs: ['ring'],
    lay(w, y, s, r, heat) {
      const x = -s * pick(r, [96, 100]);
      const n = lean(r, [2, 3], heat);
      cappedPipe(w, x, y, (n - 1) * 250 + 240);
      for (let i = 0; i < n; i++) ringHazard(w, x, y + 120 + i * 250, s);
    },
  },
  // A ringed line on each wall, one starting a little after the other.
  {
    name: 'twinRings',
    hard: true,
    needs: ['ring'],
    lay(w, y, s, r) {
      const off = pick(r, [60, 110]);
      line(w, -s * 118, y, 420);
      ringHazard(w, -s * 118, y + 100, s);
      ringHazard(w, -s * 118, y + 320, -s as 1 | -1);
      line(w, s * 118, y + off, 420);
      ringHazard(w, s * 118, y + off + 210, -s as 1 | -1);
    },
  },
  // One spoked ring, or two -- on the same side, or one to each.
  {
    name: 'wheels',
    needs: ['wheel'],
    lay(w, y, s, r, heat) {
      const n = lean(r, [1, 2], heat);
      const zig = r() < 0.5;
      const at = pick(r, [60, 66, 70]);
      const spin = pick(r, [0.28, 0.32, 0.36]);
      for (let i = 0; i < n; i++) {
        const side = zig && i % 2 ? -s : s;
        wheel(w, side * at, y + 120 + i * 430, (i % 2 ? -spin : spin) * s, r(), 74);
      }
    },
  },
  // Hexagons down one wall, or stepping from one wall to the other.
  {
    name: 'hexes',
    needs: ['hex'],
    lay(w, y, s, r, heat) {
      if (r() < 0.4) {
        const n = lean(r, [2, 3], heat);
        for (let i = 0; i < n; i++) {
          const side = (i % 2 ? -s : s) as 1 | -1;
          hexagon(w, side * 60, y + 100 + i * 320, 84, side);
        }
        return;
      }
      const n = lean(r, [1, 2, 3], heat);
      const at = s * pick(r, [56, 66, 76]);
      for (let i = 0; i < n; i++) hexagon(w, at, y + 100 + i * 300, 84, pick(r, [1, -1]));
    },
  },
  // Frames tumbling down the middle, stepping either side of it.
  {
    name: 'frames',
    needs: ['frame'],
    lay(w, y, s, r, heat) {
      const n = lean(r, [2, 3], heat);
      const at = pick(r, [14, 22, 30]);
      const gap = lean(r, [310, 290], heat);
      const spin = lean(r, [0.34, 0.4, 0.46], heat);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? -s : s;
        bracket(w, side * at, y + 110 + i * gap, side * spin);
      }
    },
  },
  // A launcher on the far wall over a line of pills.
  {
    name: 'turretPills',
    needs: ['turret', 'pill'],
    lay(w, y, s, r) {
      const x = -s * pick(r, [54, 58]);
      const phase = r();
      turret(w, s, y + 20, pick(r, [0.6, 0.8]));
      line(w, x, y + 60, 480);
      capsule(w, x, y + 160, phase, s);
      capsule(w, x, y + 310, phase, s);
      if (r() < 0.5) railHazard(w, x, y + 460, s, 84, 0, BLADE_SLIDE, r());
    },
  },
  // Launchers on alternate walls, each over a short line.
  {
    name: 'crossfire',
    hard: true,
    needs: ['turret', 'pill'],
    lay(w, y, s, r) {
      turret(w, s, y + 20, 0.8);
      line(w, -s * 40, y + 100, 300);
      turret(w, -s as 1 | -1, y + 420, 0.7);
      line(w, s * 40, y + 500, 300);
      capsule(w, s * 40, y + 620, r(), -s as 1 | -1);
    },
  },
  // A bladed line on each wall, overlapping, the blades taking turns.
  {
    name: 'twinRails',
    hard: true,
    needs: ['rail'],
    lay(w, y, s, r, heat) {
      const reach = lean(r, [64, 72], heat);
      const phase = r();
      line(w, -s * 120, y, 380);
      railHazard(w, -s * 120, y + 90, s, reach, 0, BLADE_SLIDE, phase);
      railHazard(w, -s * 120, y + 290, s, reach, 0, BLADE_SLIDE, (phase + 0.5) % 1);
      line(w, s * 120, y + 120, 380);
      railHazard(w, s * 120, y + 190, -s as 1 | -1, reach, 0, BLADE_SLIDE, (phase + 0.25) % 1);
      railHazard(w, s * 120, y + 410, -s as 1 | -1, reach, 0, BLADE_SLIDE, (phase + 0.75) % 1);
    },
  },
  // Short lines stepping from wall to wall, a pill or a blade on each.
  {
    name: 'switchback',
    hard: true,
    needs: ['rail', 'pill'],
    lay(w, y, s, r, heat) {
      const n = lean(r, [3, 4], heat);
      for (let i = 0; i < n; i++) {
        const side = (i % 2 ? -s : s) as 1 | -1;
        const x = -side * 120;
        line(w, x, y + i * 230, 200);
        if (r() < 0.5) capsule(w, x, y + i * 230 + 100, r(), side);
        else railHazard(w, x, y + i * 230 + 100, side, 80, 0, BLADE_SLIDE, r());
      }
    },
  },
  // A spoked ring, and a pill line on the far wall past it.
  {
    name: 'wheelPill',
    needs: ['wheel', 'pill'],
    lay(w, y, s, r) {
      wheel(w, s * pick(r, [60, 66]), y + 120, s * pick(r, [0.3, 0.34]), r(), 74);
      line(w, -s * 124, y + 300, 260);
      capsule(w, -s * 124, y + 400, r(), s);
    },
  },
  // A ringed blade and a pill sharing one line.
  {
    name: 'ringPill',
    needs: ['ring', 'pill'],
    lay(w, y, s, r) {
      const x = -s * pick(r, [96, 100]);
      const ringFirst = r() < 0.5;
      line(w, x, y, 440);
      ringHazard(w, x, y + (ringFirst ? 100 : 330), s);
      capsule(w, x, y + (ringFirst ? 330 : 100), r(), s);
    },
  },
  // A hexagon against one wall, then a pill line against the other.
  {
    name: 'hexPill',
    needs: ['hex', 'pill'],
    lay(w, y, s, r) {
      hexagon(w, s * pick(r, [60, 66]), y + 100, 84, pick(r, [1, -1]));
      line(w, -s * 124, y + 260, 260);
      capsule(w, -s * 124, y + 360, r(), s);
    },
  },
  // A bladed line, and a frame tumbling past the end of it.
  {
    name: 'frameLine',
    needs: ['frame', 'rail'],
    lay(w, y, s, r) {
      line(w, -s * 130, y, 300);
      railHazard(w, -s * 130, y + 100, s, 88, 0, BLADE_SLIDE, r());
      bracket(w, s * pick(r, [6, 14]), y + 440, s * pick(r, [0.38, 0.44]));
    },
  },
  // A band blowing toward a line with a pill on it.
  {
    name: 'windGate',
    needs: ['wind', 'pill'],
    lay(w, y, s, r) {
      const x = s * pick(r, [92, 96]);
      windZone(w, -s * 100, y, 240, 120, s);
      line(w, x, y + 280, 260);
      capsule(w, x, y + 380, r(), s);
      if (r() < 0.5) windZone(w, -s * 100, y + 460, 200, 120, s);
    },
  },
  // A frame, a band, and a frame on the far side of it.
  {
    name: 'windFrames',
    needs: ['wind', 'frame'],
    lay(w, y, s, r) {
      bracket(w, s * pick(r, [0, 10]), y + 100, s * pick(r, [0.4, 0.44]));
      windZone(w, -s * 100, y + 260, 240, 120, s);
      bracket(w, -s * pick(r, [0, 12]), y + 620, -s * 0.46);
    },
  },
];

// --- signatures ----------------------------------------------------------------
//
// What makes one level not the level before it. The script stages and the
// hurdle deck are shared vocabulary -- a level recalls the corridor behind it
// and deals from everything it knows -- so on their own the levels ran
// together. A signature is a set piece only its own levels deal, laid between
// the ordinary hurdles all the way down: level four is the one where saws rain
// out of the ceiling, level five the one with the crushers.
//
// They are held to the hurdles' rules -- `LANE_MIN` at every depth, flown by
// `hurdles.test.ts` -- and every one is written to leave a lane on its own
// geometry, whatever instant it is met at.

export type SigName = 'rain' | 'fountain' | 'pendulum' | 'orbiter' | 'zipper' | 'crusher';

/** How far a pendulum swings either side of straight out, in radians. */
const PENDULUM_SWING = 0.75;
/** How far an orbiter's saws ride out from its hub. */
const ORBIT_R = 54;
/** How deep a crusher's block is, along the run. */
const CRUSHER_DEPTH = 44;

/** A saw that drops out of `wall` and falls across to the other one. */
function dropSaw(w: World, wall: 1 | -1, y: number, rate: number, phase: number) {
  w.props.push(
    mk(w, 'dropSaw', wall * AUTHOR_HALF_W, y, {
      side: wall,
      radius: 12,
      size: 26,
      rate,
      phase,
      spin: BLADE_SPIN,
    }),
  );
}

/** A blade on an arm `arm` long, swinging from a pivot on `wall`. */
function pendulum(w: World, wall: 1 | -1, y: number, arm: number, rate: number, phase: number) {
  w.props.push(
    mk(w, 'pendulum', wall * AUTHOR_HALF_W, y, {
      side: wall,
      reach: arm * SPREAD,
      angle: PENDULUM_SWING,
      radius: 17,
      size: 38,
      rate,
      phase,
      spin: BLADE_SPIN,
    }),
  );
}

/** `count` saws round a hub, `orbit` out from it. */
function orbiter(w: World, x: number, y: number, count: number, rate: number, phase: number) {
  w.props.push(
    mk(w, 'orbiter', x, y, { reach: ORBIT_R, radius: 12, size: 26, count, rate, phase, spin: 6 }),
  );
}

/** A saw racing up and down a track `span` long. */
function zipper(w: World, x: number, y: number, span: number, rate: number, phase: number) {
  w.props.push(mk(w, 'zipper', x, y, { span, radius: 13, size: 28, rate, phase, spin: 9 }));
}

/** A block `reach` long that slams out of `wall`. */
function crusher(w: World, wall: 1 | -1, y: number, reach: number, rate: number, phase: number) {
  w.props.push(
    mk(w, 'crusher', wall * AUTHOR_HALF_W, y, {
      side: wall,
      reach: reach * SPREAD,
      size: CRUSHER_DEPTH,
      rate,
      phase,
    }),
  );
}

/** A saw rain or fountain: columns of drops, let go in a rolling wave. */
function drops(wall: 1 | -1): Hurdle['lay'] {
  return (w, y, _s, r, heat) => {
    const n = lean(r, [3, 4, 5, 6], heat);
    const gap = lean(r, [150, 135, 120], heat);
    const rate = lean(r, [0.4, 0.46, 0.52], heat);
    // The wave rolls one way or the other along the run, or comes in pairs.
    const step = pick(r, [0.17, -0.17, 0.5]);
    const phase = r();
    for (let i = 0; i < n; i++) dropSaw(w, wall, y + i * gap, rate, (phase + i * step + 1) % 1);
  };
}

export const SIGNATURES: Record<SigName, Hurdle> = {
  // Small saws dropping out of the ceiling, one column after another.
  rain: { name: 'sigRain', needs: [], lay: drops(1) },
  // The rain turned over: saws shot up out of the floor.
  fountain: { name: 'sigFountain', needs: [], lay: drops(-1) },
  // Blades on arms, swinging along the run from alternate walls.
  pendulum: {
    name: 'sigPendulum',
    needs: [],
    lay(w, y, s, r, heat) {
      const n = lean(r, [2, 3], heat);
      const arm = lean(r, [165, 180, 195], heat);
      const rate = lean(r, [0.32, 0.38, 0.44], heat);
      const phase = r();
      const zig = r() < 0.6;
      for (let i = 0; i < n; i++) {
        const wall = (zig && i % 2 ? s : -s) as 1 | -1;
        pendulum(w, wall, y + 150 + i * 340, arm, rate, (phase + i * 0.35) % 1);
      }
    },
  },
  // Rings of saws turning round an empty hub, stepping from wall to wall.
  orbiter: {
    name: 'sigOrbiter',
    needs: [],
    lay(w, y, s, r, heat) {
      const n = lean(r, [2, 3], heat);
      const count = lean(r, [2, 3, 4], heat);
      const rate = lean(r, [0.26, 0.32, 0.38], heat);
      const at = pick(r, [62, 70]);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? s : -s;
        orbiter(w, side * at, y + 80 + i * 330, count, side * rate, r());
      }
    },
  },
  // Saws racing along tracks laid down the run: one lane, or two out of step.
  zipper: {
    name: 'sigZipper',
    needs: [],
    lay(w, y, s, r, heat) {
      const span = lean(r, [240, 280, 320], heat);
      const rate = lean(r, [0.24, 0.29, 0.34], heat);
      const phase = r();
      const lanes = lean(r, [[pick(r, [-40, 0, 40])], [-62, 62], [-100, 0, 100]], heat);
      lanes.forEach((x, i) => zipper(w, s * x, y + i * 40, span, rate, (phase + i * 0.5) % 1));
    },
  },
  // Blocks slamming out of alternate walls, one after another.
  crusher: {
    name: 'sigCrusher',
    needs: [],
    lay(w, y, s, r, heat) {
      const n = lean(r, [2, 3, 4], heat);
      const gap = lean(r, [240, 220, 200], heat);
      const reach = lean(r, [200, 225, 245], heat);
      const rate = lean(r, [0.4, 0.46, 0.52], heat);
      const phase = r();
      for (let i = 0; i < n; i++) {
        const wall = (i % 2 ? s : -s) as 1 | -1;
        crusher(w, wall, y + i * gap, reach, rate, (phase + i * 0.3) % 1);
      }
    },
  },
};

/** Set pieces that always reach the floor, whichever way round they are laid. */
const FLOOR_SIGS = new Set([SIGNATURES.rain, SIGNATURES.fountain]);

/**
 * The hurdles a level may deal, given the script stages it has shown -- and,
 * with `about`, only the ones that use at least one thing out of those stages.
 */
function hurdlesFor(names: string[], about?: string[]) {
  const tags = new Set(names.flatMap(name => survey(name).tags));
  const theme = about && new Set(about.flatMap(name => survey(name).tags));
  return HURDLES.filter(
    h => h.needs.every(tag => tags.has(tag)) && (!theme || h.needs.some(tag => theme.has(tag))),
  );
}

/**
 * Fewest hurdles the closing stretch will deal from. A level whose own idea
 * is one hazard -- the frames, say -- would otherwise close on one hurdle
 * dealt a dozen times over; below this it deals from the whole middle deck.
 */
const CLOSE_MIN = 4;

/**
 * Lay one hurdle with the top of its band at `top`, and say where it reaches.
 *
 * It is written against its own anchor, so it is laid there first and then
 * moved as a whole: what the hurdle *is* never depends on where in the level
 * it landed.
 */
export function layHurdle(w: World, card: Card, top: number, r: Rand, heat = 0.5): Band {
  const from = w.props.length;
  card.hurdle.lay(w, top, card.s, r, heat);
  const laid = w.props.slice(from);
  const band = bandOf(laid)!;
  return shift(laid, band, top - band.top);
}

function shift(props: Prop[], band: Band, by: number): Band {
  for (const p of props) p.y += by;
  return moved(band, by);
}

function moved(band: Band, by: number): Band {
  return {
    top: band.top + by,
    bottom: band.bottom + by,
    floorTop: band.floorTop + by,
    floorBottom: band.floorBottom + by,
  };
}

/** Heat below which the hard hurdles are held back in the deck. */
const HARD_FROM = 0.5;

/** A small seeded generator, so a level is the same level every time. */
function rng(seed: number): Rand {
  // Park-Miller: every product stays well inside a double's exact range.
  const M = 2147483647;
  let a = seed % M;
  if (a <= 0) a += M - 1;
  return () => {
    a = (a * 16807) % M;
    return (a - 1) / (M - 1);
  };
}

/**
 * The deck the fresh hurdles are dealt from: every hurdle the level may use,
 * once each way round, shuffled. Nothing is dealt a second time until the
 * whole deck has been, and the same hurdle is never dealt twice running --
 * not even across a reshuffle.
 */
function dealer(rand: Rand) {
  let pool: Hurdle[] = [];
  let cards: Card[] = [];
  let last = '';
  const refill = () => {
    cards = pool.flatMap(hurdle => [
      { hurdle, s: 1 as const },
      { hurdle, s: -1 as const },
    ]);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  };
  return {
    rand,
    /** Switch to a new set of hurdles, when the level moves into a new stretch. */
    use(next: Hurdle[]) {
      if (next === pool) return;
      pool = next;
      refill();
    },
    /**
     * The cards in the order they should be tried: what is left in the deck,
     * then -- only if none of that fits -- anything in the pool that is not the
     * hurdle just dealt, and a repeat of that as the very last resort.
     */
    order(heat: number): Card[] {
      // While the heat is low the hard hurdles wait in the deck; if they are all
      // that is left, the deck is dealt afresh rather than forcing one out.
      const held = (c: Card) => !!c.hurdle.hard && heat < HARD_FROM;
      if (!cards.some(c => !held(c))) refill();
      const other = (c: Card) => c.hurdle.name !== last;
      const spare = pool.flatMap(hurdle => [
        { hurdle, s: 1 as const },
        { hurdle, s: -1 as const },
      ]);
      const easy = (c: Card) => !held(c);
      return [
        ...cards.filter(c => other(c) && easy(c)),
        ...spare.filter(c => other(c) && easy(c)),
        ...cards.filter(c => other(c) && !easy(c)),
        ...cards.filter(c => !other(c)),
      ];
    },
    take(card: Card) {
      const at = cards.findIndex(c => c.hurdle === card.hurdle && c.s === card.s);
      if (at >= 0) cards.splice(at, 1);
      last = card.hurdle.name;
    },
  };
}
