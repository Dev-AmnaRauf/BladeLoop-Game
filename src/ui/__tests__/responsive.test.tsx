/**
 * The pages, in the window the game actually gives them.
 *
 * Every screen is locked to landscape, so the shape a page is drawn into is
 * short and wide rather than the tall narrow one a phone hands an app by
 * default. That is not a detail of one page: three of them -- the door, the
 * front page and the loading screen -- are built out of the same three parts
 * stacked down the screen, and the stack comes to a good 500dp against the
 * 320 to 440 a phone has sideways. They lay those parts out across the
 * screen instead, and what follows pins that they do, that they stop doing it
 * where there is genuinely room to stack, and that nothing on any of them is
 * left sitting under a cutout.
 *
 * Sizes are read off the rendered tree rather than measured: there is no
 * layout engine here, so what can be checked is the style a page chose, which
 * is exactly the decision these make.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { COL_MAX, GUTTER, PAGE_H, TIGHT_H, uiScale } from '../layout';
import LoadingScreen from '../LoadingScreen';
import LoginScreen from '../LoginScreen';
import SettingsScreen from '../SettingsScreen';
import Splash from '../Splash';
import { signOut } from '../../state/account';
import { land, upright, WIDE } from './viewport';

// Each case mounts a whole page, sky and all, and there are twenty of them.
// Run alone they land in half a second apiece and the first, which pays for
// the cold mount, in four; with the rest of the suite sharing the cores they
// go well past the default five seconds. Same allowance the other screen
// tests take, and for the same reason.
jest.setTimeout(30000);

/** Real phones held sideways, in dp: the short side is the height. */
const PHONES = [
  { width: 640, height: 320 },
  { width: 780, height: 360 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
  { width: 956, height: 440 },
];

/** A tablet held sideways, which has the height to stack a page after all. */
const TABLET = { width: 1180, height: 820 };

/** The safe area for a given window: a cutout down one side, a bar down the other. */
const metricsFor = (size: { width: number; height: number }): Metrics => ({
  frame: { x: 0, y: 0, ...size },
  insets: { top: 0, left: 47, right: 34, bottom: 0 },
});

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  // Every one of these pages keeps an animation or two running while mounted.
  // Left up, they outlive the suite and Jest never exits.
  await ReactTestRenderer.act(() => {
    trees.splice(0).forEach(t => t.unmount());
  });
  signOut();
  upright();
});

async function render(node: React.ReactElement, size: { width: number; height: number }) {
  land(size);
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metricsFor(size)}>{node}</SafeAreaProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

/** The flattened style of the one node carrying this testID. */
function styleOf(tree: ReactTestRenderer.ReactTestRenderer, testID: string): ViewStyle {
  const node = tree.root.findAll(n => n.props?.testID === testID && n.props?.style != null)[0];
  if (!node) throw new Error(`no node with testID ${testID}`);
  return StyleSheet.flatten(node.props.style) as ViewStyle;
}

const splash = (
  <Splash
    front
    level={3}
    levelName="First Blades"
    playerName=""
    onStart={() => {}}
    onLogin={() => {}}
    onLeaderboard={() => {}}
    onSettings={() => {}}
  />
);

describe('the scale a page draws its furniture at', () => {
  it('is exactly one on the screen the pages are drawn against', () => {
    expect(uiScale(PAGE_H)).toBe(1);
  });

  it('never runs away in either direction, however odd the window', () => {
    for (const h of [1, 200, 320, 390, 820, 4000]) {
      expect(uiScale(h)).toBeGreaterThanOrEqual(0.82);
      expect(uiScale(h)).toBeLessThanOrEqual(1.25);
    }
  });

  it('never shrinks the furniture as the screen grows', () => {
    const heights = [200, 320, 360, 390, 440, 820, 1200];
    for (let i = 1; i < heights.length; i++) {
      expect(uiScale(heights[i])).toBeGreaterThanOrEqual(uiScale(heights[i - 1]) - 1e-9);
    }
  });
});

