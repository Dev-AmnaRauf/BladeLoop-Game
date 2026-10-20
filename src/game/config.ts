/**
 * BladeLoop - global tuning.
 *
 * The ball falls down a corridor: gravity sinks it, a tap throws it back up,
 * and dragging a finger slides it sideways by however far the finger travels.
 * World Y grows with progress and draws downward; world X is centred on the
 * corridor.
 *
 * No colour lives here. The palette used to, and it was the only thing in the
 * simulation layer that the simulation never read -- every one of its tokens
 * was consumed by `src/ui/`, and having a second copy of `bg`, `pole`, `blade`
 * and a dozen more sitting next to `ui/theme.tsx`'s copy is what let the two
 * drift apart. It is all in `ui/theme.tsx` now, and there is one of each.
 */

/**
 * The half-corridor the sixty-odd stages in `level.ts` are authored against.
 *
 * Every x in those stages -- a line at -92, a launcher on the wall at 149, the
 * finish dish at 60 -- is a number in *this* space, and they stay that way.
 * What the run is actually flown down is `HALF_W`, which is this stretched by
 * `SPREAD`; `level.ts` does the stretching once, as it lays each prop down.
 */
export const AUTHOR_HALF_W = 165;

/**
 * How far the authored corridor is pulled apart across itself.
 *
 * 1: it is not pulled apart at all. The run is flown down the column the
 * stages were authored in, and that column is what a landscape screen is
 * fitted to -- the corridor across its short side, the run along its long one.
 *
 * It was 2 for a while, and the argument for that was a real one. Back then
 * the run was flown *down* the screen, so a landscape window was a very wide
 * one with a 330px corridor using about a third of it. Stretching x alone
 * spent that width without zooming, since stretching y with it would have
 * shown less of what is coming.
 *
 * What it could not stretch is the half of the furniture that turns. A
 * hexagon, a spoked ring, a tumbling frame cannot be pulled along one axis
 * without its own corners changing size as it goes round, so each of those
 * kept the size it was drawn at while the room it had to block doubled -- and
 * they are most of what a level is made of. So the corridor read as the
 * authored one with its hazards loosened: every hurdle that turns blocked half
 * the share of the lane it was authored to block, and a turret's shot took
 * 2.2s to cross rather than 1.1s. The reference plays the tight column. This
 * is back to it, and the stages are flown at the widths they were tuned at.
 *
 * The width the landscape lock buys is still spent, and the answer to where
 * is better than either of those: it goes on *what is coming*. The corridor is
 * flown across the screen now, so the long side is the warning -- about 760
 * world px of it on a phone, which is very nearly what the stages were
 * authored against -- and the corridor itself gets the short side, walls and
 * all. Neither the hurdles nor the room to read them has to give anything up.
 *
 * Everything that reads this keeps reading it: `level.ts` multiplies every
 * authored x by it exactly once, and `WIND_FORCE`, `WIND_MAX` and
 * `RunWord`'s x carry it too. The spread stays one number rather than a
 * decision spread across sixty stages, so it can go back up without touching
 * any of them.
 */
export const SPREAD = 1;

/** The corridor runs from -HALF_W to +HALF_W. */
export const HALF_W = AUTHOR_HALF_W * SPREAD;

export const BALL_R = 11;

/**
 * The narrowest the corridor is ever allowed to come down to, in px of *lane*.
 *
 * A lane is measured in places the ball's centre may sit, so it is the gap on
 * screen less the ball's own 22px: a lane of 55 is 77px of daylight, over a
 * ball's width of slack either side of the line through it.
 *
 * It was 44 until 2026-09-25, when the phone showed hurdles laid close
 * together that the ball could not get between: 44 was enough to pass the
 * audit and still too tight to fly.
 *
 * It is the corridor's promise, and it is quoted here rather than in the audit
 * that checks it because the furniture is sized against it -- `bracketReach`
 * is the frame reading this number and coming out shorter for it. The audit
 * (`levelAudit.test.ts`) flies every level and holds it to this.
 *
 * Room to fit is not the promise. The corridor arrives, the shapes in it are
 * turning while it does, and a gap exactly the width of the thing going
 * through it is one a player can read correctly and still be squeezed out of.
 */
