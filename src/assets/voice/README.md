# Voice

Recorded voice lines. Separate from `../sfx/` on purpose: those are synthesised
by `scripts/gen_sfx.js` and can be regenerated at will, these are recordings
that cannot.

## Adding a line

1. Drop the file in this folder.
2. Add one line to `VOICE` in `src/services/SoundService.ts`:

   ```ts
   go: require('../assets/voice/go.mp3'),
   ```

Metro resolves `require` at build time, so a file sitting in this folder alone
does nothing until it appears in that map.

## Filenames

Lowercase letters, digits and underscores only -- no spaces, capitals, dashes
or punctuation. Android turns assets into resource names and rejects the rest
at build time, whatever the file plays like.

## Format

mp3 for anything spoken: a voice line is long enough that a wav costs real
app size, and the decode happens once at `preload()` rather than on the frame
it fires.

Record or export mono, 44.1kHz. Trim the silence off both ends -- a line that
starts 300ms in fires 300ms late, and nothing in the game compensates for it.

## Levels

Voice sits above the music and alongside the effects. The music is mixed at
`MUSIC_VOLUME` (0.35) and ducks no further, so a line recorded quietly will be
lost under it; set its level in `VOLUME` in `SoundService.ts` rather than
re-recording it hotter.

## Licensing

Anything recorded for the game is fine. A voice pulled from a video, a film or
a TTS service with a restrictive licence is not -- see the note in
`../music/README.md` for the one file already in that position.
