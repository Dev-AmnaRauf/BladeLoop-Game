/* eslint-disable react-native/no-inline-styles -- the row is laid out by hand */
import React from 'react';
import { View } from 'react-native';
import { useTheme } from './theme';

/**
 * The floor's spikes: a row of the blade's red teeth along the whole floor
 * wall, standing `out` of the way up (0 is flush and not drawn at all).
 *
 * Drawn like `Walls`, in the corridor's own axes before `GameView`'s quarter
 * turn -- so the floor is the box's left wall and a spike points right, into
 * the corridor -- and in screen px, not world px: the wall does not scroll, so
 * neither does the row standing on it, and it is one memoised node per height.
 */

/** How wide one spike's base is, in screen px. */
const BASE = 14;

function FloorSpikes({
  width,
  height,
  wall,
  tall,
  out,
}: {
  width: number;
  height: number;
  /** Half the corridor in screen px, as `Walls` takes it. */
  wall: number;
  /** A fully out spike's height, in screen px. */
  tall: number;
  /** 0 to 1: how far out of the floor the row stands. */
  out: number;
}) {
  const t = useTheme();
  if (out <= 0) return null;
  // The same clamp `Walls` puts its floor through, so the row stands on it.
  const x = width / 2 - Math.max(0, Math.min(wall, width / 2 - 3));
  const reach = tall * out;
  const n = Math.ceil(height / BASE);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: i * BASE,
          width: 0,
          height: 0,
          borderTopWidth: BASE / 2,
          borderBottomWidth: BASE / 2,
          borderLeftWidth: reach,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: t.blade,
        }}
      />,
    );
  }
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {nodes}
    </View>
  );
}

export default React.memo(FloorSpikes);
