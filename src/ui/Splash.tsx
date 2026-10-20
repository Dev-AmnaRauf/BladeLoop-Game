/* eslint-disable react-native/no-inline-styles -- one-off layout */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import Backdrop from './Backdrop';
import Button, { IconButton } from './Button';
import { Ball, Saw } from './entities';
import { playThen } from './handover';
import Icon from './Icon';
import { useLayout } from './layout';
import { TYPE } from './type';
import Wordmark from './Wordmark';

/**
 * Radius the blades circle the character at, and how big they are, at `ui` 1.
 *
 * Both are scaled by the page's own `ui` rather than used raw: the game is
 * sideways throughout, so the height this has to fit in is the phone's short
 * side, and the same absolute pixels on a small one would crowd the pills out
 * of the page. See `layout`.
 */
const ORBIT = 78;
const BLADE = 34;

/** BLADE's type size at `ui` 1; the rest of the mark is a share of it. */
const WORD_BLADE = 54;

/** How much of the ring the character fills, as a share of the orbit. */
const HERO = 4.2 / 78;

/** How long the page takes to fade out of the way of the game, in ms. */
const LEAVE_MS = 260;

/** How fast the sky behind the title drifts by, in backdrop px a second. */
const DRIFT = 26;
/** How often the drift is stepped. Slow enough to cost the splash nothing. */
const DRIFT_MS = 50;

/**
 * One full turn of the button's two rings, in ms. Each ring owns half of it:
 * one value drives both, the second reading it half a turn behind, so the two
 * can never drift apart the way two loops of their own would.
 */
const RIPPLE_MS = 2600;

/**
 * The opening screen, and the game's front page.
 *
 * The logo sits at the top as a sticker, the character bobs under it with
 * three blades circling it, and two pills -- play, and the account -- are the
 * whole of what there is to do. PLAY opens the road between the levels rather
 * than a run: which level to open is a decision with ten answers now, and the
 * road is where it is made -- which is also where the stars each level is
 * worth are shown, rather than here. The same pastel cloud world the corridor
 * hangs in drifts past behind all of it, so the game looks like itself before
 * it has started.
 *
 * Tapping the page at large does nothing any more. It used to start a run,
 * which was fine when the only control here was one disc; with an account pill
 * beside the play button, a mis-reach would have cost the player a run.
 *
 * The three parts -- the wordmark, the character in its ring, the pills -- are
 * stacked down the page on a screen tall enough to stack them, and set side by
 * side on one that is not. The game is sideways throughout, so a phone is
 * always the second case: the three of them come to a good 500dp stacked and a
 * phone held sideways has about 360, and the answer to that is to use the axis
 * there is plenty of rather than to shrink all three until they fit. A tablet
 * has the height for the stack and keeps it. See `layout`.
 */
