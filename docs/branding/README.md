# App icon

The mark is the ball the game is played with: a glossy blue-violet bubble with
big sparkling eyes, pink blush and an open smile, wearing the soft lavender
halo it has in game. It sits on the lavender sky the run is flown under, with
clouds along the bottom, two small bubbles drifting up on the left and one red
saw blade peeking in at the top right, so the icon says both "cute" and
"blades". The themed (monochrome) icon is the ball's silhouette with the saw
and bubbles, eyes cut out.

Everything here is generated -- there is no Figma or Illustrator source to keep
in sync. `scripts/gen_icon.js` defines the mark as maths and rasterises it with
a small software renderer, in the same spirit as `scripts/gen_sfx.js` for the
sound effects.

```sh
node scripts/gen_icon.js
```

That one command rewrites every target:

| Where | What |
| --- | --- |
| `android/.../mipmap-*dpi/ic_launcher.png` | legacy launcher, rounded-square |
| `android/.../mipmap-*dpi/ic_launcher_round.png` | legacy launcher, circular |
| `android/.../mipmap-*dpi/ic_launcher_{foreground,background,monochrome}.png` | adaptive layers, incl. the Android 13 themed icon |
| `android/.../mipmap-anydpi-v26/ic_launcher{,_round}.xml` | adaptive icon declarations |
| `ios/.../AppIcon.appiconset/Icon-*.png` + `Contents.json` | every iPhone size plus the 1024 store icon |
| `docs/branding/icon-master-1024.png` | master, for anything else that needs it |
| `docs/branding/playstore-icon-512.png` | Play Store listing icon |

The iOS and store PNGs are written without an alpha channel, which the App
Store requires; the Android ones keep theirs so the launcher can mask them.

## Retuning it

The numbers worth touching are at the top of the `design` section of the
script: the sky, ball, face and saw colours, `PUFFS` for the clouds, and
`geometry()` for the ball's size and where the saw and the bubbles sit.

A full run renders the 1024 master and takes a couple of minutes, so iterate
with the preview instead -- it renders one 512 square and one 96px launcher
into a directory of your choosing and stops:

```sh
node scripts/gen_icon.js --preview /tmp
```

Two things constrain the geometry. The adaptive foreground is drawn into two
thirds of its canvas so the whole mark stays inside Android's 66dp safe zone,
and the mark has to survive being masked to a circle, so nothing important can
sit in the corners.