describe('a phone held sideways', () => {
  /**
   * The three pages built out of a mark, a character and a set of controls.
   * Stacked they do not fit; across they do, and this is the decision itself
   * rather than a measurement of the result.
   */
  it.each(PHONES)('lays the front page across a $width x $height screen', async size => {
    const tree = await render(splash, size);
    expect(styleOf(tree, 'front-page').flexDirection).toBe('row');
  });

  it.each(PHONES)('lays the door across a $width x $height screen', async size => {
    const tree = await render(<LoginScreen onDone={() => {}} />, size);
    expect(styleOf(tree, 'door').flexDirection).toBe('row');
  });

  it.each(PHONES)('lays the loading screen across a $width x $height screen', async size => {
    const tree = await render(
      <LoadingScreen level={2} levelName="Switchback" onDone={() => {}} />,
      size,
    );
    expect(styleOf(tree, 'loading').flexDirection).toBe('row');
  });

  it('is what `tight` means, and a tablet is not', () => {
    for (const p of PHONES) expect(p.height).toBeLessThan(TIGHT_H);
    expect(TABLET.height).toBeGreaterThanOrEqual(TIGHT_H);
  });
});

describe('a tablet held sideways', () => {
  /**
   * The stack is the layout these pages were drawn as and it is the better
   * one where it fits: the mark over the character over the controls reads as
   * one thing down the middle of the screen. A tablet has the height for it.
   */
  it('stacks the front page rather than spreading it across a metre of glass', async () => {
    const tree = await render(splash, TABLET);
    expect(styleOf(tree, 'front-page').flexDirection).toBeUndefined();
  });

  it('stacks the door too', async () => {
    const tree = await render(<LoginScreen onDone={() => {}} />, TABLET);
    expect(styleOf(tree, 'door').flexDirection).toBeUndefined();
  });
});

describe('the safe area down the sides', () => {
  /**
   * Held sideways the cutout, the curve of the corners and the gesture bar
   * all move to the *sides* of the screen, which is where a portrait app
   * never has to look. Every page pads itself by the gutter plus whatever the
   * inset on that side turns out to be.
   */
  it('is kept clear on the front page', async () => {
    const tree = await render(splash, WIDE);
    const style = styleOf(tree, 'front-page');
    expect(style.paddingLeft).toBe(GUTTER + 47);
    expect(style.paddingRight).toBe(GUTTER + 34);
  });

  it('is kept clear on the door', async () => {
    const tree = await render(<LoginScreen onDone={() => {}} />, WIDE);
    const style = styleOf(tree, 'door');
    expect(style.paddingLeft).toBe(GUTTER + 47);
    expect(style.paddingRight).toBe(GUTTER + 34);
  });

  it('is kept clear on the loading screen', async () => {
    const tree = await render(
      <LoadingScreen level={2} levelName="Switchback" onDone={() => {}} />,
      WIDE,
    );
    const style = styleOf(tree, 'loading');
    expect(style.paddingLeft).toBe(GUTTER + 47);
    expect(style.paddingRight).toBe(GUTTER + 34);
  });
});

describe('a page of rows', () => {
  /**
   * The settings page is the one whose body is a couple of self-contained
   * groups, so held sideways it puts them abreast. Either way the column they
   * sit in is capped: a row whose label is at one edge of the screen and
   * whose switch is at the other is not a row anybody can read as one thing.
   */
  it('never lets a row run wider than a row can be read', async () => {
    const tree = await render(
      <SettingsScreen visible onBack={() => {}} onSignOut={() => {}} />,
      WIDE,
    );
    // Every cell of the two-abreast body, and the body they sit in.
    const widths = tree.root
      .findAll(n => typeof n.type === 'string' && n.props?.style != null)
      .map(n => StyleSheet.flatten(n.props.style) as ViewStyle)
      .filter(st => typeof st.maxWidth === 'number')
      .map(st => st.maxWidth as number);
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBeLessThanOrEqual(COL_MAX * 2 + 14);
  });
});
