import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SPREAD, clamp } from '../game/config';
import { OPENING_Y } from '../game/level';
import { TYPE } from './type';

/**
 * The word painted across the opening corridor, turned on its side so that
 * `GameView`'s quarter turn lands it reading along the run.
 *
 * It is level scenery, not an overlay: it sits at a fixed spot in the world and
 * the ball falls past it. Drawn before the props so the pipe, the blades and
 * the ball all pass over the top of it, the way a marking on the floor would.
 *
 * It does have a life of its own, though, and it is the shortest one in the
 * game. It writes itself as the run opens: the letters drop in one at a time
 * from the top down, each turning itself into place -- it is the only
 * instruction the game ever gives, so it arrives doing the thing it says -- and
 * the whole word fades out again as the ball comes down past it, before the
 * first line of the level. By then it has been read.
 */

/**
 * World X: out in the open right of the stage-one pipe, which stands at -92.
 *
 * Quoted against that pipe, so it is quoted in the space the stages are
 * authored in and stretched across the corridor the same way they are. Left as
 * a bare 34 it would drift in over the line as `SPREAD` pulled the line out,
 * and the one instruction the game gives would end up written across the one
 * hazard it is trying to teach.
 */
export const WORD_X = 34 * SPREAD;

/**
 * World Y of the word's middle.
 *
 * It lives in the run-up, the clear air the ball opens in, and it starts above
 * the opening flag. That is the whole point of where it is: it has to be on
 * screen from the run's first frame, because that is when it writes itself.
 * Down in the first stage, where it used to sit, the letters landed a screen
 * below the ball and the player only ever met the finished word -- which read
 * as a word sitting there turning on the spot rather than one arriving.
 */
export const WORD_Y = OPENING_Y + 230;

/**
 * How long the whole word takes to write itself, in seconds of run.
 *
 * Off the run's own clock, which is only honest now that the word is in the
 * run-up: it is on screen from the first frame, so the first frame is when the
 * first letter can land.
 *
 * Short enough that the word is finished before it starts fading. The ball
 * takes about a second to come down level with it, and a word still writing
 * itself while it goes reads as two things happening to it at once.
 */
const IN_SECS = 0.9;
/** The word itself. Split up: each letter arrives on its own. */
const WORD = 'ROTATE';
/**
 * How much of the way in a single letter takes. The rest of the run-up is the
 * stagger between them, so a bigger span here means the letters overlap more
 * and the word lands as more of one movement than six.
 */
const LETTER_SPAN = 0.45;
/** Gap between one letter starting and the next, so they land in order. */
const LETTER_STEP = (1 - LETTER_SPAN) / (WORD.length - 1);
/** Full turns a letter makes as it drops in. */
const LETTER_TURNS = 1;
/** How small a letter starts, before it grows into its own size. */
const LETTER_SCALE = 0.2;

/**
 * Where the word gives itself up. It starts going a beat after the ball draws
 * level with it -- so the writing is done and read first -- and is gone by the
 * first line of the level, which is where the run-up ends and where an
 * instruction stops being any use to anybody.
 */
const OUT_FROM = WORD_Y + 40;
const OUT_TO = 0;

const SIZE = 54;
/** Box the text is laid out in before the quarter turn. Wider than the word
 *  itself: the text centres inside it, and a tight box would clip the tails. */
const LEN = 300;

/** How far the word reaches up and down the corridor once turned, for culling. */
export const WORD_SPAN = LEN;

/**
 * How the word looks this frame: writing itself as the run opens, then fading
 * out as the ball comes down past it.
 *
 * Worked out from the world rather than from an `Animated` timeline of its
 * own: the view is already redrawn every frame from the run's clock and the
 * ball, and a second clock running beside that one is a second thing to get
 * out of step with a pause, a respawn or a start over. A pause holds the word
 * mid-word, and a start over -- which puts the clock back to nothing -- writes
 * it again, both for free.
 *
 * @param t     Seconds of run so far, which is what the letters land on.
 * @param ballY World Y of the ball, which is what the fade out is measured on.
 */
export function wordPhase(t: number, ballY: number) {
  return {
    /** How far through writing itself the word as a whole is, 0 to 1. */
    progress: clamp(t / IN_SECS, 0, 1),
    /** What is left of it as the run comes down past it: 1 whole, 0 gone. */
    fade: 1 - clamp((ballY - OUT_FROM) / (OUT_TO - OUT_FROM), 0, 1),
  };
}

/**
 * Where one letter is in its own arrival, given how far the word has got.
 *
 * Each letter owns a slice of the run-up and holds still either side of it, so
 * they land one after another in reading order rather than all at once.
 */
export function letterPhase(i: number, progress: number) {
  const raw = clamp((progress - i * LETTER_STEP) / LETTER_SPAN, 0, 1);
  // Eased out, so a letter flies in and settles rather than stopping dead.
  const eased = 1 - (1 - raw) ** 3;
  return {
    /** Degrees still to turn through, about the letter's own middle. */
    spin: (1 - eased) * LETTER_TURNS * 360,
    scale: LETTER_SCALE + (1 - LETTER_SCALE) * eased,
    opacity: eased,
  };
}

function RunWord({
  x,
  y,
  color,
  progress,
  fade,
}: {
  x: number;
  y: number;
  color: string;
  progress: number;
  fade: number;
}) {
  return (
    // The box's own quarter turn is what makes the word read down the corridor,
    // and it never moves. What moves is the letters inside it, each about its
    // own middle -- so the word arrives in place rather than swinging into it.
    <View
      pointerEvents="none"
      style={[styles.box, { left: x - LEN / 2, top: y - SIZE / 2, opacity: fade }]}>
      {WORD.split('').map((ch, i) => {
        const l = letterPhase(i, progress);
        return (
          <Text
            key={`${i}${ch}`}
            style={[
              styles.word,
              {
                color,
                opacity: l.opacity,
                transform: [{ rotate: `${l.spin}deg` }, { scale: l.scale }],
              },
            ]}>
            {ch}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    width: LEN,
    height: SIZE,
    // A row before the turn, which is a column of letters after it -- and a
    // row again after `GameView` turns the whole corridor back the other way,
    // which is why this one is not `UPRIGHT`. The two turns cancel, so the
    // word is upright on the glass and reads in the direction the run travels.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // A quarter turn about the box's centre: the word ends up reading top to
    // bottom, first letter highest, still centred on the point it was given.
    transform: [{ rotate: '90deg' }],
  },
  word: {
    fontSize: SIZE,
    lineHeight: SIZE,
    ...TYPE.black,
    // The letters are their own views now, so the gap between them is margin
    // rather than tracking: a shared `letterSpacing` hangs off the right of
    // every letter, which reads as an off-centre turn once each one spins.
    marginHorizontal: 1,
  },
});

/**
 * Memoised: once the letters are all in, `progress` sits at 1 and `fade` at 1,
 * and the rest of its props only change when the camera crosses a stage
 * boundary -- so it is only actually re-rendered while it is moving.
 */
export default React.memo(RunWord);
