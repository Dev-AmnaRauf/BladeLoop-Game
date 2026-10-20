/* eslint-disable react-native/no-inline-styles -- the scenery is laid out by hand */
import React from 'react';
import { View } from 'react-native';
import type { WorldId } from '../game/worlds';
import { SCENERY } from './theme';

/**
 * What a world has behind its corridor.
 *
 * Drawn in the corridor's own box, like everything else inside the quarter
 * turn: `x` runs across the corridor, 0 at the floor and `width` at the
 * ceiling, and `y` runs along the run. So a tree stands with its trunk laid
 * along `x`, and snow falls toward `x` = 0.
 *
 * Three layers, and they are split for the frame budget the way the backdrop
 * is. The **far** layer -- a moon, a planet, an aurora -- does not know where
 * the camera is, so it is one memoised node per screen size. The **ground**
 * -- hills, lollipops, towers -- scrolls at a fraction of the camera, a band
 * at a time, each band memoised so it costs nothing until a new one scrolls
 * in. Only the **motes** -- leaves, snow, embers -- are live, and there are
 * a dozen or so of them.
 *
 * Everything is quiet: low alpha, the world's own hues, and none of the three
 * colours the run is read by. Nothing here collides, scores or takes a touch.
 */

/** How much of the camera the ground takes. Lower reads as further away. */
const PARALLAX = 0.22;
/** Depth of one band of ground, in box px. */
const BAND = 520;
/** Pieces of ground in one band. */
const PIECES = 4;
/** Live motes on screen. */
const MOTES = 14;

function frac(x: number) {
  return x - Math.floor(x);
}

/** A fixed shuffle, so a band always brings the same ground back. */
function rnd(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** A disc, for the many round things a world is made of. */
function disc(
  key: string,
  x: number,
  y: number,
  d: number,
  color: string,
  opacity: number,
  extra: object = {},
) {
  return (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: color,
        opacity,
        ...extra,
      }}
    />
  );
}

