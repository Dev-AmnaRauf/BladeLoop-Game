/**
 * Sign in with Google Play Games.
 *
 * The third door on the login screen, and on Android the one with the least in
 * front of it: Play Games signs a player in against the account the phone is
 * already using, so the usual case is a toast rather than a picker. There is no
 * iOS side to this at all -- Play Games Services is an Android product -- and
 * `react-native-google-play-games` throws outright when it is called there, so
 * the platform check happens before the module is ever reached for.
 *
 * `require` inside a try, the same way `GoogleAuth` and `Ads` do it: a JS
 * bundle that got ahead of the native build has the package in `node_modules`
 * and no TurboModule behind it, and that has to read as "not available" rather
 * than as a crash on the first screen of the app.
 *
 * Unlike the other two, though, the package's JS loads happily with nothing
 * native behind it -- `TurboModuleRegistry.getEnforcing` is only called on the
 * first API call, not at import -- so a successful `require` proves nothing.
 * The honest answer needs a round trip, which is also true of the things only a
 * device knows: whether Play Games is installed, whether this build's signing
 * certificate matches the one registered in Play Console, whether the player is
 * signed in already. So availability here is asked for with `probe()` and
 * answered once, rather than being read off the module like `Google.isAvailable`
 * reads off its SDK.
 *
 * This is sign-in only. No score goes to a Play Games leaderboard and no
 * achievement is unlocked -- the board the game keeps is the Firestore one in
 * `Leaderboard`. What sign-in does do is carry over to it: `linkFirebase`
 * attaches the Play Games player to the device's Firebase account, so the
 * board row belongs to the player rather than to this install.
 */
import { Platform } from 'react-native';
import NativePlayGamesAuth from '../native/NativePlayGamesAuth';
import { signInWithPlayGames } from './firebase';
import { WEB_CLIENT_ID } from './GoogleAuth';
import * as Board from './Leaderboard';
import { getAccount, markLinked } from '../state/account';

/** Who Play Games says is holding the phone. */
export interface Player {
  /** The Play Games player id: stable for this player and this game. */
  id: string;
  /** The gamer tag, which is the name Play Games shows other players. */
  name: string;
}

/** The shape the native module hands back. */
interface NativePlayer {
  id: string;
  displayName: string;
}

interface Sdk {
  isAuthenticated(): Promise<boolean>;
  signIn(): Promise<NativePlayer>;
  getPlayer(): Promise<NativePlayer | null>;
}

/**
 * What `probe` found: whether the door can be opened at all, and who is behind
 * it if the phone is already signed in.
 */
export interface Probe {
  available: boolean;
  player: Player | null;
}

const NOTHING: Probe = { available: false, player: null };

let sdk: Sdk | null = null;
let resolved = false;

/** Find the module, if this build has it and this platform can use it. */
function getSdk(): Sdk | null {
  if (resolved) return sdk;
  resolved = true;
  // Before the require, not after: importing the package on iOS is safe, but
  // every call into it throws, and there is nothing to be gained by finding
  // that out one call later.
  if (Platform.OS !== 'android') return (sdk = null);
  try {
    const mod = require('react-native-google-play-games');
    const api = (mod.default ?? mod) as Sdk | undefined;
    sdk = typeof api?.signIn === 'function' ? api : null;
  } catch {
    sdk = null;
  }
  return sdk;
}

let available = false;

/**
 * The last answer `probe` came back with. False until it has been asked, so a
 * caller that needs the truth has to await the probe rather than read this --
 * it is here for the screens that only want to know whether to draw a row they
 * have already probed for.
 */
export function isAvailable() {
  return available;
}

let pending: Promise<Probe> | null = null;

/**
 * Ask the device whether this door exists, and who is already through it.
 *
 * Cached: the answer cannot change while the app is running, so the login
 * screen opening twice costs one round trip. The single exception is
 * `E_NO_ACTIVITY` -- Play Games needs a foreground activity, and a probe that
 * lands while the app is on its way to the background has been told nothing
 * about the device, so that one is not remembered.
 */
export function probe(): Promise<Probe> {
  if (!pending) pending = run();
  return pending;
}

async function run(): Promise<Probe> {
  const games = getSdk();
  if (!games) return NOTHING;
  let signedIn: boolean;
  try {
    // The first call into the module is also what proves the native side is
    // there: with no TurboModule behind it this rejects, and every answer below
    // is the same "no" a device with no Play Services gives.
    signedIn = await games.isAuthenticated();
  } catch (err) {
    if (code(err) === 'E_NO_ACTIVITY') pending = null;
    available = false;
    return NOTHING;
  }
  available = true;
  if (!signedIn) return { available: true, player: null };
  try {
    return { available: true, player: toPlayer(await games.getPlayer()) };
  } catch {
    // Signed in, name unknown. That is not a reason to take the door away: the
    // question this answers is whether it opens, and it has already been
    // answered. The button says what it does rather than who it is.
    return { available: true, player: null };
  }
}

/** The error code a rejected native call carries, or '' when it has none. */
function code(err: unknown) {
  return String((err as { code?: unknown })?.code ?? '');
}

function toPlayer(p: NativePlayer | null): Player | null {
  if (!p?.id) return null;
  return { id: p.id, name: p.displayName ?? '' };
}

