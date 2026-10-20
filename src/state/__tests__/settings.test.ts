import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMuted, setName, setSetting, getSettings, settings, toggleMuted, MAX_NAME } from '../settings';

beforeEach(async () => {
  settings.reset();
  await settings.hydrated();
});

test('the speaker button silences both switches and brings both back', () => {
  expect(isMuted()).toBe(false);

  toggleMuted();
  expect(getSettings()).toMatchObject({ sfx: false, music: false });
  expect(isMuted()).toBe(true);

  toggleMuted();
  expect(getSettings()).toMatchObject({ sfx: true, music: true });
});

test('one switch left on is not muted', () => {
  setSetting('music', false);
  expect(isMuted()).toBe(false);
  // ...and pressing the button from there silences the other one too, rather
  // than turning the music back on.
  toggleMuted();
  expect(getSettings()).toMatchObject({ sfx: false, music: false });
});

test('a name is trimmed and capped before it can reach the board', () => {
  setName('   Amna   ');
  expect(getSettings().name).toBe('Amna');

  setName('x'.repeat(MAX_NAME + 20));
  expect(getSettings().name).toHaveLength(MAX_NAME);
});

test('a change is written to disk', async () => {
  await settings.hydrated();
  setSetting('vibrate', false);
  const raw = await AsyncStorage.getItem('bladeloop.settings.v1');
  expect(JSON.parse(raw as string).vibrate).toBe(false);
});
