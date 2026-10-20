/* eslint-disable react-native/no-inline-styles -- the sky is laid out by hand */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { COLORS, SKY, mixHex, useTheme } from './theme';

/**
 * The pastel cloud world the corridor hangs in.
 *
 * Nothing here is part of the run: it never collides, never scores and never
 * takes a touch. It rides at a fraction of the camera so the corridor still
 * reads as the thing that is moving.
 *
 * It is drawn in three layers, and the split is what keeps it off the frame
 * budget. The sky is a fixed gradient that never scrolls -- it is the ground
 * everything else is seen against, so it is painted once per size. The cloud
 * banks behind never move beyond the parallax, so each band of them is one
 * memoised node. The islands and the little creatures in front drift on the
 * native driver, so a skyful of them animates without ever waking the JS
 * thread -- which is the thread the ball is being steered on.
 *
 * Its colours are `SKY`, in `./theme` with everything else the game is painted
 * in. They used to be declared here, which made this file a third palette
 * outside both of the other two.
 */

/** How much of the camera the backdrop takes. Lower reads as further away. */
const PARALLAX = 0.34;
/** Depth of one repeat of the sky, in backdrop px. */
const BAND = 720;

type Prop = 'island' | 'blob' | 'flyer' | 'bubble';

/** How many strips the sky gradient is painted in. */
const SKY_BANDS = 40;

/**
 * And the night ground under a run.
 *
 * Fewer than the sky's, on purpose. That gradient runs periwinkle to near-white
 * rose and crosses most of a screen's worth of value, so a step between two of
 * its strips is a step a player can see; this one crosses about six points of
 * value from end to end, so half as many strips are already finer than the
 * banding the panel itself does. They are also strips the *run* pays for, on
 * the one screen in the game with a frame budget, and the sky pays for its
 * forty on screens where nothing is moving.
 */
const GROUND_BANDS = 20;

/** Where the props stand in one band: `x` and `y` are fractions of the band. */
const SLOTS: { x: number; y: number; size: number }[] = [
  { x: 0.13, y: 0.04, size: 78 },
  { x: 0.86, y: 0.17, size: 64 },
  { x: 0.3, y: 0.34, size: 54 },
  { x: 0.78, y: 0.49, size: 88 },
  { x: 0.16, y: 0.63, size: 60 },
  { x: 0.62, y: 0.79, size: 70 },
  { x: 0.9, y: 0.92, size: 52 },
];

const CAST: Prop[] = ['island', 'blob', 'flyer', 'island', 'bubble', 'blob', 'island', 'flyer'];
const TINTS = [SKY.mint, SKY.lilac, SKY.mint, SKY.lilac, SKY.lilac, SKY.mint];

/** Where the cloud banks sit in a band, and how big and how near each is. */
const CLOUDS: { x: number; y: number; w: number; layer: 0 | 1 | 2 }[] = [
  { x: 0.02, y: 0.08, w: 210, layer: 0 },
  { x: 0.55, y: 0.2, w: 260, layer: 1 },
  { x: -0.12, y: 0.33, w: 300, layer: 2 },
  { x: 0.68, y: 0.44, w: 190, layer: 0 },
  { x: 0.2, y: 0.57, w: 250, layer: 1 },
  { x: 0.72, y: 0.69, w: 280, layer: 2 },
  { x: -0.05, y: 0.84, w: 230, layer: 1 },
  { x: 0.48, y: 0.95, w: 200, layer: 0 },
];

const CLOUD_FACE = [SKY.cloudFar, SKY.cloudMid, SKY.cloudNear];
const CLOUD_FADE = [0.34, 0.55, 0.82];

/** Positive remainder, so bands above the start still pick a prop. */
function pick<T>(list: T[], n: number): T {
  return list[((n % list.length) + list.length) % list.length];
}

/**
 * A fixed shuffle. A band always brings the same sky back, so climbing past
 * one and dropping onto it again does not rearrange the clouds.
 */
