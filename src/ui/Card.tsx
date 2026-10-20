import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { COLORS, MARK } from './theme';
import { CloseButton } from './Button';
import Icon, { type IconName } from './Icon';
import Sticker from './Sticker';
import { TYPE } from './type';

/** True on a short, wide screen. A card goes sideways and sheds height there. */
export function useLandscape() {
  const { width, height } = useWindowDimensions();
  return width > height;
}

/** The three hues a card can be painted in, each a family of four steps. */
export type Hue = 'fail' | 'clear' | 'pause';

export const HUES: Record<Hue, { rim: string; face: string; well: string; edge: string }> = {
  fail: {
    rim: COLORS.failRim,
    face: COLORS.failFace,
    well: COLORS.failWell,
    edge: COLORS.failEdge,
  },
  clear: {
    rim: COLORS.clearRim,
    face: COLORS.clearFace,
    well: COLORS.clearWell,
    edge: COLORS.clearEdge,
  },
  pause: {
    rim: COLORS.pauseRim,
    face: COLORS.pauseFace,
    well: COLORS.pauseWell,
    edge: COLORS.pauseEdge,
  },
};

/**
 * The pop-up every run ends on.
 *
 * Two parts, top to bottom, and the order is the whole design: the one word
 * for how it went, and a card holding the score and the buttons. That is all
 * of it. The cards used to carry a headline, a sentence of explanation, two
 * labelled statistics and a stack of worded pills, which is a paragraph to
 * read at the exact moment the player wants to be back in the game -- so the
 * words are gone and what is left is a number and a row of beads, every one of
 * which says what it does by its glyph.
 *
 * The stars used to ride above the word: one per level, the whole game's
 * progress on every card. They are on the road between the levels now, where
 * each level wears its own, and a card that is about this run stays about this
 * run.
 *
 * The card itself is three surfaces, which is what gives it depth without a
 * single gradient: a dark outline, a pale rim inside it catching the light,
 * and the card's own face inside that.
 *
 * It springs in rather than appearing. A card that is simply there on the
 * frame after a death reads as the game having stopped; one that overshoots
 * and settles reads as the game answering. The scrim rides the same value, so
 * the run behind is still faintly visible while the card is on its way down.
 */
export function PopCard({
  hue,
  title,
  titleFace,
  titleEdge,
  onClose,
  land,
  cheer = false,
  full = false,
  children,
}: {
  hue: Hue;
  /** The one loud word, drawn as a sticker over the top of the card. */
  title: string;
  titleFace: string;
  titleEdge: string;
  /** Given only where closing the card means something. See `PauseCard`. */
  onClose?: () => void;
  land: boolean;
  /** Draw the word as a win: the logo's gold bubble lettering, with stars. */
  cheer?: boolean;
  /**
   * Take the screen rather than a pop-up's corner of it: nearly the whole
   * width, and most of the height on a short one, with the body centred in it.
   * The level-complete card is the one that asks for it -- it is the moment a
   * level of five minutes pays out, and on a landscape phone a 380-wide card
   * used under half the screen it was celebrating on.
   */
  full?: boolean;
  children: React.ReactNode;
}) {
  const c = HUES[hue];
  const { height } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      // Enough overshoot to read as a bounce, damped enough not to wobble.
      friction: 6.5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [pop]);

  // Clamped, because the spring overshoots past 1 and an opacity above 1 is
  // fine but a card that scales past its landing point and back is the point.
  const fade = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const slide = pop.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });

  return (
    // The card claims every touch its own controls do not. Without this a tap
    // beside it reaches the run underneath and steers a game nobody can see.
    <View style={styles.fill} onStartShouldSetResponder={() => true}>
      <Animated.View style={[styles.scrim, { opacity: fade }]} pointerEvents="none" />
      <Animated.View
        style={[
          styles.stack,
          full && styles.stackFull,
          { opacity: fade, transform: [{ scale }, { translateY: slide }] },
        ]}
        pointerEvents="box-none">
        {/* Rides down over the top of the card, half on and half off, so the
            word and the card read as one object rather than as a stack of
            boxes. */}
        <View style={[styles.title, land && styles.titleLand]}>
          {cheer ? (
            <Cheer word={title} land={land && !full} pop={pop} />
          ) : (
            <Sticker size={land ? 26 : 34} face={titleFace} edge={titleEdge} weight={3.5}>
              {title}
            </Sticker>
          )}
        </View>

        <View
          style={[
            styles.rim,
            land && styles.rimLand,
            { backgroundColor: c.rim, borderColor: c.edge },
          ]}>
          <View
            style={[
              styles.face,
              land && styles.faceLand,
              full && { minHeight: height * 0.62, justifyContent: 'center' },
              { backgroundColor: c.face },
            ]}>
            {children}
          </View>

          {onClose ? <CloseButton onPress={onClose} /> : null}
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * The stars thrown either side of a won card's word: size, turn, and how far
 * each one sits below the line. Two a side, the inner one bigger and higher,
 * so the pair fans out from the word rather than standing in a row.
 */
const BURST = [
  { size: 0.55, turn: -24, drop: 0.3 },
  { size: 0.8, turn: -10, drop: -0.1 },
  { size: 0.8, turn: 10, drop: -0.1 },
  { size: 0.55, turn: 24, drop: 0.3 },
];

/** One gold star on a dark outline: the outline is the same glyph, bigger. */
function BurstStar({
  size,
  turn,
  drop,
  pop,
}: {
  size: number;
  turn: number;
  drop: number;
  pop: Animated.Value;
}) {
  // They land after the card does, spinning in from nothing, so the word
  // arrives first and the stars read as its applause.
  const scale = pop.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  });
  const rotate = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [`${turn - 120}deg`, `${turn}deg`],
  });
  const edge = size * 1.32;
  return (
    <Animated.View
      style={[
        styles.star,
        {
          width: edge,
          height: edge,
          marginTop: drop * size * 2,
          transform: [{ scale }, { rotate }],
        },
      ]}>
      <Icon name="star" size={edge} color={MARK.edge} style={styles.starLayer} />
      <Icon name="star" size={size} color={MARK.bladeTop} />
    </Animated.View>
  );
}