export const LANE_MIN = 5 * BALL_R;

/** Half-thickness of a pipe, for both drawing and collision. */
export const PIPE_R = 3;

/** One authored stage of the level. */
export const STAGE_H = 1100;

/**
 * Clear corridor between one hurdle and the next, in px, measured between the
 * furthest either of them can reach the ball -- not between their anchors.
 *
 * It replaced the breather: a 300 px stage of nothing laid wherever the level
 * changed its mind, which with the dead air at either stage's edge came to
 * five to nine seconds of empty corridor, a dozen or more times a level. On
 * the phone that read as the level having nothing in it.
 *
 * 170 is about a second and a half at the opening gear and a little over one
 * at the top of the ladder: long enough to cross from a lane against one wall
 * to a lane against the other, which is the most one hurdle can ask of the
 * next, and short enough that the corridor never goes quiet.
 */
export const HURDLE_GAP = 170;
/**
 * Where the camera line sits along the screen, as a share of the run's travel
 * across it.
 *
 * The run reads left to right, so this is a third of the way in from the left
 * edge: behind the ball is the third already flown, and the two thirds ahead
 * of it are the warning. The drag carries the ball `DRAG_BAND` either side of
 * this line, and the scroll carries the line itself.
 */
export const CAM_ANCHOR = 0.34;

/**
 * Furthest the camera may lag the ball once the run is over, in px.
 *
 * While the run is being played the camera does not chase at all: it is the
 * scroll, and `DRAG_BAND` is what keeps the ball on screen around it. This is
 * for after that -- the finish plate sets the ball down on itself outright,
 * and the death cards leave the camera easing toward wherever the ball ended
 * up. Both leave the camera a long way behind for a few frames, and the ball
 * would ride off the edge of the screen while it caught up. Clamping the
 * camera to a band around the ball puts a hard ceiling and floor on that.
 */
export const BALL_DRIFT = 90;

/**
 * How fast the corridor scrolls at the *opening* of a level, in px/s.
 *
 * This is the pace a level starts on and finishes on. Between the two it leans
 * forward to an ordinary pace and eases back again: see `paceShape`.
 *
 * It sits well below the 180 the flat descent ran at (and the 225 and 300
 * before that). A level opens at a pace there is time to read the corridor at,
 * with nothing to react to that was not visible a second ago.
 */
export const CLIMB = 104;

/**
 * The pace hump: how much faster than the opening the corridor runs at each
 * point of a level, and how it eases back.
 *
 * A level opens at `CLIMB`, leans forward to `SPEED_MAX` through its middle,
 * and eases back to `CLIMB` for its finish, so it starts and ends at the same
 * pace. It used to only ever climb -- every flag a rung up, and a creep on top
 * between them -- which left the close of a level the fastest part of it. The
 * player asked for the start and the end to match, with the middle quicker.
 *
 * The pace is read off how far through the level the ball is, so the same
 * stretch arrives at the same pace every time it is flown, a retry included.
 * The flags no longer move it; they are the checkpoint and the payout.
 *
 * `SPEED_MAX` is about a third quicker than the opening -- an ordinary pace,
 * not a different game. `SPEED_EASE` is how long a change of one `SPEED_STEP`
 * takes to ease in, which is what a respawn winds back up at, and
 * `SPEED_RATE` is that read back as multiplier gained per second.
 */
export const SPEED_STEP = 0.12;
export const SPEED_MAX = 1.36;
export const SPEED_EASE = 2.2;
export const SPEED_RATE = SPEED_STEP / SPEED_EASE;

/**
 * Where the hump rises and falls, as shares of the level: flat at the opening
 * pace until `PACE_RISE[0]`, at the top from `PACE_RISE[1]` to `PACE_FALL[0]`,
 * and back at the opening pace from `PACE_FALL[1]` to the dish. Both slopes are
 * a smoothstep, a minute or so each, far gentler than a respawn's wind-up.
 */
export const PACE_RISE = [0.12, 0.35] as const;
export const PACE_FALL = [0.65, 0.88] as const;

