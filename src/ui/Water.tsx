/* eslint-disable react-native/no-inline-styles -- the room is laid out by hand */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { WATER } from './theme';

/**
 * The water the corridor is flown down.
 *
 * The run used to stand on a flat vertical gradient, and a gradient is a wall:
 * it says which way is up and nothing else. Everything drawn in front of it --
 * the rods, the blades, the ball -- has a near side and a shaded one, so the
 * one thing in the frame with no depth at all was the room holding them.
 *
 * So the room is a place instead: the ball is falling down through the sea.
 * Four things say so, and every one of them is a depth cue rather than a
 * decoration.
 *
 * The **surface** is a lit band across the top of the screen, and the
 * **shafts** are the light coming down through it, fanning from a point above
 * the screen. A fan is a perspective: two lines that are parallel in the world
 * and not on the screen is the oldest way there is of saying "this is deep",
 * and it is the one the reference photograph leans on hardest.
 *
 * The **bubbles** rise past the camera in three bands -- far ones small, slow
 * and dim, near ones big, quick and bright. That is the parallax, and it is
 * what a fan of light on its own cannot do: the near band crosses the screen
 * several times while a far one is still climbing, so the water between them
 * has to be read as distance.
 *
 * The **motes** are the plankton hanging in it, drifting up on their own, and
 * they are there because water with nothing suspended in it is a colour rather
 * than a volume.
 *
 * The light itself is the game's own. `SKY` is the day every screen outside
 * the corridor stands in, and this is that day from underneath: the surface
 * and the shafts are drawn in the pale end of that same gradient, and the
 * ground under them is its hue taken down to a value a run can be read
 * against. One family above the water and below it -- the run used to be the
 * one screen in the game painted in a colour of its own.
 *
 * Nothing here collides, scores or takes a touch, and -- see `WATER` in
 * `./theme` -- nothing here is warm. Gold means fly into this and the blade's
 * red means this ends the run, so a bubble may not catch a gold glint the way
 * a real one would. It is the one thing about this water that is not true to
 * the reference, and it is not negotiable.
 *
 * It is built to cost the descent almost nothing. The surface and the shafts
 * do not depend on the camera, so they are one memoised node per screen size,
 * and the sway on the shafts is a single looping transform on the native
 * driver -- the thread the ball is being steered on never wakes for it. Only
 * the bubbles and the motes are live.
 */

/** Where the light comes from, in screen fractions. Above the top edge. */
const SUN_X = 0.5;
const SUN_Y = -0.3;

/** The shafts of light, and how far from straight down the fan opens. */
const SHAFTS = 7;
const FAN = 0.52;
/** Each shaft is drawn in this many lengths, widening and fading as it falls. */
const SHAFT_STEPS = 3;

/** How many bands of light shimmer across the surface itself. */
const SURFACE_BANDS = 5;

/**
 * The bubbles, in three bands of depth.
 *
 * `rise` is the descent, in world px, that carries one band a full screen
 * height up the glass, so a smaller number is a nearer, quicker band. They are
 * quoted against the camera rather than against a clock so that everything in
 * the room stops when the corridor does -- a paused run with bubbles still
 * climbing reads as a bug, and a dead one reads as a taunt.
 */
const BANDS = [
  { count: 5, rise: 1500, size: 5, spread: 0.35, film: 0.4 },
  { count: 4, rise: 900, size: 11, spread: 0.6, film: 0.6 },
  { count: 3, rise: 520, size: 19, spread: 0.85, film: 0.8 },
];

/** Plankton: one view each, and the only thing in the water drawn as a dot. */
const MOTES = 16;
const MOTE_RISE = 2200;

/** How far the light leans against the steer, in px. */
const DRIFT = 12;

const TAU = Math.PI * 2;

function frac(x: number) {
  return x - Math.floor(x);
}

/** The same fixed shuffle the sky uses: a bubble keeps its own lane for good. */
function rnd(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * How strongly something at `u` of its climb is drawn, 0 at both ends.
 *
 * A bubble is born below the bottom of the screen and dies above the top, and
 * neither may ever be seen to happen: these are the same handful of views
 * recycling forever, so a hard edge appearing at one end or vanishing at the
 * other is a pop the player would catch within a run or two.
 */
function climbFade(u: number) {
  return Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.22);
}

