# Functional Requirements

**Project:** BladeLoop
**Last updated:** 2026-09-17

Requirements are numbered `FR-n`. Each one states the behaviour, then its
inputs and outputs, its validation, and its acceptance criteria. Where the
behaviour is already built, the file that owns it is named — this document is
a description of the product, not a wish list, and anything not yet built is
marked **Not built**.

---

## 0. Screen map and permissions

```text
launch
 └─ LoginScreen        (every launch — CONTINUE once the answer is stored)
     └─ Splash         PLAY · name/LOGIN · settings · leaderboard
         └─ LevelMap   the road: pick a stop · stars per level · PLAY LEVEL {n} · back
             └─ Game   HUD, pause button, mute button
                 ├─ Pause card       RESUME · START OVER · GET GEMS · board · settings
                 ├─ Game over card   RETRY HERE · START OVER · LAST FLAG {5} · GET GEMS · …
                 └─ Level clear card NEXT LEVEL / PLAY AGAIN · REPLAY LEVEL · …
         ├─ LeaderboardScreen      WORLD · COUNTRY · CITY
         ├─ SettingsScreen
```

**Permissions.** The app requests no runtime permissions. It needs network
access for the board, and the region lookup; vibration is a normal-level
permission granted at install. Location is deliberately *not* requested —
country and city come from the IP address instead (`src/services/Region.ts`).

---

## 1. Session and identity

### FR-1 — Login screen, every launch

The login screen is the first thing the app shows, in front of the splash, on
every launch. It offers **SIGN IN WITH PLAY GAMES**, **PLAY WITH GOOGLE** and
**PLAY AS GUEST**, in that order, and the two signed-in doors only appear on a
device that can open them. The answer is stored in `bladeloop.account.v1`, and a
returning player is never asked to sign in again: the last button becomes
**CONTINUE** and touches the account not at all, so the cost of the screen to
them is one tap.

- **Input:** a button press. **Output:** `account.provider` set to `playgames`,
  `google` or `guest`, and the splash.
- **Loading:** nothing decides on the first frame — `GameScreen` waits for
  `account.hydrated()` before showing the login screen, so a signed-in player
  never flashes past it. While either sign-in is running its button reads
  `SIGNING IN`.
- **Error:** a real failure (no network, no Play Services, provider off) puts
  `Google sign-in failed. Check your connection, or play as a guest.` under the
  button in red; the guest button underneath still works. A failed Play Games
  sign-in says `Play Games sign-in failed. Use Google, or play as a guest.` and
  additionally takes its own button away, since the service has just said it
  cannot open that door.
- **Not an error:** a dismissed account picker, or a dismissed Play Games sheet,
  leaves the screen exactly as it was. A *refused* Play Games sign-in is not
  that, although the service spells the two the same way: a game Play Games will
  not talk to — wrong signing certificate, or never set up in Play Console —
  comes back as a successful call whose `isAuthenticated` is false, and
  `react-native-google-play-games` turns that into the `E_SIGN_IN_CANCELLED`
  a real dismissal gives. Taken at face value the button is dead: pressed,
  nothing happens and nothing is said. So the clock is the tiebreak — a cancel
  that lands inside `DECIDED_MS` (900 ms, in `src/services/PlayGames.ts`) is
  faster than a person can read and dismiss a sheet, and is treated as the
  failure above.
- **Degraded:** if the Google module is missing from the build, its button is
  hidden rather than broken (`src/services/GoogleAuth.ts` uses a runtime
  `require`). The Play Games button is hidden until `PlayGames.probe()` comes
  back from the device saying it can be used, so it is absent on iOS, on an
  Android build without the native module, on a phone with no Play Games, and
  until the game is set up in Play Console.
- **Acceptance:** every launch opens on the screen; a returning player sees
  `CONTINUE` and reaches the splash with their account intact; a guest, a Google
  player and a Play Games player all reach the splash; killing the app
  mid-sign-in loses nothing.

### FR-2 — A guest is a full player

Every device holds an anonymous Firebase account, opened the first time the
board is touched. A guest's scores are written and read exactly like a signed-in
player's. Signing in with Google buys an account that outlives the install.

- **Acceptance:** with `submitScores` on, a guest's best appears on the world
  board.

### FR-3 — Name on first sign-in

Signing in with Google fills in the board name from the account's first name,
**only** when the player has never set one. The settings screen can still
change it.

### FR-4 — Sign-out

`signOut()` clears the account and puts the login screen back. The board row
the account owns stays where it is.

---

## 2. The run

### FR-5 — Control: tap to jump, drag to nudge

The run is a **side-scroller**: the corridor scrolls past left to right, and
the ball flies between a floor and a ceiling that are the corridor's own two
walls. See FR-27e for the axes.

- **Tap** — one finger landing is one jump (`LIFT` 340 px/s, capped at
  `RISE_MAX` 440), straight up the screen. Holding does nothing more. A tap
  taken while falling throws the fall away rather than being subtracted from
  it. One tap clears about 80 px of a corridor 308 px tall, so three or four
  stacked take the ball from the floor to the ceiling.
- **Drag** — the finger slides the ball *along the run*, by how far it
  *travels*, after `DRAG_SLOP` (6 px) of slop, at `DRAG_GAIN` 1:1 in world
  space, never further than `DRAG_BAND` (120 px) ahead of or behind the camera
  line. Forward is toward what is coming and buys less warning; back is more.
  Stopping the finger stops the ball on that frame, with nothing to coast off.