function rnd(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** The gradient is painted in strips, so a stop has to be read at any height. */
function skyAt(t: number) {
  const s = SKY.stops;
  let i = 0;
  while (i < s.length - 2 && t > s[i + 1].at) i++;
  const a = s[i];
  const b = s[i + 1];
  return mixHex(a.c, b.c, b.at === a.at ? 0 : (t - a.at) / (b.at - a.at));
}

/** Lay a gradient down the screen as a stack of flat strips. */
function bandsOf(height: number, count: number, key: string, at: (t: number) => string) {
  const strips = [];
  // Each strip reaches a little past the top of the next one. The tops land on
  // fractions of a pixel -- a count of bands rarely divides a screen evenly --
  // and rounding them can leave a hairline of nothing between two strips. That
  // never showed while the sky was opaque over an opaque page, because the gap
  // let through something almost the same colour; with the sky thinned it lets
  // through the bare page, and the screen came out ruled with faint horizontal
  // lines. Three px of overlap is cheaper than chasing the rounding.
  const h = Math.ceil(height / count) + 3;
  for (let i = 0; i < count; i++) {
    strips.push(
      <View
        key={key + i}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: (i * height) / count,
          height: h,
          backgroundColor: at(i / (count - 1)),
        }}
      />,
    );
  }
  return strips;
}

