/* eslint-disable react-native/no-inline-styles -- every shape is positioned per frame */
import React from 'react';
import { View } from 'react-native';
import {
  CAM_ANCHOR,
  FIXED_DT,
  HALF_W,
  LEAN_MAX,
  RISE_MAX,
  SPIKE_H,
  STAGE_H,
  TRAIL_POINTS,
  clamp,
  spikeState,
  viewScale,
} from '../game/config';
import {
  BRACKET_HALVES,
  bracketCorners,
  bracketSide,
  capsuleX,
  capsuleY,
  crusherFace,
  dropX,
  frameCorner,
  gearPos,
  orbiterPos,
  pendulumPos,
  propsNear,
  railReach,
  swayX,
  viewOf,
  zipperY,
} from '../game/engine';
import type { World } from '../game/types';
import { worldOf } from '../game/worlds';
import Backdrop from './Backdrop';
import {
  Ball,
  Bar,
  Bracket,
  Capsule,
  Crusher,
  Dot,
  Flag,
  Frame,
  Halo,
  Hatch,
  Hub,
  Plate,
  PopChip,
  Rod,
  Saw,
  Shot,
  Stand,
  StarChip,
  Turret,
  TvBox,
  Wheel,
  Wind,
} from './entities';
import RunWord, { WORD_SPAN, WORD_X, WORD_Y, wordPhase } from './RunWord';
import { mixHex, useTheme } from './theme';
import Walls from './Walls';
import FloorSpikes from './FloorSpikes';
import Scenery from './Scenery';

/** How far below the screen a prop eases in from. */
const ENTER_ZONE = 130;

