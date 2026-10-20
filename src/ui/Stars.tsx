/* eslint-disable react-native/no-inline-styles -- the arc is sized per star */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS } from './theme';
import Icon from './Icon';

/**
 * The stars a level is worth, thrown in an arc over its stop on the road.
 *
 * They are the stars lying in that level's corridor, not a rating of how the
 * run went: one socket per star the level has, filled for each one the player
 * has actually picked up. That is why a cleared level can still be showing an
 * empty socket -- it is the game saying there is something down there that was
 * missed, and it is the whole reason to go back into a level that is already
 * beaten.
 *
 * It arcs rather than sitting in a line: the middle star is the highest and
 * the outer ones drop away and lean out from it, which is what stops a row of
 * them reading as a progress bar and what makes them look thrown over the top
 * of the bead rather than stacked on it.
 */
export function StarArc({
  /** How many are filled, from the left. */
  lit,
  /** How many the level has, which is how many sockets are drawn. */
  total,
  /** Height of one star. The arc is quoted off it. */
  size = 22,
}: {
  lit: number;
  total: number;
  size?: number;
}) {
  if (total <= 0) return null;
  // A single star has no arc to sit on, so it sits flat in the middle.
  const mid = (total - 1) / 2;
  return (
    <View
      style={styles.arc}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${lit} of ${total} stars`}>
      {Array.from({ length: total }, (_, i) => {
        // How far out from the middle: 0 at the centre, 1 at either end.
        const out = mid === 0 ? 0 : (i - mid) / mid;
        return (
          <Star
            key={i}
            size={size * (1 - Math.abs(out) * 0.16)}
            drop={out * out * size * 0.42}
            tilt={out * 20}
            lit={i < lit}
          />
        );
      })}
    </View>
  );
}

/**
 * One star.
 *
 * Gold over a dark under-glyph when it has been won -- the sticker edge every
 * loud shape in this game is drawn with -- and a flat hole in the page when it
 * has not, so an empty socket reads as something missing rather than as a
 * second colour of star.
 */
const Star = React.memo(function StarShape({
  size,
  drop,
  tilt,
  lit,
}: {
  size: number;
  drop: number;
  tilt: number;
  lit: boolean;
}) {
  // A won star breathes, very slightly. It is the only thing moving on a page
  // of still beads, so it is what the eye lands on first.
  const glint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lit) return;
    const leg = (toValue: number) =>
      Animated.timing(glint, {
        toValue,
        duration: 1100,
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    loop.start();
    return () => loop.stop();
  }, [glint, lit]);
  const scale = glint.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        marginTop: drop,
        marginHorizontal: -size * 0.1,
        transform: [{ rotate: `${tilt}deg` }, { scale: lit ? scale : 1 }],
      }}>
      <Icon
        name="star"
        size={size}
        color={lit ? COLORS.starEdge : COLORS.starOff}
        style={{ position: 'absolute', marginTop: size * 0.11 }}
      />
      <Icon
        name="star"
        size={size}
        color={lit ? COLORS.gold : 'rgba(255,255,255,0.22)'}
        style={styles.abs}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  arc: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  abs: { position: 'absolute' },
});

export default StarArc;
