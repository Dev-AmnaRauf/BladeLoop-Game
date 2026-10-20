/* eslint-disable react-native/no-inline-styles -- the room is laid out by hand */
import React from 'react';
import { View } from 'react-native';
import { WATER, useTheme } from './theme';

/**
 * The two walls the corridor runs between, and the water outside them.
 *
 * Drawn, like everything else in the corridor, in the corridor's own axes: a
 * wall down each side of a tall box, which `GameView`'s quarter turn lays
 * across the screen as the ceiling and the floor the ball flies between.
 *
 * The corridor is 330 world px across -- the column the sixty-odd stages in
 * `level.ts` are authored in, flown at the width they were tuned at -- and
 * `viewScale` fits that column plus a `WALL_PAD` either side to the screen's
 * short side. So on a phone the walls land within a few px of the edges and
 * the bands below are a sliver; on a tablet, where the scale stops climbing,
 * there is real water outside them and the bands are what fall it away into
 * the dark. Both are the same drawing, asked the same question.
 *
 * Two rules it keeps, both of them the corridor's:
 *
 * **It only ever darkens.** No daylight is laid over the run -- a wash over
 * the corridor is what made a saw's `bladeCore` and a `TvBox` face, which are
 * filled with `bg` so they read as holes punched through, into discs *lighter*
 * than what surrounds them. Nothing here is over the corridor at all: the
 * bands start at the wall and fall away outward, and `GameView` draws them
 * under the prop layer, so a shot crossing the line from a wall launcher is in
 * front of them.
 *
 * **It does not move.** There is nothing on a wall to read -- no rungs, no
 * markings -- so there is nothing for the camera to carry. It is one memoised
 * node per screen size and palette, on the one screen in the game with a frame
 * budget, and the thread the ball is steered on never wakes for it.
 */

/** How thick a wall's lit face is, in screen px. */
const FACE = 3;

/** How many bands the water outside a wall falls away in. */
const BANDS = 7;

/** How dark the water gets, at the wall and at the edge of the screen. */
const DIM_NEAR = 0.14;
const DIM_FAR = 0.52;

/** The lit inside face of a wall, and how far its glow reaches inward. */
const GLOW = 14;
const GLOW_ALPHA = 0.1;

function Walls({
  width,
  height,
  /**
   * Half the corridor, in *screen* px: what `HALF_W` comes to once the view
   * scale is applied. `GameView` works it out, so the one place that maps
   * world x onto the glass stays the one place.
   */
  wall,
}: {
  width: number;
  height: number;
  wall: number;
}) {
  const t = useTheme();
  // Where the walls land. Clamped so a window narrower than the corridor --
  // no real phone, but a split screen or a freeform window can be anything --
  // puts them on the glass rather than off the sides of it, with the bands
  // simply having nowhere left to fall away in. The face's own 3px come out
  // of the clamp as well: a wall drawn hard against the edge would have half
  // of itself off the screen, and the lines and launchers bolted to it with
  // it.
  const half = Math.max(0, Math.min(wall, width / 2 - FACE));
  const outside = Math.max(0, width / 2 - half);
  const band = outside / BANDS;

  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < BANDS; i++) {
    // Lightest against the wall, darkest at the edge of the screen: the room
    // falls away into deep water rather than the corridor gaining a frame.
    const a = DIM_NEAR + (DIM_FAR - DIM_NEAR) * (i / Math.max(1, BANDS - 1));
    for (const dir of [-1, 1] as const) {
      const from = width / 2 + dir * (half + i * band);
      nodes.push(
        <View
          key={`b${i}${dir}`}
          style={{
            position: 'absolute',
            left: dir < 0 ? from - band : from,
            top: 0,
            width: band,
            height,
            backgroundColor: t.bg,
            opacity: a,
          }}
        />,
      );
    }
  }

  for (const dir of [-1, 1] as const) {
    const x = width / 2 + dir * half;
    nodes.push(
      // The glow off the inside face. It is the only thing here that reaches
      // into the corridor, it is `WATER`'s own light rather than a new one,
      // and at a tenth it is a lit edge rather than a wash.
      <View
        key={`g${dir}`}
        style={{
          position: 'absolute',
          left: dir < 0 ? x : x - GLOW,
          top: 0,
          width: GLOW,
          height,
          backgroundColor: WATER.ray,
          opacity: GLOW_ALPHA,
        }}
      />,
      // The wall itself: the game's own structural violet, with a paler line
      // down its inside edge so it reads as a face turned toward the light
      // rather than as a rule drawn on the screen.
      <View
        key={`w${dir}`}
        style={{
          position: 'absolute',
          left: dir < 0 ? x - FACE : x,
          top: 0,
          width: FACE,
          height,
          backgroundColor: t.pole,
        }}
      />,
      <View
        key={`e${dir}`}
        style={{
          position: 'absolute',
          left: dir < 0 ? x - 1 : x,
          top: 0,
          width: 1,
          height,
          backgroundColor: WATER.surface,
          opacity: 0.55,
        }}
      />,
    );
  }

  return <>{nodes}</>;
}

export default React.memo(Walls);
