/* eslint-disable react-native/no-inline-styles -- one-off layout */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import * as Analytics from '../services/Analytics';
import * as Google from '../services/GoogleAuth';
import * as Haptics from '../services/Haptics';
import * as PlayGames from '../services/PlayGames';
import * as Sound from '../services/SoundService';
import { signInAsGoogle, signInAsGuest, signInAsPlayGames, useAccount } from '../state/account';
import { getSettings, setName } from '../state/settings';
import Backdrop from './Backdrop';
import Button from './Button';
import { playThen } from './handover';
import { Ball, Saw } from './entities';
import { useLayout } from './layout';
import Wordmark from './Wordmark';
import { TYPE } from './type';

/**
 * Where the sky behind the door is parked.
 *
 * It does not drift. The moving backdrop is the front page's -- the game
 * showing itself off -- and a door that is busy behind the glass reads as the
 * same screen the player is about to see again.
 */
const CAM_Y = 260;

/** The crowd in the sky is drawn in full: this page shares the front page's. */
const DIM = 1;

/** How long the door takes to fade out of the way of the game, in ms. */
const LEAVE_MS = 260;

/** How wide the column of buttons is allowed to get. */
const PANEL_W = 340;

/**
 * Radius the blades circle the character at, and how big they are, at `ui` 1.
 *
 * Scaled by the page's own `ui` rather than used raw, the way the front
 * page's are: the game is sideways throughout, so the room this has to fit in
 * is the phone's short side. See `layout`.
 */
const ORBIT = 62;
const BLADE = 28;

/** BLADE's type size at `ui` 1; the rest of the mark is a share of it. */
const WORD_BLADE = 48;

/** How much of the ring the character fills, as a share of the orbit. */
const HERO = 3.2 / 62;

/**
 * The door into the game: up to three ways in, every one of them a way to play.
 *
 * It comes before the splash rather than instead of it, and it is built out of
 * the same pieces: the stacked logo with its gold loop, the character inside a
 * ring of blades, the pastel sky behind both. What it does not carry is the
 * front page's own furniture -- no stars, no corners, no road -- and the two
 * doors stand straight on the sky rather than inside a card. That is the whole
 * difference the player is meant to read: the same world, with one decision in
 * it instead of a game's worth of them.
 *
 * Every launch opens here, a returning player included -- but a returning
 * player is never asked to sign in again. The phone already knows who they
 * are, so the button becomes a CONTINUE that changes nothing, and Google is
 * offered only to a guest who might want to trade up. Signing a returning
 * player in again would be worse than pointless: the guest button would throw
 * away the Google account they already had.
 *
 * No button here is a wall, and each is labelled with what it does rather than
 * what it costs: SIGN IN WITH PLAY GAMES and PLAY WITH GOOGLE both put a run on
 * the board under an account that survives this install, and PLAY AS GUEST is
 * underneath them for someone who only wants to play, so nobody is held at the
 * door by a network that is down or an SDK that is not in the build. Both of
 * the signed-in doors only appear once the device has said it can open them.
 *
 * The doors spring in and nothing else moves. The world is already ticking
 * behind this screen, and a login that stutters is a bad first frame.
 *
 * On a screen too short to stack them -- which, the game being sideways
 * throughout, is every phone -- the game's own mark and the column of doors
 * sit side by side instead: the signature on the left, the decision on the
 * right. A tablet has the height for the stack and keeps it. See `layout`.
 */
