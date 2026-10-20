/**
 * The way back out of the game, one screen at a time.
 *
 * Android's back button is the only navigation this game has -- there is no
 * bar, no tabs and no drawer -- so the chain it walks *is* the map of the app:
 * a run backs out onto the front page, the front page backs out to the door,
 * and the door is the one place with nothing behind it. What this pins down is
 * that every screen has a way back to the one before it without the app being
 * killed and started again, which is the only way the door used to be
 * reachable a second time.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { BackHandler, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { signOut } from '../../state/account';
import GameScreen from '../GameScreen';
import { METRICS, land, upright } from './viewport';

// The provider is handed its metrics rather than left to measure a layout that
// never happens off a device: without them it renders nothing at all.
/**
 * A phone held sideways, safe area and all: see `./viewport`. The game is
 * locked to landscape on every screen, so this is the only shape any of these
 * pages is ever drawn in, and `land()` below puts the window itself the same
 * way round -- the provider's metrics are the insets and nothing else.
 */
const metrics = METRICS;

/** Every live back subscription, newest last -- the order Android runs them. */
let chain: Array<() => boolean | null | undefined> = [];

let tree: ReactTestRenderer.ReactTestRenderer | null = null;

beforeEach(() => {
  chain = [];
  // Sideways, the way the game actually runs: the pages read the window and
  // lay themselves out across it rather than down it.
  land();
  // The run's frame loop is not what is being tested here, and left going it
  // re-renders the whole tree on every tick -- thousands of renders inside the
  // `act` calls below, for a test that only ever asks which screen is up. One
  // frame is scheduled and none after it.
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0 as never);
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
    _event: string,
    cb: () => boolean | null | undefined,
  ) => {
    chain.push(cb);
    return {
      remove: () => {
        chain = chain.filter(fn => fn !== cb);
      },
    };
  }) as never);
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    tree?.unmount();
  });
  // And the window back the way Jest handed it over, since `Dimensions` is
  // module state and outlives this suite.
  upright();
  tree = null;
  // Only once nothing is mounted: the account store is subscribed to by
  // whatever is on screen. A guest signed in by one test would otherwise make
  // the next one open on CONTINUE instead of on the first-launch door.
  signOut();
  jest.restoreAllMocks();
});

/**
 * Press the hardware back button.
 *
 * Android hands the press to the newest subscription first and stops at the
 * first one that claims it, so a sheet closes itself rather than the screen
 * behind it doing the closing. Returns false when nothing claimed the press,
 * which on a phone is the app being left.
 */
async function back() {
  let handled = false;
  await ReactTestRenderer.act(async () => {
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i]()) {
        handled = true;
        break;
      }
    }
    await Promise.resolve();
  });
  return handled;
}

/** Everything on screen, flattened, so a screen can be named by what it says. */
function said() {
  return (tree?.root.findAllByType(Text) ?? [])
    .flatMap(n => React.Children.toArray(n.props.children))
    .filter((c): c is string => typeof c === 'string')
    .join(' | ');
}

/**
 * The opacity a style prop actually resolves to, animated values included.
 *
 * A style here is the array an `Animated.View` was handed, and the entry that
 * matters is an `Animated.Value` rather than a number -- so it is asked for
 * its current reading rather than compared as one.
 */
function flatOpacity(style: unknown): number | undefined {
  const parts = (Array.isArray(style) ? style : [style]).filter(Boolean) as Array<
    Record<string, unknown>
  >;
  for (let i = parts.length - 1; i >= 0; i--) {
    const o = parts[i].opacity as { __getValue?: () => number } | number | undefined;
    if (typeof o === 'number') return o;
    if (o && typeof o.__getValue === 'function') return o.__getValue();
  }
  return undefined;
}

/** Press the button a screen reader would find under this label. */
async function press(label: string) {
  const node = tree?.root
    .findAllByProps({ accessibilityRole: 'button' })
    .find(n => n.props.accessibilityLabel === label);
  if (!node) throw new Error(`no button labelled "${label}" in: ${said()}`);
  await ReactTestRenderer.act(async () => {
    node.props.onPress();
    // Long enough for the screen's own fade to hand over.
    await new Promise<void>(r => setTimeout(r, 900));
  });
}

async function launch() {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <GameScreen />
      </SafeAreaProvider>,
    );
    // Long enough for the saved account and the saved progress to land, which
    // is what the door waits for before it decides what to offer.
    await new Promise<void>(r => setTimeout(r, 50));
  });
  // The door is the first screen of every launch.
  expect(said()).toContain('PLAY AS GUEST');
  await press('Play as guest');
  // ...and behind it, the front page.
  expect(said()).toContain('PLAY');
}

test('back walks the front page out to the door, and the door out of the game', async () => {
  await launch();

  // The front page is not the bottom of the app: one press opens the door
  // again, so an account can be changed without the app being restarted.
  expect(await back()).toBe(true);
  expect(said()).toContain('CONTINUE');

  // ...and the door itself is the bottom. Nothing claims this one, which is
  // the press that leaves the app.
  expect(await back()).toBe(false);
  // The screens each fade before they hand over, and the run is ticking the
  // whole time: this walks two of them at a beat apiece.
}, 60000);

test('back comes off the road onto the front page, and on to the door', async () => {
  await launch();
  await press('PLAY');
  expect(said()).toContain('PLAY LEVEL 1');

  expect(await back()).toBe(true);
  expect(said()).not.toContain('PLAY LEVEL 1');
  expect(said()).toContain('PLAY');

  expect(await back()).toBe(true);
  expect(said()).toContain('CONTINUE');
}, 60000);

/**
 * The page the road was opened from is still a page when the road closes.
 *
 * PLAY fades the front page out and leaves it there -- the road is drawn over
 * it, not in place of it -- so coming back off the road used to land on a page
 * drawn at zero opacity with its one button already spent. Every word of it
 * was still in the tree, which is why the test above passed while the screen
 * was blank: the only thing that tells the two apart is whether the page can
 * still be seen, and whether pressing it does anything.
 */
test('the front page comes back off the road visible and pressable', async () => {
  await launch();
  await press('PLAY');
  expect(said()).toContain('PLAY LEVEL 1');

  expect(await back()).toBe(true);

  // Seen: the page is drawn at full strength rather than left faded out.
  const page = tree?.root.findByProps({ testID: 'front-page' });
  expect(flatOpacity(page?.props.style)).toBe(1);

  // ...and pressable: the road opens a second time off the same button.
  await press('PLAY');
  expect(said()).toContain('PLAY LEVEL 1');
}, 60000);
