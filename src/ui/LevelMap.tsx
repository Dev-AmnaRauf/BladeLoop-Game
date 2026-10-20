/* eslint-disable react-native/no-inline-styles -- the road is laid out by hand */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, WORLD_SIGN } from './theme';
import { starsIn } from '../game/engine';
import { BOSS_LEVEL, LEVEL_COUNT, levelAt } from '../game/level';
import { type WorldDef, opensWorld, worldOf } from '../game/worlds';
import Button, { IconButton } from './Button';
import Icon from './Icon';
import { useLayout } from './layout';
import { StarArc } from './Stars';
import { TYPE } from './type';

/**
 * The road between the levels.
 *
 * The game's levels are a line, not a grid: one leads to the next and the
 * only choice a player has is how far back down it to go. So the page draws
 * the line -- a wide pale path winding up a lavender page with a bead on it
 * for every level, the cleared ones behind and the ones still shut ahead.
 *
 * It reads from the bottom up. The lowest level on the page sits at its foot
 * and the highest at the top, so the road climbs the way progress does and the
 * thing the player is working toward is the thing furthest away.
 *
 * The road has no end. Past the twenty authored levels the game keeps dealing
 * corridors, so the page draws a window onto the road rather than the whole of
 * it -- the stops around where the player is, a few locked ones ahead, and the
 * ones behind them dragged back into view a stretch at a time. A page that
 * mounted every stop would be mounting thousands of them for a player who has
 * been at this a while, and the only thing that would change on screen is how
 * long the scroll bar is.
 *
 * What is on it is exactly what the save knows: the stars each level is worth
 * thrown over the beads that have been cleared, filled for the ones actually
 * picked up, and a grey bead on everything past the next level. There is no
 * energy meter, no daily chest, no sale and no streak on this page, because
 * there is no energy, no chest, no sale and no streak behind it -- a road that
 * showed them would be advertising a game that is not here.
 */

/** Vertical distance between one stop on the road and the next, in px. */
const STEP = 152;
/**
 * How much of the endless road is drawn: locked stops past the one the player
 * is up to, and cleared ones behind it. Dragging the page to its foot pulls
 * another `BEHIND`-worth of the walked road back into view.
 */
const AHEAD = 5;
const BEHIND = 24;
/** How near the foot of the road counts as asking for more of it, in px. */
const REACH_EDGE = 48;
/** How far the road wanders either side of the middle, as a share of the lane. */
const SWING = 0.27;

/**
 * The widest the road's own lane is allowed to get, in dp.
 *
 * The road is a sine wound down a column, and the column used to be the whole
 * page. That was right when the page was a phone held upright and the whole
 * page was 390dp across. The game is sideways throughout now and the page is
 * better than twice that, and a sine swung across all of it is not a road any
 * more -- it is a flat zigzag with its stops parked against the two edges of
 * the screen, under the back button at one end and the play pill at the other.
 *
 * So the road keeps a lane the width it always had and the lane is centred in
 * whatever the page turns out to be. The weather behind it still uses the
 * whole width: sky is the one thing on this page that should run to the edges.
 */
const LANE_MAX = 420;
/** Clear air above the last stop and below the first. */
const HEAD = 150;
const FOOT = 150;

/** Height the stars over a bead take, and the crown over the last one. */
const ARC_H = 22;
const CROWN_H = 22;

/** Diameter of a bead, and of the one the player is on. */
const NODE = 62;
const NODE_LIVE = 76;

/** How many straight pieces one leg of the road is drawn out of. */
const PIECES = 12;
/**
 * Width of the pale band the road is drawn as, and of the lane inside it.
 *
 * It is a broad soft path rather than a line: the beads sit *on* the road at
 * this width, which is what makes the page read as one winding thing with
 * stops along it instead of as a column of buttons joined by a wire.
 */
const ROAD_W = 92;
const LANE_W = 52;