- The drag is a **nudge, not a second way of flying the level**: the corridor
  is authored against the jump, and a drag that could outrun a hurdle would be
  a way round every one of them.
- The scheme is deliberately **relative**, not absolute: every touch is also a
  tap, so finger-following threw the ball across the screen on every jump.
  Absolute finger-following, hold-a-side and an aimed tap have all been tried
  and rejected — do not reintroduce them.
- **Acceptance:** a jump taken anywhere on the glass moves the ball straight
  up, never along the run; a drag that ends mid-band leaves the ball exactly
  there.

### FR-6 — The descent

The corridor opens at `CLIMB` (104 px/s) and gets quicker the longer the run
lasts, never with depth: `climbAt` is `CLIMB × pace × speed`, and `speed` is a
function of how long the run has been flown and how many flags it has passed,
not of where the ball is. A stretch of corridor therefore arrives at the same
pace on a retry as it did when it was first met.

- **The creep:** a run gains `CREEP_RATE` of the opening pace per second flown
  — a flag's worth of pace every `CREEP_SECS` (90 s), about a tenth of a per
  cent a second. It is too slow to be felt arriving and plainly there half a
  minute later, which is what "the level is speeding up" should feel like. It
  is added to the gear below and the **sum** is held at `SPEED_MAX`, so it is
  not a fourth way to run the corridor faster than it has been audited; what it
  changes is that a level quickens while it is being flown rather than only
  when a flag goes by. It advances only while the run is being played, so a
  game over card left up does not wind the corridor on behind it.
- **The speed ladder:** every flag raises the gear by `SPEED_STEP` (0.12 of the
  opening pace), to a ceiling of `SPEED_MAX` (1.36) — a level ends about a
  third faster than it opened, at most. The opening pace is the slow part, not
  the whole level: the flags land a minute and a half apart, so the middle of a
  level runs at an ordinary pace and only the front of it is a crawl. A rung used to be a whole multiple of `CLIMB`
  to a ceiling of 4, which made the back half of a level a different game from
  the front half: the same corridor arriving four times faster than the one the
  player had learned to read, with the gaps in it coming four times sooner.
  Flags past the ceiling still score and still bank the checkpoint; they simply
  stop making the corridor faster. The change is eased in at `SPEED_RATE` —
  one `SPEED_EASE` (2.2 s) per rung — rather than applied on the frame the flag
  goes by, so it reads as the corridor leaning forward rather than as a jump cut.
- **The pace is shown:** the HUD carries a `+3%`/`+12%`/`+24%` chip under the
  level label, gear and creep together, from the moment the run has earned a
  whole per cent (about ten seconds in) to the end of the level, and the flag
  banner (FR-7) says the pace out loud as a flag is earned. It is a percentage
  rather than the `×2`/`×3` it used to be because the ladder is a nudge a flag
  at a time: `×1.12` is noise, and a rounded `×1` would say nothing happened.
- **A revive returns to the pace it left at:** `Checkpoint` carries the gear
  *and* the creep, so the corridor round a checkpoint is read back at the pace
  it was authored to be met at.

Gravity (`FALL_G`) sinks the ball to `SINK_MAX`; a player who never taps still
gets a run, riding the floor of the corridor and taking whatever the level has
put there. The corridor's two walls are the ceiling and the floor (`CEIL_X` /
`FLOOR_X`, ±154 px), and reaching either is not a death — the ceiling is what a
stack of taps runs out of, and the floor is where an untouched ball rests.

- **Screen shape:** the corridor and its walls are fitted to the screen's short
  side (`viewScale`), and the long side is how much of the run is on screen
  (`lookahead`) — about 760 px on a phone held sideways, which is what the
  levels were authored against. A window that shows less runs the corridor
  slower to match (`paceFor`), so warning time is equal on every screen. The
  same maths covers a tall window (tablet, split screen), which is the only way
  one is reached now that the game is landscape-only.
- **Acceptance:** the pace at the top of the level and at the bottom of it is
  the same for a run that has passed no flag; a dropped frame costs smoothness,
  not speed (fixed `1/60` step, `MAX_STEPS` 5).
- **Frame pacing:** the world steps in whole `1/60`s; the *drawing* does
  not. Each frame is drawn `alpha` of the way between the last two steps
  (`World.prev`, `viewOf`), so the ball travels on every refresh of the
  screen rather than only on the refreshes a step landed in. Without it a
  90Hz panel drew the ball standing still on a third of its frames and a
  120Hz one on half of them — a stutter no frame-rate counter reports.
- **Acceptance:** at 60, 90 and 120Hz no two consecutive frames draw the
  ball in the same place, and each frame carries its own share of a
  second's travel (`src/game/__tests__/smooth.test.ts`).

### FR-7 — Hazards and pickups

