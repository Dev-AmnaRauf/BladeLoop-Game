import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS } from './theme';
import { LEVEL_COUNT } from '../game/level';
import * as Analytics from '../services/Analytics';
import * as Board from '../services/Leaderboard';
import * as Google from '../services/GoogleAuth';
import { APP_VERSION } from '../services/links';
import { privacy, rate, shareScore } from '../services/Sharing';
import { MAX_NAME, setName, setSetting, useSettings } from '../state/settings';
import { resetProgress, useProgress } from '../state/progress';
import { signOut, useAccount } from '../state/account';
import Icon, { type IconName } from './Icon';
import Screen from './Screen';
import { TYPE } from './type';

/**
 * One row of the list: a round glyph bead, a label, and whatever the row's own
 * control is on the right.
 *
 * Every row is the same object whatever it does -- a switch, a door out to the
 * browser, or the one that throws progress away. Only the bead's colour and
 * the thing on the right say which, which is what lets six of them read as one
 * list rather than as six controls that happen to be stacked.
 */
function Row({
  icon,
  label,
  hint,
  danger,
  right,
  onPress,
  role = 'button',
  checked,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  danger?: boolean;
  right?: React.ReactNode;
  onPress: () => void;
  role?: 'button' | 'switch';
  checked?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'switch' ? { checked: !!checked } : undefined}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.bead, danger && styles.beadDanger]}>
        <Icon name={icon} size={19} color={COLORS.onCard} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={styles.rowHint} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right ?? <Icon name="chevron" size={20} color={COLORS.faint} />}
    </Pressable>
  );
}

/**
 * The switch on the right of a row that turns something on or off.
 *
 * A knob in a track rather than the word ON or OFF: a player glancing down a
 * list of three of these is reading *which* are on, and a shape says that in
 * one look where three short words have to be read one at a time.
 */
function Toggle({ value }: { value: boolean }) {
  return (
    <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </View>
  );
}

/**
 * Settings.
 *
 * Three switches for what the game does to the room it is played in, three
 * doors -- start over, the privacy policy, the store listing -- and, under
 * those, the account: the name a score goes onto the board under, the share
 * sheet, and the way back to the sign-in screen.
 *
 * Music, sound effects and vibration are three switches rather than the one
 * master they used to be. The floating speaker button is still a master over
 * the first two and always will be, but a player who wants the loop off and
 * the coins still clicking had no way to say so, and that is the commonest
 * thing anybody actually wants from a game's sound settings.
 *
 * It is drawn inside the game's own view tree rather than as a native modal
 * window, the way the shop and the board are: a native modal takes its
 * orientation from the OS and can come up sideways over a game that has not
 * turned. Drawn here it always shares the game's size and orientation.
 */
