/**
 * The board and the settings are whole pages now rather than sheets, and both
 * are reached from the splash's corners. These render them the way the game
 * does -- offline, with nothing cached and no place known -- because that is
 * the state a first open is actually in, and it is the one where a page that
 * assumes it has a country would throw.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Animated, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LeaderboardScreen from '../LeaderboardScreen';
import LoginScreen from '../LoginScreen';
import * as Google from '../../services/GoogleAuth';
import * as PlayGames from '../../services/PlayGames';
import { getAccount, signInAsGuest, signOut } from '../../state/account';
import { getSettings, setName } from '../../state/settings';
import { APP_VERSION } from '../../services/links';
import SettingsScreen from '../SettingsScreen';
import { WORD_Y, letterPhase, wordPhase } from '../RunWord';
import { OPENING_Y } from '../../game/level';
import { CLIMB } from '../../game/config';
import { METRICS, land, upright } from './viewport';

/** Where the opening flag stands, from `buildLevel`. */
const FLAG_Y = OPENING_Y + 320;

/**
 * A phone held sideways, safe area and all: see `./viewport`. The game is
 * locked to landscape on every screen, so this is the only shape any of these
 * pages is ever drawn in, and `land()` below puts the window itself the same
 * way round -- the provider's metrics are the insets and nothing else.
 */
const metrics = METRICS;

/** Everything rendered in a test, so it can be torn down again. */
const trees: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  // No network at all: every service has to answer without one.
  // Sideways, the way the game actually runs: the pages read the window and
  // lay themselves out across it rather than down it.
  land();
  globalThis.fetch = jest.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
});

afterEach(async () => {
  // The sky behind a page keeps an animation running per body in it.
  // Left mounted, those timers outlive the suite and Jest never exits.
  await ReactTestRenderer.act(() => {
    trees.splice(0).forEach(tree => tree.unmount());
  });
  // Only once nothing is mounted: the stores are subscribed to by whatever is
  // on screen, so clearing them first re-renders a tree outside `act`.
  signOut();
  setName('');
  jest.restoreAllMocks();
  // The service remembers what the device told it, and a test that said the
  // door was there must not leave that standing for the next one.
  PlayGames.reset();
  require('@react-native-google-signin/google-signin').__setSignInResult({
    type: 'success',
    data: { idToken: 'mockIdToken', user: { name: 'Mock Player', email: 'mock@example.com' } },
  });
  // And the window back the way Jest handed it over, since `Dimensions` is
  // module state and outlives this suite.
  upright();
  // @ts-expect-error -- putting the environment back the way it was found.
  delete globalThis.fetch;
});

async function render(node: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

/** Press the button a screen reader would find under this label. */
function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  const node = tree.root
    .findAllByProps({ accessibilityRole: 'button' })
    .find(n => n.props.accessibilityLabel === label);
  if (!node) throw new Error(`no button labelled "${label}"`);
  node.props.onPress();
}

/** Long enough for the sign-in round trip and the screen's fade out. */
function settle() {
  return new Promise<void>(resolve => setTimeout(() => resolve(), 800));
}

/** Every string the page put on screen, flattened. */
function texts(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(Text)
    .flatMap(n => React.Children.toArray(n.props.children))
    .filter(c => typeof c === 'string')
    .join(' | ');
}

test('the run word is on screen from the first frame, and gone before the level', () => {
  // It stands in the run-up, above the opening flag, so it is already there to
  // be written on the run's first frame -- which is the whole reason it moved
  // out of the first stage. Down there the letters landed a screen below the
  // ball and the player only ever met the finished word.
  expect(WORD_Y).toBeLessThan(FLAG_Y);
  expect(WORD_Y).toBeGreaterThan(OPENING_Y);

  // Nothing written yet on that first frame, and all of it a moment later.
  expect(wordPhase(0, OPENING_Y).progress).toBe(0);
  expect(wordPhase(0.5, OPENING_Y).progress).toBeGreaterThan(0);
  expect(wordPhase(2, OPENING_Y).progress).toBe(1);

  // Finished writing before it starts fading, which is the pair of them not
  // treading on each other: the ball needs about a second to come down level
  // with the word, and the word is done in less.
  const downToWord = (WORD_Y - OPENING_Y) / CLIMB;
  expect(wordPhase(downToWord, WORD_Y).progress).toBe(1);
  expect(wordPhase(downToWord, WORD_Y).fade).toBe(1);

  // Then it goes as the ball comes down past it, and is gone by the first line
  // of the level -- past there an instruction is no use to anybody.
  expect(wordPhase(2, WORD_Y + 120).fade).toBeLessThan(1);
  expect(wordPhase(2, 0).fade).toBe(0);
  expect(wordPhase(2, 400).fade).toBe(0);
});

