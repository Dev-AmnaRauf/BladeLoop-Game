# Art Direction Plan — one ground, one rule for colour

**Status:** Stages 1–4 delivered and checked on the device. §2's recommendation
was revised at stage 4 — see that stage for why.
**Written:** 2026-09-21
**Scope:** `src/ui/theme.tsx`, `src/game/config.ts` (`COLORS`), `src/ui/Backdrop.tsx`,
`src/ui/entities.tsx`, `src/ui/GameView.tsx`, `src/ui/Hud.tsx`, `src/ui/LevelMap.tsx`,
`src/ui/Screen.tsx`, `src/ui/Overlays.tsx`, `src/ui/Splash.tsx`, `src/ui/LoginScreen.tsx`,
`src/ui/LoadingScreen.tsx`, `src/ui/LeaderboardScreen.tsx`

---

## 1. What is actually wrong

The complaint is that the theme, the background and the hurdle colours read as
mixed up. That is not one bad hex. It is four separate faults, and they compound.

### 1.1 The game has two art directions running at once

There is a **deep-space night palette** (`theme.tsx` → `NIGHT`/`DEEP`, `COLORS.bg`
`#140B33`) and there is a **pastel daylight cloud world** (`Backdrop.tsx` → `SKY`,
a periwinkle `#6F5AD8` warming to a near-white rose `#F8E6F0`).

Neither one was deleted. Instead every screen negotiates between them with its
own number:

| Screen | Ground it actually draws on |
| --- | --- |
| Splash, Login, Loading | Pastel sky at full strength (`dim=1`, `skyDim` default `1`) |
| Leaderboard, Settings (`Screen.tsx`) | Pastel sky at `dim=0.55`, then `COLORS.night` (88% opaque) painted over it |
| The run (`GameView.tsx:405`) | `COLORS.bg`, then pastel sky at `skyDim` 0.20 → 0.14 |
| Level map (`LevelMap.tsx:347`) | Neither — a flat `COLORS.mapSky` `#9B7BF0`, its own third ground |

Four grounds. Nothing in the code says which one is the game's. Every new screen
has to invent a fifth.

### 1.2 The run's ground is mud, and it changes down the screen

This is the one the eye reads as "ajeeb". 20% of a pastel gradient over a dark
indigo does not give a dark room — it gives a wash whose value climbs from top
to bottom:

| Screen height | Effective ground |
| --- | --- |
| Top | `#261B54` — deep violet, fine |
| Middle | `#33264F` — muddy |
| Bottom | `#423759` — desaturated mauve-grey, the flattest colour in the game |

So **the same hurdle is easier to see at the top of the screen than at the
bottom**. A rod is `#6B5BC7`; against `#261B54` it reads, against `#423759` it
nearly vanishes — and the bottom of the screen is where the ball lives, because
`CAM_ANCHOR` is `0.34`.

Two more things break on that wash specifically:

- `bladeCore` (`#1B0E3F`) is meant to read as **a hole punched through the saw**,
  taking the ground's own colour. The ground is no longer that colour, so the
  hole is now *darker* than everything around it — it reads as a black dot glued
  on the saw.
- `TvBox` fills with `t.bg` (`entities.tsx:773`) for the same "it's a hole"
  reason, with the same result.

The `skyDim` pass on 2026-09-18 moved this from unusable to bad. It did not fix
it, because 20% of the wrong ground is still the wrong ground.

### 1.3 The ground is the same hue as the things drawn on it

`bg` `#140B33` is a saturated violet. So are the rods (`pole` `#6B5BC7`), the
ball (`ballBody` `#7A4BFF`, `ballIris` `#6B3FD6`, `ballEar` `#9A6BFF`), the map,
the pause card, the clouds and the floating rock. The file comments already
admit this ("on a ground that is itself violet"), and the answer each time was to
make the *foreground* louder. That is backwards. The ground should give up its
chroma; it does not need any.

### 1.4 "Warm kills, cool does not" is the stated rule, and three things break it

The rule is written in `theme.tsx:12-21` and `config.ts:60-73`. Against the code:

