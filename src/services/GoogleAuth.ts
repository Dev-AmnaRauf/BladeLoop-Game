/**
 * Sign in with Google.
 *
 * `@react-native-google-signin/google-signin` is installed, but it is still
 * picked up at runtime rather than imported, the same way `PlayGames` reaches
 * for its module: a JS bundle that got ahead of the native build, an iOS build whose
 * pods are not in yet, or a device with no Play Services all answer honestly
 * that Google sign-in is unavailable, and the login screen offers the guest
 * button on its own rather than one that cannot work. The Android SHA-1 still
 * has to be registered with Firebase for the picker to succeed on a device --
 * see `docs/INTEGRATIONS.md`.
 *
 * The token this gets back is a Google id token, which is not something the
 * leaderboard can use directly; `firebase.signInWithGoogle` trades it for a
 * Firebase session, and that is what the rest of the app already speaks.
 */
import { signInWithGoogle } from './firebase';
import * as Board from './Leaderboard';

/**
 * The project's web client id, from `android/app/google-services.json` (the
 * `client_type: 3` entry). Google's own libraries require the *web* client id
 * here even on Android -- the Android client is matched by signing certificate
 * instead. It is a public identifier, like the API key next to it.
 */
export const WEB_CLIENT_ID =
  '541403839742-m362nhvl6klju4m45693ngarb2q0oe5c.apps.googleusercontent.com';

interface GoogleUser {
  name: string;
  email: string;
}

interface Sdk {
  configure(opts: { webClientId: string; offlineAccess?: boolean }): void;
  hasPlayServices(opts?: { showPlayServicesUpdateDialog?: boolean }): Promise<boolean>;
  signIn(): Promise<unknown>;
  signOut(): Promise<unknown>;
}

let sdk: Sdk | null = null;
let resolved = false;

/**
 * Find the module, if this build has it, and configure it once.
 *
 * `require` inside a try is deliberate: an `import` of a package that is not
 * installed is a Metro build error, while this is a runtime miss the screen
 * can render around.
 */
function getSdk(): Sdk | null {
  if (resolved) return sdk;
  resolved = true;
  try {
    const mod = require('@react-native-google-signin/google-signin');
    const google = (mod.GoogleSignin ?? mod.default?.GoogleSignin) as Sdk | undefined;
    if (!google) return (sdk = null);
    google.configure({ webClientId: WEB_CLIENT_ID });
    sdk = google;
  } catch {
    sdk = null;
  }
  return sdk;
}

/** True when the button can actually do something on this device. */
export function isAvailable() {
  return getSdk() !== null;
}

/**
 * The id token out of whichever shape of result this version of the SDK
 * returns. v13 wraps it in `{ type, data }`; older ones hand back the user
 * object directly. Reading both means an upgrade of the package is not also a
 * silent breakage of the login screen.
 */
function readToken(res: unknown) {
  const r = res as {
    idToken?: string;
    data?: { idToken?: string; user?: unknown };
    user?: unknown;
  };
  const idToken = r?.idToken ?? r?.data?.idToken ?? null;
  const user = (r?.data?.user ?? r?.user ?? {}) as {
    name?: string;
    email?: string;
  };
  return { idToken, name: user.name ?? '', email: user.email ?? '' };
}

/**
 * Run the whole flow: Google's account picker, then the trade for a Firebase
 * session. Resolves null when the player backed out of the picker, and throws
 * only when something actually went wrong -- a cancel is not an error worth
 * putting a message on screen for.
 */
export async function signIn(): Promise<GoogleUser | null> {
  const google = getSdk();
  if (!google) throw new Error('Google sign-in is not available in this build');
  await google.hasPlayServices({ showPlayServicesUpdateDialog: true });
  let res: unknown;
  try {
    res = await google.signIn();
  } catch (err) {
    // Every version of the SDK reports a dismissed picker differently; none of
    // them is a failure the player needs told about.
    const code = String((err as { code?: unknown })?.code ?? '');
    if (code === 'SIGN_IN_CANCELLED' || code === '12501' || code === '-5') return null;
    throw err;
  }
  const { idToken, name, email } = readToken(res);
  // v13 returns `{ type: 'cancelled' }` rather than throwing.
  if (!idToken) return null;
  const fb = await signInWithGoogle(idToken);
  if (fb.moved) Board.rehome();
  return { name: fb.name || name, email: fb.email || email };
}

/** Drop the Google session, so the next sign-in asks which account again. */
export async function signOut() {
  try {
    await getSdk()?.signOut();
  } catch {
    // Already signed out, or the SDK is not here. Either way there is nothing
    // to undo, and the app-side account state is cleared by the caller.
  }
}