/**
 * The weather behind the road.
 *
 * The page used to be a flat lavender field with a road on it, which read as
 * a diagram of the levels rather than as somewhere the road goes. So the sky
 * is given some depth: banks of cloud stacked all the way up it, the pale
 * ones set further back than the bright ones, and specks of light scattered
 * between them. None of it is a control and none of it moves -- it scrolls
 * with the road, so climbing the page is climbing past weather.
 *
 * `CLOUD_STEP` is how far apart the banks are stacked; everything else about
 * one -- which side it sits, how big it is, which of the two tints it wears --
 * is the index run through `wobble`, so the sky is laid out the same way on
 * every open instead of reshuffling itself under the player.
 */
const CLOUD_STEP = 190;
/** How far up and down a bank drifts off its slot, as a share of the step. */
const CLOUD_JITTER = 0.34;
/** Width of a bank at scale 1, and its height. */
const CLOUD_W = 168;
const CLOUD_H = 62;

/** Specks of light between the banks: how many per bank, and how big. */
const SPARKS = 2;
const SPARK_R = 3;

/**
 * A repeatable number in 0..1 off an integer. Not random: the page has to lay
 * its sky out the same way every time it is opened, and a `Math.random` in a
 * render would reshuffle the clouds on every frame the road was dragged.
 */
function wobble(i: number, salt: number) {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Where stop `i` sits, `i` being 0 for the lowest level on the page.
 *
 * The road is a sine rather than a strict left-right zigzag: a zigzag turns
 * corners and this has to read as something a thing could travel along. The
 * half-step in the phase keeps level one off the centre line, so the very
 * first thing on the page is already a curve.
 */
function stopAt(i: number, lane: number, height: number, laneX: number) {
  return {
    x: laneX + lane / 2 + Math.sin((i + 0.5) * 0.85) * lane * SWING,
    y: height - FOOT - i * STEP,
  };
}

/** A point along the leg from `a` to `b`, bowed out the way the road bends. */
function along(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
  bow: number,
) {
  // One control point, pushed sideways off the midpoint: enough to turn a
  // straight line between two stops into a piece of the same wandering road.
  const cx = (a.x + b.x) / 2 + bow;
  const cy = (a.y + b.y) / 2;
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
    y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
  };
}