| Thing | Lethal? (`engine.ts:1151-1210`) | Drawn as | Verdict |
| --- | --- | --- | --- |
| `pipe` (rod) | no | `t.pole` cool | correct |
| `gear` (saw), `capsule` | yes | `t.blade` red | correct |
| `triangle`/`square`/`hexagon`, `bracket`, `bigWheel` | yes | `t.hazard` orange | warm, but a **second** warm hue |
| **`turret`** | **yes** | **`t.pole`** — the safe-rail cool violet | **breaks the rule** |
| `tvBox` (pickup) | no | `t.ink` outline on `t.bg` | in no family at all |
| `stand`, `plate` | no | `t.pole` | correct |

And the rule leaks the other way, out of the corridor and into the HUD:

- `Hud.tsx:157` — the speed/gear chip is painted `COLORS.hazard`, the one colour
  that means "this ends your run", sitting permanently in the HUD.
- `Overlays.tsx:573` — the speed flash, same colour, same problem.

Separately, `hazard` orange `#FF7A3D` and `blade` red `#FF4D6D` are close
neighbours at speed. They are two hues spent distinguishing two things that
**do the same thing to the player** (both kill), while the one distinction that
matters — kill vs. safe — is carried by a turret that is painted safe.

### 1.5 There are 117 distinct hex values in three systems that do not know about each other

```text
src/game/config.ts   COLORS   72 tokens   <- used ONLY by src/ui/, never by src/game/
src/ui/theme.tsx     Theme    44 tokens   <- duplicates bg, pole, ring, blade, hazard, gold, ink...
src/ui/Backdrop.tsx  SKY      15 tokens   <- outside both, so it never fades with the level
                     loose literals in LevelMap, LeaderboardScreen, Splash, Overlays...
------------------------------------------------------------------------
117 distinct hexes
```

`COLORS.bg` and `NIGHT.bg` are the same value typed twice. So are `pole`, `ring`,
`blade`, `bladeDark`, `bladeCore`, `hazard`, `hazardEdge`, `gold`, `ink`,
`ballShine`. Change one and half the game changes. **That is the mechanical
reason the game looks mixed: it is mixed, in the source.**

*Read the 117 as "how many different colours exist", not as a measure of the
duplication — a value typed in three files counts once in it. The number that
matters is how many places a colour is written down at all: 163 lines of it,
across ten files.*

`SKY` being outside the theme is why the backdrop does not fade into `DEEP` with
the rest of the level.

---

## 2. The decision: one ground, and it is night

Three options were on the table.

| | Keep | Cost | Verdict |
| --- | --- | --- | --- |
| **A. Night everywhere** | Ball gradient, blade red, gold star, live mint all keep their glow. One ground, one contrast, on every screen. | Repaint `SKY` (15 tokens) and the map (~12 tokens). | **Recommended** |
| B. Day everywhere | The cute cloud world at full strength. | The ball, the mint, the gold and the blade are all *lit* colours; on a pale ground none of them glow. `entities.tsx` inverts end to end. | No |
| C. Day on menus, night in the run | Smallest change. | Still two palettes to keep in step forever — which is what produced this. | Stage 1 only |

**Go with A.** Everything the player actually reads in this game is emitting
light: the ball's cyan→violet sweep, a blade's red, a star's gold, the mint of a
live turret. Lit things need a dark room. The repo already concluded this once
(change log, 2026-09-17, "deep space") — it just never finished the job, because
the backdrop was never repainted to match.

Stage 1 below is Option C, and it is the first step of A anyway, so the biggest
visible win lands first and nothing is thrown away.

> **Revised at stage 4 — the answer is C, not A.** Option A's case rests
> entirely on *lit things need a dark room*, and once stages 1–3 had been seen
> on the device it was clear that argument covers the corridor and nothing
> else. Nothing outside it is lit: the front page is a logo, two buttons and a
> crowd of soft creatures. The fault was never that the game had two moods — it
> was that the two were being mixed into each other a fifth at a time, which
> stage 1 fixed. What was left of "four grounds" was the level map, which had
> invented a third. So the game keeps its day and its night, the map joins the
> day, and which ground a screen stands on is now a stated rule rather than an
> accident. Option A would have cost the pastel cloud world — the game's whole
> identity outside the run — to fix something already fixed.