function Splash({
  front,
  level,
  levelName,
  playerName,
  onStart,
  onLogin,
  onLeaderboard,
  onSettings,
}: {
  /**
   * True while this page is the front-most thing on screen.
   *
   * PLAY does not unmount the page -- the road is drawn *over* it, and the
   * pause card and the run behind it are still the ones this page opened -- so
   * the page is left faded out and spent for as long as the road is up. That
   * is fine while something covers it and fatal the moment nothing does: the
   * player comes off the road onto a page that is drawn at zero opacity with
   * its one button already claimed, which reads as the game having hung.
   *
   * So the page is told when it is uncovered, and puts itself back.
   */
  front: boolean;
  /** The level PLAY will open, 1-based. */
  level: number;
  levelName: string;
  /** The signed-in player's name, or '' for a guest or nobody. */
  playerName: string;
  onStart: () => void;
  /** Opens the sign-in door. */
  onLogin: () => void;
  /** Opens the board, off the trophy in the corner. */
  onLeaderboard: () => void;
  onSettings: () => void;
}) {
  const { w: W, h: H, top, bottom, ui, tight, gutL, gutR } = useLayout();
  // The furniture, at this window's scale. The orbit is what the character
  // and the three blades are both hung off, so it is the one number the whole
  // stage is built out of.
  const orbit = ORBIT * ui;
  const blade = BLADE * ui;
  const stage = orbit * 2 + blade;
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(1)).current;
  const started = useRef(false);
  // The backdrop is drawn from a camera position rather than animated, so it
  // is stepped here. Only this screen re-renders with it, and the crowd itself
  // is memoised per band, so a step costs one transform.
  const [camY, setCamY] = useState(0);

  useEffect(() => {
    const drift = setInterval(() => setCamY(y => y + (DRIFT * DRIFT_MS) / 1000), DRIFT_MS);
    return () => clearInterval(drift);
  }, []);

  useEffect(() => {
    const intro = Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    });
    const hover = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const orbitSpin = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    // The rings that run out of the play pill. One linear ramp read two ways
    // rather than an animation each: the splash sits over a ticking world, and
    // every value here is one more thing the native driver has to carry.
    const rings = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: RIPPLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    intro.start();
    hover.start();
    orbitSpin.start();
    breathe.start();
    rings.start();
    return () => {
      intro.stop();
      hover.stop();
      orbitSpin.stop();
      breathe.stop();
      rings.stop();
    };
  }, [enter, bob, spin, pulse, ripple]);

  // The pending handover, dropped if the page goes away before it fires.
  const standDown = useRef<(() => void) | null>(null);
  useEffect(() => () => standDown.current?.(), []);

  // Uncovered again: undo the leaving. The fade is set rather than played --
  // this is the page arriving from under something that was over it, not a
  // page fading itself in -- and the button is handed back at the same time,
  // since the guard that makes PLAY fire once per departure would otherwise
  // make it fire once per launch. See `front`.
  useEffect(() => {
    if (!front) return;
    standDown.current?.();
    standDown.current = null;
    started.current = false;
    leave.setValue(1);
  }, [front, leave]);

  const start = () => {
    if (started.current) return;
    started.current = true;
    // Handed over on the clock as well as on the fade: this button is the only
    // way off the front page, and a fade that never reports itself finished
    // would leave it pressed and dead. See `playThen`.
    standDown.current = playThen(
      Animated.timing(leave, {
        toValue: 0,
        duration: LEAVE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      LEAVE_MS,
      onStart,
    );
  };

  const titleY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });
  const heroScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });
  const heroY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  // The blades spin on their own axis too, the other way, as they go round.
  const counter = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-1080deg'],
  });
  const promptFade = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });
  // The pill breathes on the same clock the hint under it fades on.
  const playScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });
  /**
   * The two rings behind the play pill. One ramp drives both: the first runs
   * out over the first half of a turn, the second over the second half, so the
   * pair is staggered by construction rather than by two loops that would
   * drift apart. Each is born at the pill's own size -- a ripple starts at the
   * stone -- so the step in each opacity ramp is the point of it.
   */
  const ringA = {
    transform: [
      {
        scale: ripple.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.14, 1.14],
        }),
      },
    ],
    opacity: ripple.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.4, 0, 0],
    }),
  };
  const ringB = {
    transform: [
      {
        scale: ripple.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1, 1.14],
        }),
      },
    ],
    opacity: ripple.interpolate({
      inputRange: [0, 0.4999, 0.5, 1],
      outputRange: [0, 0, 0.4, 0],
    }),
  };

  /**
   * The corner controls' band, and so how much of the top of the page the
   * three parts must keep clear of. Stacked they sit below it; side by side
   * they only have to clear it where a column actually reaches that high, so
   * the row is given the band as padding and centres itself in what is left.
   */
  const band = top + (tight ? BEAD * 0.72 : 64);

  return (
    // The page is laid out below the corner buttons rather than behind them:
    // the corners are absolute, so without this the logo is spaced into the
    // top of the screen and the gear sits on top of the first word of it.
    <Animated.View
      testID="front-page"
      style={[
        styles.fill,
        tight && styles.fillWide,
        {
          opacity: leave,
          paddingTop: band,
          paddingLeft: gutL,
          paddingRight: gutR,
          paddingBottom: bottom + (tight ? 10 : 0),
        },
      ]}>
      {/* Behind everything, and behind nothing of the game: the splash covers
          the run, so this is the only crowd on screen. */}
      <Backdrop camY={camY} width={W} height={H} dim={1} />

      <Animated.View
        style={[styles.title, { opacity: enter, transform: [{ translateY: titleY }] }]}>
        {/* The name of the game, hoop and all. Everything about how it is put
            together lives in `Wordmark`, so the front page, the door and the
            loading screen cannot drift apart from each other. */}
        <Wordmark size={WORD_BLADE * ui} />
        {/* The ribbon the reference hangs under its logo, carrying the one
            thing worth saying on a front page: where the player is up to. */}
        <View style={styles.ribbon}>
          <Text style={styles.ribbonTxt} numberOfLines={1}>
            {`LEVEL ${level} · ${levelName.toUpperCase()}`}
          </Text>
        </View>
      </Animated.View>

      <View style={[styles.stage, { width: stage, height: stage }]}>
        {/* Two faint rings the character sits inside, so it reads as hanging
            in the middle of the orbit rather than merely in front of a cloud. */}
        <View
          pointerEvents="none"
          style={[styles.halo, { width: orbit * 1.9, height: orbit * 1.9, opacity: 0.22 }]}
        />
        <View
          pointerEvents="none"
          style={[styles.halo, { width: orbit * 1.35, height: orbit * 1.35, opacity: 0.32 }]}
        />

        {/* The orbit: three blades round the character. */}
        <Animated.View
          style={[
            styles.orbit,
            {
              left: blade / 2,
              top: blade / 2,
              width: orbit * 2,
              height: orbit * 2,
              transform: [{ rotate }],
            },
          ]}>
          {[0, 1, 2].map(i => {
            const a = (i / 3) * Math.PI * 2;
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: orbit + Math.cos(a) * orbit,
                  top: orbit + Math.sin(a) * orbit,
                  width: 0,
                  height: 0,
                  transform: [{ rotate: counter }],
                }}>
                <Saw x={0} y={0} size={blade} rot={0} />
              </Animated.View>
            );
          })}
        </Animated.View>

        <Animated.View
          style={{
            width: 0,
            height: 0,
            transform: [{ translateY: heroY }, { scale: heroScale }],
          }}>
          <Ball x={0} y={0} scale={orbit * HERO} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, tight && styles.actionsWide, { opacity: enter }]}>
        <View style={styles.playWrap}>
          <Animated.View pointerEvents="none" style={[styles.ring, ringA]} />
          <Animated.View pointerEvents="none" style={[styles.ring, ringB]} />
          <Animated.View style={{ width: '100%', transform: [{ scale: playScale }] }}>
            <Button label="PLAY" icon="play" onPress={start} hero />
          </Animated.View>
        </View>

        {playerName ? (
          <Button label={playerName.toUpperCase()} icon="guest" tone="cool" onPress={onSettings} />
        ) : (
          <Button label="LOGIN" icon="google" tone="blue" onPress={onLogin} />
        )}

        <Animated.Text style={[styles.hintTxt, { opacity: promptFade }]}>
          tap to fly, drag to shift
        </Animated.Text>
      </Animated.View>

      {/* Up in the corners, clear of both pills, and well clear of the notch:
          the trophy is the tallest thing on this line and a tall phone would
          otherwise take a bite out of the top of it. Held sideways the notch
          is down the side rather than across the top, so the corners are
          pinned inside the gutters the rest of the page is padded by. */}
      <View
        style={[styles.corners, { top: top + (tight ? 8 : 22), left: gutL, right: gutR }]}
        pointerEvents="box-none">
        <IconButton icon="settings" label="Settings" onPress={onSettings} />
        <TrophyBead onPress={onLeaderboard} />
      </View>
    </Animated.View>
  );
}

