/**
 * What the game puts on screen before its saves have come off disk.
 *
 * Both stores are read asynchronously, so there is a window on every launch --
 * a frame in a test, longer than that on a real phone -- where every one of
 * them still reads as its defaults. The front page used to be drawn inside it:
 * a live PLAY with no door in front of it yet, over a ribbon reading LEVEL 1
 * whoever the player is and however far down they are. Pressing it there opened
 * the first level rather than theirs.
 *
 * The window is a race everywhere except here, where the saved progress is held
 * back by hand, so what is on screen during it can be looked at rather than
 * caught.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// The progress store answers when this test says so and not before. Everything
// else about it is the real thing -- only the wait is ours.
jest.mock('../../state/progress', () => {
  const actual = jest.requireActual('../../state/progress');
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  return { ...actual, whenHydrated: () => held, __land: () => release() };
});

// Landing the save is also what sets the board's housekeeping going, and that
// reaches for the phone's locale and then for the network. Neither is what this
// is about, and both outlive the test if they are left real.
jest.mock('../../services/Region', () => ({
  ...jest.requireActual('../../services/Region'),
  resolve: () => Promise.resolve(null),
}));

import GameScreen from '../GameScreen';
import { signOut } from '../../state/account';
import * as Progress from '../../state/progress';
import { METRICS, land, upright } from './viewport';

/** Let the held save land, and with it the front page. */
const landSave = () => (Progress as unknown as { __land: () => void }).__land();

/**
 * A phone held sideways, safe area and all: see `./viewport`. The game is
 * locked to landscape on every screen, so this is the only shape any of these
 * pages is ever drawn in, and `land()` below puts the window itself the same
 * way round -- the provider's metrics are the insets and nothing else.
 */
const metrics = METRICS;

let tree: ReactTestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  // The run's frame loop re-renders the whole tree on every tick, and this
  // Sideways, the way the game actually runs: the pages read the window and
  // lay themselves out across it rather than down it.
  land();
  // test only ever asks which screens are mounted.
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0 as never);
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    tree?.unmount();
  });
  // And the window back the way Jest handed it over, since `Dimensions` is
  // module state and outlives this suite.
  upright();
  tree = null;
  signOut();
  jest.restoreAllMocks();
});

/** Everything on screen, flattened, so a screen can be named by what it says. */
function said() {
  return (tree?.root.findAllByType(Text) ?? [])
    .flatMap(n => React.Children.toArray(n.props.children))
    .filter((c): c is string => typeof c === 'string')
    .join(' | ');
}

/**
 * How many front pages are mounted -- none of them, or the one.
 *
 * `deep: false` stops the one page being counted three times: an
 * `Animated.View` is a component wrapping a component wrapping the host view,
 * and the prop is on all three of them.
 */
function pages() {
  return (tree?.root.findAllByProps({ testID: 'front-page' }, { deep: false }) ?? []).length;
}

/** One beat of everything that is waiting on a promise or a timer. */
async function beat() {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(r => setTimeout(r, 20));
  });
}

/**
 * Beat until `ready` answers, rather than for a fixed stretch.
 *
 * A store landing is a promise, and how many milliseconds that takes says more
 * about how loaded the machine running the suite is than about the app: a wait
 * long enough on its own is short enough when sixteen other suites have the
 * cores. So nothing here waits a length of time -- it waits for the thing.
 */
async function until(ready: () => boolean, what: string) {
  for (let i = 0; i < 100; i++) {
    if (ready()) return;
    await beat();
  }
  throw new Error(`never happened: ${what} -- on screen: ${said()}`);
}

test('the front page waits for the saved progress rather than guessing at it', async () => {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <GameScreen />
      </SafeAreaProvider>,
    );
  });
  // The account is the only store the door waits on, so it is up first.
  await until(() => said().includes('PLAY AS GUEST'), 'the door opened');

  // The save is still held, so there is no front page behind the door. The old
  // build had one here, already advertising the first level.
  expect(pages()).toBe(0);
  expect(said()).not.toContain('FIRST BLADES');

  // And once the save lands, the page it describes arrives with it.
  landSave();
  await until(() => pages() > 0, 'the front page arrived');
  expect(pages()).toBe(1);
  // Mounting the whole game and building its opening world is seconds of work
  // on a loaded machine, so this gets the same allowance the other screen tests
  // take rather than the default five.
}, 60000);
