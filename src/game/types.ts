/**
 * Every hazard, pickup and marker is one `Prop`, positioned in world space.
 * A fat record beats a union here: the game loop touches the same handful of
 * fields every frame.
 */
export type PropKind =
  /** Vertical rod. The rail a blade rides: touching the bare line is safe. */
  | 'pipe'
  /** Blade on a rail off a pipe, sliding in and out along it. */
  | 'gear'
  /** Red pill blade bolted to a pipe, rocking gently up and down it. */
  | 'capsule'
  /** Big spoked wheel drifting in the corridor. */
  | 'bigWheel'
  /** Tumbling triangle frame. */
  | 'triangle'
  /** Tumbling square frame. */
  | 'square'
  /**
   * Static hexagon cage with blades on rails strung across it. The outline is
   * scenery -- the ball flies in through it -- and only the blades are lethal.
   */
  | 'hexagon'
  /** Tumbling `[ ]` frame: two boxes, mouths facing, turning as one piece. */
  | 'bracket'
  /** Green launcher that turns red and fires a shot across the corridor. */
  | 'turret'
  /** Band of arrows that shoves the ball sideways while it is inside. */
  | 'wind'
  /** Console pickup: bursts coins and opens the bonus window. */
  | 'tvBox'
  /** Checkpoint. Scores, and a failed run resumes here. */
  | 'flag'
  | 'star'
  /** The dish at the end of the level. */
  | 'plate'
  /** T-bar capping a pipe. Decoration only: nothing collides with it. */
  | 'stand'
  /**
   * Small saw that drops out of one wall, falls straight across the corridor
   * and disappears into the other, over and over. `side` 1 falls from the
   * ceiling (the saw rain), -1 shoots up out of the floor (the fountain).
   */
  | 'dropSaw'
  /** Blade on an arm swinging back and forth along the run from a wall pivot. */
  | 'pendulum'
  /** `count` saws going round an empty hub on spokes. */
  | 'orbiter'
  /** Saw racing back and forth along a track laid down the run. */
  | 'zipper'
  /** Block that slams out of a wall, holds, and draws back in. */
  | 'crusher';

export interface Prop {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  /**
   * Reach along the run, for pipes and for the travel of a sliding gear.
   *
   * Along `y`, so a pipe is a rod laid down the corridor -- which is a rod
   * lying *across* the screen once the corridor is turned onto it.
   */
  span: number;
  /** Collision radius, or the circumradius of a frame. */
  radius: number;
  /** Outer reach of a wheel's spokes. */
  reach: number;
  /**
   * Base rotation, or the resting angle of a frame.
   *
   * On a launcher it is the line its shots leave on, in radians -- see
   * `SHOT_SPREAD`. A launcher does not turn, so the field is free, and
   * keeping the aim on the prop is what makes a shot the same shot on a
   * retry.
   */
  angle: number;
  /** Turns per second for anything that spins. */
  spin: number;
  /** Slides per second for anything that travels. */
  rate: number;
  /** How far a drifting prop swings either side of its anchor. 0 holds still. */
  sway: number;
  /** Offset into a cycle, so siblings do not move in lockstep. */
  phase: number;
  /** Which side of its pipe a gear sticks out. */
  side: 1 | -1;
  /** Radius of the faint ring drawn behind a rail blade. 0 draws none. */
  ring: number;
  /** How far a blade rocks up and down about its anchor, in px. 0 holds still. */
  bob: number;
  /** Half-width of one box in a bracket frame; body size for everything else. */
  size: number;
  /** How many blades an orbiter carries. 0 on everything else. */
  count: number;
  taken: boolean;
  /** Seconds until a turret fires again. */
  cooldown: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  /** 0 = ink dot, 1 = gold coin fleck. */
  hue: 0 | 1;
}

/** A floating "+5" that drifts off a pickup. */
export interface Pop {
  id: number;
  x: number;
  y: number;
  label: string;
  life: number;
}