export default function Backdrop({
  camY,
  width,
  height,
  dim,
  skyDim = 1,
}: {
  camY: number;
  width: number;
  height: number;
  /** How strongly the things *in* the sky are drawn, 0 to 1. */
  dim: number;
  /**
   * Which of the game's two grounds this screen stands on.
   *
   * 1 is the pastel day, and is the default: the front page, the door, the
   * loading screen, the road and the two full pages all live there. 0 is the
   * game's own night, `COLORS.bg`, and the run is the only caller that asks
   * for it -- everything the player reads inside the corridor is emitting
   * light, and lit things need a dark room.
   *
   * There is no third answer in practice, and the values between are not a
   * design. They are what the run used to ask for, and they are what was
   * wrong with it: a pastel day thinned over a deep-space night is not a dark
   * room, it is a wash, and because the sky is a *gradient* the wash lightened
   * down the screen. A hurdle was legible at the top and nearly gone at the
   * bottom, which is the third of the screen the ball actually lives in.
   *
   * Below 1 the backdrop lays its own solid `COLORS.bg` underneath, so the sky
   * is thinned against the game's ground rather than against whatever happens
   * to be behind the backdrop. At 0 it is that ground alone and the gradient
   * is not built at all.
   */
  skyDim?: number;
}) {
  // The run fades its palette from one night into another across a level, and
  // the ground goes with it. Outside the corridor this is the default palette
  // and is never read, because every one of those screens asks for the sky.
  const theme = useTheme();
  const depth = camY * PARALLAX;
  // The same trick the world layer uses: quote everything against the band it
  // stands in and slide the whole layer. A prop then keeps identical props
  // frame after frame, so React.memo drops it from the render and the sky
  // costs the frame budget nothing.
  const base = Math.floor(depth / BAND) * BAND;
  const first = Math.floor((depth - height) / BAND);
  const last = Math.floor((depth + height * 1.4) / BAND);
  // A caller that has asked for no crowd at all -- sky only.
  const bare = dim <= 0.02;
  // A caller that has asked for no sky either: the run, which stands on the
  // game's own ground. Then the gradient is not merely invisible, it is not
  // built -- forty strips at zero opacity are forty views the run pays for on
  // a layer nobody can see.
  const unlit = skyDim <= 0;

  // The gradient does not scroll and does not depend on the camera, so it is
  // painted when the window changes size and never again.
  const sky = React.useMemo(
    () => (unlit ? null : bandsOf(height, SKY_BANDS, 'sk', skyAt)),
    [height, unlit],
  );

  // And the ground under a run, built the same way and on the same terms: only
  // when the window resizes or the level's fade visibly moves. The palette is
  // quantised upstream for exactly that reason, so this is a couple of dozen
  // views rebuilt twenty times over a whole level rather than sixty times a
  // second.
  const ground = React.useMemo(
    () =>
      !unlit
        ? null
        : // Two stops rather than the sky's seven, so a strip is a straight mix.
          bandsOf(height, GROUND_BANDS, 'gr', t => mixHex(theme.bgTop, theme.bgBot, t)),
    [height, unlit, theme.bgTop, theme.bgBot],
  );

  // None of this depends on where in a band the camera is, only on which bands
  // are showing -- so the list is built when one scrolls by and not sixty
  // times a second. Rebuilding it every frame left React diffing a screenful
  // of clouds that were never going to have changed.
  const nodes = React.useMemo(() => {
    if (bare) return null;
    const out: React.ReactNode[] = [];
    for (let b = first; b <= last; b++) {
      out.push(<CloudBank key={`cb${b}`} band={b} width={width} top={b * BAND - base} />);
      for (let i = 0; i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        const n = b * SLOTS.length + i;
        out.push(
          <Floater
            key={`pr${n}`}
            kind={pick(CAST, n)}
            tint={pick(TINTS, n * 3 + 1)}
            size={slot.size}
            left={slot.x * width - slot.size / 2}
            top={b * BAND + slot.y * BAND - base}
            seed={n}
          />,
        );
      }
    }
    return out;
  }, [bare, first, last, base, width]);

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
        // Behind every sibling, and it has to be said rather than left to the
        // order they are written in. A positioned view paints *above* the
        // in-flow ones next to it whatever their order, so as an ordinary
        // absolute layer the sky covered the very page it is the ground for.
        // It never showed while the sky was a scatter of dim stars on nothing;
        // it is the whole screen now, so it is spelled out.
        zIndex: -1,
      }}>
      {unlit ? (
        // The game's own ground and nothing else: the water a run is flown
        // down, lit at the top and cold at the floor. The flat fill under it is
        // not decoration -- the strips are laid out by hand and the last one
        // ends on a rounded pixel, so something has to own the seam at the
        // very bottom of the screen.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>{ground}</View>
      ) : skyDim < 1 ? (
        <>
          {/* The game's own ground, and the sky thinned over it. Two layers
              rather than a paler set of strips, so the one number says how
              much daylight this screen wants and the gradient stays the one
              gradient every other screen is drawn from. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg }]} />
          <View style={[StyleSheet.absoluteFill, { opacity: skyDim }]}>{sky}</View>
        </>
      ) : (
        sky
      )}
      {bare ? null : (
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: dim }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width,
              height,
              transform: [{ translateY: base - depth }],
            }}>
            {nodes}
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * One bank of cloud, drawn in three depths.
 *
 * Clouds do not twinkle, turn or breathe -- a sky of animating puffs is a
 * screenful of views changing every frame for something nobody is looking at.
 * Depth comes from three values and three sizes instead, which costs nothing
 * per frame because a whole band of them is one memoised node.
 */
const CloudBank = React.memo(function CloudBankShape({
  band,
  width,
  top,
}: {
  band: number;
  width: number;
  top: number;
}) {
  const puffs = CLOUDS.map((c, i) => {
    const n = band * CLOUDS.length + i;
    // A little jitter per band, so two bands of the same sky never line up.
    const jx = (rnd(n * 1.7) - 0.5) * width * 0.16;
    const jy = (rnd(n * 2.9) - 0.5) * BAND * 0.06;
    const w = c.w * (0.82 + rnd(n * 3.3) * 0.4);
    return (
      <Cloud
        key={`c${i}`}
        w={w}
        left={c.x * width + jx}
        top={c.y * BAND + jy}
        face={CLOUD_FACE[c.layer]}
        fade={CLOUD_FADE[c.layer]}
        seed={n}
      />
    );
  });
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top, width, height: BAND }}>
      {puffs}
    </View>
  );
});

/**
 * One cloud: a rounded slab with three domes sitting on it.
 *
 * The whole thing is faded once, at the wrapper, rather than per shape -- four
 * translucent pieces overlapping would darken wherever they crossed and the
 * cloud would read as a bunch of circles rather than as one soft mass.
 */