---

## 3. The palette

Four families and nothing else. Every colour in the corridor must belong to one.

| Family | Means | Rule |
| --- | --- | --- |
| **Ground** | the room | Near-neutral, very low chroma, never competes |
| **Structure** (cool) | safe to touch | Quiet. Lower value than any hazard |
| **Hazard** (red) | ends the run | One hue, loud, always over a dark rim |
| **Reward** (gold + mint) | take this | Used nowhere else in the game, ever |

Plus the **ball**, which is outside all four on purpose: it is the one thing
being tracked, and it is the only cyan in the game.

### 3.1 Ground — drop the chroma

| Token | Now | Proposed | Why |
| --- | --- | --- | --- |
| `NIGHT.bg` | `#140B33` | `#0C0A1C` | Near-neutral blue-black. The rods and the ball are violet; the room must not be. |
| `DEEP.bg` | `#26093C` | `#180A20` | Same value, plum hue. The closing-stretch fade stays a **hue** shift, as designed. |
| `NIGHT.card` | `#241450` | `#1A1630` | A lifted surface, not a second violet. |
| `DEEP.card` | `#3A1259` | `#261730` | |

### 3.2 Structure — quieter than the hazards

Safe things should recede. They are currently the brightest furniture on screen.

| Token | Now | Proposed |
| --- | --- | --- |
| `pole` | `#6B5BC7` | `#4C4780` |
| `poleBack` | `#2E1C63` | `#2A2750` |
| `ring` | `#3A2A7A` | `#322E58` |

Against the new `#0C0A1C` ground, `#4C4780` separates by **value** rather than by
chroma — which is the separation that survives a small screen in daylight.

### 3.3 Hazard — one hue, two weights

Delete orange from the corridor. Frames and saws both kill; they do not need
different hues, they need different **weight**, which the silhouette and stroke
already give.

| Token | Now | Proposed | Used by |
| --- | --- | --- | --- |
| `blade` | `#FF4D6D` | `#FF4D6D` *(keep — this is the game's signature)* | saw, capsule, hot turret muzzle |
| `bladeDark` | `#C21B4B` | `#C21B4B` *(keep)* | saw ring |
| `hazard` | `#FF7A3D` **orange** | `#E8365C` | frames, bracket, wheel, **turret body** |
| `hazardEdge` | `#5E1400` **brown** | `#4A0A1E` | the dark rim under all of it |

`#E8365C` is the same hue as the blade, one step deeper and heavier — so the big
slow furniture sits *behind* the small fast blades in the same family, instead of
arguing with them.

### 3.4 Reward — gold and mint, and nothing else may use them

`gold` `#FFC93C` and `live` `#2BE0A8` stay exactly as they are. The rule is what
changes: **no HUD chrome, no button, no card and no map bead may be painted in a
corridor colour, and nothing in the corridor may be gold or mint unless the
player is meant to fly into it.**

### 3.5 Night sky (replaces `SKY` in `Backdrop.tsx`)

The same cloud world, drawn after dark. Low contrast on purpose: it is a ground,
not a subject.

| Token | Now | Proposed |
| --- | --- | --- |
| gradient stop 0.0 | `#6F5AD8` | `#0C0A1C` |
| stop 0.32 | `#A98FEC` | `#15122C` |
| stop 0.68 | `#DCBFEA` | `#1F1838` |
| stop 1.0 | `#F8E6F0` | `#2A1F42` |
| `cloudFar` | `#B9A2EC` | `#151132` |
| `cloudMid` | `#E3CDF2` | `#1D1740` |
| `cloudNear` | `#FBF0F8` | `#28204E` |
| `grass` / `grassDark` / `bush` | `#7FD59A` / `#4FB177` / `#3F9E68` | `#3C6B52` / `#2C5340` / `#254634` |
| `rock` / `rockDark` | `#8F6FD0` / `#6B4CB0` | `#3A3060` / `#2A2348` |
| `mint` / `lilac` | `#86DDA0` / `#C79BEE` | `#4E8A66` / `#6B5490` |

Once the sky is dark, **`skyDim` has no job and is deleted**, along with
`Screen.tsx`'s `COLORS.night` veil and the `skyInk`/`skyInkSoft` pair (type on
the sky goes back to `ink`). Three mechanisms removed, four grounds become one.