export interface Stage {
  index: number;
  name: string;
  yStart: number;
  yEnd: number;
  /** Stages in the closing stretch run on an inverted palette. */
  dark: boolean;
}

export type Status = 'playing' | 'dead' | 'paused' | 'finished';

/**
 * The ball, in the corridor's own two axes.
 *
 * Those axes are worth stating once, because everything else in the game is
 * quoted in them and neither one is the screen axis it is drawn along:
 *
 * - **x is the cross axis**: where the ball sits between the corridor's two
 *   walls, `FLOOR_X` to `CEIL_X`. It is drawn *up and down* the screen, and it
 *   is the axis gravity and the taps work on.
 * - **y is progress**: how far down the corridor the run has got. It is drawn
 *   *across* the screen, left to right, and the scroll is what carries it.
 *
 * A level is still authored in exactly these numbers -- the sixty stages in
 * `level.ts` have not moved -- so a hurdle that was a gap to slide into is now
 * a gap to fly into, and that is the whole of the difference.
 */
export interface Ball {
  x: number;
  y: number;
  /**
   * Rise and fall, in px/s, signed the way the screen is: positive flies the
   * ball up toward `CEIL_X`, negative sinks it toward `FLOOR_X`. A tap is the
   * only thing that ever makes it positive and gravity is the only thing
   * pulling it back the other way.
   *
   * This is the ball's whole motion on the cross axis -- `fly` is what it
   * integrates into, and the walls are what clamp it.
   */
  vx: number;
  /**
   * The line the ball has flown itself, before wind is laid over the top.
   *
   * This is what `vx` integrates into and what the walls clamp; `x` is this
   * plus whatever a wind band currently has it shoved off by. The two are kept
   * apart so that a gust is a standing shove the player flies against rather
   * than something the ball carries out of the band as momentum -- see
   * `stepWind`.
   */
  fly: number;
  /**
   * How far ahead of (+) or behind (-) the camera line the drag has carried
   * the ball, in px of corridor, never further than `DRAG_BAND`.
   *
   * The ball's `y` is this plus the camera and nothing else: the scroll is the
   * level's clock and the drag is a nudge laid over it, so there is no
   * velocity on this axis to integrate and nothing for the ball to coast off
   * once the finger stops.
   */
  lead: number;
  /**
   * How fast the last drag was moving the ball along the corridor, in px/s.
   * Positive is toward what is coming.
   *
   * Nothing integrates this and the ball is not flying at it: `lead` is set
   * outright so the ball comes to rest on the frame the finger does. It is
   * read by the drawing alone, as how far the ball leans into its travel, and
   * `stepSteer` bleeds it back to nothing once the finger stops moving.
   */
  lean: number;
  /** Recent positions as flat x,y pairs, newest first. Drawn as the tail. */
  trail: number[];
}

/** Where a failed run picks back up. */
export interface Checkpoint {
  y: number;
  score: number;
  /**
   * The gear the descent was in when this flag was passed, so a revive picks
   * the run back up at the pace the player left it at rather than at the
   * level's opening crawl.
   */
  gear: number;
  /**
   * The creep banked by the time this flag was passed. Kept with the gear for
   * the same reason: the pace a revive resumes at is the two of them together,
   * and restoring one without the other would hand back -- or take away -- a
   * chunk of descent the player never crossed a flag for.
   */
  creep: number;
}

/**
 * Where the moving parts of the world were one whole step ago.
 *
 * The simulation only ever advances in whole `FIXED_DT` steps, but a screen
 * refreshes on its own clock -- 90 or 120 times a second on most phones sold
 * now, and never quite evenly even on a 60. Drawing the stepped position on
 * every refresh therefore means the ball stands perfectly still for a third
 * of them and then covers two steps in one, which is exactly the stutter a
 * player reads as the game being choppy.
 *
 * So this is the other end of a line the drawing interpolates along: given how
 * far past the last step the refresh actually fell, the ball, the camera and
 * the clock every blade is turned by can all be put where they were at that
 * instant rather than at the last whole step. Nothing in the simulation reads
 * any of it -- it is there so the drawing has two states to sit between, and
 * `viewOf` is the only thing that ever touches it.
 */