export default function GameView({
  world,
  W,
  H,
  alpha = 1,
}: {
  world: World;
  W: number;
  H: number;
  /**
   * How far past the last whole simulation step this refresh of the screen
   * fell, 0 to 1. The loop hands over whatever is left in its accumulator.
   *
   * Everything below is drawn at that instant rather than at the last step,
   * so a screen refreshing faster than the world is stepped -- which is every
   * 90Hz and 120Hz phone -- moves the ball on every single refresh instead of
   * standing it still for a third or a half of them. Defaulted to 1 for the
   * callers drawing a world nobody is stepping: a test, or a portrait of the
   * ball, wants simply the state the world is in.
   */
  alpha?: number;
}) {
  const theme = useTheme();
  // The one place the interpolation happens. Read `view` from here down and
  // never the world's own `t`, `camY` or ball position: those are the last
  // whole step, and mixing the two would draw a corridor that ticks behind a
  // ball that glides.
  const view = viewOf(world, alpha);
  // How far back along its own line a thing that travels in a straight one --
  // a shot, a spark -- has to be drawn to sit at the same instant the ball is
  // drawn at. Those move by a velocity rather than off `view.t`, so they get
  // the same fraction of a step taken back off them by hand.
  const back = (1 - clamp(alpha, 0, 1)) * FIXED_DT;
  // The tail runs the ball's own gradient backwards: violet where it leaves
  // the ball, orchid by the time it has faded out. Built per palette rather
  // than per frame -- the segments move sixty times a second and their colours
  // never do, and a fresh string each frame would be a fresh prop each frame.
  const tailInk = React.useMemo(
    () =>
      Array.from({ length: TRAIL_POINTS }, (_, i) =>
        mixHex(theme.ballBody, theme.ballWarm, i / Math.max(1, TRAIL_POINTS - 1)),
      ),
    [theme.ballBody, theme.ballWarm],
  );
  const scale = viewScale(H);
  // The box the corridor is drawn into, in screen px, before the quarter turn
  // that puts it on the glass: as wide as the screen is tall and as tall as
  // the screen is wide. Everything from here down is in the corridor's own
  // axes -- x across the corridor, y along the run -- and the turn at the
  // bottom of this file is the single place those become screen axes.
  const BW = H;
  const BH = W;
  // The same two, in world px. `VW` is the corridor and its walls, fitted to
  // the screen's short side by `viewScale`; `VH` is how much of the run is on
  // screen, which is what the landscape lock is really being spent on.
  const VW = BW / scale;
  const VH = BH / scale;
  // The corridor is centred; world X runs from -HALF_W to +HALF_W around it.
  const cx = VW * 0.5;

  // The camera is one transform on the layer rather than a subtraction baked
  // into every shape's `top`. That way a prop that is not itself moving keeps
  // the exact same props frame after frame, and React.memo drops its whole
  // subtree from the render -- which is most of what is on screen. The frame
  // budget is what the finger feels, so this is what keeps the ball under it.
  //
  // Positions are quoted relative to the stage the camera is in, so they stay
  // small numbers instead of climbing into the tens of thousands; `base` only
  // changes when a stage boundary goes by.
  const base = Math.floor(view.camY / STAGE_H) * STAGE_H;
  const ly = (y: number) => y - base;
  // Progress runs downward: what the ball has not reached yet sits below it.
  // Screen space, still needed to decide what is worth drawing at all.
  const sy = (y: number) => VH * CAM_ANCHOR + (y - view.camY);
  // Everything eases up into place over its last stretch below the screen,
  // rather than just appearing -- this is purely cosmetic: by the time a prop
  // is close enough to matter for collision it has long since settled, so it
  // never touches the hitboxes computed from the true world position.
  const enterDY = (top: number) =>
    top > VH - ENTER_ZONE ? clamp((top - (VH - ENTER_ZONE)) / ENTER_ZONE, 0, 1) * 22 : 0;

  const nodes: React.ReactNode[] = [];

  // The word painted across the opening corridor. Pushed before the props so
  // the pipe, the blades and the ball all pass over the top of it.
  const wordTop = sy(WORD_Y);
  const word = wordPhase(view.t, world.ball.y);
  // Faded right out counts as gone: past the triangle there is nothing left to
  // draw, and the node goes with it rather than sitting there at zero.
  if (word.fade > 0.001 && wordTop > -WORD_SPAN && wordTop < VH + WORD_SPAN) {
    nodes.push(
      <RunWord
        key="word"
        x={cx + WORD_X}
        y={ly(WORD_Y)}
        color={theme.ink}
        progress={word.progress}
        fade={word.fade}
      />,
    );
  }

  // --- props --------------------------------------------------------------
  // Only the props within a couple of buckets of the ball: by the last stage
  // the level holds several hundred, and walking all of them every frame was
  // most of what the descent was spending its budget on.
  for (const p of propsNear(world, world.ball.y)) {
    if (p.taken && p.kind !== 'flag' && p.kind !== 'plate') continue;
    const screenTop = sy(p.y);
    if (screenTop + p.span < -260 || screenTop > VH + 260) continue;
    const px = cx + p.x;
    const dy = enterDY(screenTop);
    const top = ly(p.y) + dy;

    switch (p.kind) {
      case 'pipe':
        nodes.push(<Rod key={`pi${p.id}`} x={px} top={top} height={p.span} />);
        break;

      case 'gear': {
        const g = gearPos(p, view.t);
        const gy = ly(g.y) + dy;
        if (p.ring > 0) {
          // A ringed blade goes round its pipe on the ring, so the ring is
          // drawn on the pipe as the track and there is no rail.
          nodes.push(<Halo key={`gh${p.id}`} x={px} y={top} r={p.ring} flat={false} />);
        } else {
          // A light rail marks the full reach; the blade telescopes along it.
          nodes.push(
            <Bar
              key={`ga${p.id}`}
              x={px}
              y={gy}
              len={railReach(p)}
              rot={p.side === 1 ? 0 : Math.PI}
              thick={4}
              color={theme.ring}
              edge={theme.poleBack}
            />,
          );
        }
        nodes.push(
          <Saw key={`gs${p.id}`} x={cx + g.x} y={gy} size={p.size} rot={view.t * p.spin} />,
        );
        break;
      }

      case 'capsule': {
        // The pill rocks up and down its line; the halo rides with it so the
        // two never drift apart.
        const cy = ly(capsuleY(p, view.t)) + dy;
        nodes.push(<Halo key={`ch${p.id}`} x={px} y={cy} r={44} />);
        nodes.push(<Capsule key={`cp${p.id}`} x={cx + capsuleX(p)} y={cy} />);
        break;
      }

      case 'bigWheel':
        nodes.push(
          <Wheel
            key={`bw${p.id}`}
            x={cx + swayX(p, view.t)}
            y={top}
            radius={p.radius}
            reach={p.reach}
            rot={p.angle + p.spin * view.t}
          />,
        );
        break;

      case 'triangle':
      case 'square':
      case 'hexagon': {
        const sides = p.kind === 'triangle' ? 3 : p.kind === 'hexagon' ? 6 : 4;
        // Take the drawn rotation straight from the collision corner, so the
        // shape the player sees is exactly the shape they are flying against.
        const c0 = frameCorner(p, view.t, 0, sides);
        // Warm kills, cool does not. A hexagon is a cage the ball is meant to
        // fly in through -- nothing collides with the outline, only with the
        // saws strung inside it -- so it is drawn in the rails' violet, like
        // every other member of the corridor that may be crossed. The solid
        // frames, which do end the run on contact, stay hazard red.
        const cage = p.kind === 'hexagon';
        nodes.push(
          <Frame
            key={`fr${p.id}`}
            x={px}
            y={top}
            radius={p.radius}
            sides={sides}
            rot={Math.atan2(c0.y - p.y, c0.x - p.x)}
            color={cage ? theme.pole : undefined}
            edge={cage ? theme.poleBack : undefined}
          />,
        );
        break;
      }

      case 'bracket': {
        // Corners come back in world space; shift them into the layer the same
        // way every other prop is, so rotation and translation line up exactly
        // with the collision the player feels. Both halves read the one prop
        // angle, so the pair is drawn turning together, as it collides.
        for (const half of BRACKET_HALVES) {
          const corners = bracketCorners(p, view.t, half).map(c => ({
            x: cx + c.x,
            y: ly(c.y) + dy,
          }));
          nodes.push(
            <Bracket key={`bk${p.id}.${half}`} corners={corners} side={bracketSide(half)} />,
          );
        }
        break;
      }

      case 'turret':
        nodes.push(
          <Turret key={`tu${p.id}`} x={px} y={top} size={p.size} side={p.side} hot={p.phase > 0} />,
        );
        break;

      case 'wind':
        nodes.push(
          <Wind
            key={`wd${p.id}`}
            x={px}
            y={top}
            width={p.size}
            height={p.span}
            side={p.side}
            t={view.t}
          />,
        );
        break;

      case 'tvBox':
        nodes.push(<TvBox key={`tv${p.id}`} x={px} y={top} size={p.size} />);
        break;

      case 'star':
        nodes.push(<StarChip key={`st${p.id}`} x={px} y={top} />);
        break;

      case 'flag':
        nodes.push(<Flag key={`fl${p.id}`} x={px} y={top} />);
        break;

      case 'plate':
        nodes.push(<Plate key={`pl${p.id}`} x={px} y={top} size={p.size} />);
        break;

      case 'stand':
        nodes.push(<Stand key={`sd${p.id}`} x={px} y={top} size={p.size} />);
        break;

      case 'dropSaw':
        nodes.push(<Hatch key={`dh${p.id}`} x={px} y={top} side={p.side} />);
        nodes.push(
          <Saw
            key={`ds${p.id}`}
            x={cx + dropX(p, view.t)}
            y={top}
            size={p.size}
            rot={view.t * p.spin}
          />,
        );
        break;

      case 'pendulum': {
        const b = pendulumPos(p, view.t);
        const by = ly(b.y) + dy;
        nodes.push(
          <Bar
            key={`pn${p.id}`}
            x={px}
            y={top}
            len={p.reach}
            rot={Math.atan2(by - top, cx + b.x - px)}
            thick={5}
          />,
        );
        nodes.push(<Hub key={`ph${p.id}`} x={px} y={top} />);
        nodes.push(
          <Saw key={`ps${p.id}`} x={cx + b.x} y={by} size={p.size} rot={view.t * p.spin} />,
        );
        break;
      }

      case 'orbiter': {
        nodes.push(<Halo key={`oh${p.id}`} x={px} y={top} r={p.reach} flat={false} />);
        for (let i = 0; i < p.count; i++) {
          const b = orbiterPos(p, view.t, i);
          const by = ly(b.y) + dy;
          nodes.push(
            <Bar
              key={`ob${p.id}.${i}`}
              x={px}
              y={top}
              len={p.reach}
              rot={Math.atan2(by - top, cx + b.x - px)}
              thick={3}
            />,
          );
          nodes.push(
            <Saw
              key={`os${p.id}.${i}`}
              x={cx + b.x}
              y={by}
              size={p.size}
              rot={view.t * p.spin}
            />,
          );
        }
        nodes.push(<Hub key={`oc${p.id}`} x={px} y={top} />);
        break;
      }

      case 'zipper':
        nodes.push(<Rod key={`zr${p.id}`} x={px} top={top} height={p.span} />);
        nodes.push(
          <Saw
            key={`zs${p.id}`}
            x={px}
            y={ly(zipperY(p, view.t)) + dy}
            size={p.size}
            rot={view.t * p.spin}
          />,
        );
        break;

      case 'crusher':
        nodes.push(
          <Crusher
            key={`cr${p.id}`}
            wall={px}
            face={cx + crusherFace(p, view.t)}
            y={top}
            depth={p.size}
          />,
        );
        break;
    }
  }

  // --- shots and debris ---------------------------------------------------
  for (const b of world.bullets) {
    const y = sy(b.y);
    if (y < -60 || y > VH + 60) continue;
    nodes.push(
      <Shot
        key={`bt${b.id}`}
        x={cx + b.x - b.vx * back}
        y={ly(b.y - b.vy * back)}
        rot={Math.atan2(b.vy, b.vx)}
      />,
    );
  }
  for (const q of world.particles) {
    const y = sy(q.y);
    if (y < -40 || y > VH + 40) continue;
    nodes.push(
      <Dot
        key={`pa${q.id}`}
        x={cx + q.x}
        y={ly(q.y)}
        size={q.size}
        gold={q.hue === 1}
        fade={Math.min(1, q.life * 2)}
      />,
    );
  }
  for (const q of world.pops) {
    const y = sy(q.y);
    if (y < -40 || y > VH + 40) continue;
    nodes.push(
      <PopChip
        key={`po${q.id}`}
        x={cx + q.x}
        y={ly(q.y)}
        label={q.label}
        fade={Math.min(1, q.life * 3)}
      />,
    );
  }

  // --- the ball and its tail ----------------------------------------------
  if (!world.ballHidden) {
    // The tail is the path actually travelled, so it bends with every dodge.
    const tr = world.ball.trail;
    const pts = tr.length / 2;
    for (let i = 0; i + 1 < pts; i++) {
      const x0 = cx + tr[i * 2];
      const y0 = ly(tr[i * 2 + 1]);
      const x1 = cx + tr[i * 2 + 2];
      const y1 = ly(tr[i * 2 + 3]);
      nodes.push(
        <Bar
          key={`tl${i}`}
          x={x0}
          y={y0}
          len={Math.hypot(x1 - x0, y1 - y0) + 1}
          rot={Math.atan2(y1 - y0, x1 - x0)}
          thick={3.6 * (1 - i / pts) + 0.6}
          color={tailInk[Math.min(tailInk.length - 1, i)]}
        />,
      );
    }
    // Always drawn solid. A respawned ball used to be dimmed while it was
    // immune, which is gone along with the immunity -- the ball the player
    // steers is the ball that dies, so it is never a half-there one.
    // The ball is drawn knowing how it is flying, not just where it is: the
    // eyes turn into the steer and the face narrows on a climb, so a hold and
    // a tap both read off the ball itself rather than only off the corridor
    // going past it.
    nodes.push(
      <Ball
        key="ball"
        x={cx + view.ballX}
        y={ly(view.ballY)}
        scale={1}
        // Both of these are in the box's axes, not the screen's, so they come
        // out of the turn pointing the right way: `look` is across the
        // corridor, which is the jump, and `rise` is along it, which is the
        // drag. So the ball turns its eyes into a tap and leans into a nudge.
        look={clamp(world.ball.vx / RISE_MAX, -1, 1)}
        rise={clamp(-world.ball.lean / LEAN_MAX, -1, 1)}
      />,
    );
  }

  const shake = view.t < world.shakeUntil ? (Math.random() - 0.5) * 10 : 0;
  // The camera ride, folded in with the shake. Applied after the scale, so it
  // is measured in world units like everything inside the layer.
  const camY = VH * CAM_ANCHOR - view.camY + base;

  // How much daylight is let through behind the corridor: the clouds and the
  // creatures in `dim`, the sky itself in `skyDim`. Both are none.
  //
  // The sky here is a pastel day -- a periwinkle that warms through lilac to a
  // near-white rose -- and the corridor is drawn in the palette's deep-space
  // night. Thinning one over the other does not make a dark room; it makes a
  // wash, and because the sky is a *gradient* the wash is not even one colour.
  // At a fifth it ran from `#261B54` at the top of the screen to `#423759` at
  // the bottom: a mauve-grey, the flattest value in the game, and the third of
  // the screen the ball actually lives in, since `CAM_ANCHOR` is 0.34. The
  // same hurdle was legible at the top and nearly gone at the bottom -- the
  // hurdle got harder to see the closer it came to the player.
  //
  // It broke the two shapes that fill with the ground on purpose, as well. A
  // saw's `bladeCore` and the face of a `TvBox` take `bg` so they read as a
  // hole punched through; over a wash they are *darker* than what surrounds
  // them, so the hole reads as a black disc glued on.
  //
  // So no daylight is laid over the run: it stands on its own ground, which is
  // water -- `bgTop`/`bgBot`, which is the same day the rest of the game
  // stands in, at the depth the light has reached by the time it is down here.
  // What is built on top of it is a place rather than a sky: see `Water`,
  // below. That layer stays within the same rule the wash broke, since a
  // surface glow, a fan of light and a few bubbles are lit things drawn *in*
  // the room rather than a second ground laid over the first, and every one of
  // them is far enough under `bg` in value that the two shapes filled with it
  // stay holes punched through the corridor.
  //
  // This is the game's declared shape rather than a step on the way to
  // something else: there are two grounds, and which one a screen stands on is
  // decided by whether the ball is in play. Outside the corridor -- the front
  // page, the door, the road, the board -- it is the pastel day, because what
  // is drawn there is a logo, some buttons and a crowd of soft creatures, none
  // of it lit, all of it happier in daylight. Inside the corridor it is deep
  // water, because every single thing the player reads down here is emitting
  // light, and lit things need a dark room to be read in.
  //
  // What was wrong was never that there were two. It was that they were being
  // mixed into each other a fifth at a time, on a screen that then belonged to
  // neither. The backdrop stays in the tree at zero so the one knob that says
  // which ground this screen is on stays visible at the place it is used.
  const dim = 0;
  const skyDim = 0;

  // The quarter turn, and the only one in the game.
  //
  // Everything inside it is drawn exactly as it always was -- the corridor
  // running down a tall box with a wall either side of it -- and the turn is
  // what lays that box across a screen held sideways: the run reads left to
  // right, and the corridor's two walls become the ceiling and the floor.
  //
  // It is one transform on one node rather than a rotation worked into every
  // shape's position, which is what keeps `Walls`, `Water`, `Backdrop` and
  // every prop in `entities` written in the corridor's own axes, and keeps the
  // levels authored in them too. The three places type appears inside the box
  // turn themselves back -- see `UPRIGHT` -- and they are the only exceptions.
  //
  // `-90deg` rather than `90deg`: it is the turn that sends the box's downward
  // axis, which is the run, to the right of the screen. The other one would
  // send it left and the level would come at the player backwards.
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          left: (W - BW) / 2,
          top: (H - BH) / 2,
          width: BW,
          height: BH,
          transform: [{ rotate: '-90deg' }],
        }}>
        <Backdrop camY={view.camY} width={BW} height={BH} dim={dim} skyDim={skyDim} />
        {/* And the world the level is flown in: its sky, its ground and what
          drifts through it -- leaves, snow, embers, stars. It goes between the
          ground and the corridor, so the rods and the blades read in front of
          it, and it keeps off the blade's red and the coin's gold, so nothing
          in it is mistaken for a pickup or for something that kills. */}
        <Scenery world={worldOf(world.level).id} camY={view.camY} width={BW} height={BH} />
        {/* The two walls the corridor runs between, and the water outside them
          falling away into the dark. Above the room and under the corridor:
          nothing it draws is over the run, so the shapes filled with `bg`
          still read as holes and a shot crossing the line from a wall
          launcher is drawn in front of it. The corridor is centred on the
          screen, so half of it lands at `HALF_W` times the view scale. */}
        <Walls width={BW} height={BH} wall={HALF_W * scale} />
        {/* The floor's spikes, when they are up. Quantised so the memo holds
          for the whole of the time they stand still. */}
        <FloorSpikes
          width={BW}
          height={BH}
          wall={HALF_W * scale}
          tall={SPIKE_H * scale}
          out={world.spikes ? Math.round(spikeState(world.spikeClock).out * 10) / 10 : 0}
        />
        <View
          style={{
            position: 'absolute',
            left: (BW - VW) / 2,
            top: (BH - VH) / 2,
            width: VW,
            height: VH,
            transform: [{ scale }, { translateX: shake }, { translateY: camY + shake * 0.5 }],
          }}>
          {nodes}
        </View>
      </View>
    </View>
  );
}
