/* eslint-disable react-native/no-inline-styles -- every shape is positioned per frame */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PIPE_R, wheelBand } from '../game/config';
import { COLORS, useTheme } from './theme';
import { TYPE } from './type';

/**
 * The turn that puts a piece of type back the right way up.
 *
 * Everything in this file is drawn in the corridor's own axes and the whole
 * layer is then turned a quarter -- see `GameView` -- so the run reads across
 * a screen held sideways. Shapes do not mind that. Type does: a word carried
 * through the turn would climb the screen rather than read along it.
 *
 * So the three things in the corridor that are type -- the word on the finish
 * dish, the `+5` on a star, and the pop that answers a pickup -- turn
 * themselves back by exactly the same quarter, and end up upright on the glass
 * while still sitting at the point in the corridor they were given. They are
 * the only exceptions in the corridor, and there should not be a fourth: a
 * label is interface, and interface belongs in the HUD, which is outside the
 * turn altogether.
 */
export const UPRIGHT = { rotate: '90deg' } as const;

const BALL_D = 22;
/** How much the dish is squashed, to read as lying flat. */
const DISH_FLAT = 0.34;
const TAU = Math.PI * 2;

/** A pipe. `top`/`height` are already in screen space. */
export const Rod = React.memo(function RodShape({
  x,
  top,
  height,
}: {
  x: number;
  top: number;
  height: number;
}) {
  const t = useTheme();
  // Flat black, no seam. A lit line down the middle of a stroke this thin read
  // as a second line laid over the first rather than as a highlight, so every
  // heavy member in the run is one solid stroke now.
  return (
    <View
      pointerEvents="none"
      style={[
        styles.rod,
        {
          left: x - PIPE_R,
          top,
          height,
          width: PIPE_R * 2,
          backgroundColor: t.pole,
        },
      ]}
    />
  );
});

/**
 * Faint ring behind a rail hazard, purely decorative. Flattened into an
 * ellipse by default; the rings bolted to a line are drawn round.
 */
export const Halo = React.memo(function HaloShape({
  x,
  y,
  r,
  flat = true,
}: {
  x: number;
  y: number;
  r: number;
  flat?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        borderWidth: 2,
        borderColor: t.ring,
        transform: [{ scaleY: flat ? 0.5 : 1 }],
      }}
    />
  );
});

/**
 * A straight bar pinned at one end and swung to `rot` radians. It is one flat
 * stroke: a lit seam down the middle of a bar this thin read as a second bar
 * over the first, so nothing in the run wears one any more. `edge` outlines a
 * light bar so it still reads on a white ground.
 */
export const Bar = React.memo(function BarShape({
  x,
  y,
  len,
  rot,
  thick = 3,
  color,
  edge,
}: {
  x: number;
  y: number;
  len: number;
  rot: number;
  thick?: number;
  color?: string;
  edge?: string;
}) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y - thick / 2,
        width: len,
        height: thick,
        backgroundColor: color ?? t.pole,
        borderWidth: edge ? 1 : 0,
        borderColor: edge,
        transform: [{ rotate: `${rot}rad` }],
        transformOrigin: 'left center',
      }}
    />
  );
});

/**
 * Red circular saw, the way the reference draws it: a round red disc with a
 * ring of small teeth round the rim, a dark ring inside that, and a bullseye
 * hub -- white with a dark pin in the middle.
 */