### 3.6 The map, under the same roof

The road becomes the night road. `mapSky`, `mapRoad`, `mapLane`, `mapCloud`,
`mapCloudHi`, `mapSpark` re-tint to the sky values above (`#3A3168` road,
`#4A3F80` lane). Beads go to the reward family so the road says the same thing
the corridor says:

| Bead | Now | Proposed |
| --- | --- | --- |
| cleared | `#C33DE8` magenta | `live` mint — the reward family |
| where you are | `#3BE07A` ring | `gold` ring |
| locked | `#9EA2B8` **slate grey** | `#3A3560` — removes the only grey in the game |
| finale | `#FFC93C` | keep |

`LevelMap.tsx:641` `#E8E9F0` and the three loose white literals become tokens.

---

## 4. Work plan

Five stages, each shippable on its own, biggest visible win first.

### Stage 1 — kill the mud — **DONE 2026-09-21**

`GameView.tsx` — `skyDim` from `0.2 - darkness*0.06` to **`0`**, and `dim`
from `0.1` to **`0`** for the run. `Backdrop` now treats `skyDim <= 0` as
"ground only" and skips building the forty gradient strips entirely, so the run
is a layer lighter rather than paying for an invisible one. The backdrop call
stays in the tree at zero, because stage 4 repaints that sky for night and this
is the one number that brings it back. `darkness` still drives `mixTheme`, so
the fade into the closing stretch is untouched. 228 tests pass, lint clean.

**Device check, vivo V2435, level 8 (Wind Tunnel), 2026-09-21.** The device took
a fresh bundle (on-device cache rewritten 12:57 against a 12:46 edit), so the
frames below are this code.

*Confirmed:* the run's ground is one value from the top of the screen to the
bottom. The mauve-grey is gone, and a hurdle now reads the same wherever it sits.
A screenshot of the run dropped from ~200 KB to ~50 KB, which is the wash
leaving. The death card reads better on it than it did on the wash.

*The fix made the next problem obvious, and it is worse than this plan assumed.*
With the wash gone, §3.1 and §3.3 are no longer polish:

1. **The ball is the least legible thing on the screen.** It is `#7A4BFF` violet
   on a `#140B33` violet ground, at about 22 px. In every frame captured, the
   thing the player is steering is harder to find than every hazard, the rod,
   the wind band and the score. Its cyan sweep (`ballCool`) does not read at
   that size at all. This is now the first thing stage 3 must fix, and dropping
   the ground's chroma is most of it.
2. **The orange is the loudest thing in the game.** A bracket in `#FF7A3D`
   against the dark ground dominates the frame — far past the red saw and
   capsule beside it, which carry the same meaning. Two warm hues for one
   message, and the louder of the two is the one that is *not* the game's
   signature colour. Unifying to the blade's red (§3.3) is confirmed right.
3. **`hazardEdge` has lost its job.** The dark rim existed to keep a lethal
   shape off a pale cloud bank. There is no pale cloud bank in the run any more,
   and on the dark ground the brown `#5E1400` rim reads as a muddy smear along
   the orange rather than as an outline. Under §3.3 it either goes, or inverts
   into a *light* rim — which would also serve the ball.

Two smaller things the frames turned up, not previously in this plan:

- The mute button is a gold disc sitting **inside the play area**, bottom right,
  over the corridor. Gold is the reward family (§3.4); at a glance it reads like
  a star that cannot be collected. It wants the HUD's own chip colours.
- The `+5` pickup pops are a white-ruled circle with white type — pure UI
  furniture floating in the world. Same fix as `TvBox` in stage 3.

The run is drawn on solid `COLORS.bg`. The wash goes, the bottom of the screen
stops being mauve-grey, and the hurdles have the same contrast wherever they are
on screen. Everything else in this plan is improvement; this one is the fix.

