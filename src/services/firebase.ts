/**
 * Firebase over plain HTTPS.
 *
 * The leaderboard needs one collection read and one document write, which the
 * Firestore REST API does with `fetch` alone -- no native SDK, so it works in
 * the app as it builds today and under Jest without a mock of a native module.
 * If `@react-native-firebase/firestore` is ever added for other reasons, this
 * file is the only thing the leaderboard would have to swap.
 *
 * The values below come from `android/app/google-services.json`. A Firebase
 * web API key is a public client identifier, not a secret: it names the
 * project, and what a caller may actually do is decided by the security rules
 * (see `docs/INTEGRATIONS.md`). Shipping it in the bundle is how Firebase is
 * meant to be used -- but the rules have to be tight, because everyone with
 * the app has this key.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FIREBASE = {
  projectId: 'bladeloop-4d203',
  apiKey: 'AIzaSyBiXULpfwPQNpF5mmUJzhGgJEqSdrejZjo',
};

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts';
const SECURETOKEN = 'https://securetoken.googleapis.com/v1/token';

export const DOCS = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;

const AUTH_KEY = 'bladeloop.auth.v1';

/** Nothing the board does is worth making the player wait longer than this. */
const TIMEOUT_MS = 10000;
/** Refresh a token this long before it actually expires. */
const EXPIRY_SLACK_MS = 60000;

interface SavedAuth {
  uid: string;
  refreshToken: string;
}

interface Session extends SavedAuth {
  idToken: string;
  /** Epoch ms the id token stops being accepted. */
  expiresAt: number;
}

let session: Session | null = null;
/** In-flight sign-in, so a burst of calls shares one round trip. */
let pending: Promise<Session | null> | null = null;

/** `fetch` that gives up rather than hanging a screen on a dead network. */
export async function timedFetch(url: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url: string, body: unknown) {
  const res = await timedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

/** A brand new anonymous account. The uid it returns is this device's row. */
async function signUp(): Promise<Session> {
  const data = await postJson(`${IDENTITY}:signUp?key=${FIREBASE.apiKey}`, {
    returnSecureToken: true,
  });
  const saved: SavedAuth = {
    uid: data.localId,
    refreshToken: data.refreshToken,
  };
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(saved)).catch(() => {});
  return {
    ...saved,
    idToken: data.idToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
}

/** A fresh id token for an account this device already has. */
async function refresh(saved: SavedAuth): Promise<Session> {
  const data = await postJson(
    `${SECURETOKEN}?key=${FIREBASE.apiKey}`,
    // The token endpoint takes JSON as well as the documented form encoding.
    { grant_type: 'refresh_token', refresh_token: saved.refreshToken },
  );
  return {
    uid: data.user_id ?? saved.uid,
    refreshToken: data.refresh_token ?? saved.refreshToken,
    idToken: data.id_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
}

async function openSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as SavedAuth;
      try {
        return await refresh(saved);
      } catch {
        // The stored account is gone or the token was revoked; start over
        // rather than leaving the device permanently unable to post a score.
        await AsyncStorage.removeItem(AUTH_KEY).catch(() => {});
      }
    }
    return await signUp();
  } catch {
    // Offline, or the project has anonymous sign-in turned off. Callers treat
    // a null session as "the board is unreachable right now".
    return null;
  }
}

/**
 * The current signed-in session, opening one if needed. Null means the device
 * could not reach Firebase -- never a reason to fail the run, only a reason to
 * fall back to the locally cached board.
 */
export async function auth(): Promise<Session | null> {
  if (session && session.expiresAt - EXPIRY_SLACK_MS > Date.now()) return session;
  if (!pending) {
    pending = openSession().then(s => {
      session = s;
      pending = null;
      return s;
    });
  }
  return pending;
}