| Prop | Behaviour |
| --- | --- |
| `pipe` | The rail a blade rides. Touching the bare line is safe. |
| `gear`, `capsule` | Blades on a rail: sliding, or rocking along the pipe. Fatal. |
| `bigWheel`, `triangle`, `square`, `bracket` | Turning frames and rims. Fatal on contact with the band. |
| `hexagon` | A cage, not a hazard: nothing collides with the outline, and the ball flies in through it. Only the blades strung across it are fatal. Drawn in the rails' cool violet for that reason. |
| `turret` | Turns red and fires a shot **across** the corridor on its own fixed line (`Prop.angle`, straight across ± `SHOT_SPREAD` 0.6 rad off the launcher's depth). The shot never tracks the ball, and it is gone the moment it reaches the far wall. |
| `wind` | Shoves the ball across the corridor — up or down the screen — while it is inside, up to `WIND_MAX` 76 px, eased off on the way out. The shove is a standing offset over the line the ball has flown (`Ball.fly` vs `Ball.x`), never folded into its speed, so it is something to fly against rather than gravity the player cannot beat. |
| `flag` | Checkpoint, payout and gear change — see below. |
| `star` | `+1` coin. |
| `tvBox` | Bursts coins and doubles score for `BONUS_SECS` (10 s). |
| `plate` | The dish: ends the level. |
| `stand` | Decoration. Nothing collides with it. |

**A frame leaves a lane at every angle it turns to.** `bracket` is the only
shape long enough for that to be in question: it turns, a level lays a stage
down many times over, so sooner or later it is met lying flat across the
corridor — and at that turn the channel down its middle lies *across* the run
and is not a way down at all, leaving only the wall lane either side. At
`BRACKET_H` 236 that lane was 20 px for a ball 22 px across, and a frame
anchored near the middle closed the corridor outright for a few frames. The
spine is 140 now (was 168, and the boxes it is cut from `BRACKET_W` 30, was
34), which leaves `LANE_MIN` at the wall with 23 px to spare wherever the frame
is anchored and however it is turned, and the channel is `BRACKET_GAP` 74 (was
58) so that taking a frame head-on is a line that can be aimed at. The second
cut was asked for at level 8, which is the level made of frames: there they are
met inside a wind band, where the lane the player ends up in is the one the
band leaves them rather than the one they aimed at. The arithmetic,
not the flown lap, is what pins this — see the frame test in
`levelAudit.test.ts`, since one lap only ever meets each frame at one angle.

**The flag** is the one landmark a level has, and it does four things at once:
`FLAG_SCORE` (150) to the score, `FLAG_COINS` (2) to the run's gems, the resume
point banked with the gear it was passed in, and the descent wound up one rung
of the ladder (FR-6). It is drawn large and dark — a chequered flag on a gold post — and
taking one puts a **CHECKPOINT** banner over the run for about a second and a
half, naming the payout and the new pace. The banner takes no touch and is never
waited on: the run carries on underneath it.

Flags are authored inside the stages, and the level builder keeps roughly one
per `FLAG_GAP_SECS` (70 s) of descent, dropping the rest — so the first arrives
around a minute and a half in and the ceiling is reached with a stretch of level
still to spend it on. None is kept within half a gap of the dish.

- **Acceptance:** the level audit test (`src/game/__tests__/levelAudit.test.ts`)
  passes — every authored stage is flyable and no prop sits outside the
  corridor. The audit flies one lap of each level's **window** with every
  authored flag kept (`createWorld(n, { laps: 1, allFlags: true })`). A
  full-length level also lays down stages recalled from the levels behind it
  and fresh hurdles dealt between them (FR-9). The recalled stages are not
  re-flown here, because every script stage belongs to exactly one level's
  window and is audited by the level that owns it. The hurdles are flown by
  `src/game/__tests__/hurdles.test.ts`: every one, both ways round, three deals
  of each.

### FR-8 — Death, retry and revive

A death shows the **GAME OVER** card (**NEW BEST** when the run beat the
device's best) with:

- **RETRY HERE** — resume from the last flag.
- **START OVER** — restart the level from the top.
- **LAST FLAG {5}** — spend 5 coins (`REVIVE_COST`) to revive; hidden or
  refused when the balance is short, and hidden until a flag has actually been
  passed. The run-up no longer carries a flag of its own (FR-6), so a death in
  the opening minute and a half has no flag to be put back at and the card
  offers **GET GEMS** in its place. The revive returns the descent to the gear
  that flag was passed in.
- **GET GEMS**, share, leaderboard, settings.

A respawn backs up `RESPAWN_BACKUP` (220 px) and picks a lane that stays clear
for `RESPAWN_CLEAR` (2.1 s), then eases back to full pace over
`RESPAWN_SETTLE` (0.45 s). Nothing is immune, so the depth has to be one the
ball can survive being set down at: `respawnSpot` asks `laneAt` for the best
lane where the retry would like to start, and while that lane does not last the
full window it walks back up the corridor (up to 8 steps, never past the start
of the level) and asks again. Without that, a death on a stretch with no clear
lane at all put the ball straight back into the hazard that killed it, and the
retry button became a death loop with no way out of it — the game "getting
stuck" in the middle of a level.

A step is **120 px or one second of descent at the run's gear, whichever is
more**. Flat 120 px is a second of corridor at the opening pace and less than
one at the top of the ladder, so at speed the search covered less run than the
window it was searching for, and a retry in a wide stretch settled for the least
bad depth it could see and died there. What the search is looking for is
somewhere the furniture is standing differently, and how far away that is, is a
length of run.

**Both ways back in go through `respawnSpot`,** the revive included. The revive
used to take the flag's own depth as given, on the grounds that a flag stands in
clear air — true while the corridor ran at one pace, and false once the flags
started winding it up, because the window is quoted in seconds and at the top
gear reaches two or three times further down the corridor than the flag can see.
It may therefore set the ball down above the flag; that is only ever generous,
since the flag is already taken and scores nothing a second time.

**A respawn restarts at the opening pace** (`speed` back to 1, `gear` and
`creep` kept) and winds up to `runGear(gear, creep)` at `SPEED_RATE`. This
matters far less than it did
while a gear was a whole multiple of the descent, but it is still the line the
lane picker flies, so it has to be the line the ball takes:
`respawnTravel`/`respawnDepth` integrate that ramp, and the lane picker and both
audits all read them, so "clear for the window" is one claim in one place.

- **Acceptance:** the retry and the flag-respawn audits are flown at every pace
  a run can reach (`gears()`, from 1 to `SPEED_MAX` in half-rung steps, since
  the creep fills the gaps between the rungs) in `levelAudit.test.ts` and
  `respawn.test.ts`. The unattended fall out of a respawn hits nothing inside
  `RESPAWN_CLEAR` at any of them.

- **Validation:** a revive must check the balance before spending;
  `spendCoins` returns `false` and changes nothing when short.
- **Acceptance:** retry resumes at the banked checkpoint score, not zero.

### FR-9 — Pause

The pause button freezes the run (`status: 'paused'`) and shows **RESUME**,
**START OVER**, **GET GEMS**, the board and settings. The app going to the
background pauses the run rather than fast-forwarding it on return: a call
arriving mid-descent is not a death the player earned.

### FR-9a — The back button

Android's back key is the only navigation the game has, and it walks one screen
at a time all the way out:

| Where the player is | Back takes them |
| --- | --- |
| A sheet, the shop, the board, the settings | Closes it, onto whatever was under it |
| The road | The front page |
| A run | The front page, with the run paused rather than thrown away |
| The front page | The login door |
| The login door | Out of the app |

The front page used to be the bottom of that chain, which left the door
reachable only by killing the app and starting it again. It is one press now,
so an account can be changed — or a guest can trade up to Google — without a
restart.

- **Acceptance:** back from the road lands on the front page and back again on
  the door; the door is the only screen that lets the press through to the
  system (`src/ui/__tests__/back.test.tsx`).

### FR-10 — Level clear

The dish is drawn to be read a stage before it arrives: three flattened rings
200 px across (was 160, and 110 before that), the outer one gold because it is a
payout and not more furniture, with **LEVEL COMPLETED** lettered across the face
below the centre — the lettering is quoted against the width, so it grew with
the dish, and below rather than on the centre because the finish sets the ball
down on the dish's own anchor and the middle of the face is where the run ends
up parked. 200 px is as wide as it goes at its anchor of x 60: half of it out
from there lands on 160, which is the narrowest portrait viewport's own edge,
and a wider dish would draw its gold ring off the side of those screens.
Nothing about the finish itself moved: the dish has no hitbox and never had
one, it ends the level on the ball passing its depth at any X.

Reaching the dish shows a cheer that moves on with the level -- **AWESOME!**, **SUPERB!**, **BRILLIANT!**, **AMAZING!**, **FANTASTIC!** in gold bubble lettering with a burst of stars -- (or **ALL CLEAR** on the last level) over a
first line reading **LEVEL _n_ COMPLETE**, with **NEXT LEVEL** / **PLAY AGAIN**,
**REPLAY LEVEL**, share, gems, board and settings. The level is named in words
because a level is now minutes of run, and one green word is what a player would
otherwise see whether they walked it or fought it.
`recordClear(level, stars)` banks two things: the clear itself,
which opens the next level, and how many of that level's stars the run picked
up, kept at the best any run of it has managed.

**NEXT LEVEL** goes back out to the road with the newly opened level pointed
at, rather than dropping straight into it. A level is chosen in one place, and
the road is where the stars the run just won are shown over the stop it
cleared.

The card itself carries no stars. The ten-star row that used to ride above
every card — the whole game's progress, on a card about one run — is gone; the
stars live on the road, per level.

- **Validation:** `cleared` only moves forward; it is no longer capped, since
  the road does not end at the twentieth level. A level's star count never goes
  down.
- **Acceptance:** clearing level 3 twice leaves `cleared` at 3; replaying it
  and missing the stars leaves the count it had (`src/state/__tests__/progress.test.ts`).

### FR-11 — Levels

Twenty authored, and then it keeps going. Each is a slice of a sixty-four stage
script, each with its own
dish at the bottom and between one and four stars lying in the corridor on
the way down. Levels 1-5 are the reference run; 6-10 carry on in the same
vocabulary, one idea per level -- the yard, the crossfire, the tunnel, the
gauntlet and the core. 11-20 are that same vocabulary on a shorter leash: a
level of nothing but pills, a level of nothing but ringed blades, a level of
nothing but frames, and so on down to the finale. No hazard is introduced
past level 10 on purpose -- by then the player knows every shape in the game,
and what is left to ask of them is to read the same shapes with less room.

The twentieth level is the finale the map crowns: it is the longest descent and
uses every hazard in the game, not a boss fight, because a falling corridor
has nowhere to put a boss.

**How long a level is.** Each level carries a target descent in seconds
(`LevelDef.secs`): five minutes for the early ones, six or seven further down,
and ten for the finale. That target is what decides the length of the corridor —
the builder walks the descent as the run will meet it (carrying depth, elapsed
time and the gear the flags have set) and lays stages until the clock is full.
A level therefore runs to thirty to seventy stages rather than the three or
four its window holds.

**What fills them is not one window on repeat.** A descent is read in three
stretches, so the hurdles a player meets in the last minute are not the ones
they met in the first:

| Stretch | Share of the descent | What it lays |
| --- | --- | --- |
| Opening | until the recalled stages run out | The corridor **behind** this level: about two levels' worth of earlier stages, once each, met at the slowest gear of the run. An easy way in, on hazards the player has already beaten. |
| Middle | to 70 % | **Fresh hurdles** dealt from every hazard the level and the corridor behind it have shown. |
| Close | the rest | Fresh hurdles that use the level's own hazards, then the level's own window, once, at the gear the flags have bought. This is the idea the level is named after. |

Nothing **ahead** of the level is ever reached for: an opening is the last
place to meet a hazard for the first time. Level 1 has nothing behind it, so it
opens on its own window and deals hurdles from there on.

**No script stage is laid twice in a level.** The time between them is filled
from a **hurdle deck** of 21 small hurdles. Each one is a single piece of
furniture: a bladed line, a ringed line, pill lines on both walls, spoked
rings, hexagons, frames, a launcher over a line, or a wind band at a line.
Each is dealt with its own wall, count, spacing and timing.

- Nothing is dealt a second time until the whole deck has been, and the same
  hurdle never comes twice running.
- Hurdles are laid `HURDLE_GAP` (170 px, about a second and a half) apart, so
  the corridor never goes quiet for longer than that. The old 300 px breather
  and the air at the edge of each stage came to five to nine seconds of empty
  corridor, many times a level.
- Nothing reaches the floor within 400 px of a flag, or of anything else that
  reached it, so a retry always has a lane to land in.
- The deck is seeded by the level, so a level is the same every time it is
  played.

Stars and consoles are laid only out of the level's **own** window, the first
time its stage comes round, and a dealt hurdle carries no pickups. So a level
is worth the same one to four stars it always was, the shop banner interrupts a
run once, and reaching back for an older corridor does not quietly print gems. The dish is placed once, at the
end, by the builder rather than by whichever stage happens to be one that
closes a run of the script.

**Past the twentieth.** The game does not end there. `levelAt(n)` answers for
any `n`: past the authored twenty it deals the levels 6-20 corridors again in
order, one lap after another, each lap marked on its name (`Wheel Yard II`,
`Wheel Yard III`) and running a stage deeper into the dark palette than the
last. The tutorial corridors -- levels 1-5 -- are never dealt again, so a
player who has cleared the written game is never dropped back into it.

Nothing out there is generated. Every endless level is a stretch of script that
was placed by hand and audited, because "this corridor can be flown down" is a
fact about the stages in it and not something a generator could promise. That
is what lets the audit of twenty levels stand for all of them.

- **Acceptance:** every one of the twenty passes the level audit -- the
  corridor never pinches below two ball widths of lane (`LANE_FLOOR`,
  `4 * BALL_R` of places the ball's centre may sit, which is 66 px of daylight
  on the screen), no flag drops a respawn into a hazard, and no two big shapes
  crowd each other. Every level past them is
  one of those same audited corridors, whatever number is asked for
  (`src/game/__tests__/endless.test.ts`).

### FR-11a — The level map

PLAY on the front page opens a road wound up a lavender page with a stop on it
for every level: the lowest at the foot of it, the highest at the top.
Behind the road, banks of cloud are stacked all the way up the page with
specks of light between them, laid out off the bank's own index rather than
at random so the sky is the same every time the page is opened. Every
stop is a bead with its own number on its face. A cleared one is violet and
wears the stars that level is worth, the next one up is bigger and ringed in
green with READY! beside it, and everything past that is slate, padlocked and
cannot be pressed. The twentieth stop wears a crown -- the end of the written game rather than the
end of the road, which carries on above it.

**A road with no end.** The page draws a window onto it rather than the whole
of it: every stop from twenty-four behind the player to five past them, and
never fewer than the authored twenty. Dragging the page to its foot hands back
another twenty-four stops of the road already walked, so a level cleared long
ago can still be gone back to. A page that mounted every stop would be mounting
thousands of them for a player who has been at this a while, and the only thing
that would change on screen is the length of the scroll bar.

**The stars.** A cleared stop carries one socket per star that level actually
has — one to four, as authored — filled for each one the player has picked up
on their best run of it. That is the game's only star display: a level can be
finished without its stars, and going back for the ones that were missed is
the reason to replay a level that is already beaten. A level that has not been
cleared shows none at all, since an empty arc over a padlocked stop is only a
page telling the player what they are missing.

There is no energy meter, no daily chest, no sale and no streak on the page,
because there is nothing behind it that keeps them.

- **Acceptance:** at least `LEVEL_COUNT` stops, and more once the player is
  past them; everything past `cleared + 1` is disabled; the play button names
  the level it opens; a cleared stop reads out "{won} of {total} stars" and an
  uncleared one reads out nothing; two hundred levels in, the page draws a
  window and gives back more of the road when it is dragged to its foot
  (`src/ui/__tests__/levelMap.test.tsx`).

The twenty that are written, and the stages each is cut from -- levels 21 and
up are these same windows again, from row 6 down:

| # | Name | Stages | What it is about |
| --- | --- | --- | --- |
| 1 | First Blades | 0–3 | The opening lines and the first triangle |
| 2 | Rod Works | 3–6 | Twin lines, pills, the first spoked rings |
| 3 | Hex Gardens | 6–9 | Hexagons with blades strung across them |
| 4 | Frame Run | 9–12 | The tumbling `[ ]` frames, and the console |
| 5 | Last Descent | 12–16 | Launchers, wind, the reference’s own dish |
| 6 | Wheel Yard | 16–19 | Spoked rings, one across the corridor at a time |
| 7 | Crossfire | 19–22 | Launchers on both walls, firing across each other |
| 8 | Wind Tunnel | 22–25 | Wind bands, with frames turning inside them |
| 9 | The Gauntlet | 25–28 | Hexagons and ringed blades, back to back |
| 10 | Core Breach | 28–32 | All of it at once, and the first half's last dish |
| 11 | Pill Works | 32–35 | Capsule lines: the narrow lane, held |
| 12 | Spin Cycle | 35–38 | Ringed blades and nothing else |
| 13 | Tumbledown | 38–41 | The `[ ]` frames on their own |
| 14 | Ring Road | 41–44 | Spoked rings, each with a line on the far wall |
| 15 | Shooting Gallery | 44–47 | Three launchers a stage, over lines |
| 16 | Headwind | 47–50 | Wind bands with something to be blown into |
| 17 | Honeycomb | 50–53 | Hexagons, one straight after another |
| 18 | Switchback | 53–56 | One lane, changing wall every few seconds |
| 19 | The Grind | 56–59 | The close furniture, back to back |
| 20 | Event Horizon | 59–63 | Every hazard at once, and the last dish |

The front page drops the player onto the road at `nextLevel()` — one past the
highest cleared, with no cap. It carries no star row of its own:
the front page is the way in, and what the player has is on the road.

---

### FR-11b — Level signatures and worlds — **Added 2026-09-24**

- **Signature.** Each level has one or more signature set pieces (`LevelDef.sig`) that no other level deals in the same mix: saw rain, fountain, pendulums, orbiters, zippers or crushers. They alternate with the ordinary hurdles through the middle and close, and appear from the start of the opening. Level 4 opens and continues with saws falling from the ceiling, followed by hurdles.
- **Rules.** A set piece leaves `LANE_MIN` at every depth and instant, keeps the floor window, and never leaves a stretch quieter than a hurdle gap. A set piece that cannot fit where it is due gives way to an ordinary hurdle.
- **Worlds.** Seven worlds of three levels each: Nature (1–3), Candy (4–6), Frozen (7–9), Lava (10–12), Neon City (13–15), Moon (16–18), Galaxy (19–20). Endless levels cycle through them in three-level blocks.
- **Unlock.** A world is unlocked once its first level is playable (`cleared + 1 >= first`). There is no purchase.
- **Look.** A world sets the corridor's ground, rails and rings, and draws its own scenery behind the corridor. Blades, hazards, the ball and coins keep their colours in every world. Scenery never collides or takes touches, and it holds still whenever the camera does.
- **Map and card.** Each world's first stop on the map has a sign with the world's name, greyed with a lock while shut. The level-complete card for the level before a world says "NEW WORLD UNLOCKED: <NAME>".
- **Acceptance.** `hurdles.test.ts` (every set piece flown; every level deals its own signature and only its own), `worlds.test.ts`, `scenery.test.tsx`.

## 3. Progress and economy

### FR-12 — What persists

`bladeloop.progress.v1` holds `coins`, `best`, `runs`, `cleared`. A finished
run calls `recordRun(score, coins)`, which returns whether it was a new best —
which is also what decides whether the score is worth sending to the board.

### FR-13 — Shop (removed 2026-09-25)

There is no shop. Gems are earned in play only (stars, consoles, flags) and
spent only on the revive (LAST FLAG). The coin-pack sheet, the GET GEMS beads
on the cards, the HUD gem chip's tap and the console opening the shop banner
are all gone; the console still pays out five and starts the bonus.

- **Acceptance:** no card, the HUD or any pickup offers to sell gems.

### FR-14 — Reset progress

Settings offers a reset that clears `progress` and leaves `settings` and the
row already on the board untouched.

- **Acceptance:** after a reset, sound preferences and the player's name are
  unchanged and the board row still stands.

---

## 4. Leaderboard

### FR-15 — Three boards from one collection

`scores/{uid}` carries `country` and `city` next to the score, so the
leaderboard screen serves **WORLD**, **COUNTRY** and **CITY** from one
collection — the narrow two are the same query with a filter in front. Fifty
rows per board (`BOARD_SIZE`), each board cached separately; a board fetched
less than 60 s ago is shown without a network call.

- **Write rule:** a write happens only when a run beats what this device
  already sent, or when the name or place on the row changed.
- **Off switch:** `settings.submitScores` off keeps every run on the device.
- **Loading:** the screen shows the cached board while it refreshes rather
  than an empty list.
- **Error:** a failed read falls back to the last board seen and says
  `Offline - showing the last board seen`. A failed write is queued and
  retried on the next app open or board open.
- **Empty (no rows):** `Nobody has posted a score yet. Be first.` — or
  `Nobody around {where} has posted a score yet. Be first.`
- **Empty (no place):** `Your city is not known yet, so there is no city board
  to show. The world board still has you.` (and the same for country).
- **Validation:** names are trimmed to 14 characters and stripped of control
  characters before they go up; the rules re-check every field server-side.
- **Privacy:** names, country and city are public, and both the settings
  screen and the board say so.
- **Acceptance:** a device that has never been online can open the board, see
  its last cached rows, play, and have its best arrive on the board on the
  next launch that reaches the network.

---

## 5. Ads

### FR-16 — No ads — **Removed 2026-09-24**

The game shows no ads of any kind. AdMob (`react-native-google-mobile-ads`)
is not in the build, and no screen or transition waits on an ad.

- **Acceptance:** no rewarded card in the shop, and START OVER / NEXT LEVEL
  act at once.

### FR-17 — UMP consent — **Dropped**

Only needed for ads; there are none.

---

## 6. Settings, sound and sharing

### FR-18 — Settings screen

A full page reachable from the splash's gear and from the pause, game-over and
level-clear cards.

- **Sound** — effects, music and vibration, each its own switch.
- **Player** — the board name (public, shown next to the place it was set in)
  and whether scores are sent at all.
- **Share / rate / reset progress.**
- **Validation:** the name is trimmed and cut to 14 characters on entry;
  an empty name shows as `YOU` on the board.

### FR-18a — The front page's two corners

The gear on the left opens settings; the gold bead on the right opens the
leaderboard. The right-hand one is a trophy on a gold disc, and it is the
largest control on the page — it used to be the game's own crowned character,
drawn out of the same parts as the crowd behind the page, which read as a
mascot rather than as a door and hid the one thing it was for.

A page drawn by `Screen` (settings, leaderboard) balances its back arrow with
bare space rather than a second ring: the ring was a circle in the opposite
corner that looked like a control and did nothing when it was pressed.

- **Acceptance:** both corners keep their accessibility labels ("Settings",
  "Leaderboard"); the page header has exactly one pressable in it.

### FR-19 — Mute button

The floating speaker is a master over `sfx` and `music` rather than a third
setting that could disagree with them: one press silences both, the next
brings both back.

### FR-20 — Privacy switches — **Not built (regression to restore)**

`settings.analytics` still exists, still defaults to on and is still what
`Analytics` reads, but no screen reaches it. Both stores expect a player to be
able to find it in a listing that carries analytics. Restore them, with a policy link, before submitting.

### FR-21 — Share and rate

One share button opens the platform sheet with the player's score; rate opens
the store listing. `IOS_APP_ID` in `src/services/links.ts` is still a
placeholder.

---

## 7. Analytics

### FR-22 — Events and consent

`src/services/Analytics.ts` records every event and forwards it to Firebase the
moment the SDK is installed — no call site changes. Consent is enforced inside
`track()`, so no screen can report around it; turning the switch off also calls
`setAnalyticsCollectionEnabled(false)`.

Events: `app_open`, `run_start`, `run_end`, `level_clear`, `revive`,
`checkpoint`, `shop_open`, `shop_purchase`, `ad_request`, `ad_impression`,
`ad_reward`, `ad_failed`, `leaderboard_open`, `leaderboard_submit`,
`settings_open`, `setting_change`, `share`, `rate`, `progress_reset`,
`screen_view`.

---

## 8. Cross-cutting rules

| # | Rule |
| --- | --- |
| FR-23 | No service failure may end or fail a run. Every service answers honestly when its backend is missing and the run carries on. |
| FR-24 | Nothing decides on the first frame. Stores read as their defaults until AsyncStorage answers; screens that would flash wait for `hydrated()`. |
| FR-25 | Saved state is versioned in its key (`…v1`, board `…v2`); a shape change takes a new key. |
| FR-26 | The run word on screen says **ROTATE**. It matches the reference art, not the drag control — it is not a bug. |
| FR-27 | Landscape is the orientation the whole game is in, and the run is flown *across* it. `viewScale(H)` fits the corridor and its walls to the screen's short side, `lookahead(W, H)` is how much of the run the long side shows, `paceFor(W, H)` retunes the scroll to match, and all three are read per frame so a change of window shape needs no restart. |
| FR-27a | **The whole game is sideways, and never turns.** The activity is `android:screenOrientation="sensorLandscape"` — both ways of holding the phone sideways, and `sensor*` rather than `user*` so a player with the system auto-rotate lock on is not held to one of them. Every screen is drawn that way: the door, the front page, the road, the board, settings, the shop and the run. There is no rule deciding per screen and nothing turns the phone part way through, which is what the build before this one did (see FR-27d for why that was dropped). `src/services/Orientation.ts` still asks, once, at launch, through the app's own `NativeOrientation` module (`OrientationModule.kt`): belt and braces on Android, where the manifest has already said it, and the only lock on a platform whose native half is not built. The service drops an ask that changes nothing, which matters because the call sits in a screen that re-renders every frame of a run. `configChanges` covers the orientation keys, so a flip end for end resizes the activity rather than recreating it: world, score, checkpoint, gear and coins all survive it. **iOS: `Info.plist` now lists the two landscape keys and nothing else**, on the phone and on the iPad, so an iPhone is landscape-only too even though the native module still has no iOS half. Pinned by `src/ui/__tests__/orientation.test.tsx` and `src/services/__tests__/orientation.test.ts`. |
| FR-27b | A flip end for end, or any other change of window shape, changes nothing in the level. The corridor is authored in world px, so a different window is the same corridor with more or less of the run on screen and the pace moved to match. The ball, camera, score and gear are untouched at the instant of the turn; a held drag is dropped, because a `pageX` measured before the turn is meaningless after it. Pinned by `src/game/__tests__/orientation.test.ts`. |
| FR-27c | **Every page lays itself out for a short, wide window.** `src/ui/layout.ts` is the one place that reads the shape: `useLayout()` returns the window, the safe area, a gentle `ui` scale on decorative furniture (`uiScale`, 1 at `PAGE_H` 360dp, clamped to 0.82–1.25), `tight` for a viewport under `TIGHT_H` 720dp, and `col`, the width a column of content is capped at (`COL_MAX` 520). Three pages are built out of a wordmark, the character in its ring of blades and a set of controls — the door, the front page and the loading screen — and stacked those come to about 500dp against the 320–440 a phone has sideways. On a `tight` viewport each lays them out *across* instead; a tablet has the height and keeps the stack. `TIGHT_H` is 720 rather than a rounder number because the stacked front page comes to about 674dp once `ui` is at its ceiling, and a 600dp window that kept the stack would run its last button off the bottom with nothing to scroll. The settings page puts its two groups of rows abreast (`Screen`'s `columns`), but only where there is room for two columns of 300 (`PAIR_MIN`); a small phone keeps the single column, because two columns of wrapped labels is worse than the scroll it was avoiding. The road keeps a lane of its own (`LANE_MAX` 420) centred in the page rather than swinging its sine across a 900dp screen, and the shop sheet keeps its own width rather than running the length of the bottom edge. Type, tap targets and row spacing are never scaled — a 44dp target is 44dp on every device. Pinned by `src/ui/__tests__/responsive.test.tsx`. |
| FR-27d | **Nothing on any screen sits under a cutout.** Held sideways the cutout, the curve of the corners and the gesture bar all move to the *sides*, which is where a portrait app never has to look. Every page pads by `GUTTER` (16) plus the inset on that side; the HUD already took `left`/`right`, and the mute button and its hit test (`muteButtonHit`, which the touch layer uses so a tap on the button is not also a steer) both take the right and bottom insets and must be given the same pair. The first attempt at a landscape-only build was reverted on the device for exactly this class of problem at the other end — the door's stacked layout ran off a 720px screen and the sign-in button was cut in half — which is what FR-27c now prevents. |
| FR-27e | **The run is a side-scroller, and the world's two axes are not the screen's.** The corridor keeps the axes its sixty stages are authored in: `x` is *across* the corridor, `FLOOR_X` to `CEIL_X` (±154), and `y` is progress along the run. Gravity and the taps work on `x`; the scroll and the drag work on `y`. `GameView` then turns the whole drawn layer one quarter (`rotate: '-90deg'`, one transform on one node) so `y` reads left to right across the glass and `x` reads top to bottom — which is why `Walls`, `Water`, `Backdrop` and every prop in `entities` are still written, and every level still authored, in the corridor's own axes. The three pieces of type inside the corridor — the word on the finish dish, a star's `+5` and the pop that answers a pickup — carry `UPRIGHT` (the same quarter, the other way) so they read upright on the glass; the HUD is outside the turn altogether. `RunWord`'s own quarter turn and the layer's cancel out, which is what lands the word reading along the run. Pinned by `src/ui/__tests__/gameView.test.tsx`. |
| FR-28 | The drawing interpolates between simulation steps and never extrapolates past the current one. Anything that *puts* the ball somewhere — a respawn, a checkpoint, a fresh world — calls `syncPrev` so it is never drawn sliding in from where it died. |
| FR-29 | The game is played in deep space. Every colour comes from `COLORS` or the two world palettes `NIGHT`/`DEEP` (all three in `src/ui/theme.tsx`); a screen that spells a hex at the call site is a bug unless the value belongs to a coloured surface of its own, such as a medal. |

---

## 9. Test coverage

`npm test` — 26 suites, 335 tests as of 2026-09-23, all passing. The level
audit and the retry test both run once per level, so both grow with the game;
the audit is the slow one (about four minutes for twenty levels).

| Suite | Covers |
| --- | --- |
| `src/game/__tests__/control.test.ts` | Tap-vs-drag, slop, gain, the corridor as floor and ceiling |
| `src/game/__tests__/pace.test.ts` | Scroll pace across screen shapes |
| `src/game/__tests__/orientation.test.ts` | The corridor fits the screen's short side, the run gets its long one, and a drag is worth the same share of the run on every shape (FR-27, FR-27b) |
| `src/game/__tests__/smooth.test.ts` | Frame pacing at 60/90/120Hz; no interpolation across a respawn |
| `src/game/__tests__/levelAudit.test.ts` | Every authored stage is flyable |
| `src/game/__tests__/respawn.test.ts` | A retry is never set down inside a hazard, and survives the whole respawn window untouched |
| `src/services/__tests__/leaderboard.test.ts` | Write rules, cache, queued retry |
| `src/services/__tests__/analytics.test.ts` | Consent enforcement |
| `src/state/__tests__/settings.test.ts` | Name validation, mute master |
| `src/state/__tests__/progress.test.ts` | What a clear banks: the next level, and a level's best star count |
| `src/ui/__tests__/screens.test.tsx` | Login, board, settings rendering |
| `src/ui/__tests__/levelMap.test.tsx` | The road: a stop per level, the lock gate, the play button, the stars per stop |
| `src/ui/__tests__/overlays.test.tsx` | Pause, game-over and level-clear cards |
| `src/ui/__tests__/orientation.test.tsx` | The game asks for landscape once at launch and never for anything else, walking the screens that used to be upright (FR-27a) |
| `src/ui/__tests__/responsive.test.tsx` | The pages lay out across a phone held sideways and down a tablet, and keep the side insets clear (FR-27c, FR-27d) |
| `src/ui/__tests__/gameView.test.tsx` | The quarter turn: one rotation on one node, the box it turns, and the type that turns back out of it (FR-27e) |
| `src/ui/__tests__/walls.test.tsx` | The walls land on the corridor's edge and nothing outside them lightens the room |
| `__tests__/App.test.tsx` | App boots |

Google sign-in is driven through `__mocks__/@react-native-google-signin/`, so
the login tests exercise the real token-trade path without Play Services;
`__setSignInResult` is how a test asks for a dismissed picker or a failure.