test('the letters land one after another, each turning into place', () => {
  const LAST = 'ROTATE'.length - 1;

  // Nothing has landed at the very start: every letter a full turn out, and
  // none of them drawn.
  for (let i = 0; i <= LAST; i++) {
    expect(letterPhase(i, 0).opacity).toBe(0);
    expect(letterPhase(i, 0).spin).toBeCloseTo(360);
  }

  // Part way through, the word is mid-arrival: the front of it has landed and
  // the back of it has not. That gap is the whole effect.
  const mid = 0.5;
  expect(letterPhase(0, mid).opacity).toBeGreaterThan(letterPhase(LAST, mid).opacity);
  expect(letterPhase(0, mid).spin).toBeLessThan(letterPhase(LAST, mid).spin);
  // In reading order, never out of it.
  for (let i = 1; i <= LAST; i++) {
    expect(letterPhase(i, mid).opacity).toBeLessThanOrEqual(letterPhase(i - 1, mid).opacity);
  }

  // And every one of them is home by the end, the last included.
  for (let i = 0; i <= LAST; i++) {
    const done = letterPhase(i, 1);
    expect(done.spin).toBe(0);
    expect(done.scale).toBe(1);
    expect(done.opacity).toBe(1);
  }
});

test('the board offers all three scopes with no location known', async () => {
  const tree = await render(
    <LeaderboardScreen visible best={12} runs={3} onBack={() => {}} onOpenSettings={() => {}} />,
  );

  const shown = texts(tree);
  expect(shown).toContain('WORLD');
  expect(shown).toContain('COUNTRY');
  expect(shown).toContain('CITY');
  expect(shown).toContain('LEADERBOARD');
  // Jest's default 5s is not enough here, and never was by much: this renders a
  // whole page -- backdrop animations and all -- in a worker running beside the
  // level audit, which pins a core for the best part of a minute. In isolation
  // it takes about two seconds; starved of CPU it had been landing either side
  // of the default and failing on the wrong day.
}, 30000);

test('a hidden board draws nothing, so it claims no back button', async () => {
  const tree = await render(
    <LeaderboardScreen
      visible={false}
      best={0}
      runs={0}
      onBack={() => {}}
      onOpenSettings={() => {}}
    />,
  );

  expect(tree.root.findAllByType(Text)).toHaveLength(0);
});

test('the settings page carries a switch each for music, effects and vibration', async () => {
  const onBack = jest.fn();
  const tree = await render(<SettingsScreen visible onBack={onBack} onSignOut={() => {}} />);

  const shown = texts(tree);
  // The three things the game does to the room it is played in, each with a
  // switch of its own rather than riding one master.
  expect(shown).toContain('Music');
  expect(shown).toContain('Sound Effects');
  expect(shown).toContain('Vibration');
  expect(shown).toContain('Reset Progress');
  expect(shown).toContain('Privacy Policy');
  expect(shown).toContain('Rate Us');
  // The account half, which is the only way to either of these.
  expect(shown).toContain('Share the game');
  expect(shown).toContain('Sign out');
  // Which build this is, for a support mail that would otherwise have to ask.
  expect(shown).toContain(`Version ${APP_VERSION}`);
  expect(shown).not.toContain('Send my scores');
  expect(shown).not.toContain('Personalised ads');
  // It is a whole page now rather than a card, so it leaves on the page's own
  // back chevron rather than on a DONE button of its own.
  press(tree, 'Back');
  expect(onBack).toHaveBeenCalled();
});

test('the settings card hands a signed-in player back to the door', async () => {
  // The row only means anything to somebody who is already in, which is the
  // only state the settings are ever reachable from.
  signInAsGuest();
  const done = jest.fn();
  // The confirm is a native dialog, so the button it would have offered is
  // taken off the call and pressed here.
  const asked = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await render(<SettingsScreen visible onBack={() => {}} onSignOut={done} />);

  expect(texts(tree)).toContain('Sign out');

  await ReactTestRenderer.act(async () => {
    press(tree, 'Sign out');
  });

  // Nothing happens on the press alone: the dialog is what signs anybody out.
  expect(getAccount().provider).toBe('guest');
  expect(done).not.toHaveBeenCalled();

  const buttons = asked.mock.calls[0][2] as { text: string; onPress?: () => void }[];
  await ReactTestRenderer.act(async () => {
    buttons.find(b => b.text === 'Sign out')?.onPress?.();
  });

  expect(getAccount().provider).toBe('none');
  expect(done).toHaveBeenCalledTimes(1);
});

