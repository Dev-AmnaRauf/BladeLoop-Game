/**
 * Sound effect and music hooks.
 *
 * Every call site goes through `play(name)` for one-shot effects and
 * `startMusic`/`pauseMusic` for the loop; this file owns the audio backend so
 * none of them have to know one exists. Clips are decoded once on `preload()`
 * and kept for the life of the app -- a game fires these during a run, so
 * loading one on the frame it is needed would drop that frame.
 *
 * ## Adding a clip
 *
 * Drop the file in `src/assets/sfx/` and add one line to `SOURCES` below:
 *
 *     coin: require('../assets/sfx/coin.mp3'),
 *
 * Metro resolves `require` at build time, so the path has to be a literal --
 * a file on its own in the folder is not picked up until it is listed here.
 * Names with no entry stay silent instead of throwing, so the map can be
 * filled in one clip at a time.
 *
 * Formats: mp3, wav, m4a and aac all play on both platforms. Short SFX are
 * happiest as mono wav (no decode delay); anything longer should be mp3.
 * Filenames must be lowercase letters, digits and underscores -- Android
 * rejects the rest at build time, whatever the file plays like.
 *
 * ## Adding a voice line
 *
 * Voice is keyed to the same event names as the effects, so there is no new
 * call site to add and nothing in the UI to change: drop the recording in
 * `src/assets/voice/` and add one line to `VOICE`, and it speaks everywhere
 * that event already fires.
 *
 *     gameover: require('../assets/voice/gameover.mp3'),
 *
 * A voice line lands *on top of* its effect rather than replacing it, which is
 * what makes "Game over!" over the falling triad read as one thing. To have a
 * line instead of its effect, delete that name's row from `SOURCES`.
 */
import { Image, Platform } from 'react-native';
import Sound from 'react-native-sound';

export type SfxName =
  | 'button'
  | 'start'
  | 'collision'
  | 'gameover'
  | 'checkpoint'
  | 'revive'
  | 'coin';

/**
 * The clips, by name. See the file doc comment for how to wire up a new one.
 */
const SOURCES: Partial<Record<SfxName, number>> = {
  button: require('../assets/sfx/button.wav'),
  start: require('../assets/sfx/start.wav'),
  collision: require('../assets/sfx/collision.wav'),
  gameover: require('../assets/sfx/gameover.wav'),
  checkpoint: require('../assets/sfx/checkpoint.wav'),
  revive: require('../assets/sfx/revive.wav'),
  coin: require('../assets/sfx/coin.wav'),
};

/** Per-clip volume, for clips that land louder or quieter than the rest. */
const VOLUME: Partial<Record<SfxName, number>> = {};

/**
 * Recorded voice lines, by the event they speak on. See the file doc comment
 * for how to wire one up.
 *
 * Empty until the recordings land: a name with no row here is silent, so the
 * map fills in one line at a time and the game is playable at every step. The
 * names are `SfxName`s rather than a list of their own because a voice line is
 * something to say about an event the game already has -- a line with no event
 * would have nowhere to fire from.
 *
 *     start: require('../assets/voice/start.mp3'),      // "Ready... go!"
 *     checkpoint: require('../assets/voice/checkpoint.mp3'), // "Nice!"
 *     collision: require('../assets/voice/collision.mp3'),   // "Ouch!"
 *     gameover: require('../assets/voice/gameover.mp3'),     // "Game over!"
 *     revive: require('../assets/voice/revive.mp3'),         // "Back in!"
 *     coin: require('../assets/voice/coin.mp3'),
 *     button: require('../assets/voice/button.mp3'),
 */
const VOICE: Partial<Record<SfxName, number>> = {};

/**
 * How loud the voice sits, per line and by default.
 *
 * Louder than the effects on purpose: words have to carry over both the effect
 * they land on and the music under it, and the music does not duck for them.
 * Trim a line that comes in hot here rather than re-recording it.
 */
const VOICE_VOLUME: Partial<Record<SfxName, number>> = {};
const VOICE_VOLUME_DEFAULT = 1;

/** The background loop. Its own file rather than an `SfxName`: it loops, it
 * pauses and resumes with the run, and it is mixed well under the effects. */
const MUSIC = require('../assets/music/bg_music.mp3');

/** Music sits under the effects -- the run has to stay readable by ear. */
const MUSIC_VOLUME = 0.35;

/**
 * Turn what `require` returns into something the player will accept.
 *
 * `require` of an asset hands back an opaque id, and react-native-sound took
 * one of those directly up to 0.11. From 0.12 its constructor takes a string
 * and calls `.startsWith` on it, so passing the id throws before a single clip
 * is decoded. Resolving it here is the same lookup `<Image source={require()}>`
 * does, and it lands on the right thing in both builds: a Metro URL in
 * development, which the player recognises by its `http` prefix, and the
 * mangled `res/raw` resource name in a release build, which is exactly what it
 * strips the extension off and looks up on Android.
 *
 * Every call site passes the result with an explicit `undefined` base path. The
 * constructor folds a truthy second argument into the filename before it
 * checks whether that argument is the error callback, so handing it the
 * callback in that slot builds a path out of the function itself. An `http`
 * path is taken whole and escapes this, which is why it goes wrong only in a
 * release build -- exactly where it is hardest to notice.
 */
function assetPath(mod: number) {
  return Image.resolveAssetSource(mod)?.uri ?? '';
}