export default function LevelMap({
  /** How many levels have been cleared, and so which beads are behind. */
  cleared,
  /** The level the page opens focused on and the play button will start. */
  level,
  /** Stars picked up per level, keyed by level number. See `Progress`. */
  stars,
  onPick,
  onPlay,
  onBack,
}: {
  cleared: number;
  level: number;
  stars?: Record<string, number>;
  onPick: (level: number) => void;
  onPlay: () => void;
  onBack: () => void;
}) {
  const { w: width, h: height, top, bottom, gutL, gutR } = useLayout();
  // The road's own lane, and where its left edge falls on the page. Both are
  // measured inside the gutters, so a cutout down the side of a phone held
  // sideways never has a bead under it. See `LANE_MAX`.
  const lane = Math.min(LANE_MAX, Math.max(0, width - gutL - gutR));
  const laneX = gutL + (width - gutL - gutR - lane) / 2;
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // The hardware back button leaves the map, the way it leaves any page.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // The furthest level the player may open: everything cleared, plus the next.
  // Nothing caps it -- the levels past the authored twenty are built on demand.
  const unlocked = cleared + 1;
  /** How much further back down the road the player has dragged the page. */
  const [reach, setReach] = useState(0);

  // The window: the walked road behind the player, and a few shut stops ahead.
  // It never starts above level one, and it never shows fewer stops than the
  // authored game has, so a fresh save still opens on the whole first twenty.
  const first = Math.max(1, unlocked - BEHIND - reach);
  const last = Math.max(LEVEL_COUNT, unlocked + AHEAD);
  const shown = last - first + 1;

  const defs = useMemo(
    () => Array.from({ length: shown }, (_, i) => levelAt(first + i)),
    [first, shown],
  );

  // The road is as tall as the window it is drawing, and grows downward as
  // more of it is pulled back: a stop's distance from the top of the page is
  // its level's, so nothing already on screen moves when the page gets taller.
  const roadH = HEAD + FOOT + (shown - 1) * STEP;

  const stops = useMemo(
    () => defs.map((_, i) => stopAt(i, lane, roadH, laneX)),
    [defs, lane, laneX, roadH],
  );

  /**
   * Dragged to the foot of the road: hand back another stretch of it.
   *
   * Only ever downwards, and only while there is road left to give. The new
   * stops are laid below everything already drawn, so the page grows under the
   * player's thumb rather than shifting what they are looking at.
   */
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (first <= 1) return;
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const left =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (left <= REACH_EDGE) setReach(r => r + BEHIND);
    },
    [first],
  );

  // Open on the level the player is about to play rather than at the bottom of
  // a road they have already walked. Laid out bottom-up, so the offset is
  // measured down from the top of the road.
  useEffect(() => {
    const focus = stops[Math.min(stops.length - 1, Math.max(0, level - first))];
    const to = Math.max(0, focus.y - height * 0.55);
    // Without the frame's delay the ScrollView has not been measured yet and
    // the scroll is thrown away.
    const id = setTimeout(
      () => scroller.current?.scrollTo({ y: to, animated: false }),
      0,
    );
    return () => clearTimeout(id);
    // Only on the way in: scrolling back to the focus every time the player
    // taps a different stop would fight the hand that is scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The weather, laid out once per size of page. It is drawn before the road
  // and never over it: a cloud in front of the path would read as a level the
  // player cannot get to.
  const sky = useMemo(() => {
    const out: React.ReactNode[] = [];
    const banks = Math.ceil(roadH / CLOUD_STEP) + 1;
    for (let i = 0; i < banks; i++) {
      const y =
        roadH - i * CLOUD_STEP - CLOUD_STEP * CLOUD_JITTER * wobble(i, 1);
      // Alternating sides, nudged off the edge they are on: two banks in a row
      // on the same side leaves a bare stripe down the other half of the page.
      const side = i % 2 ? 1 : -1;
      const x = width / 2 + side * width * (0.24 + 0.16 * wobble(i, 2));
      const scale = 0.62 + 0.55 * wobble(i, 3);
      out.push(
        <Cloud
          key={`c${i}`}
          x={x}
          y={y}
          scale={scale}
          tint={wobble(i, 4) > 0.5 ? COLORS.mapCloudHi : COLORS.mapCloud}
        />,
      );
      for (let k = 0; k < SPARKS; k++) {
        const sx = width * (0.08 + 0.84 * wobble(i * 3 + k, 5));
        const sy = y - CLOUD_STEP * (0.3 + 0.5 * wobble(i * 3 + k, 6));
        const r = SPARK_R * (0.7 + 0.8 * wobble(i * 3 + k, 7));
        out.push(
          <View
            key={`s${i}.${k}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: sx,
              top: sy,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: COLORS.mapSpark,
              opacity: 0.75,
            }}
          />,
        );
      }
    }
    return out;
  }, [roadH, width]);

  const road = useMemo(() => {
    // Every band first and every lane after, rather than a band and a lane per
    // piece: the pieces overlap, so a lane laid down early would be painted
    // back over by the next piece's band.
    const bands: React.ReactNode[] = [];
    const lanes: React.ReactNode[] = [];
    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      // Bow the leg away from the middle, so consecutive legs curve opposite
      // ways and the whole road reads as one S rather than a row of arcs. Off
      // the lane's middle rather than the page's: the lane is the road.
      const bow =
        (a.x + b.x) / 2 - (laneX + lane / 2) > 0 ? lane * 0.11 : -lane * 0.11;
      for (let k = 0; k < PIECES; k++) {
        const p = along(a, b, k / PIECES, bow);
        const q = along(a, b, (k + 1) / PIECES, bow);
        const len = Math.hypot(q.x - p.x, q.y - p.y) + ROAD_W;
        const rot = Math.atan2(q.y - p.y, q.x - p.x);
        // The band, and the lighter lane that runs inside it. Both are tints
        // of the page's own lavender, so the road is one soft shape the beads
        // sit on rather than a second colour arriving from nowhere.
        bands.push(
          <View
            key={`r${i}.${k}`}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y - ROAD_W / 2,
              width: len,
              height: ROAD_W,
              borderRadius: ROAD_W / 2,
              backgroundColor: COLORS.mapRoad,
              transform: [{ rotate: `${rot}rad` }],
              transformOrigin: 'left center',
            }}
          />,
        );
        lanes.push(
          <View
            key={`l${i}.${k}`}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y - LANE_W / 2,
              width: len - (ROAD_W - LANE_W),
              height: LANE_W,
              borderRadius: LANE_W / 2,
              backgroundColor: COLORS.mapLane,
              transform: [{ rotate: `${rot}rad` }],
              transformOrigin: 'left center',
            }}
          />,
        );
      }
    }
    return [...bands, ...lanes];
  }, [stops, lane, laneX]);

  return (
    <View style={[styles.root, { backgroundColor: COLORS.mapSky }]}>
      <ScrollView
        ref={scroller}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ height: roadH }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        {sky}
        {road}
        {defs.map((def, i) =>
          def.n === 1 || opensWorld(def.n) ? (
            <WorldSign
              key={`w${def.n}`}
              world={worldOf(def.n)}
              x={laneX + lane / 2}
              y={stops[i].y + STEP * 0.5}
              locked={def.n > unlocked}
            />
          ) : null,
        )}
        {defs.map((def, i) => (
          <Stop
            key={def.n}
            n={def.n}
            name={def.name}
            x={stops[i].x}
            y={stops[i].y}
            state={
              def.n > unlocked ? 'locked' : def.n <= cleared ? 'done' : 'live'
            }
            picked={def.n === level}
            boss={def.n === BOSS_LEVEL}
            lit={stars?.[def.n] ?? 0}
            total={starsIn(def.n)}
            onPress={onPick}
          />
        ))}
      </ScrollView>

      {/* The way back, over the road rather than scrolling with it. Inside
          the gutter, which held sideways is where the cutout and the curve of
          the corner are. */}
      <View style={[styles.top, { top: top + 8, left: gutL }]}>
        <IconButton icon="back" label="Back" onPress={onBack} />
      </View>

      {/* And the one thing the page is for, pinned to the bottom. Held to the
          road's own lane rather than run the width of the page: a pill as wide
          as a landscape screen reads as a banner rather than as a button. */}
      <View
        style={[
          styles.play,
          { paddingBottom: bottom + 14, paddingLeft: gutL, paddingRight: gutR },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.playPill, { maxWidth: lane }]}>
          <Button
            label={`PLAY LEVEL ${level}`}
            onPress={onPlay}
            icon="play"
            hero
          />
        </View>
      </View>
    </View>
  );
}

/**
 * The sign at the gate of a world: its name on a pill in the world's own
 * colour, set in the road between the last level of one world and the first
 * of the next. Shut worlds show the sign greyed with a lock on it, so the road
 * says where it is going before the player gets there.
 */
const WorldSign = React.memo(function WorldSignShape({
  world,
  x,
  y,
  locked,
}: {
  world: WorldDef;
  x: number;
  y: number;
  locked: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityLabel={`${world.name}${locked ? ', locked' : ''}`}
      style={[
        styles.sign,
        {
          top: y - SIGN_H / 2,
          left: x - SIGN_W / 2,
          backgroundColor: locked ? COLORS.nodeLock : WORLD_SIGN[world.id],
          borderColor: locked ? COLORS.nodeLockEdge : COLORS.inkOnLight,
        },
      ]}
    >
      {locked ? (
        <Icon name="lock" size={13} color={COLORS.nodeLockEdge} />
      ) : null}
      <Text
        style={[styles.signTxt, locked && { color: COLORS.nodeLockEdge }]}
        numberOfLines={1}
      >
        {world.name.toUpperCase()}
      </Text>
    </View>
  );
});

/**
 * One bank of cloud: a long base with puffs sitting on it, all of one flat
 * tint. Four shapes rather than one, because the silhouette is the whole of
 * what makes it read as cloud instead of as a lozenge.
 */
const Cloud = React.memo(function CloudShape({
  x,
  y,
  scale,
  tint,
}: {
  x: number;
  y: number;
  scale: number;
  tint: string;
}) {
  const w = CLOUD_W * scale;
  const h = CLOUD_H * scale;
  const puff = (left: number, bottom: number, d: number) => ({
    position: 'absolute' as const,
    left: w * left,
    bottom: h * bottom,
    width: h * d,
    height: h * d,
    borderRadius: h,
    backgroundColor: tint,
  });
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: w,
          height: h * 0.46,
          borderRadius: h,
          backgroundColor: tint,
        }}
      />
      <View style={puff(0.04, 0.16, 0.5)} />
      <View style={puff(0.26, 0.3, 0.7)} />
      <View style={puff(0.54, 0.2, 0.56)} />
      <View style={puff(0.78, 0.12, 0.44)} />
    </View>
  );
});

type State = 'done' | 'live' | 'locked';

/**
 * One stop on the road.
 *
 * Every one of them is a bead with its own number on its face, so the road can
 * be read at a glance as the count of levels it is. What tells them apart is
 * the colour of the bead and what is over it: a cleared level is violet and
 * wears the stars it is worth, the one the player is up to is bigger and
 * ringed in the only green on the page, and everything past it is slate. The
 * slate ones also keep a padlock, because colour alone would leave the page
 * unreadable to anyone who cannot separate the violet from the grey.
 */
const Stop = React.memo(function StopShape({
  n,
  name,
  x,
  y,
  state,
  picked,
  boss,
  lit,
  total,
  onPress,
}: {
  n: number;
  name: string;
  x: number;
  y: number;
  state: State;
  /** True on the stop the play button will open. */
  picked: boolean;
  boss: boolean;
  /** Stars won in this level, and how many it has. */
  lit: number;
  total: number;
  onPress: (level: number) => void;
}) {
  const live = state === 'live';
  const locked = state === 'locked';
  const d = live ? NODE_LIVE : NODE;
  const face = locked ? COLORS.nodeLock : COLORS.nodeDone;
  const edge = locked ? COLORS.nodeLockEdge : COLORS.nodeDoneEdge;
  const press = useCallback(() => onPress(n), [onPress, n]);

  // The stop the play button is aimed at breathes, so it is findable on a page
  // the player has scrolled away from. Native driver: it must cost the page
  // nothing while a finger is dragging the road past it.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!picked) return;
    const leg = (toValue: number) =>
      Animated.timing(pulse, {
        toValue,
        duration: 900,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    loop.start();
    return () => loop.stop();
  }, [pulse, picked]);
  const halo = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] });
  const fade = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.1],
  });

  return (
    // Hung off the bead's own centre rather than off the top of the column:
    // the arc above it, and the crown above that on the last level, are both
    // fixed heights, so this is what keeps every bead sitting *on* the road
    // instead of a crowned one riding below it.
    <View
      style={{
        position: 'absolute',
        left: x - 70,
        top: y - d / 2 - (boss ? CROWN_H + ARC_H : ARC_H),
        width: 140,
      }}
    >
      {boss && (
        <View style={styles.crown}>
          <Icon name="crown" size={26} color={COLORS.bossRim} />
        </View>
      )}

      {/* The stars the level is worth, over the top of its bead -- and only
          once it has been cleared. On a level the player has not reached, a
          row of empty sockets would be telling them how much they are missing
          on a page they cannot do anything about it from. */}
      <View style={styles.arc}>
        {state === 'done' ? (
          <StarArc lit={lit} total={total} size={boss ? 24 : 22} />
        ) : null}
      </View>

      <Pressable
        onPress={press}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={`Level ${n}, ${name}, ${
          state === 'done'
            ? `cleared, ${lit} of ${total} stars`
            : live
            ? 'next up'
            : 'locked'
        }`}
        style={styles.stop}
      >
        {picked && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: d * 1.42,
              height: d * 1.42,
              borderRadius: d * 0.71,
              borderWidth: 4,
              borderColor: COLORS.nodeLive,
              opacity: fade,
              transform: [{ scale: halo }],
            }}
          />
        )}

        {/* The bead: a dark under-edge with the face sat on top of it, which
            is what gives every loud shape in this game its depth without a
            single gradient. */}
        <View
          style={{
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: edge,
            alignItems: 'center',
            paddingBottom: 5,
            justifyContent: 'flex-start',
          }}
        >
          <View
            style={{
              width: d,
              height: d - 5,
              borderRadius: d / 2,
              backgroundColor: face,
              borderWidth: 3,
              borderColor: picked ? COLORS.nodeLive : edge,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* The gloss across the top of the bead. */}
            <View
              style={{
                position: 'absolute',
                top: d * 0.1,
                width: d * 0.6,
                height: d * 0.22,
                borderRadius: d * 0.3,
                backgroundColor: COLORS.onCard,
                opacity: 0.22,
              }}
            />
            <Text style={[styles.num, { fontSize: d * 0.4 }]}>{n}</Text>
          </View>
        </View>

        {locked && (
          <View style={[styles.lock, { borderColor: COLORS.nodeLockEdge }]}>
            <Icon name="lock" size={12} color={COLORS.nodeLockEdge} />
          </View>
        )}
      </Pressable>

      {picked && (
        <View style={styles.ready}>
          <Text style={styles.readyTxt}>READY!</Text>
          <Icon name="play" size={11} color={COLORS.onCard} />
        </View>
      )}
    </View>
  );
});

/** How big a world's sign is on the road. */
const SIGN_W = 190;
const SIGN_H = 34;

const styles = StyleSheet.create({
  sign: {
    position: 'absolute',
    width: SIGN_W,
    height: SIGN_H,
    borderRadius: SIGN_H / 2,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signTxt: {
    ...TYPE.black,
    fontSize: 13,
    letterSpacing: 1,
    color: COLORS.inkOnLight,
  },
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  top: { position: 'absolute' },
  play: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    alignItems: 'center',
  },
  // The pill's own box, so it is centred on the road rather than stretched
  // across the page. `stretch` up to the cap: the button is full-width by
  // construction and this is what tells it what full width means here.
  playPill: { width: '100%' },
  stop: { alignItems: 'center', justifyContent: 'center' },
  crown: {
    height: CROWN_H + 4,
    alignItems: 'center',
    marginBottom: -4,
    zIndex: 2,
  },
  // Reserved whether or not there are stars to draw, so a bead never shifts up
  // the page the first time its level is cleared.
  arc: {
    height: ARC_H + 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: -4,
  },
  // Dark ink, because both beads it lands on are light now -- mint once
  // cleared, drained violet while locked. White read well enough on the old
  // magenta and reads badly on either of these.
  num: { ...TYPE.black, color: COLORS.inkOnLight },
  lock: {
    position: 'absolute',
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: COLORS.nodeLockFace,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ready: {
    alignSelf: 'center',
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.nodeDoneEdge,
    borderWidth: 2,
    borderColor: COLORS.onCard,
  },
  readyTxt: {
    ...TYPE.black,
    fontSize: 12,
    color: COLORS.onCard,
    letterSpacing: 0.5,
  },
});