test('the login screen offers both doors when the SDK is there', async () => {
  const tree = await render(<LoginScreen onDone={() => {}} />);

  const shown = texts(tree);
  expect(shown).toContain('PLAY WITH GOOGLE');
  expect(shown).toContain('PLAY AS GUEST');
});

/**
 * A login screen whose Play Games probe has already landed.
 *
 * The mount and the probe's answer share one `act`, because they are one beat
 * apart: the answer arrives in the microtask straight after the effects run,
 * which is in the gap between two separate acts and inside a single async one.
 */
async function openedDoor(found: PlayGames.Probe, onDone = () => {}) {
  jest.spyOn(PlayGames, 'probe').mockResolvedValue(found);
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={metrics}>
        <LoginScreen onDone={onDone} />
      </SafeAreaProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

test('the Play Games door is drawn only once the device says it has one', async () => {
  // Nothing is assumed about the phone: the button is not on screen until the
  // service has been and asked, so it never offers a door onto nothing.
  const off = await openedDoor({ available: false, player: null });
  expect(texts(off)).not.toContain('SIGN IN WITH PLAY GAMES');

  const on = await openedDoor({ available: true, player: null });
  const shown = texts(on);
  expect(shown).toContain('SIGN IN WITH PLAY GAMES');
  // And it stands above the other two, which are still both there.
  expect(shown.indexOf('SIGN IN WITH PLAY GAMES')).toBeLessThan(shown.indexOf('PLAY WITH GOOGLE'));
  expect(shown).toContain('PLAY AS GUEST');
});

test('signing in with Play Games settles the account and names the board row', async () => {
  jest.spyOn(PlayGames, 'signIn').mockResolvedValue({ id: 'p-1', name: 'BladeRunner' });

  const done = jest.fn();
  const tree = await openedDoor({ available: true, player: null }, done);

  await ReactTestRenderer.act(async () => {
    press(tree, 'Sign in with Play Games');
    await settle();
  });

  // No email: Play Games shares a gamer tag and a player id, and that is all.
  expect(getAccount()).toMatchObject({
    provider: 'playgames',
    name: 'BladeRunner',
    email: '',
    playerId: 'p-1',
  });
  // The tag goes onto the board whole -- it is already one short word, unlike
  // the full name a Google account carries.
  expect(getSettings().name).toBe('BladeRunner');
  expect(done).toHaveBeenCalledTimes(1);
});

test('a dismissed Play Games sheet leaves the screen exactly as it was', async () => {
  jest.spyOn(PlayGames, 'signIn').mockResolvedValue(null);

  const done = jest.fn();
  const tree = await openedDoor({ available: true, player: null }, done);

  await ReactTestRenderer.act(async () => {
    press(tree, 'Sign in with Play Games');
    await settle();
  });

  expect(getAccount().provider).toBe('none');
  expect(done).not.toHaveBeenCalled();
  expect(texts(tree)).not.toContain('Play Games sign-in failed');
  // Still offered, because nothing said it could not be done.
  expect(texts(tree)).toContain('SIGN IN WITH PLAY GAMES');
});

test('a failed Play Games sign-in takes its door away and leaves the others', async () => {
  // A phone with no Play Games on it, or a build whose certificate is not the
  // one registered in Play Console. Say so once, take away the button that has
  // just proved it does not work, and leave the two that need none of it.
  jest.spyOn(PlayGames, 'signIn').mockRejectedValue(new Error('E_SIGN_IN_FAILED'));

  const done = jest.fn();
  const tree = await openedDoor({ available: true, player: null }, done);

  await ReactTestRenderer.act(async () => {
    press(tree, 'Sign in with Play Games');
    await settle();
  });

  const shown = texts(tree);
  expect(getAccount().provider).toBe('none');
  expect(done).not.toHaveBeenCalled();
  expect(shown).toContain('Play Games sign-in failed');
  expect(shown).not.toContain('SIGN IN WITH PLAY GAMES');
  expect(shown).toContain('PLAY WITH GOOGLE');
  expect(shown).toContain('PLAY AS GUEST');
});

test('a build with no Google SDK still lets a player in', async () => {
  // What an iOS build without its pods, or a JS bundle ahead of the native
  // one, actually looks like: the button is not drawn, the screen says why,
  // and the guest button -- which needs no SDK and no network -- carries it.
  jest.spyOn(Google, 'isAvailable').mockReturnValue(false);
  const tree = await render(<LoginScreen onDone={() => {}} />);

  const shown = texts(tree);
  expect(shown).toContain('PLAY AS GUEST');
  expect(shown).toContain('Play as a guest -- your runs are kept on this phone.');
  expect(shown).toContain('Google sign-in is not available on this device');
  expect(shown).not.toContain('PLAY WITH GOOGLE');
});

test('signing in with Google settles the account and names the board row', async () => {
  // The whole flow bar the native picker: the SDK mock hands back an id token,
  // and Firebase's identity service trades it for a session.
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          localId: 'g1',
          refreshToken: 'r1',
          idToken: 't1',
          expiresIn: '3600',
          displayName: 'Mock Player',
          email: 'mock@example.com',
        }),
      text: () => Promise.resolve(''),
    }),
  ) as unknown as typeof fetch;

  const done = jest.fn();
  const tree = await render(<LoginScreen onDone={done} />);

  await ReactTestRenderer.act(async () => {
    press(tree, 'Play with Google');
    await settle();
  });

  expect(getAccount()).toMatchObject({ provider: 'google', email: 'mock@example.com' });
  // A player who never picked a name gets one off the account -- first name
  // only, since the board is a public list with a width.
  expect(getSettings().name).toBe('Mock');
  expect(done).toHaveBeenCalledTimes(1);
});