*Check on the device before going further — this alone may be most of what was
being complained about.*

### Stage 2 — one source of truth — **DONE 2026-09-21** *(no visual change)*

1. `COLORS` moved out of `src/game/config.ts` into **`src/ui/theme.tsx`**, next
   to the world palettes rather than into a module of its own — the point was
   one place, and a second colour file would have been two. It was declared in
   the simulation layer but **used only by `src/ui/`** (verified: `src/game/`
   never read a colour out of it), so the move was pure. `config.ts` is 200
   lines shorter and holds tuning only.
2. The 18 importing files updated, plus `App.tsx` — which this plan missed,
   because the survey behind it had only counted `src/`.
3. `SKY` moved out of `Backdrop.tsx` into `theme.tsx` beside `COLORS`. It is
   **not** folded into the `Theme` interface, as this plan originally said to.
   `mixTheme` walks `Object.keys(NIGHT)` running a hex blend over every value,
   and `SKY` holds a nested array of gradient stops that would blow up on
   contact with it. The fade that would buy also does not exist yet — the
   backdrop sits at zero through the whole run after stage 1. Stage 4 repaints
   that sky and can decide then whether it needs to fade, and what shape it has
   to take to.
4. **22 tokens now read off `NIGHT` instead of restating it** — `bg`, `panel`,
   `ink`, `pole`, `poleBack`, `ring`, `line`, `ballShine`, `hazard`,
   `hazardEdge`, `blade`, `bladeDark`, `bladeCore`, `live`, `gold`,
   `gradA`/`gradB`/`gradC`, `gradEdge`, `bossRim`, `dangerFace`, `onMedal`.
   They cannot drift from the corridor any more, because there is nothing left
   to drift from.
5. Twelve loose literals across six files now point at tokens: `#8A4A05` (four
   copies, in `Splash`, `LoginScreen`, `LoadingScreen` and `Overlays`) at
   `starEdge`; `#3B1C9E` (three copies) at the new `gradEdge`, which is the
   ball's own rim; `LevelMap`'s and `LeaderboardScreen`'s whites at `onCard`;
   `#FFE9AC` on the leaderboard's live tab, which was the podium gold's rim
   typed a second time, at `PODIUM[0].rim`; and two of the six avatar faces,
   which were `gradB` and `gradC` spelled out. `#E8E9F0` and `#0A5745` got
   names (`nodeLockFace`, `inkOnTeal`) rather than staying inline.

**Result: colour is written down in two files instead of ten** — `theme.tsx`,
and the leaderboard's own podium set (gold, silver, bronze; used nowhere else,
named in place). 163 lines carrying a colour became 128. `tsc` clean, 228 tests
pass, lint unchanged.

*The target this stage was written with — "117 distinct hexes → 50 or fewer" —
was the wrong measure, and is dropped. A distinct-value count collapses
duplicates by definition, so the very thing being fixed was invisible in it: a
colour typed in three files counted once before and counts once after. It moved
117 → 119, and both new entries are hex values quoted inside a comment.
Acceptance criterion 8 is rewritten to say what was meant.*

### Stage 3 — the four families — **DONE 2026-09-21**

Applied §3.1–3.4, ground and ball first, then the rule violations.

**The room gave up its chroma.** `NIGHT.bg` `#140B33` → `#0C0A1C`, `DEEP.bg`
`#26093C` → `#180A20`, and both `card`s with them. Both grounds are now named
constants (`NIGHT_BG`, `DEEP_BG`) because more than one thing has to *be* them:
a saw's `bladeCore` and the face of a `TvBox` are holes punched through the
shape, and they are the ground now rather than a hand-typed near-miss of it.
That was the whole of the ball fix — the glow behind the ball is `ballBody` at
20%, which over the old violet ground came out barely lighter than the room and
now lifts clear of it.

**Structure got quieter.** `pole` `#6B5BC7` → `#4C4780`, with `poleBack`,
`ring` and `ringSoft` to match. A rail is the one thing in the corridor safe to
touch, so it had no business being the brightest furniture in it.