/**
 * Open the Play Games sign-in.
 *
 * Resolves null when the player backed out of it, and throws only when
 * something actually went wrong -- a dismissed sign-in is a decision, not a
 * failure, and the screen has nothing to tell them about it. On a phone that is
 * already signed in this returns the player without showing anything at all,
 * which is the normal case and the reason this door is worth having.
 */
export async function signIn(): Promise<Player | null> {
  const games = getSdk();
  if (!games) throw new Error('Play Games is not available in this build');
  let player: Player | null;
  const asked = Date.now();
  try {
    player = toPlayer(await games.signIn());
  } catch (err) {
    // A cancel the player had time to make is a decision, and the screen has
    // nothing to tell them about it. One that came back faster than a sheet
    // can be read is Play Games refusing this build -- see `DECIDED_MS`.
    if (code(err) === 'E_SIGN_IN_CANCELLED' && Date.now() - asked >= DECIDED_MS) return null;
    // Whatever this was, the door is not one to keep offering on a screen that
    // has just been told it does not work.
    available = false;
    if (code(err) === 'E_SIGN_IN_CANCELLED') {
      throw new Error('Play Games would not open a sign-in for this build');
    }
    throw err;
  }
  if (player) available = true;
  return player;
}

/**
 * How long a sign-in has to have been in front of the player before the word
 * "cancelled" can be taken at face value.
 *
 * Play Games has one answer for two completely different events. A player who
 * opens the sheet and backs out of it, and a build Play Games refuses to talk
 * to at all, both come back as `E_SIGN_IN_CANCELLED` -- the refusal arrives as
 * a *successful* call whose `isAuthenticated` is false, and the native module
 * turns that into the same cancel. On the device the refusal is
 * `DEVELOPER_ERROR` in logcat under `PlayGamesServices[SignInAuthenticator]`,
 * and nothing whatever on screen.
 *
 * Read as a cancel, that makes a misconfigured game's sign-in button *dead*:
 * pressed, nothing happens, no error, press it again. Which is worse than a
 * button that says it failed, because it reads as the app being broken rather
 * than as something being wrong with the setup.
 *
 * The one thing that separates the two is the clock. A refusal is a round trip
 * to Play Services with no UI in it and comes back in well under a second; a
 * cancel needs a sheet drawn, read and dismissed, which no player does that
 * fast. So a "cancel" that lands sooner than this is not taken as a decision.
 *
 * Deliberately generous. Calling a real cancel a failure only puts a line of
 * text on a screen the player is already leaving, while calling a real failure
 * a cancel is the dead button this exists to stop.
 */
const DECIDED_MS = 900;

/**
 * Attach the signed-in Play Games player to a Firebase account.
 *
 * Best-effort, and never throws: the player is already in the game by the time
 * this runs, and a Firebase project whose Play Games provider is not switched
 * on yet must not turn a working sign-in into a failed one. False means the
 * board stays on the account the device already had, and the caller tries
 * again on a later launch.
 *
 * The code is asked for with the project's web client id, which is also the
 * client Firebase's Play Games provider is set up with -- the two have to be
 * the same client, or Firebase refuses the code.
 */
export async function linkFirebase(): Promise<boolean> {
  if (Platform.OS !== 'android' || !NativePlayGamesAuth) return false;
  const auth = NativePlayGamesAuth;
  try {
    const fb = await signInWithPlayGames(() => auth.requestServerAuthCode(WEB_CLIENT_ID));
    if (fb.moved) Board.rehome();
    markLinked();
    say(`firebase linked, uid ${fb.uid}${fb.moved ? ' (moved)' : ''}`);
    return true;
  } catch (err) {
    say(`firebase link failed: ${String(err)}`);
    return false;
  }
}

/**
 * A line in logcat under `BladeLoopAuth`. Never throws: a log that failed is
 * not a reason for a link that worked to report that it did not.
 */
function say(message: string) {
  try {
    NativePlayGamesAuth?.log?.(message);
  } catch {}
}

/**
 * Where the player's account stands, written to logcat at launch. A Play
 * Games player who never linked is the case worth seeing, and it is otherwise
 * invisible: the sign-in worked, so nothing on screen says anything is wrong.
 */
function logState() {
  const { provider, linked } = getAccount();
  say(`account ${provider}, linked ${linked}`);
}

/**
 * `linkFirebase`, for a Play Games player it has not yet worked for. Safe to
 * call on every launch: it does nothing for any other kind of account, and
 * nothing once the link has taken.
 */
export async function ensureLinked() {
  if (Platform.OS === 'android') logState();
  const acct = getAccount();
  if (acct.provider !== 'playgames' || acct.linked) return;
  await linkFirebase();
}

/** Forget the module and everything the probe learned. For tests. */
export function reset() {
  sdk = null;
  resolved = false;
  available = false;
  pending = null;
}

/**
 * There is deliberately no `signOut` here.
 *
 * Play Games Services v2 dropped the sign-out API -- the session belongs to the
 * phone's Google account and the Play Games app owns it, not this game. Signing
 * out in settings clears the app's own account and puts the door back up; the
 * next press of the Play Games button signs straight back in as the same
 * player, which is the behaviour every other Play Games title has.
 */
