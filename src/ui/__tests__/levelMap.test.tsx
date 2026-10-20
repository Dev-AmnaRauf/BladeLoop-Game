/**
 * The road between the levels.
 *
 * It is the only screen that decides what a player is *allowed* to open and
 * the only one that says what each level is worth, so the things worth pinning
 * down are the gate and the stars rather than the paint: a locked stop must
 * not be pressable, the one after the last clear must be, a cleared stop must
 * show the stars that level has and how many of them the save actually holds,
 * and the page has to grow a stop when a level is added rather than quietly
 * dropping the ones past five.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LevelMap from '../LevelMap';
import { starsIn } from '../../game/engine';
import { BOSS_LEVEL, LEVELS, LEVEL_COUNT } from '../../game/level';
import { METRICS, land, upright } from './viewport';

// Mounting a road with every level on it is a second of work on a quiet
// machine and several with the rest of the suite sharing the cores, so these
// get the same allowance the other screen tests take rather than the default
// five. Run alone they land in a fifth of a second apiece; it is only the
// company they keep that makes them slow.
jest.setTimeout(20000);

/**
 * A phone held sideways, safe area and all: see `./viewport`. The game is
 * locked to landscape on every screen, so this is the only shape any of these
 * pages is ever drawn in, and `land()` below puts the window itself the same
 * way round -- the provider's metrics are the insets and nothing else.
 */
const metrics = METRICS;

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  // Sideways, the way the game actually runs: the pages read the window and
  // lay themselves out across it rather than down it.
  land();
});

afterEach(async () => {
  // The sky behind the page keeps an animation running per body, and the live
  // stop keeps one of its own. Left mounted, those outlive the suite.
  await ReactTestRenderer.act(() => {
    trees.splice(0).forEach(tree => tree.unmount());
  });
  // And the window back the way Jest handed it over, since `Dimensions` is
  // module state and outlives this suite.
  upright();
});

async function open(
  cleared: number,
  level: number,
  on: Partial<Handlers> = {},
  stars: Record<string, number> = {},
) {
  const handlers: Handlers = {
    onPick: jest.fn(),
    onPlay: jest.fn(),
    onBack: jest.fn(),
    ...on,
  };
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <LevelMap cleared={cleared} level={level} stars={stars} {...handlers} />
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  return { tree, ...handlers };
}

interface Handlers {
  onPick: jest.Mock;
  onPlay: jest.Mock;
  onBack: jest.Mock;
}

/**
 * Every stop on the road, by the label a screen reader would read out.
 *
 * Only the nodes carrying an `onPress` count. A `Pressable` hands its
 * accessibility props down to the host views it renders, so matching on the
 * role alone finds each stop two or three times over.
 */
function stops(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByProps({ accessibilityRole: 'button' })
    .filter(
      n =>
        String(n.props.accessibilityLabel).startsWith('Level ') &&
        typeof n.props.onPress === 'function',
    )
    .map(n => ({
      label: n.props.accessibilityLabel as string,
      disabled: !!n.props.disabled,
      press: n.props.onPress as () => void,
    }));
}

function texts(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Text)
    .flatMap(n => React.Children.toArray(n.props.children))
    .filter(c => typeof c === 'string')
    .join(' | ');
}

test('there is a stop for every level the game has', async () => {
  const { tree } = await open(3, 4);
  expect(stops(tree)).toHaveLength(LEVEL_COUNT);
  // Not a hard-coded ten: the page is built off the level list, so this is
  // what catches a stop being dropped when a level is added.
  expect(LEVELS).toHaveLength(LEVEL_COUNT);
});

test('everything past the next level is locked, and locked stops do not open', async () => {
  const { tree } = await open(3, 4);
  const road = stops(tree);
  // Three cleared, the fourth is next up, the rest are shut.
  expect(road.map(s => s.disabled)).toEqual(
    Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1 > 4),
  );
  expect(road[0].label).toContain('cleared');
  expect(road[3].label).toContain('next up');
  expect(road[4].label).toContain('locked');
});

test('a fresh save can only open the first level', async () => {
  const { tree, onPick } = await open(0, 1);
  const road = stops(tree);
  expect(road.filter(s => !s.disabled)).toHaveLength(1);
  road[0].press();
  expect(onPick).toHaveBeenCalledWith(1);
});