let sfxOn = true;
let musicOn = true;
let loaded = false;
const clips = new Map<SfxName, Sound>();
/** Decoded voice lines, keyed the same way. Empty while `VOICE` is. */
const voices = new Map<SfxName, Sound>();

/** The loop's player, once decoded. */
let music: Sound | null = null;
/** What the game wants the music to be doing, which is not the same as what it
 * is doing: the music switch and a clip that has not decoded yet both hold it
 * silent. */
let musicWanted = false;

/**
 * Bring the player in line with `musicWanted` and the music switch. Called
 * from every path that can change either, including the decode callback -- so
 * music asked for during the splash still starts the moment the file is ready.
 */
function applyMusic() {
  if (!music || !music.isLoaded()) return;
  if (musicWanted && musicOn) music.play();
  else music.pause();
}

/**
 * Point the audio at the player's two switches. Effects and the loop are
 * separate settings, so one call keeps both in step with what was saved.
 */
export function setAudio(next: { sfx: boolean; music: boolean }) {
  sfxOn = next.sfx;
  musicOn = next.music;
  applyMusic();
}

/** Ask for the loop. Resumes where it left off rather than restarting, so a
 * pause mid-run is not audible as a jump back to the top of the track. */
export function startMusic() {
  musicWanted = true;
  applyMusic();
}

/** Hold the loop where it is. `startMusic` picks it back up. */
export function pauseMusic() {
  musicWanted = false;
  applyMusic();
}

/** Hold the loop and rewind it, so the next run opens on the track's first bar. */
export function stopMusic() {
  musicWanted = false;
  applyMusic();
  music?.setCurrentTime(0);
}

/**
 * Decode every clip in `SOURCES`, plus the music. Safe to call more than once;
 * the second call is a no-op. A clip that fails to decode is dropped rather
 * than retried -- the run carries on without that one sound.
 */
export function preload() {
  if (loaded) return;
  loaded = true;

  // The category means opposite things on the two platforms, so it is set
  // per platform rather than once. On iOS 'Ambient' is what it reads like:
  // the effects mix under whatever the player already has playing and go
  // quiet with the mute switch, instead of taking over the audio session.
  // On Android react-native-sound maps 'Ambient' to STREAM_NOTIFICATION,
  // which is muted outright whenever the phone is on silent or vibrate --
  // the whole game falls silent with the media volume up. Game audio belongs
  // on the media stream, which is what 'Playback' (STREAM_MUSIC) selects.
  Sound.setCategory(Platform.OS === 'android' ? 'Playback' : 'Ambient', true);

  (Object.keys(SOURCES) as SfxName[]).forEach(name => {
    const src = SOURCES[name];
    if (src == null) return;
    clips.set(
      name,
      decode(assetPath(src), VOLUME[name] ?? 1, () => clips.delete(name)),
    );
  });

  (Object.keys(VOICE) as SfxName[]).forEach(name => {
    const src = VOICE[name];
    if (src == null) return;
    const volume = VOICE_VOLUME[name] ?? VOICE_VOLUME_DEFAULT;
    voices.set(
      name,
      decode(assetPath(src), volume, () => voices.delete(name)),
    );
  });

  music = decode(
    assetPath(MUSIC),
    MUSIC_VOLUME,
    () => {
      music = null;
    },
    track => {
      track.setNumberOfLoops(-1);
      // The run may already have started while this was decoding.
      applyMusic();
    },
  );
}

/**
 * Load one clip, and turn it down to its own level once it has decoded.
 *
 * The volume is set in the callback rather than straight after the constructor
 * because `setVolume` only reaches the native side on a clip that has loaded.
 * The awkward part is that the callback is not guaranteed to arrive *after*
 * the constructor has returned -- a clip that is already decoded, and the
 * stand-in a test runner loads instead of the audio stack, both answer on the
 * spot, with no handle in existence yet to turn down. Reaching for one there
 * is what used to throw and take the whole first render with it, so when that
 * happens the volume is applied a turn later instead.
 */
function decode(path: string, volume: number, onFail: () => void, onReady?: (clip: Sound) => void) {
  let clip: Sound | undefined;
  const ready = () => {
    if (!clip) return;
    clip.setVolume(volume);
    onReady?.(clip);
  };
  clip = new Sound(path, undefined, (error: unknown) => {
    if (error) {
      onFail();
      return;
    }
    if (clip) ready();
    else setTimeout(ready, 0);
  });
  return clip;
}

/**
 * Fire a sound effect. Silent when effects are off, when the clip has no file
 * yet, and when it has not finished decoding.
 *
 * Retriggering a clip that is still playing restarts it from the top: one
 * player per clip means two overlapping coins are one coin, which is what a
 * rapid pickup should sound like anyway.
 *
 * The event's voice line, if it has one, speaks over the top of the effect on
 * the same terms -- same switch, same restart-on-retrigger. A line still
 * talking when its event fires again is cut off rather than doubled, which
 * keeps a fast run from stacking three of the same sentence.
 */
export function play(name: SfxName) {
  if (!sfxOn) return;
  const clip = clips.get(name);
  if (clip?.isLoaded()) clip.stop(() => clip.play());
  const line = voices.get(name);
  if (line?.isLoaded()) line.stop(() => line.play());
}

/** Free every decoded clip. For teardown; `preload` can run again after. */
export function release() {
  clips.forEach(clip => clip.release());
  clips.clear();
  voices.forEach(line => line.release());
  voices.clear();
  music?.release();
  music = null;
  musicWanted = false;
  loaded = false;
}
