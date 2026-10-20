/* eslint-disable react-native/no-inline-styles -- one-off layout */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import Backdrop from './Backdrop';
import { Ball, Saw } from './entities';
import { useLayout } from './layout';
import Wordmark from './Wordmark';
import { TYPE } from './type';

/**
 * Radius the blades circle the character at, and how big they are, at `ui` 1.
 *
 * Scaled by the screen's own `ui`, the way the other two pages that wear this
 * mark are: the game is sideways throughout, so the room here is the phone's
 * short side. See `layout`.
 */
const ORBIT = 66;
const BLADE = 30;

/** BLADE's type size at `ui` 1; the rest of the mark is a share of it. */
const WORD_BLADE = 48;

/** How much of the ring the character fills, as a share of the orbit. */
const HERO = 3.4 / 66;

/** Where the sky behind the screen is parked. Deeper than the front page's. */
const CAM_Y = 520;

/**
 * How long the bar takes to fill, in ms.
 *
 * It is a real wait rather than a fake one, but a short one: building a level
 * is arithmetic and takes no time at all, so what this is actually buying is
 * the first frame of the run. React has a screenful of rods to mount and the
 * sound engine has a music track to start, and both of those used to land on
 * the frame the player had just pressed a button on -- which is the one frame
 * in the game where a stutter reads as the game being broken.
 */
const FILL_MS = 900;

/** How often the percentage is stepped. Ten of these is a smooth enough count. */
const TICK_MS = 90;

/**
 * How long past the bar's own length the screen waits before it hands over
 * regardless, in ms.
 *
 * The handover used to hang off the bar's animation finishing, and an
 * `Animated` timing is not a promise that it ever will: interrupted -- by the
 * app being sent to the background halfway through, by the native driver
 * dropping the animation when the view is detached and re-attached -- it calls
 * back with `finished: false` and nothing calls `onDone`. The player is then
 * sat in front of a loading screen that is never going to load, with no way
 * out but killing the app. The bar is a courtesy; the clock is the contract.
 */
const HANDOVER_GRACE = 600;

/**
 * The screen between picking a level and playing it.
 *
 * It says which level is opening and what it is called, which is the one piece
 * of information the player wants at that moment and the one the corridor
 * itself never tells them. The bar underneath is the wait made visible: the
 * game is doing work here, and a screen that simply froze for the same length
 * of time would read as the game having hung.
 *
 * It is only ever shown on the way *into* a level -- off the front page, off
 * the road, or on to the next one after a clear. A retry does not get one. The
 * retry is the button the player presses twice a minute, and a loading bar in
 * front of it would be the game charging them a second every time they died.
 */
