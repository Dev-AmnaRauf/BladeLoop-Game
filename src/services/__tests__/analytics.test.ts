/**
 * The consent switch is the part of analytics worth a test: it has to stop
 * both halves of the reporting -- the events this app sends, and the sessions
 * the SDK would collect on its own -- and it has to keep working when the
 * player flips it back and forth while the app is running.
 *
 * `@react-native-firebase/analytics` is not installed, so the mock is virtual.
 */
const mockBackend = {
  logEvent: jest.fn(),
  setAnalyticsCollectionEnabled: jest.fn(),
  setUserProperty: jest.fn(),
};

jest.mock('@react-native-firebase/analytics', () => ({ __esModule: true, default: () => mockBackend }), {
  virtual: true,
});

import * as Analytics from '../Analytics';
import { setSetting, settings } from '../../state/settings';

let stop: () => void;

beforeEach(async () => {
  settings.reset();
  await settings.hydrated();
  Object.values(mockBackend).forEach(fn => fn.mockClear());
  stop = Analytics.init();
});

afterEach(() => stop());

test('an event reaches the backend when the player has consented', () => {
  Analytics.track('run_end', { score: 42 });
  expect(mockBackend.logEvent).toHaveBeenCalledWith('run_end', { score: 42 });
  expect(Analytics.isLive()).toBe(true);
});

test('turning analytics off stops the events and the SDK collecting', () => {
  setSetting('analytics', false);
  expect(mockBackend.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false);

  Analytics.track('run_end', { score: 42 });
  expect(mockBackend.logEvent).not.toHaveBeenCalled();
  expect(Analytics.isLive()).toBe(false);

  // ...and back on again.
  setSetting('analytics', true);
  expect(mockBackend.setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(true);
  Analytics.track('run_end', { score: 42 });
  expect(mockBackend.logEvent).toHaveBeenCalledTimes(1);
});

test('parameters are trimmed to what Firebase will accept', () => {
  Analytics.track('share', { target: 'x'.repeat(200), sent: true, missing: undefined });
  const [, params] = mockBackend.logEvent.mock.calls[0];
  // A parameter over the limit would cost the whole event, not just the field.
  expect(params.target).toHaveLength(100);
  expect(params.sent).toBe(true);
  expect('missing' in params).toBe(false);
});

test('the debug history keeps the last events', () => {
  Analytics.track('run_start', {});
  Analytics.screen('leaderboard');
  const names = Analytics.history().map(e => e.name);
  expect(names.slice(-2)).toEqual(['run_start', 'screen_view']);
});
