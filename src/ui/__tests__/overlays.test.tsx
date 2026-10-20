/**
 * The end-of-run cards.
 *
 * These are the screens a player sees more often than any other -- every run
 * ends on one -- so the things worth pinning down are the ones that would be
 * silently wrong for a whole session: which decision each card offers, that a
 * best run is not presented as a failure, and that the score is grouped the
 * same way on every engine rather than left to whatever ICU data shipped.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { FinishOverlay, FlagFlash, GameOverOverlay, PauseOverlay, cheerFor } from '../Overlays';
import { LEVEL_COUNT } from '../../game/level';

// Quoted off the real count rather than spelled out: adding a level is a
// content change, and a content change should not turn these red.

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

const actions = {
  onLeaderboard: jest.fn(),
  onSettings: jest.fn(),
  onShare: jest.fn(),
};

/** Where the player is, which every card now carries. */
const place = { level: 2, cleared: 1 };

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    trees.splice(0).forEach(tree => tree.unmount());
  });
  jest.clearAllMocks();
});

async function render(node: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(node);
  });
  trees.push(tree);
  return tree;
}

/** Every label a screen reader would find a button under. */
function buttons(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByProps({ accessibilityRole: 'button' })
    .map(n => n.props.accessibilityLabel as string);
}

/** Press the button a screen reader would find under this label. */
function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const node = tree.root
    .findAllByProps({ accessibilityRole: 'button' })
    .find(n => n.props.accessibilityLabel === label);
  if (!node) throw new Error(`no button labelled "${label}" among ${buttons(tree).join(', ')}`);
  node.props.onPress();
}

/** Every string the card actually puts on screen. */
function words(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Text)
    .flatMap(n => (Array.isArray(n.props.children) ? n.props.children : [n.props.children]))
    .filter((c): c is string => typeof c === 'string')
    // A sticker keeps its spaces from breaking the line; read them as spaces.
    .map(c => c.replace(/ /g, ' '));
}

const over = {
  score: 54567,
  best: 91000,
  runCoins: 12,
  reviveCost: 5,
  canRevive: true,
  isBest: false,
  onRetry: jest.fn(),
  onStartOver: jest.fn(),
  onRevive: jest.fn(),
  ...place,
  ...actions,
};

describe('the game over card', () => {
  test('groups the score in thousands', async () => {
    const tree = await render(<GameOverOverlay {...over} />);
    expect(words(tree)).toContain('54,567');
    expect(words(tree)).toContain('91,000');
  });

  test('offers the three decisions about the run, and no way to dismiss it', async () => {
    const tree = await render(<GameOverOverlay {...over} />);
    expect(buttons(tree)).toEqual(
      expect.arrayContaining(['RETRY HERE', 'LAST FLAG  5', 'START OVER']),
    );
    // Nothing closes a card whose run has already ended.
    expect(buttons(tree)).not.toContain('Close');
  });

  test('sells nothing: no gem shop, and no revive it cannot afford', async () => {
    const tree = await render(<GameOverOverlay {...over} canRevive={false} />);
    expect(buttons(tree)).not.toContain('GET GEMS');
    expect(buttons(tree)).not.toContain('LAST FLAG  5');
  });

  test('says it in numbers and two short labels, not in sentences', async () => {
    const tree = await render(<GameOverOverlay {...over} />);
    // Every distinct word on the screen, and there are meant to be almost
    // none: the one word for how it went, two labels, two numbers, and the
    // price on the revive bead. The headline is drawn several times over -- a
    // sticker is a face over an outline -- so this reads what is *said*, not
    // how many times. Anything longer than this list is a paragraph to read on
    // the way back in.
    const said = [...new Set(words(tree))].filter(w => w.trim().length > 0 && !/^[󰀀-󿿿]$/u.test(w));
    expect(said).toEqual([
      'GAME OVER',
      'SCORE',
      '54,567',
      'BEST SCORE',
      '91,000',
      'RETRY',
      'HOME',
      '5',
    ]);
  });

  test('a best run is congratulated rather than mourned', async () => {
    const tree = await render(<GameOverOverlay {...over} isBest />);
    const said = words(tree);
    expect(said).toContain('NEW BEST');
    expect(said).not.toContain('Failed!');
    // ...and it still offers the same way back into a run.
    expect(buttons(tree)).toContain('RETRY HERE');
  });

  test('retry is the button under the thumb', async () => {
    const tree = await render(<GameOverOverlay {...over} />);
    press(tree, 'RETRY HERE');
    expect(over.onRetry).toHaveBeenCalled();
    expect(over.onStartOver).not.toHaveBeenCalled();
  });
});

describe('the other two cards', () => {
  const clear = {
    score: 1200,
    best: 9000,
    runCoins: 7,
    ...place,
    ...actions,
  };

  test('a cleared level offers the next one first, and the same one after it', async () => {
    const onNext = jest.fn();
    const onReplay = jest.fn();
    const tree = await render(
      <FinishOverlay {...clear} cleared={2} onNext={onNext} onReplay={onReplay} />,
    );
    expect(words(tree)).toContain(cheerFor(2));
    // ...and it says which level it just closed, in words. A level is minutes
    // of run now, and the one green word is what a player sees whether they
    // walked it or fought it.
    expect(words(tree)).toContain('LEVEL 2 COMPLETE');
    expect(words(tree)).toContain('1,200');
    // The stars are on the road, not on the card: what a run just won is shown
    // over the stop it was won on, and the card stays about this run.
    expect(tree.root.findAllByProps({ accessibilityRole: 'image' })).toHaveLength(0);

    press(tree, 'NEXT LEVEL');
    expect(onNext).toHaveBeenCalled();
    press(tree, 'REPLAY LEVEL');
    expect(onReplay).toHaveBeenCalled();
  });

  test('the last level has nowhere to send the player but back in', async () => {
    const onReplay = jest.fn();
    const tree = await render(
      <FinishOverlay {...clear} level={LEVEL_COUNT} cleared={LEVEL_COUNT} onReplay={onReplay} />,
    );
    expect(buttons(tree)).not.toContain('NEXT LEVEL');
    press(tree, 'PLAY AGAIN');
    expect(onReplay).toHaveBeenCalled();
  });

  test('a flag says what it paid and what it did to the descent', async () => {
    // The ladder is a few per cent a rung, so the banner says the push in per
    // cent: a `×1.12` would be noise and a rounded `×1` would be a lie.
    const tree = await render(<FlagFlash score={150} coins={2} gear={1.12} onDone={jest.fn()} />);
    const said = words(tree);
    expect(said).toContain('CHECKPOINT');
    expect(said).toContain('+150');
    expect(said).toContain('+2');
    expect(said).toContain('SPEED  +12%');
    // It is a banner over a live run, not a card: nothing on it takes a touch,
    // so there is nothing to press and nothing the player has to dismiss.
    expect(buttons(tree)).toEqual([]);
  });

  test('the opening gear is not news, so the banner does not report it', async () => {
    const tree = await render(<FlagFlash score={150} coins={2} gear={1} onDone={jest.fn()} />);
    expect(words(tree).some(w => w.startsWith('SPEED'))).toBe(false);
  });

  test('a paused run closes back into itself', async () => {
    const onResume = jest.fn();
    const tree = await render(
      <PauseOverlay
        score={430}
        best={9000}
        runCoins={3}
        onResume={onResume}
        onRetry={jest.fn()}
        {...place}
        {...actions}
      />,
    );
    // Both the X and the pill mean the same thing here, so both are wired to it.
    press(tree, 'Close');
    press(tree, 'RESUME');
    expect(onResume).toHaveBeenCalledTimes(2);
  });
});