/** Diameter of the leaderboard button in the corner, and the depth of the
 * under-edge it rides on. */
const BEAD = 58;
const DEPTH = 4;

/**
 * The door to the board: a trophy, on its own gold bead.
 *
 * It used to be the game's own champion -- a crowned face, drawn out of the
 * same parts as the crowd behind the page. It read as a mascot rather than as
 * a control, and the one thing it was *for* was not on it anywhere, so a
 * player looking for the leaderboard went straight past it. The trophy is the
 * sign every game uses for a board, so the corner now says where it goes
 * before it says anything else: the glyph is the whole face of the button, it
 * is the only gold thing on the page, and it is the larger of the two corners.
 */
function TrophyBead({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Leaderboard"
      style={({ pressed }) => [styles.bead, pressed && styles.beadDown]}>
      {/* The same two stacked surfaces every button in the game is built out
          of: a darker under-edge with the lit face riding on top of it. */}
      <View style={styles.beadEdge}>
        <View style={styles.beadFace}>
          {/* The gloss every round thing in this game wears. */}
          <View pointerEvents="none" style={styles.beadGloss} />
          <Icon name="leaderboard" size={BEAD * 0.54} color={COLORS.inkOnLight} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  // Side by side instead of stacked, on a viewport too short to stack in --
  // which, the game being sideways throughout, is every phone. The three
  // parts keep their own order left to right: the name of the game, the thing
  // the game is about, and the way into it.
  fillWide: { flexDirection: 'row' },
  title: { alignItems: 'center' },
  ribbon: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 999,
    // A quiet violet rather than the blade's red: on the pastel sky the red
    // pill read as a hazard parked under the logo, which is the one thing the
    // player has been taught all game to keep away from.
    backgroundColor: COLORS.pauseWell,
    borderWidth: 2.5,
    borderColor: COLORS.pauseFace,
  },
  ribbonTxt: {
    ...TYPE.black,
    fontSize: 11,
    letterSpacing: 1.6,
    color: COLORS.onCard,
  },
  // Every size on the stage is handed in, scaled off the orbit: see `ui`.
  stage: { alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute' },
  halo: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.onCard,
  },
  // Read straight off the sky, which is light -- so this is the dark end of
  // the sky's own violet rather than the pale one the night pages use.
  actions: { alignItems: 'center', gap: 12, width: '72%', maxWidth: 320 },
  // Beside the other two rather than under them, so the column is measured
  // against its own share of the width instead of against the whole page.
  // `shrink` is what stops a long player name pushing the stage off the far
  // side: the pill wraps its label rather than the row overflowing.
  actionsWide: { width: undefined, flexShrink: 1, flexBasis: 300, gap: 10 },
  // Shrink-wraps the pill, so the rings can fill it and start at its edge.
  playWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    // Thin: the ring is a ripple, and a heavy one reads as a second button
    // sitting behind the first rather than as light coming off it.
    borderWidth: 1.5,
    borderColor: COLORS.goFace,
  },
  corners: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hintTxt: {
    fontSize: 13,
    ...TYPE.medium,
    letterSpacing: 1,
    color: COLORS.skyInkSoft,
  },

  // --- the trophy in the corner -------------------------------------------
  bead: {
    width: BEAD,
    height: BEAD + DEPTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beadDown: { transform: [{ scale: 0.94 }] },
  beadEdge: {
    width: BEAD,
    height: BEAD + DEPTH,
    borderRadius: BEAD / 2 + DEPTH,
    backgroundColor: COLORS.warmEdge,
    alignItems: 'center',
  },
  beadFace: {
    width: BEAD,
    height: BEAD,
    borderRadius: BEAD / 2,
    backgroundColor: COLORS.gold,
    // The pale ring, so the bead reads as a button standing off the sky
    // rather than as a coin painted on it.
    borderWidth: 3,
    borderColor: COLORS.onCard,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  beadGloss: {
    position: 'absolute',
    left: -BEAD * 0.25,
    top: -BEAD * 0.7,
    width: BEAD * 1.5,
    height: BEAD * 1.2,
    borderRadius: BEAD * 0.75,
    backgroundColor: COLORS.onCard,
    opacity: 0.3,
  },
});

/** Memoised: the run re-renders every frame, and this does not move with it. */
export default React.memo(Splash);