/** A box from the floor (`x` = 0) out to `h`, `w` deep along the run at `y`. */
function upright(
  key: string,
  y: number,
  w: number,
  h: number,
  color: string,
  opacity: number,
) {
  return (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: 0,
        top: y - w / 2,
        width: h,
        height: w,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

// --- far --------------------------------------------------------------------

function far(world: WorldId, width: number, height: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  switch (world) {
    case 'nature': {
      // Light through the canopy, overhead.
      for (let i = 0; i < 4; i++) {
        out.push(
          disc(
            `nf${i}`,
            width * 1.05,
            height * (0.2 + i * 0.22),
            width * 0.7,
            SCENERY.nature.far,
            0.05,
          ),
        );
      }
      break;
    }
    case 'candy': {
      // Candy-floss clouds.
      for (let i = 0; i < 6; i++) {
        const d = width * (0.28 + rnd(i) * 0.2);
        out.push(
          disc(
            `cf${i}`,
            width * (0.7 + rnd(i + 9) * 0.25),
            height * (i / 5),
            d,
            SCENERY.candy.far,
            0.07,
          ),
        );
      }
      break;
    }
    case 'frozen': {
      // An aurora: long pale bands leaning across the top of the sky.
      for (let i = 0; i < 3; i++) {
        out.push(
          <View
            key={`af${i}`}
            style={{
              position: 'absolute',
              left: width * (0.72 + i * 0.07),
              top: -height * 0.2,
              width: width * 0.08,
              height: height * 1.4,
              backgroundColor: SCENERY.frozen.far,
              opacity: 0.06,
              borderRadius: width * 0.04,
              transform: [{ rotate: `${0.18 - i * 0.12}rad` }],
            }}
          />,
        );
      }
      break;
    }
    case 'lava': {
      // The glow of the lake below the floor.
      for (let i = 0; i < 4; i++) {
        out.push(
          <View
            key={`lf${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: width * (0.08 + i * 0.06),
              height,
              backgroundColor: SCENERY.lava.far,
              opacity: 0.05,
            }}
          />,
        );
      }
      break;
    }
    case 'neon': {
      // A pink haze over the city, and the stars it leaves.
      out.push(
        disc(
          'nh',
          width * 1.1,
          height * 0.5,
          width * 1.2,
          SCENERY.neon.far,
          0.06,
        ),
      );
      for (let i = 0; i < 18; i++) {
        out.push(
          disc(
            `ns${i}`,
            width * (0.55 + rnd(i) * 0.45),
            height * rnd(i + 40),
            2,
            SCENERY.neon.mote,
            0.35,
          ),
        );
      }
      break;
    }
    case 'moon': {
      // The Earth, hanging over the ceiling, and the stars.
      const d = width * 0.3;
      out.push(
        disc('me', width * 0.8, height * 0.72, d, SCENERY.moon.earth, 0.35),
      );
      out.push(
        disc(
          'ml',
          width * 0.83,
          height * 0.7,
          d * 0.45,
          SCENERY.moon.land,
          0.3,
        ),
      );
      for (let i = 0; i < 30; i++) {
        out.push(
          disc(
            `ms${i}`,
            width * (0.3 + rnd(i) * 0.7),
            height * rnd(i + 70),
            1.5 + rnd(i + 3) * 1.5,
            SCENERY.moon.mote,
            0.4,
          ),
        );
      }
      break;
    }
    case 'galaxy': {
      // Nebula clouds, a ringed planet, and a field of stars.
      const { nebula } = SCENERY.galaxy;
      for (let i = 0; i < 6; i++) {
        out.push(
          disc(
            `gn${i}`,
            width * rnd(i + 1),
            height * (i / 5),
            width * (0.5 + rnd(i + 5) * 0.4),
            nebula[i % nebula.length],
            0.07,
          ),
        );
      }
      const d = width * 0.22;
      out.push(
        disc('gp', width * 0.78, height * 0.3, d, SCENERY.galaxy.planet, 0.4),
      );
      out.push(
        <View
          key="gr"
          style={{
            position: 'absolute',
            left: width * 0.78 - d,
            top: height * 0.3 - d * 0.18,
            width: d * 2,
            height: d * 0.36,
            borderRadius: d,
            borderWidth: 3,
            borderColor: SCENERY.galaxy.ring,
            opacity: 0.4,
            transform: [{ rotate: '-0.35rad' }],
          }}
        />,
      );
      for (let i = 0; i < 40; i++) {
        out.push(
          disc(
            `gs${i}`,
            width * rnd(i + 11),
            height * rnd(i + 90),
            1.2 + rnd(i + 7) * 1.8,
            SCENERY.galaxy.mote,
            0.5,
          ),
        );
      }
      break;
    }
  }
  return out;
}

// --- ground -----------------------------------------------------------------

/** One band of a world's ground, drawn about its own top. */
const Ground = React.memo(function GroundBand({
  world,
  band,
  width,
  top,
}: {
  world: WorldId;
  band: number;
  width: number;
  top: number;
}) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < PIECES; i++) {
    const n = band * PIECES + i;
    const y = top + ((i + 0.2 + rnd(n) * 0.6) / PIECES) * BAND;
    const s = 0.7 + rnd(n + 1) * 0.6;
    const k = `g${n}`;
    switch (world) {
      case 'nature': {
        const { hill, trunk, leaf } = SCENERY.nature;
        out.push(disc(`${k}h`, 0, y, width * 0.26 * s, hill, 0.3));
        if (rnd(n + 2) < 0.7) {
          const h = width * 0.1 * s;
          out.push(upright(`${k}t`, y + 40, 8, h, trunk, 0.3));
          out.push(disc(`${k}c`, h, y + 40, width * 0.09 * s, leaf, 0.25));
        }
        break;
      }
      case 'candy': {
        const { stick, pop, drop } = SCENERY.candy;
        const h = width * 0.1 * s;
        const d = width * 0.07 * s;
        out.push(upright(`${k}s`, y, 4, h, stick, 0.12));
        out.push(
          disc(`${k}p`, h, y, d, pop[n % pop.length], 0.18, {
            borderWidth: d * 0.1,
            borderColor: stick,
          }),
        );
        out.push(
          disc(`${k}d`, 0, y + BAND / PIECES / 2, width * 0.08 * s, drop, 0.15),
        );
        break;
      }
      case 'frozen': {
        const { peak, peakLit } = SCENERY.frozen;
        const d = width * 0.16 * s;
        out.push(
          <View
            key={`${k}p`}
            style={{
              position: 'absolute',
              left: -d / 2,
              top: y - d / 2,
              width: d,
              height: d,
              backgroundColor: peak,
              borderRightWidth: 3,
              borderColor: peakLit,
              opacity: 0.3,
              transform: [{ rotate: '45deg' }],
            }}
          />,
        );
        // Icicles off the ceiling.
        const ic = width * 0.05 * s;
        out.push(
          <View
            key={`${k}i`}
            style={{
              position: 'absolute',
              left: width - ic / 2,
              top: y + 60 - ic / 2,
              width: ic,
              height: ic,
              backgroundColor: peakLit,
              opacity: 0.2,
              transform: [{ rotate: '45deg' }],
            }}
          />,
        );
        break;
      }
      case 'lava': {
        const { rock, glow } = SCENERY.lava;
        const d = width * 0.2 * s;
        out.push(
          <View
            key={`${k}v`}
            style={{
              position: 'absolute',
              left: -d / 2,
              top: y - d / 2,
              width: d,
              height: d,
              backgroundColor: rock,
              opacity: 0.6,
              transform: [{ rotate: '45deg' }],
            }}
          />,
        );
        out.push(disc(`${k}g`, d * 0.66, y, d * 0.28, glow, 0.12));
        break;
      }
      case 'neon': {
        const { tower, edge } = SCENERY.neon;
        const h = width * (0.08 + rnd(n + 3) * 0.08);
        const w = 40 + rnd(n + 4) * 50;
        out.push(
          <View
            key={`${k}t`}
            style={{
              position: 'absolute',
              left: 0,
              top: y - w / 2,
              width: h,
              height: w,
              backgroundColor: tower,
              borderRightWidth: 2,
              borderColor: edge[n % edge.length],
              opacity: 0.5,
            }}
          />,
        );
        for (let j = 0; j < 3; j++) {
          out.push(
            <View
              key={`${k}w${j}`}
              style={{
                position: 'absolute',
                left: h * (0.25 + j * 0.22),
                top: y - w / 4 + rnd(n + j) * (w / 2),
                width: 4,
                height: 4,
                backgroundColor: edge[(n + j + 1) % edge.length],
                opacity: 0.3,
              }}
            />,
          );
        }
        break;
      }
      case 'moon': {
        const { ground, crater } = SCENERY.moon;
        out.push(disc(`${k}m`, 0, y, width * 0.22 * s, ground, 0.3));
        out.push(
          disc(`${k}c`, width * 0.05, y + 20, width * 0.05 * s, crater, 0.35),
        );
        break;
      }
      case 'galaxy': {
        // Asteroids, tumbling past on both walls.
        const d = 18 + rnd(n + 5) * 26;
        const x = rnd(n + 6) < 0.5 ? width * 0.05 : width * 0.95;
        out.push(
          <View
            key={`${k}a`}
            style={{
              position: 'absolute',
              left: x - d / 2,
              top: y - d / 2,
              width: d,
              height: d * 0.8,
              borderRadius: d * 0.35,
              backgroundColor: SCENERY.galaxy.rock,
              opacity: 0.4,
              transform: [{ rotate: `${rnd(n + 7) * 3}rad` }],
            }}
          />,
        );
        break;
      }
    }
  }
  return <>{out}</>;
});

// --- motes ------------------------------------------------------------------

/**
 * How a world's motes move. `fall` is how far across the corridor one travels
 * over its life, in widths: positive falls toward the floor, negative rises.
 */
const MOTION: Record<WorldId, { fall: number; size: number; alpha: number }> = {
  nature: { fall: 0.9, size: 6, alpha: 0.4 },
  candy: { fall: 0.6, size: 5, alpha: 0.5 },
  frozen: { fall: 1.1, size: 4, alpha: 0.6 },
  lava: { fall: -0.9, size: 3, alpha: 0.45 },
  neon: { fall: 1.2, size: 2, alpha: 0.45 },
  moon: { fall: 0.3, size: 2, alpha: 0.35 },
  galaxy: { fall: 0, size: 2, alpha: 0.6 },
};

function moteColor(world: WorldId, i: number) {
  switch (world) {
    case 'nature':
      return i % 3 ? SCENERY.nature.leaf : SCENERY.nature.mote;
    case 'candy':
      return SCENERY.candy.pop[i % SCENERY.candy.pop.length];
    default:
      return SCENERY[world].mote;
  }
}

/** 0 at both ends of a mote's life, so none is ever seen to pop in or out. */
function lifeFade(u: number) {
  return Math.min(1, u / 0.15) * Math.min(1, (1 - u) / 0.15);
}

function Scenery({
  world,
  camY,
  width,
  height,
}: {
  world: WorldId;
  camY: number;
  width: number;
  height: number;
}) {
  const sky = React.useMemo(
    () => far(world, width, height),
    [world, width, height],
  );

  const depth = camY * PARALLAX;
  const base = Math.floor(depth / BAND) * BAND;
  const first = Math.floor((depth - BAND) / BAND);
  const last = Math.floor((depth + height) / BAND);
  const ground = React.useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let b = first; b <= last; b++) {
      out.push(
        <Ground
          key={`b${b}`}
          world={world}
          band={b}
          width={width}
          top={b * BAND - base}
        />,
      );
    }
    return out;
  }, [world, first, last, base, width]);

  // The motes: tied to the camera rather than a clock, like the water's
  // bubbles, so a paused or finished run holds them still.
  const motion = MOTION[world];
  const motes: React.ReactNode[] = [];
  for (let i = 0; i < MOTES; i++) {
    const seed = i * 7.1;
    const u = frac(camY / (1400 + rnd(seed) * 900) + rnd(seed + 1));
    const d = motion.size * (0.7 + rnd(seed + 2) * 0.8);
    const start = motion.fall >= 0 ? 1.05 : -0.05;
    const x = width * (start - motion.fall * u + Math.sin(u * 6 + seed) * 0.02);
    // Galaxy stars stream along the run instead of falling across it.
    const y =
      motion.fall === 0
        ? height * (1.1 - u * 1.2)
        : height * frac(rnd(seed + 3) - camY / 3000);
    const color = moteColor(world, i);
    const leafy = world === 'nature' || world === 'candy';
    motes.push(
      <View
        key={`m${i}`}
        style={{
          position: 'absolute',
          left: (motion.fall === 0 ? width * rnd(seed + 4) : x) - d / 2,
          top: y - d / 2,
          width: world === 'galaxy' ? d * 0.8 : d,
          height: world === 'galaxy' ? d * 8 : leafy ? d * 1.6 : d,
          borderRadius: leafy ? d / 3 : d,
          backgroundColor: color,
          opacity: lifeFade(u) * motion.alpha,
          transform: leafy ? [{ rotate: `${u * 8 + seed}rad` }] : undefined,
        }}
      />,
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {sky}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          transform: [{ translateY: base - depth }],
        }}
      >
        {ground}
      </View>
      {motes}
    </View>
  );
}

export default React.memo(Scenery);
