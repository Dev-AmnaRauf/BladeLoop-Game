import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS } from './theme';
import Icon from './Icon';

/**
 * Fixed bottom-right sound toggle. Stays put -- never scrolls with the world.
 *
 * The game is sideways throughout, so the bottom right corner of the screen
 * is a corner of the *long* edge: on a phone held one way round that is where
 * the gesture bar lives, and on one held the other it is the curve of the
 * corner or the cutout. So the disc is pushed in by whatever the safe area
 * says, rather than sitting at a flat 18 from an edge that may not be there.
 *
 * `right` and `bottom` are handed in rather than read here, because
 * `muteButtonHit` has to agree with them exactly and it is not a component.
 */
function MuteButton({
  muted,
  right,
  bottom,
  onPress,
}: {
  muted: boolean;
  /** Safe area on the right and the bottom, in dp. */
  right: number;
  bottom: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.wrap,
        { right: EDGE_X + right, bottom: EDGE_Y + bottom },
        pressed && styles.pressed,
      ]}>
      {/* The same gloss every round control in the game wears: a white crescent
          across the crown, clipped to the disc. */}
      <View pointerEvents="none" style={styles.gloss} />
      <Icon name={muted ? 'soundOff' : 'soundOn'} size={23} color={COLORS.onCard} />
    </Pressable>
  );
}

const SIZE = 50;
/** Padding around the button's own size, matching its hitSlop -- the game's
 * full-screen touch layer uses this to avoid stealing taps meant for it. */
const PAD = 10;

/** How far the disc sits off the two edges it is pinned to, before insets. */
const EDGE_X = 18;
const EDGE_Y = 28;

/**
 * Screen-space footprint of the button, so a touch inside it never also
 * reaches the game underneath.
 *
 * The insets have to be passed in and have to be the same two the component
 * was given: this is the one place in the game where a control's drawn
 * position and its hit test are worked out by two different pieces of code,
 * and a disc that moved in off a cutout while its hit test stayed put would
 * be a patch of corridor that silently refuses to be steered.
 */
export function muteButtonHit(
  x: number,
  y: number,
  screenW: number,
  screenH: number,
  insetRight = 0,
  insetBottom = 0,
) {
  const right = screenW - EDGE_X - insetRight;
  const bottom = screenH - EDGE_Y - insetBottom;
  const left = right - SIZE - PAD;
  const top = bottom - SIZE - PAD;
  return x >= left && x <= right + PAD && y >= top && y <= bottom + PAD;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // `right` and `bottom` are handed in: they are the two edges the safe
    // area moves, and this button is pinned to both of them.
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    // A HUD chip, in the HUD's own colours.
    //
    // It was an amber disc with a white ring, which is exactly what a gold
    // coin in this game looks like -- and it sits *inside* the play area, over
    // the corridor, at the bottom right where pickups come past. On the device
    // it read as a star that could not be collected. Gold belongs to things
    // the player is meant to fly into.
    backgroundColor: COLORS.panel,
    // The pale ring stays. It is the only part of this button that has to
    // work on both of the game's grounds -- the face is dark, which reads on
    // the night the run is played on and disappears into the edge of the
    // pastel day the front page is.
    borderWidth: 3,
    borderColor: COLORS.onCard,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
  },
  gloss: {
    position: 'absolute',
    left: -SIZE * 0.25,
    top: -SIZE * 0.7,
    width: SIZE * 1.5,
    height: SIZE * 1.2,
    borderRadius: SIZE * 0.75,
    backgroundColor: COLORS.onCard,
    opacity: 0.26,
  },
  pressed: { transform: [{ scale: 0.95 }] },
});

/** Memoised: the run re-renders every frame, and this does not move with it. */
export default React.memo(MuteButton);