export interface Snapshot {
  t: number;
  camY: number;
  ballX: number;
  ballY: number;
}

export interface World {
  t: number;
  status: Status;
  /** Which level this run is, 1-based. See `LEVELS`. */
  level: number;
  stages: Stage[];
  props: Prop[];
  bullets: Bullet[];
  particles: Particle[];
  pops: Pop[];
  ball: Ball;
  camY: number;
  startY: number;
  score: number;
  banked: number;
  runCoins: number;
  /** Double score while `t < bonusUntil`. */
  bonusUntil: number;
  /**
   * The descent eases back up to full speed until `t` reaches this. A respawn
   * used to resume at the full climb rate on the very first frame, which read
   * as the corridor being yanked out from under the player; the run now picks
   * itself up over a few tenths of a second instead.
   */
  settleUntil: number;
  checkpoint: Checkpoint;
  nextId: number;
  shakeUntil: number;
  /** World Y of the finishing dish. */
  finishY: number;
  /** Set for one frame when something is picked up: 1 coin, 2 console, 3 flag. */
  pickup: number;
  /** Hidden while the ball is scattered into dots. */
  ballHidden: boolean;
  /** 0 = normal palette, 1 = fully inverted. Eased, so the switch is a fade. */
  darkness: number;
  /** Descent multiplier for the current screen shape; 1 on a tall screen. */
  pace: number;
  /**
   * The gear the flags have put the descent in, and the eased reading of it
   * the corridor actually scrolls at.
   *
   * `gear` steps the instant a flag goes by: 1 at the top of every level, and
   * a `SPEED_STEP` more at each flag, up to `SPEED_MAX`. `speed` is what
   * `climbAt` multiplies by, and it chases `gear` at `SPEED_RATE` -- one
   * `SPEED_EASE` per rung -- so the change is the corridor winding up rather
   * than a jump cut.
   *
   * Both are on the world rather than counted off the flags that have been
   * taken, because a respawn puts pickups back and the gear must not be
   * un-won by the ball being set down above a flag it already passed.
   */
  gear: number;
  speed: number;
  /**
   * What the run has earned toward the same ladder just by lasting, in the
   * units `gear` is in: `CREEP_RATE` per second of play. The two are added --
   * and the sum held at `SPEED_MAX` -- to make the pace `speed` chases, so a
   * level speeds up while it is being flown and a flag is the jump up to a
   * pace the run was already climbing toward.
   *
   * It advances only while the run is being played, so a game over card left
   * up does not wind the corridor on behind it.
   */
  creep: number;
  /**
   * How far a wind zone currently has the ball shoved off its flown line, in
   * px. Signed: positive is toward the right wall.
   */
  windPush: number;
  /**
   * Seconds of play the floor's spikes are timed off -- see `spikeState`.
   * Advances only while the run is being played and goes back to 0 on every
   * respawn.
   */
  spikeClock: number;
  /** Whether the floor has spikes at all. On for every run; tests about other things turn it off. */
  spikes: boolean;
  /** World Y the last failed run ended at, so it can pick up from there. */
  deathY: number;
  /**
   * Props bucketed by depth. Every per-frame sweep -- collision, pickups,
   * wind, turrets, drawing -- walks only the buckets around the ball instead
   * of the whole level, which is several hundred props by the last stage.
   */
  buckets: Map<number, Prop[]>;
  /** The prop list `buckets` was built from; a different one rebuilds it. */
  indexedFor: Prop[] | null;
  /** Bucket the cached window was built for; -Infinity when there is none. */
  nearKey: number;
  /** The props from the buckets around `nearKey`. */
  near: Prop[];
  /** The step before this one, for the drawing to interpolate against. */
  prev: Snapshot;
}