/**
 * Trade a Google id token for a Firebase account.
 *
 * The device already has an anonymous account by the time anyone reaches the
 * login screen, and this replaces it: the same REST service the anonymous
 * sign-up uses, pointed at Google as the identity provider. What comes back is
 * a session like any other, so the leaderboard writes carry on unchanged --
 * they just go out under an account the player can sign back into on another
 * phone rather than one tied to this install.
 *
 * Throws when the exchange is refused, so the caller can say so; the stored
 * session is left alone in that case and the device stays on the account it
 * already had.
 */
export async function signInWithGoogle(googleIdToken: string) {
  return signInWithIdp(`id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`);
}

/**
 * Trade a Play Games server auth code for a Firebase account.
 *
 * Unlike the Google door this tries to *link* first: the provider is attached
 * to the account the device is already on, so the uid -- and with it the
 * player's row on the board -- stays exactly where it was. Only when this Play
 * Games player already has a Firebase account of their own (they signed in on
 * another phone first) does the device move over to that one instead.
 *
 * `nextCode` is asked for a code each time one is needed rather than handed
 * one: a code is good for a single exchange, and a refused link has used it.
 */
export async function signInWithPlayGames(nextCode: () => Promise<string>) {
  const body = async () =>
    `code=${encodeURIComponent(await nextCode())}&providerId=playgames.google.com`;
  const current = await auth();
  if (current) {
    try {
      return await signInWithIdp(await body(), current.idToken);
    } catch (err) {
      if (!String(err).includes('FEDERATED_USER_ID_ALREADY_LINKED')) throw err;
    }
  }
  return signInWithIdp(await body());
}

/**
 * The exchange both doors share. With `linkTo` -- the id token of the account
 * the device is on -- the provider is linked to that account rather than
 * signed in to on its own.
 */
async function signInWithIdp(postBody: string, linkTo?: string) {
  const data = await postJson(`${IDENTITY}:signInWithIdp?key=${FIREBASE.apiKey}`, {
    postBody,
    ...(linkTo ? { idToken: linkTo } : {}),
    // Required by the endpoint and unused by a native client: there is no web
    // page for it to come back to.
    requestUri: 'http://localhost',
    returnSecureToken: true,
  });
  const before = await savedUid();
  const saved: SavedAuth = {
    uid: data.localId,
    refreshToken: data.refreshToken,
  };
  await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(saved)).catch(() => {});
  session = {
    ...saved,
    idToken: data.idToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
  return {
    uid: saved.uid,
    name: String(data.displayName ?? ''),
    email: String(data.email ?? ''),
    /** True when the device is now on a different account from before. */
    moved: before !== saved.uid,
  };
}

/** The uid of the account this device last saved, or null for none. */
async function savedUid() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as SavedAuth).uid : null;
  } catch {
    return null;
  }
}

/** Forget this device's anonymous account. Its row on the board stays put. */
export async function forgetAuth() {
  session = null;
  await AsyncStorage.removeItem(AUTH_KEY).catch(() => {});
}

// --- Firestore's typed-value wire format ----------------------------------

type FieldValue = Record<string, unknown>;

export type Scalar = string | number | boolean | null;

export function toFields(obj: Record<string, Scalar>): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) out[k] = { nullValue: null };
    else if (typeof v === 'string') out[k] = { stringValue: v };
    else if (typeof v === 'boolean') out[k] = { booleanValue: v };
    // Firestore keeps integers and doubles apart, and the board orders by an
    // integer field -- a score written as a double would sort in its own group.
    else if (Number.isInteger(v)) out[k] = { integerValue: String(v) };
    else out[k] = { doubleValue: v };
  }
  return out;
}

export function fromFields(fields: Record<string, FieldValue> | undefined) {
  const out: Record<string, Scalar> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
    else if ('booleanValue' in v) out[k] = Boolean(v.booleanValue);
    else if ('nullValue' in v) out[k] = null;
    else if ('stringValue' in v) out[k] = String(v.stringValue);
    else if ('timestampValue' in v) out[k] = String(v.timestampValue);
  }
  return out;
}