function Cloud({
  w,
  left,
  top,
  face,
  fade,
  seed,
}: {
  w: number;
  left: number;
  top: number;
  face: string;
  fade: number;
  seed: number;
}) {
  const h = w * 0.3;
  const domes: { d: number; x: number; y: number }[] = [
    { d: w * 0.52, x: w * 0.06, y: -w * 0.16 },
    { d: w * 0.66, x: w * 0.3, y: -w * 0.28 },
    { d: w * 0.44, x: w * 0.62, y: -w * 0.12 },
  ];
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left, top, width: w, height: h, opacity: fade }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          borderRadius: h / 2,
          backgroundColor: face,
        }}
      />
      {domes.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            // A touch of wobble, so no two clouds carry the same silhouette.
            left: d.x + (rnd(seed * 5 + i) - 0.5) * w * 0.05,
            top: d.y,
            width: d.d,
            height: d.d,
            borderRadius: d.d / 2,
            backgroundColor: face,
          }}
        />
      ))}
    </View>
  );
}

/**
 * One thing in the sky, drifting on its own clock.
 *
 * The drift runs on the native driver, so a skyful of them animates without
 * ever waking the JS thread. Each is on its own period, so the sky never
 * breathes in step.
 */
const Floater = React.memo(function FloaterShape({
  kind,
  tint,
  size,
  left,
  top,
  seed,
}: {
  kind: Prop;
  tint: string;
  size: number;
  left: number;
  top: number;
  seed: number;
}) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dur = 2800 + (seed % 5) * 520;
    const leg = (toValue: number) =>
      Animated.timing(bob, {
        toValue,
        duration: dur,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    loop.start();
    return () => loop.stop();
  }, [bob, seed]);

  const drift = bob.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const tilt = bob.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: drift }, { rotate: tilt }],
      }}>
      {kind === 'island' && <Island size={size} seed={seed} />}
      {kind === 'blob' && <Blob size={size} tint={tint} seed={seed} />}
      {kind === 'flyer' && <Blob size={size * 0.8} tint={tint} seed={seed} wings />}
      {kind === 'bubble' && <Bubble size={size} />}
    </Animated.View>
  );
});

/**
 * A floating island: a grass cap over rock that tapers away beneath it.
 *
 * The rock is the one violet in the crowd, which is what keeps a lump of it
 * reading as part of this sky rather than as scenery borrowed from a greener
 * game. The grass is the only green the player ever sees that is not the live
 * mint the HUD spends -- so it stays soft, and well off that.
 */
function Island({ size, seed }: { size: number; seed: number }) {
  const w = size * 0.86;
  const cap = size * 0.2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* The grass, then its shaded lip, then the rock hanging under both. */}
      <View style={{ width: w, height: cap, borderRadius: cap, backgroundColor: SKY.grass }} />
      <View
        style={{
          width: w * 0.94,
          height: cap * 0.5,
          marginTop: -cap * 0.28,
          borderRadius: cap,
          backgroundColor: SKY.grassDark,
        }}
      />
      <View
        style={{
          width: w * 0.7,
          height: size * 0.3,
          marginTop: -cap * 0.2,
          backgroundColor: SKY.rock,
          borderBottomLeftRadius: w * 0.42,
          borderBottomRightRadius: w * 0.3,
        }}
      />
      {/* The shaded side of the rock, so it sits in the same light as the
          clouds rather than reading as a flat violet wedge. */}
      <View
        style={{
          position: 'absolute',
          left: size / 2,
          top: size * 0.5 - cap * 0.1,
          width: w * 0.35,
          height: size * 0.26,
          backgroundColor: SKY.rockDark,
          borderBottomRightRadius: w * 0.3,
          opacity: 0.55,
        }}
      />
      {/* Two bushes on the cap. Any more and they read as a hedge. */}
      <View
        style={{
          position: 'absolute',
          left: size * (0.2 + rnd(seed) * 0.1),
          top: size * 0.3,
          width: size * 0.16,
          height: size * 0.16,
          borderRadius: size * 0.08,
          backgroundColor: SKY.bush,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * (0.56 + rnd(seed * 2) * 0.1),
          top: size * 0.33,
          width: size * 0.12,
          height: size * 0.12,
          borderRadius: size * 0.06,
          backgroundColor: SKY.bush,
        }}
      />
    </View>
  );
}

/**
 * One of the little creatures the world is full of.
 *
 * It is a sphere lit the way everything round here is -- body, a shade cut
 * across the lower right, a highlight where the light comes from -- plus the
 * three things that turn a ball into somebody: two ear nubs, two eyes with a
 * pupil in them, and a smile drawn as the bottom of a ring.
 *
 * They are decoration and nothing else. None of them is ever in the corridor,
 * so none of them can be mistaken for something the ball has to miss.
 */