**Hazard became one hue.** `hazard` `#FF7A3D` orange → `#E8365C`, and
`hazardEdge` from the brown `#5E1400` to a dark red `#4A0A1E`. Frames,
brackets, wheels and the turret body are now the blade's own hue a step deeper
and heavier; the big slow furniture and the small fast blades are told apart by
weight and silhouette, which is what they were always actually told apart by.

**The three rule violations, closed:**

- **The turret** is in the hazard family. It is lethal and it was painted
  `pole` — the single place the game told the player outright that a thing
  which ends the run is safe to touch. Only the rail it hangs from, which
  nothing collides with, stays cool.
- **The HUD gear chip** and **the speed flash** lost `COLORS.hazard`. They are
  ordinary HUD chips now, `panel` over `line`, with the number in gold. The
  hazard colour means something narrower than "danger" — it means *this shape,
  here, ends the run on contact* — and a chip wearing it permanently in the
  corner spends it on something the ball can never hit.
- **`TvBox`** and **`StarChip`** joined the reward family: gold rim over a dark
  well, where both were drawn in the pale ink every label and hairline uses.

Two more from the stage-1 device check:

- **The mute button** was an amber disc with a white ring sitting *inside* the
  play area, which is what a gold coin in this game looks like. It is a HUD
  chip in HUD colours now.
- **The `+5` pop** deliberately keeps the pale ink. Now that the pickup it
  answers is gold, the two are no longer the same object at a glance: gold is
  what to take, pale is what was taken.

**One deviation from §3.3, made at the device.** The plan said the turret's
muzzle keeps `live` mint while idle and `blade` red while hot. With the body
now red, a red muzzle is not a signal — it is the mint dot going away. The hot
muzzle is `ballShine` white instead, which reads as a muzzle flash, belongs to
no family, and is unmistakable against the red. Confirmed on the device: two
turrets in frame, one mint and idle, one white and firing, both legible at a
glance.

**Device check, vivo V2435, levels 7 and 8, 2026-09-21** (bundle rewritten
13:26 against a 13:24 edit). The ground is one neutral dark value; the ball
carries its glow and reads immediately; a bracket is red and in the same
language as the saws instead of the loudest thing in the game; the rods recede;
the `+5` reads as gold treasure; the mute button no longer looks collectable.
An AdMob interstitial appeared mid-navigation and was dismissed with the back
key rather than by tapping it.

**Audit of the four families, over the whole source:**

| Rule | Result |
| --- | --- |
| `hazard` only on corridor shapes | Wheel, Frame, Bracket, Turret. No HUD use. |
| `live` only where it carries state | The turret muzzle, and nothing else. |
| `pole` only on things safe to touch | Rod, the turret's rail, `Stand`, `Plate`. |
| gold/mint only on things to fly into | `TvBox`, `StarChip`, `Flag`, star `Dot`. |

`tsc` clean, 228 tests pass, lint unchanged.

### Stage 4 — two grounds, declared — **DONE 2026-09-21**

**This stage was re-scoped before it was built, and §2's recommendation is
revised with it.** §2 chose night everywhere. Stages 1–3 then showed what was
actually wrong, and it was not that the game had two moods: it was that the two
were being *mixed into each other a fifth at a time*, on a screen that ended up
belonging to neither. Stage 1 fixed that. What remained of the "four grounds"
complaint was the level map, which was a flat lavender of its own — not the sky
the splash and the door use, not the night the run uses, a third ground on
exactly one screen, carrying the only true grey in the game.

Nothing outside the corridor is lit. The front page is a logo, two buttons and
a crowd of soft creatures; the argument that carried §2 — *lit things need a
dark room* — applies to the corridor and to nothing else. Repainting the pastel
cloud world to near-black would have cost the game its identity to fix a
problem that was already fixed. So:

**The game has two grounds, and which one a screen stands on is decided by
whether the ball is in play.** Day outside the corridor, night inside it. That
is now written down at `Backdrop`'s `skyDim` prop and at its one non-default
caller in `GameView`, where both comments previously described night-everywhere
as a thing still to come.

