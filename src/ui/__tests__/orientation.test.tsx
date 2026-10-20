/**
 * Sideways, on every screen, for the whole session.
 *
 * The game used to be read upright and played sideways: a rule decided which
 * of the two each screen wanted, and the phone turned on the way into a level
 * and back on the way out. Every page is laid out for a short, wide viewport
 * now, so the rule is gone and there is one ask at launch.
 *
 * What is worth pinning is that the ask happens, that it is landscape, and --
 * the part the old build got wrong often enough to be worth a test -- that
 * walking between screens never asks for anything else. The screen mounting
 * the whole game is what proves it: the door and the front page are two of the
 * three that used to be upright, and this walks both of them.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { METRICS, land, upright } from './viewport';

/** The native module, swapped for one that writes down what it was asked. */
const mockLock = jest.fn();
jest.mock('../../native/NativeOrientation', () => ({
  __esModule: true,
  default: { lock: (mode: string) => mockLock(mode) },
}));

// The board's housekeeping reaches for the phone's locale and then for the
// network the moment the save lands. Neither is what this is about, and both
// outlive the test if they are left real.
jest.mock('../../services/Region', () => ({
  ...jest.requireActual('../../services/Region'),
  resolve: () => Promise.resolve(null),
}));

import GameScreen from '../GameScreen';
import * as Orientation from '../../services/Orientation';
import { signOut } from '../../state/account';

let tree: ReactTestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  land();
  mockLock.mockClear();
  // The service is a module and remembers across tests, so every one of these
  // starts from a phone nobody has asked.
  Orientation.reset();
  // The run's frame loop re-renders the whole tree on every tick, and this
  // test only ever asks what the phone was told.
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0 as never);
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    tree?.unmount();
  });
  tree = null;
  signOut();
  upright();
  jest.restoreAllMocks();
});

/** Everything on screen, flattened, so a screen can be named by what it says. */
function said() {
  return (tree?.root.findAllByType(Text) ?? [])
    .flatMap(n => React.Children.toArray(n.props.children))
    .filter((c): c is string => typeof c === 'string')
    .join(' | ');
}

/** One beat of everything that is waiting on a promise or a timer. */
async function beat() {
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(r => setTimeout(r, 20));
  });
}

/**
 * Beat until `ready` answers, rather than for a fixed stretch: how long a
 * store takes to land says more about how loaded the machine running the suite
 * is than about the app.
 */
async function until(ready: () => boolean, what: string) {
  for (let i = 0; i < 100; i++) {
    if (ready()) return;
    await beat();
  }
  throw new Error(`never happened: ${what} -- on screen: ${said()}`);
}

test('the game asks for landscape once and never asks for anything else', async () => {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <GameScreen />
      </SafeAreaProvider>,
    );
  });

  // The ask is at launch, under whatever the first screen turns out to be --
  // not on the way into a level, which is where it used to be.
  expect(mockLock).toHaveBeenCalledWith('landscape');
  expect(Orientation.heldWay()).toBe('landscape');

  // The door: the first of the screens that used to be read upright.
  await until(() => said().includes('PLAY AS GUEST'), 'the door opened');
  expect(Orientation.heldWay()).toBe('landscape');

  // And the front page behind it, which is another. Nothing between the two
  // turns the phone, so the module has still only been spoken to once.
  await until(() => said().includes('tap to fly'), 'the front page arrived');
  expect(Orientation.heldWay()).toBe('landscape');
  expect(mockLock.mock.calls.map(c => c[0])).toEqual(['landscape']);
  // Mounting the whole game and building its opening world is seconds of work
  // on a loaded machine, so this gets the same allowance the other screen
  // tests take rather than the default five.
}, 60000);
