# PR — Professional Requirements

**Project:** BladeLoop
**Status:** Active · pre-release (unlisted build, no ads)
**Last updated:** 2026-09-24
**Owner:** Amna Rauf

---

## 1. Purpose

BladeLoop is a one-thumb arcade side-scroller for Android and iOS. A narrow
corridor filled with spinning blades, tumbling frames, launchers and wind
bands scrolls past from the right; the ball flies between its floor and its
ceiling, and the player keeps it alive to the dish at the end of each level.
Twenty of them are authored by hand, and the road carries on past them without
end, dealing those same audited corridors again.

The purpose of the product is to deliver a run that is **read on the way in
rather than reacted to** — a steady scroll, a corridor the player can see a
long way into, a control that stops exactly where the thumb stops, and levels
that are authored by hand rather than generated — wrapped in the retention
loop a free arcade title needs (leaderboard, stars, coins).

## 2. Problem statement

Endless one-tap games are easy to start and hard to stay with. Two failures
are common, and both are design problems rather than content problems:

1. **The control fights the player.** A tap that also drags the ball
   (absolute finger-following) throws the ball across the screen on every
   jump. A control with momentum leaves the player a beat behind a corridor
   they must be *stopped* in.
2. **A failed run is the end of the session.** No checkpoint, no reason to
   come back, no sense of progress beyond a number.

BladeLoop answers both: a relative drag (the ball moves by how far the finger
*travels*, and stops when the finger stops) plus a tap that is purely a jump;
and flags that bank a checkpoint, twenty authored levels with their own stars
to collect and an endless road past them,
a coin economy
with a 5-coin revive, and a world / country / city leaderboard.

## 3. Target users

| Segment | What they want | What the product gives them |
| --- | --- | --- |
| Casual mobile player (primary) | A run under a minute, one thumb, no tutorial | Tap to jump, drag to nudge, immediate start, guest play |
| Score chaser (secondary) | A board to climb, a personal best to beat | World / country / city boards, best score, rank |
| Completionist (secondary) | An end to reach, and a reason to go back in | Ten named levels, the stars lying in each one, hand-authored stages |
| Returning player | To not start over | Checkpoints, per-level progress, coins that persist |

Assumed device floor: an Android phone with Play Services. The game is played
and read sideways throughout — there is no portrait screen in it, and the run
is flown across the long side rather than down the short one. The corridor and
its two walls are fitted to the screen's height and the width is spent on what
is coming, with the scroll slowed on a window that shows less, so warning time
is equal on every screen shape; the pages around it lay their parts out across
the screen rather than down it, because a phone held sideways has about 360dp
of height and the stacked layout they were first drawn as needs half as much
again.

## 4. Goals

**Product goals**

- **G1** — A first run starts within one screen of the app opening: login
  screen (once) → splash → play.
- **G2** — A control that never contradicts itself: a tap is only a jump, a
  drag is only a nudge along the run, and the ball rests where the finger
  rested.
- **G3** — A failed run is resumable: RETRY HERE from the last flag.
- **G4** — Progress survives the session and a device that is offline.
- **G5** — No ads. AdMob was removed on 2026-09-24, and the coin shop on 2026-09-25:
  the game has no monetisation.

**Technical goals**

- **G6** — A fixed-step simulation (1/60 s, at most 5 catch-up steps) so a
  dropped frame costs smoothness, never speed or fairness.
- **G7** — Every service degrades honestly: a missing native SDK, a dead
  network or an unconfigured backend must never fail a run.
- **G8** — No native module required for the leaderboard (Firestore REST), so
  the board works in any build.

## 5. Scope

### In scope (built)

- Ten hand-authored levels across thirty-two stages, each ending on a dish.
- Tap-to-jump / drag-to-nudge control, wind bands, turret shots across the corridor.
- Checkpoint flags (+150 and +2 gems, and one rung of the speed ladder), TV-box pickup (10 s double score), coins, stars.
- Revive for 5 coins, retry from checkpoint, restart, level chosen by progress.
- Splash, level map, login, game, pause / game-over / level-clear cards,
  leaderboard screen, settings screen.
- Leaderboard over the Firestore REST API with world / country / city tabs, an
  offline cache and a retried write queue.
- An analytics layer (records locally, forwards once the Firebase SDK is added).
- Sound effects, music and vibration, each independently switchable.
- Sign in with Play Games or with Google, or play as a guest on an anonymous
  Firebase account. Both signed-in doors only appear where the device can open
  them; Play Games is Android only and sign-in only.

