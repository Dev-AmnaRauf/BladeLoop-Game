/* eslint-disable react-native/no-inline-styles -- a bead is sized per call */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import Icon, { type IconName } from './Icon';
import { TYPE } from './type';

/**
 * Which job the button is doing, not what colour it is.
 *
 * `go` is the one thing the card wants pressed -- there is never more than one
 * on a card. `warm` is the offer beside it that costs something, `cool` is the
 * quiet way out, `blue` is the sign-in pill on the front page, `violet` is the
 * second way off a card that is not a retreat -- the way home -- and `danger`
 * is the one that throws the run away.
 */
export type Tone = 'go' | 'warm' | 'cool' | 'blue' | 'violet' | 'danger';

const FACES: Record<Tone, { face: string; edge: string; ink: string }> = {
  go: { face: COLORS.goFace, edge: COLORS.goEdge, ink: COLORS.onCard },
  warm: { face: COLORS.warmFace, edge: COLORS.warmEdge, ink: COLORS.onCard },
  cool: { face: COLORS.coolFace, edge: COLORS.coolEdge, ink: COLORS.inkOnLight },
  blue: { face: COLORS.blueFace, edge: COLORS.blueEdge, ink: COLORS.onCard },
  violet: { face: COLORS.pauseFace, edge: COLORS.pauseEdge, ink: COLORS.onCard },
  danger: {
    face: COLORS.dangerFace,
    edge: COLORS.dangerEdge,
    ink: COLORS.onCard,
  },
};

/** How far the lit face sits above its under-edge, in px. */
const DEPTH = 5;
/** How heavy the pale ring round a bead is, in px. */
const RING = 3;

/**
 * The pill button every card and sheet in the game is built out of.
 *
 * It is two stacked surfaces rather than one rectangle with a border: a darker
 * under-edge, and the lit face riding `DEPTH` above it. Pressing does not fade
 * the button -- it drops the face onto the edge and slides the whole pill down
 * by the same amount, so the button's outline never moves and the press reads
 * as the thing physically going in. That is the whole trick behind why these
 * buttons feel like buttons; opacity alone reads as a control being disabled.
 */