**The map joined the day, rather than the day joining the map.** Its sky is
`SKY.stops[2].c` — the shared gradient's own mid-value — and its road and lane
are `mixHex` of that toward `SKY.cloudNear`, its clouds and sparks `SKY`'s own
three cloud values. Derived, not restated, so it cannot drift from the pages
either side of it again.

**The beads speak the corridor's language.** Cleared is `live` mint over a dark
mint edge, the stop the play button is aimed at is ringed in `gold`, and a
level not yet reached is a violet-slate that belongs to the page (`#8A83AD`)
rather than `#9EA2B8`, which was a true grey and the only one in the game. The
number on a bead is `inkOnLight` now: white read well enough on the old magenta
and reads badly on either of the two light beads that replaced it.

**One thing fixed twice.** Stage 3 made the mute button a dark HUD chip to stop
it looking like an uncollectable gold coin over the corridor. On the device that
was right in the run and wrong on the front page, where a dark face inside a
dark ring vanished into the pastel sky at its edge. The face stays dark; the
pale ring is back. It is the one control that has to work on both grounds.

**Left alone deliberately:** `COLORS.night` (the veil the board and the settings
list draw over the sky), and `skyInk`/`skyInkSoft` (type set straight onto the
day). The plan had all three deleted, which only made sense under night
everywhere. `skyDim` stays for the same reason — it is the knob that says which
ground a screen is on, and deleting it would hide the decision rather than
record it.

**Still not shared:** the map draws its own clouds into its scrolling content
rather than using `Backdrop`, so it matches the sky by derivation rather than by
being it. Unifying that would mean changing how the road scrolls, which is a
behaviour change and not a colour one.

**Device check, vivo V2435, 2026-09-21** (bundle rewritten 13:39). The road is
on the shared sky; level 8 carries a gold ring with mint cleared beads below it
and slate locked beads above; the front page is untouched pastel; the run is
untouched night; the mute button reads on both. An AdMob interstitial appeared
during navigation and was dismissed with the back key rather than tapped.

`tsc` clean, 228 tests pass, lint unchanged.

### Stage 5 — check it on the device

`npm test` and `npm run lint` first. **No test asserts on any colour** — verified,
there are zero style assertions across `src/ui/__tests__` and `__tests__` — so
the repaint cannot break the suite. That also means the suite cannot catch a
mistake here: the device is the only check that counts.

Screenshot on the vivo, in this order: splash → login → map → run (top, middle
and bottom of the screen) → death card → leaderboard → settings. Record it in
`docs/` the way `DEVICE-TEST-2026-09-18.md` is recorded.

Two standing device rules apply: `com.bladeloop` logs nothing on this phone, so
launches are verified by on-device files rather than logcat; and no adb tap is
sent unless BladeLoop is the foreground app.

### Follow-on — the run is under water — **DONE 2026-09-21**

Asked for after stage 4, in two goes: first "give it depth, don't leave it
flat", then a reference photograph — sunlit tropical water, shafts of light
coming down through the surface, bubbles rising through them.

The complaint was right. Stage 1 and the gradient that followed settled *which*
ground the corridor stands on and fixed its value, but a gradient is still a
wall: it says which way is up and nothing else. Everything drawn in front of it
has a near side and a shaded one, so the only thing in the frame with no depth
was the room holding them.

**The ground is now water, and the water is the game's own day.** Built teal
first, straight off the photograph, and checked on the device — where the next
note was "give it the colour the main screens have". That is right, and it is
the same complaint §1.1 opens with: the run had been the one screen in the game
painted in a colour of its own. `SKY` is the day every other screen stands in —
a periwinkle warming through lilac into rose — so the run is that day seen from
*under* the surface. `bgTop`/`bgBot` go to `#221C4C`→`#2E2248` in `NIGHT` and
`#1B1440`→`#2B1940` in `DEEP`.