function LoginScreen({
  /** Called once an account is settled on, either way. */
  onDone,
}: {
  onDone: () => void;
}) {
  const { w: W, h: H, top, bottom, ui, tight, gutL, gutR } = useLayout();
  // The furniture, at this window's scale. The orbit is what the character
  // and the three blades are both hung off.
  const orbit = ORBIT * ui;
  const blade = BLADE * ui;
  const stage = orbit * 2 + blade;
  // Who the phone already has, if anybody. The whole difference between a
  // first open and every one after it.
  const acct = useAccount();
  const returning = acct.provider !== 'none';
  const enter = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(1)).current;
  const done = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Whether the Google button can do anything on this device. Read once: the
  // native module either came up with the app or it did not.
  const [hasGoogle] = useState(() => Google.isAvailable());
  // The same question for Play Games, which only the device can answer -- so it
  // is asked rather than read, and the door appears when the answer lands. See
  // `services/PlayGames`. A screen that drew the button first and found out
  // afterwards would be offering a door onto nothing.
  const [hasPlayGames, setHasPlayGames] = useState(false);

  useEffect(() => {
    Analytics.screen('login');
  }, []);

  useEffect(() => {
    let alive = true;
    // Only ever a yes: the screen starts with no Play Games door and the probe
    // can put one up, which is a state this cannot re-enter by answering no to
    // a screen that was already showing nothing.
    PlayGames.probe().then(found => {
      if (alive && found.available) setHasPlayGames(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The pending handover, dropped if the door goes away before it fires.
  const standDown = useRef<(() => void) | null>(null);
  useEffect(() => () => standDown.current?.(), []);

  useEffect(() => {
    const intro = Animated.spring(enter, {
      toValue: 1,
      // Enough overshoot to read as the panel landing, damped enough that it
      // settles rather than wobbles.
      friction: 7,
      tension: 110,
      useNativeDriver: true,
    });
    intro.start();
    return () => intro.stop();
  }, [enter]);

  /**
   * Fade the whole screen out and hand over. Guarded: one exit only -- and it
   * happens on the clock if the fade does not report itself finished, since
   * this is the door into the game and a door that sticks is the whole app
   * stuck. See `playThen`.
   */
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    standDown.current = playThen(
      Animated.timing(leave, {
        toValue: 0,
        duration: LEAVE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      LEAVE_MS,
      onDone,
    );
  }, [leave, onDone]);

  /**
   * The primary door. On a phone that has not been here before it signs the
   * player in as a guest; on one that has, it is a CONTINUE that touches the
   * account not at all.
   */
  const onPlay = useCallback(() => {
    if (busy || done.current) return;
    Sound.play('button');
    Haptics.buzz('light');
    if (!returning) {
      Analytics.track('sign_in', { provider: 'guest' });
      signInAsGuest();
    }
    finish();
  }, [busy, finish, returning]);

  const onGoogle = useCallback(async () => {
    if (busy || done.current) return;
    Sound.play('button');
    Haptics.buzz('light');
    setBusy(true);
    setError('');
    try {
      const user = await Google.signIn();
      // Null means the account picker was dismissed: no account, no error, and
      // the screen stays exactly as it was so it can be tried again.
      if (!user) return;
      signInAsGoogle(user.name, user.email);
      // A board row is labelled with the settings name, and a player who has
      // never picked one has just told us what to call them. First name only:
      // the board is a public list, and it has a width.
      if (!getSettings().name && user.name) setName(user.name.split(' ')[0]);
      Analytics.track('sign_in', { provider: 'google' });
      finish();
    } catch {
      // Anything that actually failed -- no network, Play Services missing,
      // the project's sign-in method switched off. Say so once, and leave the
      // start button, which needs none of that, sitting right underneath.
      setError('Google sign-in failed. Check your connection, or play as a guest.');
    } finally {
      setBusy(false);
    }
  }, [busy, finish]);

  const onPlayGames = useCallback(async () => {
    if (busy || done.current) return;
    Sound.play('button');
    Haptics.buzz('light');
    setBusy(true);
    setError('');
    try {
      const player = await PlayGames.signIn();
      // Null is a dismissed sign-in: no account, no error, and the screen is
      // left exactly as it was so it can be tried again.
      if (!player) return;
      signInAsPlayGames(player.name, player.id);
      // Same as the Google door: a player who has never picked a board name has
      // just told us what to call them. The gamer tag goes up whole rather than
      // split at the first space the way a Google account's name is -- it is a
      // handle the player chose to be known by, not their legal name, and
      // `setName` caps it to the width the board has anyway.
      if (!getSettings().name && player.name) setName(player.name);
      // The board row goes with the player from here on, not with the install.
      // Best-effort: a failed link leaves them signed in, and is tried again
      // on the next launch.
      await PlayGames.linkFirebase();
      Analytics.track('sign_in', { provider: 'play_games' });
      finish();
    } catch {
      // Play Games not installed, the build's certificate not registered
      // against the Play Console game, or the service simply down. The door is
      // taken away rather than left to be pressed again -- the service has just
      // said it cannot open it -- and the two underneath need none of it.
      setHasPlayGames(false);
      setError('Play Games sign-in failed. Use Google, or play as a guest.');
    } finally {
      setBusy(false);
    }
  }, [busy, finish]);

  // Clamped: the spring overshoots past 1, which is the point for the scale
  // and wrong for an opacity.
  const fade = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const panelScale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });
  const panelY = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  // Google is worth offering to somebody with no account and to a guest who
  // might trade up, but not to somebody already signed in with it.
  const showGoogle = hasGoogle && acct.provider !== 'google';
  // The same rule for Play Games, for the same reason: it is worth offering to
  // somebody with no account and to a guest who might trade up, and pointless
  // in front of a player who is already in through it.
  const showPlayGames = hasPlayGames && acct.provider !== 'playgames';
  const lead = returning ? 'WELCOME BACK' : 'SIGN IN TO KEEP YOUR SCORES';
  const playLabel = returning ? 'CONTINUE' : 'PLAY AS GUEST';
  const foot =
    acct.provider === 'google'
      ? `Signed in as ${acct.email || acct.name}`
      : acct.provider === 'playgames'
      ? `Signed in as ${acct.name || 'a Play Games player'}`
      : acct.provider === 'guest'
      ? 'Playing as a guest on this phone.'
      : hasGoogle || hasPlayGames
      ? 'A guest run is kept on this phone only.'
      : 'Play as a guest -- your runs are kept on this phone.';

  return (
    // The screen claims every touch its own controls do not, so a tap on the
    // background cannot reach the run waiting underneath and steer it blind.
    <Animated.View
      testID="door"
      style={[
        styles.fill,
        tight && styles.fillWide,
        {
          opacity: leave,
          paddingTop: top + (tight ? 8 : 0),
          paddingLeft: gutL,
          paddingRight: gutR,
          paddingBottom: bottom + (tight ? 8 : 0),
        },
      ]}
      onStartShouldSetResponder={() => true}>
      <Backdrop camY={CAM_Y} width={W} height={H} dim={DIM} />

      {/* The game's signature: its logo over its character. Stacked down the
          page on a screen tall enough, and the left half of the row on one
          that is not -- either way the two of them travel together, because
          between them they are the one thing on this screen that is not a
          decision. */}
      <View style={[styles.brand, tight && styles.brandWide]}>
        {/* The game's own logo, at the size the front page wears it. This is a
            door into the game, not a form, so it is signed the same way. */}
        <Animated.View style={[styles.mark, { marginTop: tight ? 0 : 18, opacity: fade }]}>
          <Wordmark size={WORD_BLADE * ui} />
        </Animated.View>

        {/* The character, waiting inside its ring of blades. Still: the world
            is already ticking behind this screen and the panel is what moves. */}
        <Animated.View style={[styles.stage, { width: stage, height: stage, opacity: fade }]}>
          <View
            pointerEvents="none"
            style={[styles.halo, { width: orbit * 1.9, height: orbit * 1.9, opacity: 0.22 }]}
          />
          <View
            pointerEvents="none"
            style={[styles.halo, { width: orbit * 1.35, height: orbit * 1.35, opacity: 0.32 }]}
          />
          {[0, 1, 2].map(i => {
            const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: orbit + Math.cos(a) * orbit,
                  top: orbit + Math.sin(a) * orbit,
                  width: 0,
                  height: 0,
                }}>
                <Saw x={0} y={0} size={blade} rot={i * 0.7} />
              </View>
            );
          })}
          <View style={styles.hero}>
            <Ball x={0} y={0} scale={orbit * HERO} />
          </View>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.doors,
          tight && styles.doorsWide,
          {
            opacity: fade,
            transform: [{ scale: panelScale }, { translateY: panelY }],
          },
        ]}>
        <Text style={styles.lead}>{lead}</Text>

        {/* Play Games stands above Google because on the phone this game ships
            to it is the shorter walk: the account is already on the device, so
            the usual press of this is a toast rather than a picker. */}
        {showPlayGames ? (
          <View style={styles.row}>
            <Button
              label={busy ? 'SIGNING IN' : 'SIGN IN WITH PLAY GAMES'}
              a11y="Sign in with Play Games"
              icon="playGames"
              chevron
              tone="violet"
              disabled={busy}
              onPress={onPlayGames}
            />
          </View>
        ) : null}

        {showGoogle ? (
          <View style={styles.row}>
            <Button
              label={busy ? 'SIGNING IN' : 'PLAY WITH GOOGLE'}
              a11y="Play with Google"
              icon="google"
              chevron
              tone="blue"
              disabled={busy}
              onPress={onGoogle}
            />
          </View>
        ) : hasGoogle ? null : (
          // Honest rather than hopeful: a button that cannot open an account
          // picker is worse than a line saying why it is not there. Only worth
          // saying to somebody who might have wanted it.
          <Text style={styles.note}>Google sign-in is not available on this device.</Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.row}>
          <Button
            label={playLabel}
            a11y={playLabel === 'CONTINUE' ? 'Continue' : 'Play as guest'}
            chevron
            disabled={busy}
            onPress={onPlay}
          />
        </View>

        <Text style={styles.foot}>{foot}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  // Side by side rather than stacked, on a viewport too short to stack in.
  fillWide: { flexDirection: 'row' },
  // The signature: logo over character, and the pair of them is one half of
  // the row. `shrink` so a narrow phone gives the doors their width first --
  // this half is the decoration and that half is the decision.
  brand: { alignItems: 'center' },
  brandWide: { flexShrink: 1, gap: 6 },
  mark: { alignItems: 'center' },
  // Every size on the stage is handed in, scaled off the orbit: see `ui`.
  stage: { alignItems: 'center', justifyContent: 'center' },
  hero: { width: 0, height: 0 },
  halo: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.onCard,
  },
  doors: {
    width: '100%',
    maxWidth: PANEL_W + 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  // The other half of the row. It is the half that has to fit whatever it
  // holds -- up to three pills and three lines of type -- so it is given the
  // width first and the signature beside it takes what is left.
  doorsWide: { width: undefined, flexGrow: 1, flexShrink: 0, flexBasis: PANEL_W, gap: 9 },
  // Everything from here down is read straight off the sky, which is light --
  // so it is set in the dark end of the sky's own violet rather than in the
  // pale ink a card would have carried.
  lead: {
    fontSize: 13,
    ...TYPE.black,
    letterSpacing: 2,
    color: COLORS.skyInk,
    textAlign: 'center',
  },
  // The pills are full-width by construction, so this is what holds them to
  // the width the column is laid out against.
  row: { alignSelf: 'stretch', maxWidth: PANEL_W },
  note: {
    fontSize: 12,
    ...TYPE.medium,
    color: COLORS.skyInkSoft,
    textAlign: 'center',
  },
  // A failure needs the blade's own hue and the sky is pale, so it is the
  // darkest end of it: the bright pink would be a whisper on this ground.
  error: {
    fontSize: 12,
    ...TYPE.semi,
    color: COLORS.failEdge,
    textAlign: 'center',
  },
  foot: {
    fontSize: 11,
    ...TYPE.medium,
    letterSpacing: 0.5,
    color: COLORS.skyInkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
});

/** Memoised: the run re-renders every frame, and this does not move with it. */
export default React.memo(LoginScreen);