export const Saw = React.memo(function SawShape({
  x,
  y,
  size,
  rot,
  scale = 1,
}: {
  x: number;
  y: number;
  size: number;
  rot: number;
  scale?: number;
}) {
  const s = size * scale;
  // Only the mount turns. The disc under it keeps identical props frame after
  // frame, so React drops its whole subtree from the render: a spinning blade
  // costs one view update instead of rebuilding twenty shapes, which is what
  // the frame budget was going on wherever a few of them were on screen.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - s / 2,
        top: y - s / 2,
        width: s,
        height: s,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${rot}rad` }],
      }}
    >
      <SawFace s={s} />
    </View>
  );
});

/** The disc itself: a ring of teeth, the dark ring inside, and the hub. */
const SawFace = React.memo(function SawFaceShape({ s }: { s: number }) {
  const t = useTheme();
  const disc = s * 0.86;
  const tooth = s * 0.2;
  const ring = s * 0.6;
  const hub = s * 0.36;
  const pin = s * 0.14;

  const teeth = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    teeth.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: s / 2 + (Math.cos(a) * disc) / 2 - tooth / 2,
          top: s / 2 + (Math.sin(a) * disc) / 2 - tooth / 2,
          width: tooth,
          height: tooth,
          backgroundColor: t.blade,
          transform: [{ rotate: `${a + Math.PI / 4}rad` }],
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
        width: s,
        height: s,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {teeth}
      <View
        style={{
          position: 'absolute',
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          backgroundColor: t.blade,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: s * 0.07,
          borderColor: t.bladeDark,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: hub,
          height: hub,
          borderRadius: hub / 2,
          backgroundColor: t.bladeCore,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: pin,
          height: pin,
          borderRadius: pin / 2,
          backgroundColor: t.ink,
        }}
      />
    </View>
  );
});

/**
 * Red pill blade standing on the orbit: a serrated red rim, a white band and a
 * dark core, the way the reference draws it.
 *
 * The teeth are spaced by arc length round the stadium outline, and pushed out
 * past the rim so their points clear it. Laid on an ellipse and left flush
 * with the body, as they were, they sat behind it in the body's own red and
 * the pill came out a plain lozenge with no serration at all.
 */
export const Capsule = React.memo(function CapsuleShape({
  x,
  y,
  scale = 1,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  const w = 26 * scale;
  const h = 70 * scale;
  /** Room round the body for the teeth, so no platform clips their points. */
  const pad = 6 * scale;
  const boxW = w + pad * 2;
  const boxH = h + pad * 2;
  // The pill travels up and down its line every frame, but the pill itself
  // never changes: the body is a memo child, so a moving pill costs one view
  // update rather than laying out a serrated rim again.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - boxW / 2,
        top: y - boxH / 2,
        width: boxW,
        height: boxH,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CapsuleBody scale={scale} />
    </View>
  );
});

const CapsuleBody = React.memo(function CapsuleBodyShape({
  scale,
}: {
  scale: number;
}) {
  const t = useTheme();
  const w = 26 * scale;
  const h = 70 * scale;
  const r = w / 2;
  /** Half the straight run between the two caps. */
  const sy = h / 2 - r;
  const tooth = 6 * scale;
  const pad = tooth;
  const boxW = w + pad * 2;
  const boxH = h + pad * 2;

  // One tooth every couple of tooth-widths of rim, so the points stay separate
  // at the size the pill is actually drawn.
  const rim = 4 * sy + TAU * r;
  const n = Math.max(8, Math.round(rim / (tooth * 1.9)));
  const teeth = [];
  for (let i = 0; i < n; i++) {
    const s = (i / n) * rim;
    // Walk the outline: right side down, bottom cap, left side up, top cap.
    // `out` is the way the rim faces there, which is the way the tooth points.
    let ox: number;
    let oy: number;
    let out: number;
    if (s < 2 * sy) {
      ox = r;
      oy = -sy + s;
      out = 0;
    } else if (s < 2 * sy + Math.PI * r) {
      out = (s - 2 * sy) / r;
      ox = Math.cos(out) * r;
      oy = sy + Math.sin(out) * r;
    } else if (s < 4 * sy + Math.PI * r) {
      ox = -r;
      oy = sy - (s - 2 * sy - Math.PI * r);
      out = Math.PI;
    } else {
      out = Math.PI + (s - 4 * sy - Math.PI * r) / r;
      ox = Math.cos(out) * r;
      oy = -sy + Math.sin(out) * r;
    }
    const lift = tooth * 0.3;
    teeth.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: boxW / 2 + ox + Math.cos(out) * lift - tooth / 2,
          top: boxH / 2 + oy + Math.sin(out) * lift - tooth / 2,
          width: tooth,
          height: tooth,
          backgroundColor: t.blade,
          // Corner-first, so what clears the rim is a point and not a stub.
          transform: [{ rotate: `${out + Math.PI / 4}rad` }],
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
        width: boxW,
        height: boxH,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {teeth}
      <View
        style={{
          position: 'absolute',
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: t.blade,
          borderWidth: Math.max(1, 1.6 * scale),
          borderColor: t.bladeDark,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: w * 0.6,
          height: h * 0.78,
          borderRadius: w * 0.3,
          backgroundColor: t.bladeCore,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: w * 0.28,
          height: h * 0.42,
          borderRadius: w * 0.14,
          backgroundColor: t.ink,
        }}
      />
    </View>
  );
});

/**
 * Big wheel standing beside the rod: a treaded ring with four spokes reaching
 * out of it, matching the reference.
 */
export const Wheel = React.memo(function WheelShape({
  x,
  y,
  radius,
  reach,
  rot,
}: {
  x: number;
  y: number;
  radius: number;
  reach: number;
  rot: number;
}) {
  // The ring is round, so turning the box it lives in draws exactly the same
  // picture as turning every spoke and every tread bar one by one -- and it
  // keeps those two dozen shapes out of the frame budget while it spins.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - reach,
        top: y - reach,
        width: reach * 2,
        height: reach * 2,
        transform: [{ rotate: `${rot}rad` }],
      }}
    >
      <WheelFace radius={radius} reach={reach} />
    </View>
  );
});

/** The ring, its tread and its spokes, drawn about the centre of its own box. */
const WheelFace = React.memo(function WheelFaceShape({
  radius,
  reach,
}: {
  radius: number;
  reach: number;
}) {
  const t = useTheme();
  const band = wheelBand(radius);
  // The box is `reach` either side of the hub, so the hub is at `reach`.
  const c = reach;

  const spokes = [];
  for (let i = 0; i < 4; i++) {
    // Offset by an eighth turn so the spokes sit on the diagonals, as drawn.
    const a = Math.PI / 4 + (i * TAU) / 4;
    const inner = radius - band;
    spokes.push(
      <Bar
        key={i}
        x={c + Math.cos(a) * inner}
        y={c + Math.sin(a) * inner}
        len={reach - inner}
        rot={a}
        thick={9}
        color={t.hazard}
        edge={t.hazardEdge}
      />,
    );
  }

  // Short light bars cut across the band to read as tread. The count follows
  // the rim, so a big ring is dashed as finely as a small one rather than
  // breaking into a few fat segments.
  const tread = [];
  const n = Math.max(12, Math.round(radius / 4.5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const mid = radius - band / 2;
    tread.push(
      <Bar
        key={i}
        x={c + Math.cos(a) * mid - (Math.cos(a) * band) / 2}
        y={c + Math.sin(a) * mid - (Math.sin(a) * band) / 2}
        len={band}
        rot={a}
        thick={3}
        color={t.bg}
      />,
    );
  }

  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: c - radius,
          top: c - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          borderWidth: band,
          borderColor: t.hazard,
        }}
      />
      {tread}
      {spokes}
    </>
  );
});

/**
 * Closed frame of `n` sides tumbling beside the rod: triangle, hexagon, ...
 *
 * Drawn in the hazard colour over its dark edge rather than in the rods'
 * violet. It is the biggest lethal thing in the corridor and it used to be the
 * same stroke as the rail it tumbles beside, which left the player reading the
 * difference between "lean on this" and "this ends the run" off the silhouette
 * alone -- on a ground the same hue as both.
 *
 * `color`/`edge` are there for the one frame that is not lethal: the hexagon
 * cage, which the ball flies in through, wears the rails' cool violet so the
 * corridor keeps telling the truth about what may be touched.
 */
export const Frame = React.memo(function FrameShape({
  x,
  y,
  radius,
  sides,
  rot,
  thick = 8,
  color,
  edge,
}: {
  x: number;
  y: number;
  radius: number;
  sides: number;
  rot: number;
  thick?: number;
  color?: string;
  edge?: string;
}) {
  const t = useTheme();
  const bars = [];
  for (let i = 0; i < sides; i++) {
    const a0 = rot + (i * TAU) / sides;
    const a1 = rot + ((i + 1) * TAU) / sides;
    const x0 = x + Math.cos(a0) * radius;
    const y0 = y + Math.sin(a0) * radius;
    const x1 = x + Math.cos(a1) * radius;
    const y1 = y + Math.sin(a1) * radius;
    bars.push(
      <Bar
        key={i}
        x={x0}
        y={y0}
        len={Math.hypot(x1 - x0, y1 - y0)}
        rot={Math.atan2(y1 - y0, x1 - x0)}
        thick={thick}
        color={color ?? t.hazard}
        edge={edge ?? t.hazardEdge}
      />,
    );
  }
  return <>{bars}</>;
});

/**
 * Rotating bracket: a long, shallow rectangle left open down one long side so
 * the ball can pass through -- the `[ ]` pair the reference draws. It is one
 * rotated box with three borders rather than three separate bars, so the
 * corners come out square and closed the way the reference has them.
 *
 * The band is one flat black stroke. It used to carry the lit seam every other
 * heavy member in the run wears, but on a stroke this wide the seam read as a
 * second bar laid over the first rather than as a highlight, and the frame came
 * out looking double-walled instead of solid.
 *
 * `side` matches the prop's own field exactly: 1 skips the right edge, -1
 * skips the left -- the same rule `bracketHit` collides against, so the drawn
 * gap is always the real one.
 */
export const Bracket = React.memo(function BracketShape({
  corners,
  side,
  thick = 12,
}: {
  /** [TL, TR, BR, BL], already rotated and translated. */
  corners: { x: number; y: number }[];
  side: 1 | -1;
  thick?: number;
}) {
  const t = useTheme();
  const [tl, tr, br, bl] = corners;
  const w = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const h = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rot = Math.atan2(tr.y - tl.y, tr.x - tl.x);
  // Spinning about the centre puts the box back on exactly those four corners.
  const cx = (tl.x + br.x) / 2;
  const cy = (tl.y + br.y) / 2;
  const spine = side === 1;
  // The dark rim, drawn as the same box grown by `RIM` on every side and then
  // laid under the real one. A border is painted inward from its box, so an
  // outline has to be a second, larger box rather than a second border.
  const RIM = 2;

  const box = (grow: number, color: string) => ({
    position: 'absolute' as const,
    left: cx - w / 2 - grow,
    top: cy - h / 2 - grow,
    width: w + grow * 2,
    height: h + grow * 2,
    borderColor: color,
    borderTopWidth: thick + grow,
    borderBottomWidth: thick + grow,
    borderLeftWidth: spine ? thick + grow : 0,
    borderRightWidth: spine ? 0 : thick + grow,
    transform: [{ rotate: `${rot}rad` }],
  });

  return (
    <>
      <View pointerEvents="none" style={box(RIM, t.hazardEdge)} />
      <View pointerEvents="none" style={box(0, t.hazard)} />
    </>
  );
});

/**
 * Side-mounted launcher. `side` is the way it fires, so the rail it hangs off
 * goes on the other side, against the wall, and the muzzle sits on the edge
 * that faces the corridor.
 *
 * The body is lethal, and it used to be painted `pole` -- the colour of the
 * one thing in the corridor the ball may lean on all day. It was the single
 * place the game told the player outright that a thing which ends the run is
 * safe to touch. It is in the hazard family now; only the rail it hangs from,
 * which nothing collides with, stays cool.
 *
 * The muzzle is the state, and it is read as a *change* rather than as a
 * colour: mint while there is no shot coming, and a white flash as one goes.
 * White rather than the blade's red, which is what the palette would suggest,
 * because a red dot on a red body is not a signal -- it is the dot going away.
 */
export const Turret = React.memo(function TurretShape({
  x,
  y,
  size,
  side,
  hot,
}: {
  x: number;
  y: number;
  size: number;
  side: 1 | -1;
  hot: boolean;
}) {
  const t = useTheme();
  const railX = x - side * (size * 0.7);
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: railX - 3,
          top: y - size * 1.6,
          width: 6,
          height: size * 3.2,
          backgroundColor: t.pole,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: 6,
          backgroundColor: t.hazard,
          borderWidth: 2,
          borderColor: t.hazardEdge,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: size * 0.21,
            backgroundColor: hot ? t.ballShine : t.live,
            transform: [{ translateX: side * size * 0.26 }],
          }}
        />
      </View>
    </>
  );
});

/** Homing shot: a rounded head with a short tail. */
export const Shot = React.memo(function ShotShape({
  x,
  y,
  rot,
}: {
  x: number;
  y: number;
  rot: number;
}) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 16,
        top: y - 7,
        width: 32,
        height: 14,
        transform: [{ rotate: `${rot}rad` }],
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 4,
          width: 20,
          height: 6,
          borderRadius: 3,
          backgroundColor: t.ink,
          opacity: 0.45,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 16,
          top: 0,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: t.ink,
        }}
      />
    </View>
  );
});

/** The console pickup that pays out coins and opens the bonus window. */
export const TvBox = React.memo(function TvBoxShape({
  x,
  y,
  size,
  scale = 1,
}: {
  x: number;
  y: number;
  size: number;
  scale?: number;
}) {
  const t = useTheme();
  const s = size * scale;
  const ears = [-0.5, 0, 0.5].map(a => (
    <Bar
      key={a}
      x={x + s * 0.46}
      y={y}
      len={s * 0.34}
      rot={a}
      thick={2.5}
      color={t.gold}
    />
  ));
  return (
    <>
      {ears}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: x - s / 2,
          top: y - s / 2,
          width: s,
          height: s,
          borderRadius: s * 0.24,
          borderWidth: 3,
          borderColor: t.gold,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: s * 0.5,
            height: s * 0.38,
            borderRadius: 4,
            borderWidth: 2.5,
            borderColor: t.gold,
            marginBottom: s * 0.08,
          }}
        />
        <View style={{ flexDirection: 'row', gap: s * 0.08 }}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={{
                width: s * 0.1,
                height: s * 0.1,
                borderRadius: s * 0.05,
                borderWidth: 2,
                borderColor: t.gold,
              }}
            />
          ))}
        </View>
      </View>
    </>
  );
});

/** What the dish says to the run that reaches it. */
const PLATE_WORD = 'LEVEL COMPLETED';

/**
 * The dish at the end of the level.
 *
 * It is the last thing a run ever touches, so it is drawn big enough to be
 * read a stage before it arrives: three rings squashed flat, the outer one in
 * gold because it is a payout and not another piece of furniture, and the
 * level's sign-off lettered across the face.
 *
 * Everything is quoted against `size`, so a bigger dish is the same dish
 * rather than the old one wearing a wider outer ring -- the rings step in and
 * drop away by the same share of it, and the lettering is set to match.
 *
 * The word sits below the centre. The finish puts the ball down on the dish's
 * own anchor, so the middle of the face is exactly where the run ends up
 * parked, and it is the one place the lettering could not be read. Its box is
 * wider than the dish and the line never wraps, so the word stays one line,
 * centred on the dish, whatever face the phone ends up drawing it in.
 */
export const Plate = React.memo(function PlateShape({
  x,
  y,
  size,
}: {
  x: number;
  y: number;
  size: number;
}) {
  const t = useTheme();
  const step = size * 0.082;
  const drop = size * 0.064;
  return (
    <>
      {[0, 1, 2].map(i => {
        const r = size / 2 - i * step;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: x - r,
              top: y - r + i * drop,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              borderWidth: 4 - i,
              borderColor: i === 0 ? t.gold : t.pole,
              transform: [{ scaleY: DISH_FLAT }],
            }}
          />
        );
      })}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: x - size * 0.7,
          top: y + size * 0.08,
          width: size * 1.4,
          alignItems: 'center',
          transform: [UPRIGHT],
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: Math.max(11, Math.round(size * 0.085)),
            ...TYPE.black,
            color: t.gold,
            letterSpacing: 1.4,
          }}
        >
          {PLATE_WORD}
        </Text>
      </View>
    </>
  );
});

/** T-shaped base under a rod. */
export const Stand = React.memo(function StandShape({
  x,
  y,
  size,
}: {
  x: number;
  y: number;
  size: number;
}) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - 4,
        width: size,
        height: 8,
        backgroundColor: t.pole,
        borderRadius: 3,
      }}
    />
  );
});

export const StarChip = React.memo(function StarChipShape({
  x,
  y,
  size = 26,
  scale = 1,
}: {
  x: number;
  y: number;
  size?: number;
  scale?: number;
}) {
  const t = useTheme();
  const s = size * scale;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - s / 2,
        top: y - s / 2,
        width: s,
        height: s,
        borderRadius: s / 2,
        transform: [UPRIGHT],
        borderWidth: 2,
        // Gold, because this is a thing to fly into. A pickup drawn in the
        // pale ink every label and hairline is drawn in read as a piece of
        // interface that had drifted into the corridor; the floating pop that
        // answers it keeps that ink, so the two are no longer the same object
        // at a glance -- gold is what to take, pale is what was taken.
        borderColor: t.gold,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.bg,
      }}
    >
      {/* The reference labels each coin with what it pays, not with a star. */}
      <Text
        style={{
          fontSize: s * 0.46,
          lineHeight: s * 0.6,
          ...TYPE.black,
          letterSpacing: -0.5,
          color: t.gold,
        }}
      >
        +5
      </Text>
    </View>
  );
});

/** The floating "+5" that pops off a pickup. */
export const PopChip = React.memo(function PopChipShape({
  x,
  y,
  label,
  fade,
}: {
  x: number;
  y: number;
  label: string;
  fade: number;
}) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 24,
        top: y - 15,
        minWidth: 48,
        height: 30,
        borderRadius: 15,
        transform: [UPRIGHT],
        borderWidth: 2,
        borderColor: t.ink,
        backgroundColor: t.card,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade,
      }}
    >
      <Text style={{ fontSize: 14, ...TYPE.black, color: t.ink }}>{label}</Text>
    </View>
  );
});

/**
 * The player.
 *
 * A little candy creature rather than the inked bullseye it used to be: a
 * round face lit by a gradient -- cyan raked down the top-left, orchid coming
 * up the bottom-right, over a violet body -- with a curved shade pooling along
 * the bottom, a shine caught off the top left, and a pair of eyes that look
 * the way it is flying. It is the one thing on screen the player tracks for
 * the whole run, so it is the one thing worth spending that many views on.
 *
 * Everything is drawn inside a circle clipped to *exactly* the collision
 * radius, and the squash never grows an axis past 1 -- a rise narrows the
 * ball, a fall flattens it, and neither ever pushes a pixel outside the
 * silhouette the game actually tests. A ball drawn bigger than its hitbox
 * reads as the game stealing runs; drawn smaller, it reads as the game
 * inventing hits. So it is drawn at the hitbox, and the liveliness is bought
 * out of the inside of it.
 *
 * The glow behind it is the one thing outside that circle, and it is soft
 * enough to read as light coming off the ball rather than as more ball.
 */
export const Ball = React.memo(function BallShape({
  x,
  y,
  scale,
  look = 0,
  rise = 0,
  dead = false,
}: {
  x: number;
  y: number;
  scale: number;
  /**
   * Sideways flight, -1 (hard left) to 1 (hard right). Aims the eyes.
   * Left out by the splash and the login, where the ball is a portrait and
   * ought to be looking straight back at whoever is holding the phone.
   */
  look?: number;
  /** Vertical flight, 1 climbing to -1 diving. Stretches and squashes. */
  rise?: number;
  /**
   * The face a run that has just ended wears: one eye crossed out and a mouth
   * turned down. Only the game-over card ever asks for it -- in the corridor
   * the ball is gone the instant it is hit, and there is nothing to draw.
   */
  dead?: boolean;
}) {
  const d = BALL_D * scale;
  // Only ever a shrink on one axis, never a grow on the other, so the drawn
  // ball is always inside the circle the game actually tests.
  const up = Math.max(0, rise);
  const down = Math.max(0, -rise);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [
          { scaleX: 1 - 0.12 * up },
          { scaleY: 1 - 0.1 * down },
          { rotate: `${look * 9}deg` },
        ],
      }}
    >
      {/* Quantised, and memoised on the far side of that: this wrapper moves
          sixty times a second, but the six views that make up the face have
          nothing to say about where the ball is. Rounding the gaze to eighths
          means the face is handed identical props frame after frame and drops
          out of the render entirely -- the pupils travel about a pixel either
          way in total, so nothing is lost by moving them in steps. */}
      <BallFace d={d} gaze={Math.round(look * 8) / 8} dead={dead} />
    </View>
  );
});

/**
 * The ball's face, drawn about its own centre and knowing nothing of where on
 * screen that centre is.
 *
 * The head is clipped to a circle at exactly the collision radius. A head
 * drawn bigger than its hitbox reads as the game stealing runs; drawn smaller,
 * it reads as the game inventing hits. So it is drawn at the hitbox, and all
 * the liveliness is bought out of the inside of it -- the shade, the shine,
 * the blush and the eyes are all shapes that would spill out of the
 * silhouette if the clip were not there to curve them.
 *
 * One thing sits outside that circle: the glow, which is soft enough to read
 * as light coming off the head rather than as more head. Nothing else does.
 * The head wore a pair of ears for a while -- a stalk and a bulb either side,
 * the one place this character was allowed to break its own rule -- and they
 * are gone. What is left is a plain round head, and the silhouette the player
 * reads is exactly the circle the game tests, on the front pages and in the
 * corridor alike.
 */
const BallFace = React.memo(function BallFaceShape({
  d,
  gaze,
  dead,
}: {
  d: number;
  gaze: number;
  dead: boolean;
}) {
  const t = useTheme();
  const eye = d * 0.27;
  const iris = eye * 0.72;
  // How far an iris slides in its white. Capped well short of the rim, so a
  // hard turn never rolls an eye out the side of the face.
  const slide = gaze * eye * 0.16;

  return (
    <>
      {/* The glow. Sits behind everything and is never part of the shape. Two
          rings rather than one, so it falls off instead of ending on an edge. */}
      <View
        style={{
          position: 'absolute',
          left: -d * 0.42,
          top: -d * 0.42,
          width: d * 1.84,
          height: d * 1.84,
          borderRadius: d * 0.92,
          backgroundColor: t.ballWarm,
          opacity: 0.13,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: -d * 0.22,
          top: -d * 0.22,
          width: d * 1.44,
          height: d * 1.44,
          borderRadius: d * 0.72,
          backgroundColor: t.ballBody,
          opacity: 0.2,
        }}
      />
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: t.ballBody,
          borderWidth: Math.max(1.5, d * 0.09),
          borderColor: t.ballDeep,
          // Clips every sweep, the shade, the shine and the blush to the face,
          // so all of them are curved without any being a shape drawn curved.
          overflow: 'hidden',
        }}
      >
        {/* The gradient: cyan raked down from the top-left corner and orchid
            up from the bottom-right, each one a stack of circles about the
            same centre. Nothing in this platform draws a gradient, so this is
            how one is built -- four translucent discs shrinking toward the hot
            spot, whose opacities pile up into a falloff the eye reads as
            light. It costs eight views on the one shape that is worth them. */}
        <Sweep d={d} color={t.ballCool} cx={0.18} cy={0.1} strength={0.07} />
        <Sweep d={d} color={t.ballWarm} cx={0.86} cy={0.94} />
        {/* The shade: an oversized circle hanging off the bottom, so what
            survives the clip is a crescent following the rim. */}
        <View
          style={{
            position: 'absolute',
            left: -d * 0.2,
            top: d * 0.62,
            width: d * 1.4,
            height: d * 1.4,
            borderRadius: d * 0.7,
            backgroundColor: t.ballDeep,
            opacity: 0.32,
          }}
        />
        {/* The shine, up where the light is coming from. */}
        <View
          style={{
            position: 'absolute',
            left: d * 0.14,
            top: d * 0.1,
            width: d * 0.3,
            height: d * 0.2,
            borderRadius: d * 0.15,
            backgroundColor: t.ballShine,
            opacity: 0.9,
            transform: [{ rotate: '-24deg' }],
          }}
        />
        {/* The cheeks. Low and wide and half off the sides, where the clip
            takes the outer edge off each one. Declared before the eyes so an
            eye is never sitting behind a wash of pink. */}
        <Blush d={d} side={-1} color={t.ballBlush} />
        <Blush d={d} side={1} color={t.ballBlush} />
        {/* The eyes. Set a touch below centre: eyes on the equator read as a
            face looking through you, eyes under it read as a face looking
            where it is going. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: d * 0.33,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: d * 0.06,
          }}
        >
          <Eye
            size={eye}
            iris={iris}
            slide={slide}
            white={t.ballShine}
            ink={t.ballEye}
            irisInk={t.ballIris}
          />
          <Eye
            size={eye}
            iris={iris}
            slide={slide}
            white={t.ballShine}
            ink={t.ballEye}
            irisInk={t.ballIris}
            cross={dead}
          />
        </View>
        {/* The mouth. An open smile while the run is alive, and the same shape
            turned over on the card -- a face that pulled the happy one all the
            way down a level would be a face the player is sick of. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: dead ? d * 0.68 : d * 0.66,
            alignItems: 'center',
          }}
        >
          {dead ? (
            <View
              style={{
                width: d * 0.26,
                height: d * 0.14,
                borderTopLeftRadius: d * 0.13,
                borderTopRightRadius: d * 0.13,
                borderTopWidth: Math.max(1.5, d * 0.05),
                borderColor: t.ballEye,
              }}
            />
          ) : (
            <View
              style={{
                width: d * 0.24,
                height: d * 0.15,
                borderTopLeftRadius: d * 0.04,
                borderTopRightRadius: d * 0.04,
                borderBottomLeftRadius: d * 0.12,
                borderBottomRightRadius: d * 0.12,
                backgroundColor: t.ballEye,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {/* The tongue: a sliver of pink along the bottom of the mouth,
                  clipped by it. It is a pixel or two in the corridor, and it
                  is what keeps the mouth from reading as a hole on the card. */}
              <View
                style={{
                  width: d * 0.16,
                  height: d * 0.07,
                  borderRadius: d * 0.05,
                  backgroundColor: t.ballBlush,
                }}
              />
            </View>
          )}
        </View>
      </View>
    </>
  );
});

/**
 * One cheek: a flat oval of pink sitting half off the side of the face, so the
 * head's own clip is what shapes its outer edge.
 */
const Blush = React.memo(function BlushShape({
  d,
  side,
  color,
}: {
  d: number;
  side: -1 | 1;
  color: string;
}) {
  const w = d * 0.22;
  return (
    <View
      style={{
        position: 'absolute',
        left: side < 0 ? d * 0.01 : undefined,
        right: side > 0 ? d * 0.01 : undefined,
        top: d * 0.6,
        width: w,
        height: w * 0.62,
        borderRadius: w / 2,
        backgroundColor: color,
        opacity: 0.62,
      }}
    />
  );
});

/**
 * One hue of the ball's gradient: concentric discs about a hot spot, each one
 * smaller and each one laid over the last.
 *
 * `cx`/`cy` are where that hot spot sits, as fractions of the face. Every
 * disc is the same low opacity, so what the eye sees is the sum of however
 * many of them cover a given pixel -- full strength at the centre, nothing at
 * all past the widest one, and a smooth ramp between. Four steps is where the
 * banding stops being visible at the sizes the ball is ever drawn at.
 *
 * `strength` is how much each disc carries. The two sweeps are not equal: the
 * cyan one is raked over a violet body and reads far louder than the orchid
 * does, and left at the same weight it turned the whole top half of the
 * character blue. It is the light on the body, so it is dialled to where the
 * body is still plainly violet.
 */
const Sweep = React.memo(function SweepShape({
  d,
  color,
  cx,
  cy,
  strength = 0.24,
}: {
  d: number;
  color: string;
  cx: number;
  cy: number;
  strength?: number;
}) {
  return (
    <>
      {[1.3, 1.02, 0.76, 0.52].map(f => {
        const r = (d * f) / 2;
        return (
          <View
            key={f}
            style={{
              position: 'absolute',
              left: d * cx - r,
              top: d * cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: color,
              opacity: strength,
            }}
          />
        );
      })}
    </>
  );
});

/**
 * One eye: a white with an iris that slides a little way inside it.
 *
 * Three discs where there used to be one flat pupil -- a violet iris, the ink
 * of the pupil inside it, and a pair of glints laid over both. The glints are
 * what make an eye read as wet: a fat one up where the light is and a small
 * one opposite. They ride with the iris rather than sitting still on the
 * white, so a hard turn moves the whole eye as one object.
 *
 * `cross` swaps all of that for the two crossed bars a knocked-out character
 * wears. Only one of a pair is ever crossed -- both of them reads as a corpse,
 * and this game's ball is having a bad moment rather than a final one.
 */
function Eye({
  size,
  iris,
  slide,
  white,
  ink,
  irisInk,
  cross = false,
}: {
  size: number;
  /** Diameter of the coloured disc the pupil sits in. */
  iris: number;
  slide: number;
  white: string;
  ink: string;
  irisInk: string;
  cross?: boolean;
}) {
  const bar = {
    position: 'absolute' as const,
    width: size * 0.62,
    height: Math.max(1.5, size * 0.13),
    borderRadius: size * 0.07,
    backgroundColor: ink,
  };
  const pupil = iris * 0.58;
  const glint = iris * 0.34;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: white,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {cross ? (
        <>
          <View style={[bar, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[bar, { transform: [{ rotate: '-45deg' }] }]} />
        </>
      ) : (
        <View
          style={{
            width: iris,
            height: iris,
            borderRadius: iris / 2,
            backgroundColor: irisInk,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateX: slide }],
          }}
        >
          <View
            style={{
              width: pupil,
              height: pupil,
              borderRadius: pupil / 2,
              backgroundColor: ink,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: iris * 0.1,
              top: iris * 0.08,
              width: glint,
              height: glint,
              borderRadius: glint / 2,
              backgroundColor: white,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: iris * 0.12,
              bottom: iris * 0.12,
              width: glint * 0.52,
              height: glint * 0.52,
              borderRadius: glint * 0.26,
              backgroundColor: white,
              opacity: 0.85,
            }}
          />
        </View>
      )}
    </View>
  );
}

/** One scattered dot from a burst. */
export const Dot = React.memo(function DotShape({
  x,
  y,
  size,
  gold,
  fade,
}: {
  x: number;
  y: number;
  size: number;
  gold: boolean;
  fade: number;
}) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: gold ? t.gold : t.ink,
        opacity: fade,
      }}
    />
  );
});

/** The post, the flag hanging off it, and the chequer drawn across it. */
const FLAG_POST = 152;
const FLAG_COLS = 3;
const FLAG_ROWS = 2;
const FLAG_SQ = 21;
const FLAG_W = FLAG_COLS * FLAG_SQ;
const FLAG_H = FLAG_ROWS * FLAG_SQ;

/**
 * The checkpoint flag.
 *
 * It used to be the reference's own: a thin post with a hooked arm and a
 * fourteen-pixel grey pennant on the end of it, in the rods' violet, at part
 * opacity. That was a piece of scenery. The flag is now the single biggest
 * event in a level -- it is the checkpoint, it pays in both currencies, and it
 * winds the descent up a rung -- and the player has to see it coming from the
 * top of the screen rather than notice it going past.
 *
 * So it is twice the size and it is a chequered flag: dark squares over pale
 * ones, on a gold post. Dark is what makes it read as a marker rather than as
 * another lit thing in a corridor full of lit things, and the chequer is the
 * one pattern that says *finish line* without a word on it -- while the pale
 * squares and the gold post are what keep something dark legible against a
 * ground that is itself nearly black.
 *
 * Decoration only: nothing collides with it, and passing its depth is the
 * whole of taking it.
 */
export const Flag = React.memo(function FlagShape({
  x,
  y,
}: {
  x: number;
  y: number;
}) {
  const t = useTheme();
  // A chequer over the flag's dark ground: only the pale squares are drawn,
  // and the dark ones are the ground showing through.
  const squares = [];
  for (let row = 0; row < FLAG_ROWS; row++) {
    for (let col = 0; col < FLAG_COLS; col++) {
      if ((col + row) % 2 === 1) continue;
      squares.push(
        <View
          key={`${col},${row}`}
          style={{
            position: 'absolute',
            left: col * FLAG_SQ,
            top: row * FLAG_SQ,
            width: FLAG_SQ,
            height: FLAG_SQ,
            backgroundColor: t.ink,
          }}
        />,
      );
    }
  }

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: x - 3, top: y - FLAG_POST / 2 }}
    >
      <View
        style={{
          width: 6,
          height: FLAG_POST,
          backgroundColor: t.gold,
          borderRadius: 3,
        }}
      />
      {/* The flag hangs from the top of the post rather than off a hooked arm
          halfway up it: at this size the arm only pushed it out of the lane
          the player is reading. */}
      <View
        style={{
          position: 'absolute',
          left: 5,
          top: 4,
          width: FLAG_W,
          height: FLAG_H,
          backgroundColor: COLORS.inkOnLight,
          borderWidth: 3,
          borderColor: t.gold,
          overflow: 'hidden',
        }}
      >
        {squares}
      </View>
    </View>
  );
});

/**
 * The slot a dropping saw comes out of: a short dark mouth in the wall, so a
 * column of the rain can be read before its saw is let go. `x` is the wall it
 * is cut into, in layer px, and `side` which wall that is.
 */
export const Hatch = React.memo(function HatchShape({
  x,
  y,
  side,
}: {
  x: number;
  y: number;
  side: 1 | -1;
}) {
  const t = useTheme();
  const w = 12;
  const h = 34;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: side > 0 ? x - w : x,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: 4,
        backgroundColor: t.pole,
        borderWidth: 2,
        borderColor: t.hazard,
      }}
    />
  );
});

/**
 * A crusher's block: from its wall out to `face`, `depth` deep along the run,
 * with a row of teeth down the face that comes out at the ball.
 */
export const Crusher = React.memo(function CrusherShape({
  wall,
  face,
  y,
  depth,
}: {
  wall: number;
  face: number;
  y: number;
  depth: number;
}) {
  const t = useTheme();
  // Always a sliver of it showing at the wall, so a crusher at rest still
  // reads as one waiting to come out.
  const out = wall < face ? Math.max(face, wall + 10) : Math.min(face, wall - 10);
  const lo = Math.min(wall, out);
  const hi = Math.max(wall, out);
  const toward = out > wall ? 1 : -1;
  const tooth = 9;
  const teeth = [];
  const n = Math.max(2, Math.floor(depth / (tooth + 3)));
  for (let i = 0; i < n; i++) {
    teeth.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: out - tooth / 2 + (toward * tooth) / 3,
          top: y - depth / 2 + ((i + 0.5) * depth) / n - tooth / 2,
          width: tooth,
          height: tooth,
          backgroundColor: t.blade,
          transform: [{ rotate: '45deg' }],
        }}
      />,
    );
  }
  return (
    <>
      {teeth}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: lo,
          top: y - depth / 2,
          width: hi - lo,
          height: depth,
          borderRadius: 4,
          backgroundColor: t.hazard,
          borderWidth: 2,
          borderColor: t.hazardEdge,
        }}
      />
    </>
  );
});

/** An orbiter's hub: a small dark boss for its spokes to meet at. */
export const Hub = React.memo(function HubShape({ x, y }: { x: number; y: number }) {
  const t = useTheme();
  const r = 8;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: t.pole,
        borderWidth: 2,
        borderColor: t.poleBack,
      }}
    />
  );
});

const styles = StyleSheet.create({
  rod: { position: 'absolute', borderRadius: 4 },
});

// A small arrow: long enough to read as a push, short enough not to crowd the
// line it points at. It creeps this far toward that line and back again.
const ARROW_W = 17;
const ARROW_H = 7;
const ARROW_DRIFT = 5;

/**
 * A wind band: a faint lane with a column of small arrows showing which way it
 * blows. The arrows are evenly spaced down the band and all point the same
 * way, so it reads as a push rather than as something to dodge. Each one
 * creeps toward the line it points at and eases back -- a breath in place,
 * not travel down the band.
 */
export const Wind = React.memo(function WindShape({
  x,
  y,
  width,
  height,
  side,
  t: time,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  side: 1 | -1;
  /** The run clock, in seconds: what the drift is read off. */
  t: number;
}) {
  const t = useTheme();
  // One arrow per ~70px of band, kept inside the range the reference uses.
  const n = Math.max(5, Math.min(9, Math.round(height / 70)));
  // The column rides the edge the band blows toward, not the middle: the band
  // has to stay wide enough to catch the ball, but the arrows only read as
  // reaching for the line if they sit right up against it.
  const inset = ARROW_W / 2 + ARROW_DRIFT + 8;
  const lead = side === 1 ? width - inset : inset;
  const arrows = [];
  for (let i = 0; i < n; i++) {
    // Inset half a step at each end so the column sits inside the band.
    const cy = ((i + 0.5) / n) * height;
    // Each arrow leans over a beat behind the one above it, so the column
    // ripples toward the line rather than sliding across as one block.
    const drift = Math.sin(time * 2.6 - i * 0.45) * ARROW_DRIFT;
    arrows.push(
      <View
        key={i}
        style={{
          position: 'absolute',
          left: lead - ARROW_W / 2 + drift * side,
          top: cy - ARROW_H / 2,
          width: ARROW_W,
          height: ARROW_H,
          flexDirection: 'row',
          alignItems: 'center',
          transform: [{ scaleX: side }],
        }}
      >
        <View
          style={{ width: ARROW_W - 6, height: 1.5, backgroundColor: t.ink }}
        />
        <View
          style={{
            width: 0,
            height: 0,
            borderTopWidth: ARROW_H / 2,
            borderBottomWidth: ARROW_H / 2,
            borderLeftWidth: 6,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: t.ink,
          }}
        />
      </View>,
    );
  }
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - width / 2,
        top: y,
        width,
        height,
        backgroundColor: t.ring,
        opacity: 0.35,
      }}
    >
      {arrows}
    </View>
  );
});