### Out of scope (this release)

- In-app purchases. The coin shop was removed on 2026-09-25.
- Cross-device progress sync. Only the leaderboard row follows the account.
- Level editor, user-generated levels, daily challenges, social features.
- Localisation: English copy only.
- Server-side score validation (App Check or a Cloud Function).
- Play Games leaderboards and achievements. The Play Games integration is
  sign-in only; the board the game keeps is the Firestore one.

### Deferred / undecided

- iOS Google sign-in (needs `pod install`, an iOS Firebase app and a URL
  scheme). Guest play is the intended iOS fallback until then.
- A paid IP-geolocation endpoint for country and city at real traffic volumes.

## 6. Assumptions

- **A1** — Players accept an anonymous account being created on first use; it
  is what makes a guest's score behave exactly like a signed-in player's.
- **A2** — IP-based country and city are good enough for a leaderboard tab and
  are preferable to a location permission prompt on the first run.
- **A3** — A public Firebase web API key in the bundle is correct usage; the
  rules are the access control.
- **A4** — Client-written scores are acceptable while the app is unlisted; the
  `score <= 1000000` cap bounds what a tampered client can do.
- **A5** — The game is sideways, everywhere, for the whole session, and the
  run is flown across the screen rather than down it. There is one orientation
  and the app never turns the phone part way through: the activity comes up
  `sensorLandscape` and stays there. Both ways of holding it sideways are
  allowed, so it can be flipped end for end on any screen, which is a resize
  rather than a restart. This replaces the earlier assumption that the menus
  were read upright and only a run was sideways; what made that necessary was
  that the pages did not fit a short viewport, and they do now. It also
  replaces the assumption that the corridor was a portrait column standing in
  a landscape window: the corridor is turned onto the screen now, so the long
  side is the warning and the short side is the corridor itself.

## 7. Constraints

- **C1** — No native module for the leaderboard. It must keep working in a
  JS-only build, which is why it is REST rather than `@react-native-firebase`.
- **C2** — Analytics and Google sign-in are reached by a runtime
  `require`, so a bundle running ahead of its native build hides the feature
  instead of crashing.
- **C3** — Free-tier ipapi.co: the daily cap is per project, not per device.
- **C4** — No ads SDK in the build. AdMob was removed on 2026-09-24.
- **C5** — Levels are authored, not generated: new content is a code change.
- **C6** — The Firestore rules must keep `hasOnly` over the six score fields;
  that row is downloaded by every player.
- **C7** — Repository style: Prettier at 100 columns with `bracketSameLine`.

## 8. Stakeholders

| Role | Responsibility |
| --- | --- |
| Product owner / developer (Amna Rauf) | Scope, design, implementation, release |
| Firebase project owner | Auth providers, Firestore rules and indexes, SHA-1 fingerprints |
| Play Console / App Store Connect owner | Listing, Data safety form, privacy labels, the Play Games Services project and its Android credential |
| Players | Feedback, leaderboard content |

## 9. Success criteria

| # | Criterion | Measure |
| --- | --- | --- |
| S1 | A new install reaches its first run without instruction | Time from launch to `run_start` under 20 s |
| S2 | The control is not the reason a run ends | Deaths within 0.5 s of a respawn stay rare |
| S3 | Players return to an unfinished level | Share of sessions that resume at a checkpoint |
| S4 | The levels are actually cleared | `level_clear` for the last level per install |
| S5 | The board is populated and honest | Rows written per active device; queued writes eventually succeed |
| S7 | No service failure ever ends a run | No crash attributable to Firebase or Region |

Measured through the events in `src/services/Analytics.ts` — `app_open`,
`run_start`, `run_end`, `level_clear`, `revive`, `checkpoint`, `shop_open`,
`shop_purchase`, `ad_request`, `ad_impression`, `ad_reward`, `ad_failed`,
`leaderboard_open`, `leaderboard_submit`, `settings_open`, `setting_change`,
`share`, `rate`, `progress_reset`, `screen_view` — which report nowhere until
the Firebase Analytics SDK is installed.

## 10. Open questions

- **Clarification needed:** Cavemen, Ponytail and UI-UX-Pro — recorded in
  [`PROJECT.md`](../PROJECT.md) §1 with no descriptions yet. Their effect on
  scope is unknown until they are defined.
- Is a release keystore available, or does one need generating?
- Where do the privacy switches and the policy link go back — the settings
  screen, or a dedicated privacy page?