test('a cleared level can be gone back to', async () => {
  const { tree, onPick } = await open(5, 6);
  stops(tree)[1].press();
  expect(onPick).toHaveBeenCalledWith(2);
});

test('the play button names the level it will open, and opens it', async () => {
  const { tree, onPlay } = await open(6, 7);
  expect(texts(tree)).toContain('PLAY LEVEL 7');

  const play = tree.root
    .findAllByProps({ accessibilityRole: 'button' })
    .find(n => n.props.accessibilityLabel === 'PLAY LEVEL 7');
  expect(play).toBeTruthy();
  play!.props.onPress();
  expect(onPlay).toHaveBeenCalled();
});

/**
 * Every arc of stars on the page, in level order, as a screen reader reads it.
 *
 * The arcs are glyphs rather than text, so the accessibility label is both the
 * honest way to ask how many are filled and the thing that has to be right for
 * a player who cannot see them at all. Host views only: the label is on a
 * component that renders one, so matching on the role alone finds each arc
 * twice.
 */
function arcs(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByProps({ accessibilityRole: 'image' })
    .filter(n => typeof n.type === 'string')
    .map(n => n.props.accessibilityLabel as string);
}

test('a cleared level wears the stars it is worth, filled to what was picked up', async () => {
  // Level one has three stars in its corridor and this save picked up two of
  // them; level two was cleared without touching any of its one.
  const { tree } = await open(2, 3, {}, { 1: 2 });
  expect(arcs(tree)).toEqual([`2 of ${starsIn(1)} stars`, `0 of ${starsIn(2)} stars`]);
});

test('a level that has not been cleared shows no stars at all', async () => {
  // Nothing cleared: not the level the player is about to open and not the
  // shut ones either, since an empty arc on a level nothing can be done about
  // is only a page telling the player what they are missing.
  const { tree } = await open(0, 1);
  expect(arcs(tree)).toEqual([]);
});

test('the last authored level is the one the road crowns', async () => {
  const { tree } = await open(LEVEL_COUNT - 1, LEVEL_COUNT);
  expect(BOSS_LEVEL).toBe(LEVEL_COUNT);
  // Everything up to the finale cleared means everything up to it openable;
  // it is not a special case for the gate, only for the crown it wears.
  expect(
    stops(tree)
      .slice(0, LEVEL_COUNT)
      .every(s => !s.disabled),
  ).toBe(true);
});

test('the road carries on past the crowned level', async () => {
  const { tree, onPick } = await open(LEVEL_COUNT, LEVEL_COUNT + 1);
  const road = stops(tree);
  // Clearing the written game is not the end of the road: there are stops
  // past it, the next one is open, and it can be picked like any other.
  expect(road.length).toBeGreaterThan(LEVEL_COUNT);
  expect(road[LEVEL_COUNT - 1].label).toContain('cleared');
  expect(road[LEVEL_COUNT].disabled).toBe(false);
  expect(road[LEVEL_COUNT].label).toContain('next up');
  road[LEVEL_COUNT].press();
  expect(onPick).toHaveBeenCalledWith(LEVEL_COUNT + 1);
  expect(texts(tree)).toContain(`PLAY LEVEL ${LEVEL_COUNT + 1}`);
});

test('a long way down the road, the walked part is pulled back a stretch at a time', async () => {
  // Far enough along that the page cannot draw every stop behind the player.
  const deep = 200;
  const { tree } = await open(deep, deep + 1);
  const road = stops(tree);
  expect(road.length).toBeLessThan(deep);
  const lowest = (list: ReturnType<typeof stops>) =>
    Number(list[0].label.split(' ')[1].replace(',', ''));
  const was = lowest(road);
  expect(was).toBeGreaterThan(1);

  // Dragging the page to its foot hands back more of the road behind it.
  const scroller = tree.root.findAllByType(ScrollView)[0];
  await ReactTestRenderer.act(() => {
    scroller.props.onScroll({
      nativeEvent: {
        contentOffset: { x: 0, y: 4000 },
        layoutMeasurement: { width: 390, height: 844 },
        contentSize: { width: 390, height: 4844 },
      },
    });
  });
  expect(lowest(stops(tree))).toBeLessThan(was);
  // Every corridor on the page is built once to count the stars lying in it,
  // and this page is looking at thirty of them.
}, 20000);