The hue of the day, at the value of a night — **not** `SKY` itself taken down
here. Taking the pastel down at its own brightness is the stage 1 wash over
again: the ball is violet and the hazards are pink-red, so both would be read
against their own hue, and the gradient would lighten toward the bottom of the
screen where `CAM_ANCHOR` puts the ball. The reference photograph is refused
for the same reason — its surface is near-white and its floor near-black. The
two ends stay a few points of value apart and most of a hue apart, which is the
rule §1.2 was written for. Nothing else in the palette moves: `bg` stays where
it is, so a saw's `bladeCore` and a `TvBox` face are still darker than the room
at every height and still read as holes punched through it.

**What is in the water is `src/ui/Water.tsx`,** and every part of it is a depth
cue rather than a decoration. A lit *surface* band across the top of the
screen, stacked out of five thin layers of alpha since a view can only be
filled flat. Seven *shafts* of light fanning from a point above the screen,
each drawn in three lengths that widen and fade as they fall — a fan is a
perspective, and it is the cue the reference leans on hardest. Twelve
*bubbles* in three bands, far ones small, slow and dim and near ones big, quick
and bright: that is the parallax, and it is the thing a fan of light cannot do
on its own. Sixteen *motes* of plankton, because water with nothing suspended
in it is a colour rather than a volume.

It obeys §3 rather than adding to it. `WATER` in `theme.tsx` is drawn from the
pale end of `SKY` rather than out of a palette of its own, and two things are
kept out of it. **No bubble catches a warm glint**, however true to the
photograph that would be, because gold means fly into this and the blade's red
means this ends the run. And nothing in it carries the ball's chroma — these
are pale, near-white films at a low alpha, never lit violet — so a bubble can
never be read as the thing being steered. Nothing in the layer rises above 0.34
opacity except a bubble's rim.

Everything climbs off `camY` rather than off a clock, so a paused run and a
death card are still water rather than water that carries on rising under a
card. The surface and the shafts never move with the camera and are one
memoised node per screen size; their sway and their lean against the steer are
a single looping transform on the **native driver**, so the JS thread — the one
the ball is steered on — never wakes for them. Only the bubbles and the motes
are live per frame. `src/ui/__tests__/water.test.tsx` pins the three things
that go silently wrong in a recycled backdrop: no bubble pops at either end,
the water rises off the camera, and the bands keep three different speeds.
Still no test asserts on a colour, and the device is still the only check that
counts.

**Open:** the reference also has a coral floor. It is deliberately not drawn —
the corridor's props enter from the bottom of the screen, which is exactly
where a reef would sit, and scenery there would compete with the one part of
the screen a player has to read early. If it is wanted, it belongs as a distant
silhouette behind the light rather than as a floor.

---

## 5. Acceptance criteria

1. Two grounds, and which one a screen stands on is decided by one thing:
   whether the ball is in play. No screen mixes them, invents a third, or
   re-negotiates the choice with its own opacity number. *(Rewritten at stage
   4, which was "one ground" before — see §2.)*
2. A hurdle has the same contrast at the bottom of the screen as at the top.
3. Every corridor shape belongs to one of the four families, and the family is
   readable in a screenshot with the shape's silhouette blurred out.
4. Nothing lethal is drawn cool. Nothing safe is drawn warm. The turret obeys.
5. Gold and mint appear only on things the player is meant to fly into.
6. No corridor colour appears in the HUD, and no HUD control sits in the play
   area wearing one.
7. **The ball is among the three most legible things on any frame of the run.**
   It is the object the player is steering; today it is the least legible.
8. Colour is declared in one module. No value is typed in two places, and a
   token a world shape shares with a screen is read off the world palette
   rather than restated.
9. `npm test` and `npm run lint` pass.

## 6. Notes for whoever edits these files

- `.prettierrc.js` says 100 columns, but `entities.tsx` and `theme.tsx` are
  formatted at 80. Keep each file at the width it is already at — do not reflow
  a file while repainting it, or the diff becomes unreadable.
- The long comments in `theme.tsx`, `config.ts` and `Backdrop.tsx` explain
  *why* each colour is what it is. When a value changes, the comment must change
  with it — several of them currently describe a decision that has since been
  reversed.
- `mixTheme` iterates `Object.keys(NIGHT)`, so every key added to `Theme` must
  exist in **both** `NIGHT` and `DEEP` or the fade will produce `undefined`.