function SettingsScreen({
  visible,
  onBack,
  /** Called once the account is cleared, so the door can be put back up. */
  onSignOut,
}: {
  visible: boolean;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const settings = useSettings();
  const progress = useProgress();
  const acct = useAccount();
  // The field is edited locally and committed on blur, so a name is not
  // rewritten to disk (and pushed to the board) on every keystroke.
  const [draft, setDraft] = useState(settings.name);

  useEffect(() => {
    if (visible) {
      setDraft(settings.name);
      Analytics.track('settings_open', {});
    }
    // The saved name only needs pulling in when the screen opens; while it is
    // open the field is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const commitName = useCallback(() => {
    const next = draft.trim().slice(0, MAX_NAME);
    if (next === settings.name) return;
    setName(next);
    Analytics.track('setting_change', { setting: 'name', value: next.length > 0 });
    // Their existing row still carries the old name, so push the new one up.
    Board.syncName(progress.runs);
  }, [draft, settings.name, progress.runs]);

  /** One switch, flipped and reported. The three rows differ only by key. */
  const flip = useCallback((key: 'music' | 'sfx' | 'vibrate', next: boolean) => {
    setSetting(key, next);
    Analytics.track('setting_change', { setting: key, value: String(next) });
  }, []);

  const onShare = useCallback(() => {
    shareScore(progress.best, 0, 'settings');
  }, [progress.best]);

  const onReset = useCallback(() => {
    Alert.alert(
      'Start from nothing?',
      'Your gems, your stars, your best run and your run count are all cleared. Your settings and your place on the board are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetProgress();
            Analytics.track('progress_reset', {});
          },
        },
      ],
    );
  }, []);

  /**
   * Back to the login screen. Nothing earned is touched: gems, best run and
   * name all live in their own slices and stay on the device, so this is only
   * a change of who is playing.
   *
   * The Google session is dropped alongside the app's own account, so the next
   * sign-in asks which account rather than silently taking the last one back.
   * It is not awaited -- the account here is cleared either way, and holding
   * the page open on an SDK that may not even be in the build would leave a
   * button that has already been pressed looking dead.
   *
   * A Play Games session has no equivalent: v2 of the service dropped sign-out,
   * because the session belongs to the phone's Google account rather than to
   * this game. Signing out still puts the door back up, and the button behind
   * it signs the same player straight back in. See `services/PlayGames`.
   */
  const onLeave = useCallback(() => {
    Alert.alert(
      'Sign out?',
      'You go back to the sign-in screen. Your gems, your stars, your best run and your name stay on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          onPress: () => {
            if (acct.provider === 'google') Google.signOut();
            signOut();
            Analytics.track('sign_out', { provider: acct.provider });
            onSignOut();
          },
        },
      ],
    );
  }, [acct.provider, onSignOut]);

  if (!visible) return null;

  return (
    // Two groups of rows, and held sideways there is room for both of them
    // abreast rather than one scrolled past the bottom of the other.
    <Screen title="SETTINGS" onBack={onBack} columns>
      <View style={styles.group}>
        <Row
          icon="music"
          label="Music"
          role="switch"
          checked={settings.music}
          right={<Toggle value={settings.music} />}
          onPress={() => flip('music', !settings.music)}
        />
        <Row
          icon={settings.sfx ? 'soundOn' : 'soundOff'}
          label="Sound Effects"
          role="switch"
          checked={settings.sfx}
          right={<Toggle value={settings.sfx} />}
          onPress={() => flip('sfx', !settings.sfx)}
        />
        <Row
          icon="vibrate"
          label="Vibration"
          role="switch"
          checked={settings.vibrate}
          right={<Toggle value={settings.vibrate} />}
          onPress={() => flip('vibrate', !settings.vibrate)}
        />
        <Row
          icon="retry"
          label="Reset Progress"
          hint={
            progress.cleared > LEVEL_COUNT
              ? `${progress.coins} gems  ·  ${progress.cleared} levels cleared`
              : `${progress.coins} gems  ·  ${progress.cleared}/${LEVEL_COUNT} stars`
          }
          danger
          onPress={onReset}
        />
        <Row icon="privacy" label="Privacy Policy" onPress={privacy} />
        <Row icon="rate" label="Rate Us" onPress={rate} />
      </View>

      {/* The account. Kept below the six the game itself owns, because this is
          the half of the page that is about the player rather than the app --
          and the name is the only field on either half, so it belongs with the
          row that signs them out rather than in the middle of the switches. */}
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={styles.bead}>
            <Icon name="guest" size={19} color={COLORS.onCard} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Your name</Text>
            <Text style={styles.rowHint} numberOfLines={1}>
              Shown on the leaderboard
            </Text>
          </View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commitName}
            onSubmitEditing={commitName}
            placeholder="TAP TO NAME"
            placeholderTextColor={COLORS.faint}
            maxLength={MAX_NAME}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Your name"
            style={styles.name}
          />
        </View>
        <Row
          icon="share"
          label="Share the game"
          hint={progress.best > 0 ? `Send your best of ${progress.best}` : undefined}
          onPress={onShare}
        />
        <Row
          icon="signOut"
          label="Sign out"
          hint={
            acct.provider === 'google'
              ? acct.email || acct.name
              : acct.provider === 'playgames'
              ? acct.name || 'Signed in with Play Games'
              : 'Playing as a guest'
          }
          onPress={onLeave}
        />

        {/* Who made it and which build this is, which is the one thing a
            support mail always has to ask for and never gets. It sits inside
            the account group rather than beside it: the page lays its groups
            out two abreast on a screen held sideways, and a stamp standing as
            a block of its own would drop to a row under the pair with nothing
            next to it. */}
        <View style={styles.foot}>
          <View style={styles.stamp}>
            <Text style={styles.stampTxt}>BLADE LOOP</Text>
          </View>
          <Text style={styles.version}>{`Version ${APP_VERSION}`}</Text>
        </View>
      </View>
    </Screen>
  );
}

/** How wide the switch track is, and how big the knob riding in it is. */
const TRACK = 52;
const KNOB = 22;

const styles = StyleSheet.create({
  group: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    // A surface lifted off the night ground, outlined rather than shadowed:
    // a shadow on this ground is invisible, and an outline is what separates
    // one row from the next.
    backgroundColor: COLORS.panel,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  pressed: { opacity: 0.72 },
  // The glyph rides its own disc, so a row reads as the same object every
  // round control in the game is.
  bead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The one row that throws something away wears the colour that says so.
  beadDanger: { backgroundColor: COLORS.dangerFace },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, ...TYPE.bold, color: COLORS.ink },
  rowHint: { fontSize: 11, ...TYPE.semi, color: COLORS.muted, marginTop: 2 },
  name: {
    minWidth: 110,
    maxWidth: 140,
    fontSize: 15,
    ...TYPE.black,
    letterSpacing: 0.5,
    color: COLORS.ink,
    textAlign: 'right',
    textTransform: 'uppercase',
    // Android gives an editable field its own padding and baseline; this one
    // sits on a row, so it is stripped back to the text.
    padding: 0,
  },
  track: {
    width: TRACK,
    height: KNOB + 8,
    borderRadius: 999,
    padding: 4,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: COLORS.goFace },
  trackOff: { backgroundColor: COLORS.ring },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: COLORS.onCard,
  },
  knobOn: { alignSelf: 'flex-end' },
  knobOff: { alignSelf: 'flex-start' },
  foot: { alignItems: 'center', gap: 8, marginTop: 14 },
  stamp: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.panel,
    borderWidth: 1.5,
    borderColor: COLORS.line,
  },
  stampTxt: { fontSize: 12, ...TYPE.black, letterSpacing: 2, color: COLORS.ink },
  version: { fontSize: 11, ...TYPE.medium, color: COLORS.faint },
});

/** Memoised: the run re-renders every frame, and this does not move with it. */
export default React.memo(SettingsScreen);