function LoadingScreen({
  level,
  levelName,
  /** Called once the bar is full and the level is ready to be played. */
  onDone,
}: {
  level: number;
  levelName: string;
  onDone: () => void;
}) {
  const { w: W, h: H, top, bottom, ui, tight, gutL, gutR } = useLayout();
  // The furniture, at this window's scale.
  const orbit = ORBIT * ui;
  const blade = BLADE * ui;
  const stage = orbit * 2 + blade;
  const fill = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  // The bar is animated on the native driver and the number is counted here.
  // They are two readings of the same ramp rather than two clocks, so the
  // count can never finish ahead of the bar it is labelling.
  const [pct, setPct] = useState(0);
  const handed = useRef(false);

  useEffect(() => {
    const started = Date.now();
    // Whoever gets there first -- the bar, or the clock behind it -- and only
    // once either way.
    const hand = () => {
      if (handed.current) return;
      handed.current = true;
      setPct(100);
      onDone();
    };

    const count = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / FILL_MS);
      setPct(Math.round(t * 100));
    }, TICK_MS);

    const ramp = Animated.timing(fill, {
      toValue: 1,
      duration: FILL_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    ramp.start(({ finished }) => {
      if (finished) hand();
    });
    // The backstop. A plain timer, on the JS clock, owing nothing to the
    // animation: the screen comes down after its own length either way.
    const deadline = setTimeout(hand, FILL_MS + HANDOVER_GRACE);

    const leg = (toValue: number) =>
      Animated.timing(bob, {
        toValue,
        duration: 700,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const hover = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    const orbitSpin = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    hover.start();
    orbitSpin.start();

    return () => {
      clearInterval(count);
      clearTimeout(deadline);
      ramp.stop();
      hover.stop();
      orbitSpin.stop();
    };
  }, [fill, bob, spin, onDone]);

  const heroY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-720deg'] });
  // The bar is one view scaled from its left edge rather than a width being
  // animated, which is the only way to fill it on the native driver.
  const grow = fill.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] });

  return (
    // The screen claims every touch, so a tap meant for the button that opened
    // it cannot reach the run waiting underneath and steer it blind.
    <View
      testID="loading"
      style={[
        styles.fill,
        tight && styles.fillWide,
        {
          paddingTop: top + (tight ? 8 : 0),
          paddingBottom: bottom + (tight ? 8 : 0),
          paddingLeft: gutL,
          paddingRight: gutR,
        },
      ]}
      onStartShouldSetResponder={() => true}>
      <Backdrop camY={CAM_Y} width={W} height={H} dim={1} />

      {/* The mark over the character, the pair of them one half of the row on
          a screen too short to stack all three parts -- which is every phone,
          the game being sideways throughout. The bar is the other half, and
          it is the half worth looking at, so it is the one on the right. */}
      <View style={[styles.brand, tight && styles.brandWide]}>
        <View style={styles.mark}>
          <Wordmark size={WORD_BLADE * ui} />
        </View>

        <View style={[styles.stage, { width: stage, height: stage }]}>
          <View
            pointerEvents="none"
            style={[styles.halo, { width: orbit * 1.9, height: orbit * 1.9, opacity: 0.22 }]}
          />
          <View
            pointerEvents="none"
            style={[styles.halo, { width: orbit * 1.35, height: orbit * 1.35, opacity: 0.32 }]}
          />
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
          <Animated.View style={{ width: 0, height: 0, transform: [{ translateY: heroY }] }}>
            <Ball x={0} y={0} scale={orbit * HERO} />
          </Animated.View>
        </View>
      </View>

      <View style={[styles.foot, tight && styles.footWide]}>
        {/* Which level, and what it is called. The corridor never says either. */}
        <View style={styles.ribbon}>
          <Text style={styles.ribbonLevel}>{`LEVEL ${level}`}</Text>
          <Text style={styles.ribbonName} numberOfLines={1}>
            {levelName.toUpperCase()}
          </Text>
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[styles.bar, { transform: [{ scaleX: grow }] }]}
            pointerEvents="none"
          />
        </View>
        <Text style={styles.pct}>{`Loading... ${pct}%`}</Text>
      </View>
    </View>
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
  // Side by side rather than stacked, on a viewport too short to stack in.
  fillWide: { flexDirection: 'row' },
  // The mark and the character travel together as one half of that row.
  brand: { alignItems: 'center' },
  brandWide: { flexShrink: 1, gap: 4 },
  mark: { alignItems: 'center' },
  // Every size on the stage is handed in, scaled off the orbit: see `ui`.
  stage: { alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute' },
  halo: { position: 'absolute', borderRadius: 999, borderWidth: 2, borderColor: COLORS.onCard },
  foot: { alignItems: 'center', gap: 14, width: '74%', maxWidth: 330 },
  // The bar's half of the row: given its width first, since a track squeezed
  // to nothing is a loading screen that does not say it is loading.
  footWide: { width: undefined, flexGrow: 1, flexShrink: 0, flexBasis: 300, gap: 12 },
  ribbon: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.pauseWell,
    borderWidth: 2.5,
    borderColor: COLORS.pauseFace,
  },
  ribbonLevel: { ...TYPE.black, fontSize: 17, letterSpacing: 2, color: COLORS.onCard },
  ribbonName: { ...TYPE.bold, fontSize: 11, letterSpacing: 2, color: COLORS.onCardSoft },
  track: {
    alignSelf: 'stretch',
    height: 16,
    borderRadius: 999,
    backgroundColor: COLORS.ringSoft,
    borderWidth: 2,
    borderColor: COLORS.ring,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    borderRadius: 999,
    backgroundColor: COLORS.gradC,
    // Grown from its left edge, so the fill runs out of the end of the track
    // rather than out of the middle of it.
    transformOrigin: 'left center',
  },
  pct: { ...TYPE.semi, fontSize: 12, letterSpacing: 1, color: COLORS.skyInk },
});

/** Memoised: the run re-renders every frame, and this does not move with it. */
export default React.memo(LoadingScreen);