function Blob({
  size,
  tint,
  seed,
  wings = false,
}: {
  size: number;
  tint: string;
  seed: number;
  wings?: boolean;
}) {
  const d = size * 0.72;
  const eye = d * 0.24;
  const pupil = eye * 0.56;
  // Where it is looking, so a crowd of them is not all staring dead ahead.
  const gaze = (rnd(seed * 7.3) - 0.5) * eye * 0.3;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {wings ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: size * 0.5 - d * 0.78,
              top: size * 0.5 - d * 0.16,
              width: d * 0.34,
              height: d * 0.26,
              borderRadius: d * 0.17,
              backgroundColor: SKY.white,
              opacity: 0.75,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: size * 0.5 + d * 0.44,
              top: size * 0.5 - d * 0.16,
              width: d * 0.34,
              height: d * 0.26,
              borderRadius: d * 0.17,
              backgroundColor: SKY.white,
              opacity: 0.75,
            }}
          />
        </>
      ) : null}

      {/* The two ear nubs go down first, so the body sits over their roots. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.5 - d * 0.36,
          top: size * 0.5 - d * 0.62,
          width: d * 0.22,
          height: d * 0.26,
          borderRadius: d * 0.12,
          backgroundColor: tint,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.5 + d * 0.14,
          top: size * 0.5 - d * 0.62,
          width: d * 0.22,
          height: d * 0.26,
          borderRadius: d * 0.12,
          backgroundColor: tint,
        }}
      />

      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: tint,
          overflow: 'hidden',
        }}>
        <View
          style={{
            position: 'absolute',
            right: -d * 0.1,
            bottom: -d * 0.1,
            width: d * 0.8,
            height: d * 0.8,
            borderRadius: d * 0.4,
            backgroundColor: SKY.shade,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: d * 0.14,
            top: d * 0.1,
            width: d * 0.3,
            height: d * 0.18,
            borderRadius: d * 0.15,
            backgroundColor: SKY.white,
            opacity: 0.35,
          }}
        />
      </View>

      {/* The face, drawn over the body rather than inside it: the body clips
          its own shade, and an eye clipped by that would lose its edge. */}
      {[-1, 1].map(s => (
        <View
          key={s}
          style={{
            position: 'absolute',
            left: size * 0.5 + s * d * 0.22 - eye / 2,
            top: size * 0.5 - d * 0.1,
            width: eye,
            height: eye * 1.08,
            borderRadius: eye,
            backgroundColor: SKY.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              width: pupil,
              height: pupil,
              borderRadius: pupil / 2,
              backgroundColor: SKY.eye,
              transform: [{ translateX: gaze }],
            }}
          />
        </View>
      ))}
      {/* The smile: the bottom of a ring, which is the only arc a view can
          draw without a path behind it. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.5 - d * 0.14,
          top: size * 0.5 + d * 0.16,
          width: d * 0.28,
          height: d * 0.18,
          borderBottomLeftRadius: d * 0.14,
          borderBottomRightRadius: d * 0.14,
          borderBottomWidth: Math.max(1.5, d * 0.05),
          borderColor: SKY.eye,
          opacity: 0.8,
        }}
      />
      {/* One cheek is enough at this size; two read as a rash. */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.5 + d * 0.3,
          top: size * 0.5 + d * 0.1,
          width: d * 0.16,
          height: d * 0.1,
          borderRadius: d * 0.08,
          backgroundColor: SKY.blush,
        }}
      />
    </View>
  );
}

/** A drifting soap bubble: the one thing in the sky with nothing drawn on it. */
function Bubble({ size }: { size: number }) {
  const d = size * 0.44;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: SKY.white,
          opacity: 0.3,
          borderWidth: Math.max(1.5, d * 0.05),
          borderColor: SKY.white,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.5 - d * 0.32,
          top: size * 0.5 - d * 0.32,
          width: d * 0.22,
          height: d * 0.16,
          borderRadius: d * 0.11,
          backgroundColor: SKY.white,
          opacity: 0.8,
        }}
      />
    </View>
  );
}