test('a dismissed account picker leaves the screen exactly as it was', async () => {
  // v16 reports a cancel as a result rather than an error, and it is not one:
  // nobody is signed in, nothing is said, and the screen can be tried again.
  require('@react-native-google-signin/google-signin').__setSignInResult({ type: 'cancelled' });

  const done = jest.fn();
  const tree = await render(<LoginScreen onDone={done} />);

  await ReactTestRenderer.act(async () => {
    press(tree, 'Play with Google');
    await settle();
  });

  expect(getAccount().provider).toBe('none');
  expect(done).not.toHaveBeenCalled();
  expect(texts(tree)).not.toContain('Google sign-in failed');
});

test('a returning player is offered a continue, not another sign-in', async () => {
  // The door opens on every launch now, so somebody the phone already knows
  // has to be able to walk through it without signing in again.
  signInAsGuest();
  const done = jest.fn();
  const tree = await render(<LoginScreen onDone={done} />);

  const shown = texts(tree);
  expect(shown).toContain('CONTINUE');
  expect(shown).not.toContain('PLAY AS GUEST');
  expect(shown).toContain('WELCOME BACK');

  await ReactTestRenderer.act(async () => {
    press(tree, 'Continue');
    await settle();
  });

  // Straight through, and the account it found is the account it leaves.
  expect(getAccount().provider).toBe('guest');
  expect(done).toHaveBeenCalledTimes(1);
});

test('starting as a guest settles the account and hands over once', async () => {
  const done = jest.fn();
  const tree = await render(<LoginScreen onDone={done} />);

  await ReactTestRenderer.act(async () => {
    press(tree, 'Play as guest');
    // The screen fades out before handing over, so the callback lands a beat
    // after the press rather than during it.
    await settle();
  });

  expect(getAccount().provider).toBe('guest');
  expect(done).toHaveBeenCalledTimes(1);
});

test('the door still opens when the fade never reports itself finished', async () => {
  // An `Animated` timing that is interrupted -- the app backgrounded mid-fade,
  // the view detached and re-attached under the native driver -- can call back
  // with `finished: false`, or never call back at all. The handover must not
  // hang off it: a door that sticks is the whole game stuck, with nothing for
  // the player to do but kill the app and start it again.
  const timing = jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({ start: () => {}, stop: () => {}, reset: () => {} } as never);

  const done = jest.fn();
  const tree = await render(<LoginScreen onDone={done} />);

  await ReactTestRenderer.act(async () => {
    press(tree, 'Play as guest');
    await settle();
  });

  expect(timing).toHaveBeenCalled();
  expect(getAccount().provider).toBe('guest');
  // Handed over on the clock instead, and still only once.
  expect(done).toHaveBeenCalledTimes(1);
});
