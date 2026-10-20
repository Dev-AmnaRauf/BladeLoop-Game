/**
 * Usage analytics.
 *
 * Every call site goes through `track(name, params)`; this file owns whether
 * there is a backend at all. Firebase Analytics is picked up at runtime if the
 * native module is installed (see `docs/INTEGRATIONS.md`) and otherwise the
 * events go nowhere but the in-memory ring buffer and, in a debug build, the
 * console. That means the analytics calls can be written into the game now and
 * start reporting the day the SDK is added, without a second pass over the
 * call sites.
 *
 * Consent is checked here rather than at the call sites, so no screen can
 * forget it: with `settings.analytics` off nothing is recorded and nothing is
 * sent.
 */
import { getSettings, settings } from '../state/settings';

/**
 * The events the game reports. A closed set rather than free strings: these
 * become columns in a dashboard, and a typo would quietly become a new event
 * nobody is looking at.
 */
export type EventName =
  | 'app_open'
  | 'sign_in'
  | 'sign_out'
  | 'run_start'
  | 'run_end'
  | 'level_clear'
  | 'revive'
  | 'checkpoint'
  | 'leaderboard_open'
  | 'leaderboard_submit'
  | 'settings_open'
  | 'setting_change'
  | 'share'
  | 'rate'
  | 'privacy_open'
  | 'progress_reset'
  | 'screen_view';

export type Params = Record<string, string | number | boolean | undefined>;

/** Events kept for the in-app debug list. Small: this is a ring, not a log. */
const RING = 50;

interface Recorded {
  name: EventName;
  params: Params;
  at: number;
}

const recent: Recorded[] = [];

interface Backend {
  logEvent(name: string, params: Record<string, string | number | boolean>): unknown;
  setAnalyticsCollectionEnabled(on: boolean): unknown;
  setUserProperty(key: string, value: string | null): unknown;
}

let backend: Backend | null = null;
let resolved = false;

/**
 * Find the Firebase Analytics module, if this build has it.
 *
 * `require` is deliberate and inside a try: an `import` of a package that is
 * not installed is a Metro build error, while this is a runtime miss that
 * leaves the game running with analytics switched off.
 */
function getBackend(): Backend | null {
  if (resolved) return backend;
  resolved = true;
  try {
    const mod = require('@react-native-firebase/analytics');
    const analytics = mod.default ?? mod;
    backend = analytics();
  } catch {
    backend = null;
  }
  return backend;
}

/** True when events are actually leaving the device. */
export function isLive() {
  return getBackend() !== null && getSettings().analytics;
}

/**
 * Firebase rejects an event whose name or parameters break its limits, and it
 * rejects the whole event rather than the offending field. Trimming here means
 * a long stage name never costs a report.
 */
function clean(params: Params) {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const k = key.slice(0, 40);
    out[k] = typeof value === 'string' ? value.slice(0, 100) : value;
  }
  return out;
}

/** Record one event. Never throws and never blocks the caller. */
export function track(name: EventName, params: Params = {}) {
  if (!getSettings().analytics) return;

  const cleaned = clean(params);
  recent.push({ name, params: cleaned, at: Date.now() });
  if (recent.length > RING) recent.shift();

  // Not under Jest: a run of the suite fires hundreds of these, which is
  // enough noise to bury an actual failure.
  if (__DEV__ && typeof jest === 'undefined') {
    console.log(`[analytics] ${name}`, cleaned);
  }

  try {
    getBackend()?.logEvent(name, cleaned);
  } catch {
    // A backend that fails is not worth interrupting a run for.
  }
}

/** The last events this session, newest last. For the in-app debug list. */
export function history(): readonly Recorded[] {
  return recent;
}

/**
 * Which card or sheet the player is looking at. Firebase treats screen views
 * as their own kind of event; this keeps the call sites down to one name.
 */
export function screen(name: string) {
  track('screen_view', { screen_name: name });
}

/** Slow-moving facts about the player, for segmenting a report. */
export function setUserProps(props: Record<string, string | number | null>) {
  if (!getSettings().analytics) return;
  const b = getBackend();
  if (!b) return;
  try {
    for (const [k, v] of Object.entries(props)) {
      b.setUserProperty(k.slice(0, 24), v === null ? null : String(v).slice(0, 36));
    }
  } catch {
    // Same as above: best-effort.
  }
}

/**
 * Keep the SDK's own collection in step with the consent switch. Turning the
 * setting off has to stop the SDK collecting on its own -- dropping events at
 * `track` would still leave Firebase reporting sessions and screen time.
 */
function applyConsent() {
  const on = getSettings().analytics;
  try {
    getBackend()?.setAnalyticsCollectionEnabled(on);
  } catch {
    // Nothing to switch off if there is no backend.
  }
}

/**
 * Wire consent to the SDK for the life of the app. Called once from the game
 * screen; the returned function is only needed by a test that wants to unhook.
 */
export function init() {
  applyConsent();
  return settings.subscribe(applyConsent);
}