function Button({
  label,
  onPress,
  tone = 'go',
  disabled,
  icon,
  chevron = false,
  compact = false,
  hero = false,
  a11y,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
  /**
   * Drawn in front of the label, which is where a pill of this kind carries
   * one: the glyph says what the button is before the word says which, and a
   * row of pills is scanned down the left edge rather than read across.
   */
  icon?: IconName;
  /**
   * A chevron pinned to the right-hand end, for a pill that leads somewhere
   * rather than doing something on the spot -- the two doors on the sign-in
   * screen. It is quieter than the leading glyph on purpose: it is a hint
   * about where the button goes, not a second icon.
   */
  chevron?: boolean;
  /**
   * Thinner, for a card on a landscape screen -- where the whole stack of
   * decisions has to fit in about half the height. Nothing else changes: the
   * face is as wide and as loud as it ever was, it just loses the breathing
   * room a tall screen could afford it.
   */
  compact?: boolean;
  /**
   * Taller and louder, for the one pill on the front page. A play button that
   * is the same size as the settings row under it is not a front page.
   */
  hero?: boolean;
  /**
   * What a screen reader says, where that is not the face of the button. A
   * pill whose label changes while it works -- PLAY WITH GOOGLE going to
   * SIGNING IN -- would otherwise be a different control to a screen reader
   * halfway through being pressed.
   */
  a11y?: string;
}) {
  const { face, edge, ink } = FACES[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.shell,
        {
          backgroundColor: edge,
          paddingBottom: pressed && !disabled ? 1 : DEPTH,
        },
        pressed && !disabled && { transform: [{ translateY: DEPTH - 1 }] },
        disabled && styles.off,
      ]}>
      <View
        style={[
          styles.faceBox,
          compact && styles.faceBoxCompact,
          hero && styles.faceBoxHero,
          { backgroundColor: face },
        ]}>
        {icon ? <Icon name={icon} size={hero ? 22 : compact ? 15 : 17} color={ink} /> : null}
        <Text
          style={[
            styles.label,
            compact && styles.labelCompact,
            hero && styles.labelHero,
            { color: ink },
          ]}>
          {label}
        </Text>
        {/* Pinned rather than laid out, so it sits on the pill's right edge
            whatever the label is, and the label stays centred on the pill. */}
        {chevron ? (
          <View pointerEvents="none" style={styles.chevron}>
            <Icon name="chevron" size={hero ? 22 : 19} color={ink} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The round, glossy button the reference builds its whole control set out of.
 *
 * It is the pill's anatomy bent into a circle -- a darker under-edge with the
 * lit face riding `DEPTH` above it -- plus the two things that make a round
 * one read as a bead rather than a dot: a pale ring all the way round it, and
 * a highlight sitting across the top of the face. Both are drawn, not faded:
 * the ring is a border and the highlight is a clipped ellipse, so the button
 * keeps its shape at any size and on any ground.
 *
 * Every control that is a glyph rather than a sentence is one of these -- the
 * card's decisions, the corners of the front page, the shop and the board.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  tone = 'blue',
  size = 56,
  /** A small count pinned to the corner: what a decision costs, usually. */
  badge,
  disabled,
}: {
  icon: IconName;
  /** Read out by a screen reader, since the face of the button is a glyph. */
  label: string;
  onPress: () => void;
  tone?: Tone;
  /** Outer diameter, in px. Everything inside is quoted off it. */
  size?: number;
  badge?: string;
  disabled?: boolean;
}) {
  const { face, edge, ink } = FACES[tone];
  const inner = size - RING * 2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: size,
          height: size + DEPTH,
          borderRadius: (size + DEPTH) / 2,
          paddingBottom: pressed && !disabled ? 0 : DEPTH,
          backgroundColor: edge,
          // The pale ring, which is what separates one bead from the next in a
          // row of them and from whatever card they are sitting on.
          borderWidth: RING,
          borderColor: COLORS.onCard,
        },
        pressed && !disabled && { transform: [{ translateY: DEPTH }] },
        disabled && styles.off,
      ]}>
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: face,
          alignItems: 'center',
          justifyContent: 'center',
          // Clips the highlight to the face, so it curves with the bead.
          overflow: 'hidden',
        }}>
        {/* The gloss: an oversized white disc hanging off the top, so what
            survives the clip is a crescent of light across the crown. */}
        <View
          style={{
            position: 'absolute',
            left: -inner * 0.25,
            top: -inner * 0.72,
            width: inner * 1.5,
            height: inner * 1.2,
            borderRadius: inner * 0.75,
            backgroundColor: COLORS.onCard,
            opacity: 0.26,
          }}
        />
        <Icon name={icon} size={inner * 0.48} color={ink} />
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The same bead at the size the front page's corners ask for.
 *
 * Always blue, wherever it is: the game's page is a deep space indigo and its
 * cards are candy, and the one colour that is neither -- and so reads as a
 * *control* on both -- is the blue the reference paints every round button in.
 */
export function IconButton({
  icon,
  label,
  onPress,
  compact = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** See `Button`: the same squeeze, for the same landscape cards. */
  compact?: boolean;
}) {
  return (
    <RoundButton icon={icon} label={label} onPress={onPress} tone="blue" size={compact ? 42 : 50} />
  );
}

/**
 * The round X in the top corner of a card, the way a pop-up in this kind of
 * game always closes. It hangs half off the card's own corner, so it reads as
 * pinned to the card rather than as one more control inside it.
 */
export function CloseButton({ onPress, label = 'Close' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
      <Icon name="close" size={20} color={COLORS.onCard} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    borderRadius: 999,
    // The under-edge is the whole of what shows below the face.
    paddingBottom: DEPTH,
  },
  off: { opacity: 0.4 },
  faceBox: {
    borderRadius: 999,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  faceBoxCompact: { paddingVertical: 8 },
  faceBoxHero: { paddingVertical: 16, gap: 10 },
  chevron: { position: 'absolute', right: 16, opacity: 0.85 },
  label: { ...TYPE.black, fontSize: 15, letterSpacing: 0.8 },
  labelCompact: { fontSize: 13.5 },
  labelHero: { fontSize: 22, letterSpacing: 2 },
  // Pinned to the bead's top-right corner, the way a price tag is.
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: COLORS.dangerFace,
    borderWidth: 2,
    borderColor: COLORS.onCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { ...TYPE.black, fontSize: 11, color: COLORS.onCard },
  close: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.dangerFace,
    borderWidth: 3,
    borderColor: COLORS.onCard,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts the X clear of the card's own shadow on Android.
    elevation: 6,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
});

export default React.memo(Button);