export default function Water({
  camY,
  lean,
  width,
  height,
}: {
  camY: number;
  /** Where the ball is across the corridor, -1 to 1. The light leans off it. */
  lean: number;
  width: number;
  height: number;
}) {
  const sunX = width * SUN_X;
  const sunY = height * SUN_Y;

  // The still half of the room: it does not know where the camera is, so it is
  // built when the window changes size and never again.
  const light = React.useMemo(() => {
    const out: React.ReactNode[] = [];
    // The surface: a few bands of lit water across the top, the widest and
    // faintest first. A view can only be filled flat, so a glow has to be
    // stacked out of layers of alpha -- and thin ones, because the step
    // between two fat ones is what gives a stack away as a set of bars.
    for (let i = SURFACE_BANDS - 1; i >= 0; i--) {
      out.push(
        <View
          key={`sf${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: height * (0.05 + i * 0.045),
            backgroundColor: WATER.surface,
            opacity: 0.055,
          }}
        />,
      );
    }
    // Then the shafts. Each is pinned at the light and swung out from it, and
    // each is drawn in three lengths that widen and fade as they fall -- a
    // beam of light underwater is widest and weakest where it has travelled
    // furthest, and a rectangle at one value end to end reads as a bar of
    // paint laid over the picture.
    const len = height * 1.9;
    for (let i = 0; i < SHAFTS; i++) {
      const seed = i * 3.7;
      // Spaced evenly across the fan and then nudged, so the light does not
      // come down in a comb.
      const rot = (i / (SHAFTS - 1) - 0.5) * FAN + (rnd(seed) - 0.5) * 0.06;
      const w = width * (0.06 + rnd(seed + 1) * 0.07);
      const wide = w * 2.6;
      const steps: React.ReactNode[] = [];
      for (let k = 0; k < SHAFT_STEPS; k++) {
        const t = k / (SHAFT_STEPS - 1);
        const sw = w + (wide - w) * t;
        steps.push(
          <View
            key={k}
            style={{
              position: 'absolute',
              left: wide / 2 - sw / 2,
              top: (len * k) / SHAFT_STEPS,
              width: sw,
              height: len / SHAFT_STEPS + 1,
              backgroundColor: WATER.ray,
              opacity: 0.085 - t * 0.05,
            }}
          />,
        );
      }
      out.push(
        <View
          key={`sh${i}`}
          style={{
            position: 'absolute',
            left: sunX - wide / 2,
            top: sunY,
            width: wide,
            height: len,
            // Swung about the light itself, which is the top-centre of this
            // box -- not about the box, which would slide the whole shaft
            // sideways and break the fan.
            transform: [{ rotate: `${rot}rad` }],
            transformOrigin: 'center top',
          }}>
          {steps}
        </View>,
      );
    }
    return out;
  }, [width, height, sunX, sunY]);

  // --- the live half ------------------------------------------------------
  const nodes: React.ReactNode[] = [];
  // The bubbles. A band's own `rise` is what turns three sets of circles into
  // three distances: the near band crosses the glass three times over while
  // the far one is still on its way up.
  let id = 0;
  for (const band of BANDS) {
    for (let i = 0; i < band.count; i++) {
      const seed = ++id * 1.9;
      // Up the screen as the camera goes down -- the ball is falling, so the
      // water it is falling through rises past it.
      const u = frac(camY / band.rise + rnd(seed));
      // A bubble wanders as it climbs rather than going up a ruled line.
      const sway = Math.sin(u * TAU * (1 + rnd(seed + 2)) + seed) * width * 0.04;
      const d = band.size * (0.7 + rnd(seed + 3) * 0.6);
      const x = width * (0.5 + (rnd(seed + 4) - 0.5) * band.spread) + sway;
      const y = height * 1.1 - u * height * 1.3;
      nodes.push(<Bubble key={`bu${id}`} x={x} y={y} d={d} fade={climbFade(u) * band.film} />);
    }
  }

  // And the plankton between them: one view each, no rim and no shine, drawn
  // at a third of what a bubble is. They are the grain of the water rather
  // than anything in it, and a speck bright enough to look at is a speck the
  // player will try to collect.
  for (let i = 0; i < MOTES; i++) {
    const seed = i * 5.3;
    const u = frac(camY / MOTE_RISE + rnd(seed));
    const d = 1.4 + rnd(seed + 1) * 2.2;
    nodes.push(
      <View
        key={`mo${i}`}
        style={{
          position: 'absolute',
          left: width * rnd(seed + 2) + Math.sin(u * TAU + seed) * width * 0.03,
          top: height * 1.05 - u * height * 1.25,
          width: d,
          height: d,
          borderRadius: d,
          backgroundColor: WATER.spark,
          opacity: climbFade(u) * 0.34,
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
      }}>
      <Shimmer sunX={sunX} sunY={sunY} lean={lean}>
        {light}
      </Shimmer>
      {nodes}
    </View>
  );
}

/**
 * The light, breathing.
 *
 * Two things at once and both on the native driver: a slow sway about the
 * light itself, which is what stops a fan of beams reading as a printed
 * sunburst, and a lean against the steer, because the light is far away and
 * far away things move against you. The JS thread never wakes for either --
 * it is the thread the ball is being flown on.
 */
function Shimmer({
  sunX,
  sunY,
  lean,
  children,
}: {
  sunX: number;
  sunY: number;
  lean: number;
  children: React.ReactNode;
}) {
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const leg = (toValue: number) =>
      Animated.timing(sway, {
        toValue,
        duration: 5200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    loop.start();
    return () => loop.stop();
  }, [sway]);

  const tilt = sway.interpolate({ inputRange: [0, 1], outputRange: ['-1.6deg', '1.6deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        transform: [{ translateX: -lean * DRIFT }, { rotate: tilt }],
        transformOrigin: `${sunX}px ${sunY}px`,
      }}>
      {children}
    </Animated.View>
  );
}

/**
 * One bubble: a film, the light caught on its rim, and a shine on its cheek.
 *
 * Three views rather than one, because a circle with a border takes one alpha
 * for both and a bubble is mostly the water behind it -- the film has to sit
 * far under the rim or the whole thing reads as a ring of chalk.
 */
function Bubble({ x, y, d, fade }: { x: number; y: number; d: number; fade: number }) {
  const shine = Math.max(1.5, d * 0.22);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        opacity: fade,
      }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: WATER.film,
          borderWidth: Math.max(1, d * 0.07),
          borderColor: WATER.rim,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: d * 0.2,
          top: d * 0.16,
          width: shine,
          height: shine * 0.72,
          borderRadius: shine,
          backgroundColor: WATER.sheen,
          opacity: 0.7,
        }}
      />
    </View>
  );
}
