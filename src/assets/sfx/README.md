# Sound effects

Drop clips here, then list each one in `SOURCES` in
`src/services/SoundService.ts`:

```ts
coin: require('../assets/sfx/coin.wav'),
```

Metro resolves `require` at build time, so a file sitting in this folder is not
picked up until it appears in that map. A name with no entry stays silent.

Formats: mp3, wav, m4a and aac play on both platforms. Keep the short hits
(button, coin, collision) as small mono wavs so there is no decode delay on the
frame they fire; anything longer is better as mp3.

Filenames must be lowercase letters, digits and underscores. Android turns
assets into resource names and rejects anything else -- spaces, capitals and
punctuation all fail the build rather than the playback.

## What is here

Every clip is synthesised (see `scripts/gen_sfx.js`), so the set is
licence-free and each event is pitched to stay clear of its neighbours:

| Clip              | Fires on                          | Sound                       |
| ----------------- | --------------------------------- | --------------------------- |
| `button.wav`      | pause, resume, retry              | one dry blip                |
| `start.wav`       | tapping through the splash        | rising major triad          |
| `checkpoint.wav`  | passing a flag                    | two notes, a fifth up       |
| `coin.wav`        | a pickup, and a shop grant        | two-note arcade pickup      |
| `collision.wav`   | hitting a blade                   | thud plus downward sweep    |
| `gameover.wav`    | the game over card coming up      | falling minor triad         |
| `revive.wav`      | paying to carry on from a flag    | upward sweep                |

`collision` and `gameover` are deliberately separate: the first is the impact,
the second lands `DEATH_PAUSE` later with the card.

To retune any of them, edit `scripts/gen_sfx.js` and re-run it:

```sh
node scripts/gen_sfx.js src/assets/sfx
```