/**
 * A won card's one word, set the way the game's own name is: gold running to
 * amber down the letter, a violet ring round each one and a white band round
 * the whole word, with a burst of stars either side.
 */
function Cheer({ word, land, pop }: { word: string; land: boolean; pop: Animated.Value }) {
  const size = land ? 28 : 36;
  const stars = BURST.map((s, i) => (
    <BurstStar key={i} size={size * s.size} turn={s.turn} drop={s.drop} pop={pop} />
  ));
  return (
    <View style={styles.cheer}>
      {stars.slice(0, 2)}
      <View style={styles.cheerWord}>
        <Sticker
          size={size}
          face={MARK.bladeTop}
          faceBot={MARK.bladeBot}
          edge={MARK.edge}
          rim={MARK.band}
          weight={size * 0.075}
          bubble>
          {word}
        </Sticker>
      </View>
      {stars.slice(2)}
    </View>
  );
}

/** One glyph and one number or word, sunk into a well darker than the card. */
export function Chip({
  icon,
  value,
  hue,
  wide = false,
}: {
  icon: IconName;
  value: string;
  hue: Hue;
  /** Stretches the chip across the card, for a line rather than a number. */
  wide?: boolean;
}) {
  return (
    <View style={[styles.chip, wide && styles.chipWide, { backgroundColor: HUES[hue].well }]}>
      <Icon name={icon} size={15} color={COLORS.onCard} />
      <Text style={styles.chipTxt} numberOfLines={1}>
        {value}
      </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.dim,
  },
  // The word and the card travel as one piece. It is allowed to shrink, so a
  // long card is shortened by its own scrolling body rather than pushing its
  // last button off the bottom of the screen.
  stack: { width: '86%', maxWidth: 380, alignItems: 'center', flexShrink: 1 },
  stackFull: { width: '92%', maxWidth: 820 },
  // Pulled down over the card: the two parts overlap, which is what makes
  // them one object.
  title: { marginBottom: -14, zIndex: 2 },
  titleLand: { marginBottom: -10 },
  cheer: { flexDirection: 'row', alignItems: 'center' },
  // The bubble bands reach past the word's own box, so it is given room
  // either side before the stars close in.
  cheerWord: { marginHorizontal: 8 },
  star: { alignItems: 'center', justifyContent: 'center' },
  starLayer: { position: 'absolute' },
  rim: {
    alignSelf: 'stretch',
    flexShrink: 1,
    borderRadius: 30,
    borderWidth: 3,
    // The pale rim is drawn as padding, so the face inside it is what the
    // children lay out against and the rim is never a box of its own.
    padding: 6,
    // Android only; on iOS the card is already lifted off the scrim behind it.
    elevation: 12,
  },
  rimLand: { borderRadius: 24 },
  face: {
    flexShrink: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 10,
  },
  faceLand: { paddingTop: 16, paddingBottom: 12, gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  chipWide: { alignSelf: 'stretch', justifyContent: 'center' },
  chipTxt: { ...TYPE.black, fontSize: 13, color: COLORS.onCard },
});