/** How far up the hump a share `p` of the level is, from 0 to 1. */
export function paceHeat(p: number) {
  const ease = (a: number, b: number) => {
    const u = clamp((p - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  };
  return ease(PACE_RISE[0], PACE_RISE[1]) - ease(PACE_FALL[0], PACE_FALL[1]);
}

/** The pace multiplier a share `p` of the level runs at. */
export function paceShape(p: number) {
  return 1 + (SPEED_MAX - 1) * paceHeat(p);
}

/**
 * Retired: the creep that used to lean the corridor forward between flags.
 * The hump does that job now, and eases back too. `World.creep` stays at 0 so
 * the checkpoint and the HUD read the same shape they always did.
 */
export const CREEP_MAX = 0;

/**
 * The pace the descent is actually winding toward.
 *
 * Everything that has to know how fast the corridor is about to run -- the
 * respawn integration, the retry search, the HUD chip -- asks this rather than
 * reading `gear`, so there is one answer to "how fast is this run going".
 */
export function runGear(gear: number, creep: number) {
  return Math.min(SPEED_MAX, gear + creep);
}

/**
 * The ladder read back the way the screen says it: whole per cent over the
 * level's opening pace, so a gear of 1.12 is the `+12%` on the HUD chip.
 *
 * Said as a percentage rather than as the `×2`/`×3` the chip used to carry,
 * because a multiplier is the wrong shape for a step this size: `×1.12` is
 * four characters of noise, and rounding it to `×1` would say nothing
 * happened. What the player is being told is how much of a push the flag just
 * bought, and that is a percentage.
 */
export function speedPct(gear: number) {
  return Math.round((gear - 1) * 100);
}

/**
 * Paces to audit the corridor at, the opening one first. Nothing in the run
 * itself needs the list.
 *
 * It used to be the rungs of the flag ladder exactly, which was the whole set
 * of paces a run could be flown at while the flags were the only thing that
 * moved it. The creep fills the gaps between those rungs, so the set is now a
 * continuous range and the list is a sample of it: half a rung apart, ending
 * on `SPEED_MAX`.
 */
export function gears() {
  const step = SPEED_STEP / 2;
  const n = Math.ceil((SPEED_MAX - 1) / step);
  const all: number[] = [];
  for (let i = 0; i <= n; i++) all.push(Math.min(SPEED_MAX, 1 + i * step));
  return all;
}

/**
 * Tap to fly. The corridor scrolls past on its own at `CLIMB`, left to right;
 * across it the ball has a fall of its own, and a tap throws it back up the
 * screen. Left alone it sinks to the floor of the corridor and rides there, so
 * a player who never taps still gets a run -- they just get it along the
 * bottom wall, taking whatever the level has put there.
 *
 * `LIFT` is one tap's worth of upward speed and `RISE_MAX` is the ceiling on
 * it, so tapping faster does climb faster -- up to a point. A tap taken while
 * the ball is falling throws away the fall rather than being subtracted from
 * it, which is what makes the first tap after a long drop feel like it landed.
 *
 * A tap is the whole of the vertical control: one finger landing is one jump,
 * and holding that finger down does nothing more. Height is therefore kept by
 * timing taps against the fall, and a hand resting on the glass is a ball on
 * its way down -- see `DRAG_SLOP` for the other half, which is what that
 * resting hand is actually for once it starts moving.
 *
 * One tap clears about 80px, in a corridor 308px tall: three or four of them
 * stacked take the ball from the floor to the ceiling, and one on its own is a
 * jump the player can see land. `RISE_MAX` is set above one tap's worth for
 * exactly that reason -- were it not, the cap would swallow the extra height
 * and stacked taps would climb no faster.
 */
export const LIFT = 340;
export const RISE_MAX = 440;

/**
 * The other control: the ball is dragged along the run.
 *
 * The finger moves the ball by however much it *travels*, never to wherever it
 * happens to be. Put a thumb down anywhere and the ball does not budge; slide
 * the thumb 40px right and the ball goes 40px further into what is coming;
 * stop the thumb and the ball is stopped on that frame, there, with nothing
 * left to coast off. That last part is the whole point of the scheme -- what
 * the drag buys is a beat more or less of warning at a hurdle, and a control
 * the player has to *stop* in advance is a control they are always a beat
 * behind.
 *
 * It is a relative drag rather than an absolute one, and the difference is not
 * a detail. Mapping the finger's position straight onto the ball's was tried
 * and thrown out: every touch is also a tap, so every single jump threw the
 * ball across the corridor to meet the thumb that jumped it. Moving by the
 * delta instead means the ball only ever gets somewhere by travelling there,
 * and a tap anywhere on the glass is a pure jump.
 *
 * `DRAG_SLOP` is how far the finger must travel before any of this starts, in
 * screen px. Below it the touch is a tap and nothing else -- without it, the
 * few px of wobble in every real thumb-press would smear the ball sideways on
 * every jump.
 *
 * `DRAG_GAIN` is how much world travel one px of finger travel buys, applied
 * after the view scale is divided out, so a drag covers the same share of the
 * corridor on every screen. 1 is one-to-one: the ball keeps up with the thumb
 * exactly, which is what makes it stop exactly.
 */
export const DRAG_SLOP = 6;
export const DRAG_GAIN = 1;

/**
 * How fast a drag has to be moving the ball to count as flat out, in px/s, and
 * how quickly that reading bleeds away once the finger stops.
 *
 * Neither of these is a limit on anything: the drag sets the ball's line
 * outright and is never capped or ramped, because a ball that lagged the thumb
 * would not stop where the thumb stopped. They exist so the ball can be *drawn*
 * leaning into its travel -- `LEAN_MAX` is the speed the lean is measured
 * against, and `LEAN_BLEED` returns the ball to upright over about a sixth of
 * a second after the finger stops rather than leaving it frozen mid-turn.
 */
export const LEAN_MAX = 260;
export const LEAN_BLEED = 1500;

/**
 * Downward pull on the ball, and the terminal sink it reaches, in px/s.
 *
 * Both are read along the *cross* axis -- the corridor's own, drawn up and
 * down the screen -- and `vx` is signed the way the screen is: positive rises
 * toward `CEIL_X`, negative sinks toward `FLOOR_X`. So gravity subtracts and
 * a tap adds, which is the one place this reads differently from the descent
 * it grew out of.
 */
export const FALL_G = 720;
export const SINK_MAX = 250;

/**
 * The two walls, quoted as the furthest the ball's centre may get to each.
 *
 * These are the whole of the up-and-down room now. The ball used to fly a
 * band of its own around the camera while the corridor's walls stood off to
 * its left and right; the corridor is flown *across* the screen instead, so
 * the walls are the ceiling and the floor and the ball has the full 308px
 * between them to fly in.
 *
 * Reaching either is not a death. The ceiling is what a stack of taps runs out
 * of, and the floor is where an untouched ball comes to rest and rides -- the
 * same promise the old band made, kept by the corridor itself.
 */
export const CEIL_X = HALF_W - BALL_R;
export const FLOOR_X = -HALF_W + BALL_R;

/**
 * The floor's spikes: a row of them along the whole floor that comes up out of
 * it every so often, stays up for `SPIKE_UP` seconds and goes back down.
 *
 * They are what stops the floor being somewhere to sit out a stretch. The ball
 * still rests there between bursts, but while the spikes are up touching the
 * floor ends the run, so every few seconds the player has to be holding the
 * ball up off it.
 *
 * One cycle is: `SPIKE_REST` of bare floor, `SPIKE_WARN` of the tips peeking
 * out (harmless -- it is the warning), then `SPIKE_UP` with them fully out and
 * lethal, then straight back to bare. `SPIKE_H` is how tall they stand, in px
 * across the corridor, and is all the room they take off the bottom of it.
 * The cycle restarts from the bare floor on every respawn, so a retry is never
 * set down onto spikes that are already up.
 */
export const SPIKE_REST = 5;
export const SPIKE_WARN = 0.7;
export const SPIKE_UP = 2;
export const SPIKE_H = 16;

/** Where in its cycle the floor is at `clock` seconds into the run. */
export function spikeState(clock: number): { out: number; lethal: boolean } {
  const c = clock % (SPIKE_REST + SPIKE_WARN + SPIKE_UP);
  if (c < SPIKE_REST) return { out: 0, lethal: false };
  if (c < SPIKE_REST + SPIKE_WARN) return { out: 0.3, lethal: false };
  // Snap up over the first tenth of a second rather than appearing outright.
  return { out: Math.min(1, 0.3 + (c - SPIKE_REST - SPIKE_WARN) * 7), lethal: true };
}

/**
 * How far ahead of and behind the camera line the drag may carry the ball, in
 * px of corridor.
 *
 * The scroll is the level's clock, so the ball cannot be allowed to outrun it
 * or fall out of the back of it: this is the band the drag works inside.
 * Ahead is toward what is coming, and buys less warning; behind is more.
 *
 * It is deliberately a nudge rather than a second way of flying the level --
 * 240px of a viewport that shows about 760 -- because the jump is what the
 * corridor is authored against, and a drag that could outrun a hurdle would be
 * a way round every one of them.
 */
export const DRAG_BAND = 120;

/**
 * The simulation runs on a fixed step, so a dropped frame costs a frame of
 * smoothness and never a frame of speed. A variable step made a stutter look
 * like the game going into slow motion: the clamp that stops the ball
 * tunnelling through a blade also shortened the world's second.
 */
export const FIXED_DT = 1 / 60;
/**
 * Most fixed steps one frame may catch up on, so a long stall -- the app
 * coming back to the foreground -- does not fast-forward the run.
 */
export const MAX_STEPS = 5;

/** How far back up the corridor a failed run picks up from where it ended. */
export const RESPAWN_BACKUP = 220;

/**
 * Seconds of corridor a respawn lane has to stay clear for.
 *
 * The ball used to be immune for this long instead, which is what let a
 * respawn drop anywhere and sail through the first blade it met. Nothing is
 * immune now -- a respawned ball dies to the same things it always did -- so
 * this window is no longer a shield but the promise the lane picker has to
 * keep: `respawnX` flies every lane down for this long and takes the one that
 * stays clear. It is quoted against `CLIMB` for the same reason it always
 * was, being the run-up a hand that let go of the screen needs to get back on
 * it.
 */
export const RESPAWN_CLEAR = 2.1;

/**
 * Seconds a respawn takes to work back up to the full descent. The ball is
 * standing still while the game over card is up, so resuming at the full climb
 * rate on the first frame reads as a jolt; easing in over this window makes a
 * retry start off gently instead.
 */
export const RESPAWN_SETTLE = 0.45;

/**
 * How fast a wind zone shoves the ball off its flown line, in px/s, and how
 * far it can shove it before it holds there.
 *
 * Wind is an offset laid on top of the line the ball has flown itself, rather
 * than a force folded into the flight: that way it is a fixed, readable amount
 * of sideways however long the ball is in the band, and it eases back off on
 * the way out instead of leaving momentum behind. The player answers it by
 * flying to the other side of the gap they actually want to go through.
 *
 * Both run across the corridor, so both carry `SPREAD`. A shove is only ever a
 * hazard as a share of the room the player has to give: 76px of it is most of
 * the way to the next lane in the 330 corridor the stages are authored in, and
 * was a nudge in the 660 one the spread opened up while it was 2. Carrying the
 * spread is what keeps the band taking the same beat to push the ball as far
 * as it pushes it, whatever the corridor is.
 */
export const WIND_FORCE = 190 * SPREAD;
export const WIND_MAX = 76 * SPREAD;

export const REVIVE_COST = 5;

/**
 * Samples kept for the tail, one per frame. At the run's speeds this draws a
 * trail of roughly 35-60px, which is the length the reference carries.
 */
export const TRAIL_POINTS = 12;
/**
 * Longest the tail is ever drawn, in px of path. The reference tail is a short
 * comet whatever the ball is doing, and a long dive down the corridor would
 * otherwise draw a much longer streak than that.
 */
export const TRAIL_LEN = 52;

/**
 * The shots the turrets fire.
 *
 * They used to be homing: aimed at the ball as they left the muzzle and then
 * turning after it for `BULLET_HOME` seconds at `BULLET_TURN` rad/s. Asked
 * for on the phone, and taken out. Two reasons it was the wrong hazard. It
 * read as the level singling the player out -- every other thing in the
 * corridor is furniture that is simply *there*, and a shot that follows is an
 * opponent. And it could not be read: a shot aimed where the ball *was* is
 * answered by moving, which is exactly what makes it hit.
 *
 * A shot now leaves on the launcher's own line (`Prop.angle`, set where the
 * launcher is authored), crosses the corridor and is gone. Where it goes is a
 * fact about the launcher, not about the player, so a stretch flown twice is
 * flown against the same shots both times -- which is the same promise the
 * corridor's pace makes to a retry.
 */
export const BULLET_SPEED = 300;
export const BULLET_LIFE = 3.0;
export const BULLET_R = 9;

/**
 * How far off straight across the corridor a launcher's line may sit.
 *
 * Straight across for every launcher in the game would be a row of identical
 * tripwires. About a tenth of a turn either way is enough that no two
 * launchers in a level read the same, and not so much that a shot ends up
 * running along the corridor beside the player rather than across it.
 */
export const SHOT_SPREAD = 0.6;

/** Seconds the TV pickup keeps the double-score window open. */
export const BONUS_SECS = 10;

/**
 * What passing a flag is worth.
 *
 * A flag used to be worth 25 and a checkpoint, which on a descent that scores
 * a couple of thousand a level is a rounding error -- the player got a small
 * chime and a chip they could not read, and nothing that said they had just
 * won something. It is now the one landmark in a level that is genuinely
 * earned: it winds the corridor up a gear, it is where a revive puts the ball
 * back, and it pays in both currencies. `FLAG_COINS` is deliberately small
 * against the stars -- a flag is a milestone, not a gem mine -- but it is not
 * nothing, because "nothing" is what the old one paid.
 */
export const FLAG_SCORE = 150;
export const FLAG_COINS = 2;

/**
 * Seconds of descent between one flag and the next.
 *
 * Flags are authored into the stages, a few stages apart, which on the old
 * twenty-second level meant the first one arrived almost immediately and the
 * rest every few seconds after it. On a level that now runs for minutes that
 * would hand the player the top of the speed ladder inside the first quarter
 * of it. So the level's builder keeps one authored flag roughly this far
 * apart in *time* and drops the rest: the first is a good minute and a half
 * into the run, and each one after it is another minute and a half of
 * corridor at whatever pace the last one set.
 *
 * Kept in seconds rather than in px on purpose. The corridor gets faster as
 * the flags go by, so a fixed depth between them would bunch the last ones up
 * against each other exactly where the player has the least time to read one.
 */
export const FLAG_GAP_SECS = 70;

/**
 * Room left over the walls, in world px, so a wall is drawn on the glass
 * rather than along the very edge of it.
 */
export const WALL_PAD = 10;

/**
 * The cross-axis span the screen's short side is fitted to, in world px.
 *
 * This is what decides the view scale now, and it is the one number the whole
 * picture hangs off. The corridor is flown across the screen, so its 330px
 * have to fit the screen's *height* -- and they are made to fit it exactly
 * rather than being scaled by some share of it, because a corridor with its
 * walls off the top and bottom of the glass is a corridor the player cannot
 * read the edges of.
 */
export const VIEW_SPAN = 2 * HALF_W + 2 * WALL_PAD;

/**
 * Screen px per world px, set by fitting the corridor to the screen's height.
 *
 * Clamped at both ends for the shapes no phone is: the floor keeps a very
 * short window from drawing the corridor smaller than it is readable at, and
 * the ceiling keeps a tablet from drawing a phone's corridor at twice the size
 * with a sliver of run either side of it. Outside the clamp the walls simply
 * stop reaching the edge, and `Walls` falls the water away behind them.
 */
export function viewScale(screenH: number) {
  return clamp(screenH / VIEW_SPAN, 0.72, 1.6);
}

/**
 * How much corridor the screen shows along the run, in world px.
 *
 * The long side of the screen now, which is what the landscape lock is finally
 * being spent on: about 760px on a 20:9 phone, which is very nearly the 760
 * the levels were authored against when that was the tall axis.
 */
export function lookahead(screenW: number, screenH: number) {
  return screenW / viewScale(screenH);
}

/** What the run's warning was authored against, in world px. */
export const DESIGN_LOOK = 760;

/**
 * A viewport that shows less of what is coming runs the corridor slower to
 * match, so the player gets the same seconds of warning on any screen shape.
 *
 * It reads both sides of the screen because both now matter: the width is the
 * warning itself, and the height is what sets the scale that width is measured
 * at.
 */
export function paceFor(screenW: number, screenH: number) {
  // Floored well above the old 0.6: a short window used to run the corridor at
  // a crawl, which is the "slow" a phone in landscape was really showing.
  return clamp(lookahead(screenW, screenH) / DESIGN_LOOK, 0.9, 1.15);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Distance from a point to a line segment. */
export function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/**
 * How far a blade rocks up and down on its mounting, and how many times a
 * second. Small and slow: it is there to stop a parked blade looking welded
 * on, not to be another thing to time a run against.
 */
export const BLADE_BOB = 9;
export const BLADE_BOB_RATE = 0.35;
/**
 * How far a pill blade travels either side of its anchor along its line. The
 * pills are big, so a small rock reads as a jitter; this is a real trip up
 * and down that the player can see and time.
 */
export const CAPSULE_BOB = 34;
/**
 * Trips per second a pill blade makes up and down its line. The saws rock on
 * a much slower clock, which on a pill the size of these read as it standing
 * still while the corridor swept past; this is a pace the player can actually
 * see the pill travelling at, and time a gap against.
 */
export const CAPSULE_BOB_RATE = 0.8;

/** Nearest a gear ever sits to its pipe, along its rail. */
export const RAIL_MIN = 20;
/** Sideways offset of a capsule blade from its pipe. It never slides. */
export const CAPSULE_OFFSET = 20;
/** Vertical half-height of a capsule blade. */
export const CAPSULE_HH = 22;

/**
 * The `[ ]` frame: the bar each half is cut from, the channel between them,
 * and how long the pair is down its spine.
 *
 * The frame is the reference's `[ ]`: two boxes with their open mouths facing
 * each other, turning about the one centre. It reaches `2 * BRACKET_W +
 * BRACKET_GAP` across the channel and `BRACKET_H` along it.
 *
 * `BRACKET_H` is the number that decides whether the corridor has a gap in it.
 * A frame turns, so once a level is minutes long it *will* be met lying flat
 * across the corridor, and at that turn it is a bar `BRACKET_H + 2 * BALL_R`
 * wide laid across a corridor `2 * HALF_W` wide with only the two wall lanes
 * left either side of it. At 236 those lanes were 20px for a ball 22px across:
 * a needle at best, and at a frame anchored dead centre the corridor was for a
 * few frames not open at all. That is the one thing a corridor may never do --
 * there is nothing the player could have read differently -- and no amount of
 * widening the channel fixes it, because the channel lies *across* the run at
 * exactly that turn and is not a way down at all.
 *
 * So the frame is short enough that the wall lane clears `LANE_MIN` at every
 * angle it can turn to, whatever it is anchored at: see `bracketReach`. It is
 * a smaller frame than the reference draws, and it is the same frame all the
 * way round its turn, which is worth more.
 *
 * It came down again, from 168 to 140, for the level that is built out of
 * them: the tunnel meets its frames inside a wind band, where the lane the
 * player takes is the one the band leaves them rather than the one they aimed
 * at, and at the old length that lane was survivable rather than comfortable.
 * A shorter spine is more air either side of it at every angle it can turn
 * to, which is the same bargain the rest of the run is built on.
 *
 * The channel is held at `BRACKET_GAP` rather than scaled with the rest, so it
 * comes out a wider slice of the frame than the reference draws: it is the
 * reward for taking a frame head-on rather than going round it, so it is
 * quoted against the ball -- wide enough that threading it is a real line and
 * not a pixel-perfect one.
 */
export const BRACKET_W = 30;
export const BRACKET_GAP = 74;
export const BRACKET_H = 140;

/**
 * How far a frame reaches across the corridor at the worst turn it can make,
 * in px, with the ball's own radius and the collision slack counted in.
 *
 * Lying flat is the worst turn: the spine is then straight across the run and
 * the pair's own width is along it. Every other angle reaches less.
 */
export function bracketReach() {
  return BRACKET_H / 2 + BALL_R + 6;
}

/** Band thickness of a big wheel rim. Drawing and collision both use it. */
export function wheelBand(radius: number) {
  return Math.max(5, radius * 0.085);
}

/** Smooth 0 -> 1 -> 0 ping-pong, used by anything that slides back and forth. */
export function pingPong(t: number) {
  return 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
}
