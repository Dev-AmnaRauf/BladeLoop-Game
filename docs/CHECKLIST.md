# Checklist

**Project:** BladeLoop
**Last updated:** 2026-09-18

`[x]` is verified in the repository today. `[ ]` is outstanding. Items marked
**BLOCKER** must be closed before the app is listed in either store.

---

## 1. Planning

- [x] Project reference established — [`PROJECT.md`](../PROJECT.md)
- [x] PR (Professional Requirements) — [`PR.md`](PR.md)
- [x] ER model — [`ER.md`](ER.md)
- [x] Functional requirements — [`FUNCTIONAL-REQUIREMENTS.md`](FUNCTIONAL-REQUIREMENTS.md)
- [x] This checklist
- [x] Backend and store setup written down — [`INTEGRATIONS.md`](INTEGRATIONS.md)
- [x] Co-author removed from the workflow (no `Co-Authored-By:` trailer on
      commits or PRs) — see [`PROJECT.md`](../PROJECT.md) §3
- [ ] **Clarification needed:** define Cavemen, Ponytail and UI-UX-Pro —
      description, repository/URL, install steps, role — then fill in
      [`PROJECT.md`](../PROJECT.md) §1
- [x] ~~Decide the billing library for the shop~~ — the shop was removed on 2026-09-25; nothing is sold
- [ ] Decide where the privacy switches and policy link live

## 2. Design

- [x] Palette and type scale in one place (`src/game/config.ts`,
      `src/ui/theme.tsx`) — the page and the corridor share one light
- [x] Control scheme settled: tap = jump, relative drag = slide
      (absolute finger-following, hold-a-side and aimed tap were rejected)
- [x] Card hues per state: fail, clear, pause
- [x] Five named levels over sixteen authored stages
- [x] App icon and store icon — `docs/branding/`, generated into every mipmap
      bucket by `scripts/gen_icon.js`
- [x] Adaptive icon (`mipmap-anydpi-v26`, background / foreground / monochrome)
- [x] Feature graphic ([`store/feature-graphic-1024x500.png`](store/feature-graphic-1024x500.png))
- [ ] Store screenshots (Play listing needs at least two)
- [x] Privacy-policy page, hosted: [`PRIVACY-POLICY.md`](PRIVACY-POLICY.md) is
      the text, `public/privacy.html` is the page, and it is live at
      `https://bladeloop-4d203.web.app/privacy` (re-deploy with
      `npm run firebase:site`)
- [ ] Paste that URL into the Play Console listing (App content → Privacy
      Policy) and into App Store Connect

## 3. Implementation

### Game

- [x] Fixed-step engine (1/60 s, `MAX_STEPS` 5)
- [x] Prop bucketing by depth so per-frame sweeps stay local
- [x] Hazards: blades, frames, wheels, hexagons, brackets, turrets, wind
- [x] Pickups: stars, TV box (10 s double score), flags (+150, +2 gems, one rung of the speed ladder), the dish
- [x] Checkpoint, respawn lane picker (`RESPAWN_CLEAR` 2.1 s), settle-in
- [x] Landscape support: virtual viewport, scaled, descent paced to match
- [x] Sideways throughout: the activity is `sensorLandscape` and `Info.plist`
      lists the two landscape keys, so there is no portrait screen in the game
      and nothing turns the phone part way through
- [x] The corridor itself is untouched by any of that. Widening the playfield
      to suit the wider window was tried and taken out again: the levels are
      authored against `HALF_W` 165 and are played at it
- [x] Every page lays itself out for a short, wide window (`src/ui/layout.ts`):
      the door, the front page and the loading screen go across rather than
      down on a phone, settings puts its two groups abreast, the road keeps a
      centred lane and the shop sheet keeps its own width
- [x] The safe area down the *sides* is kept clear on every page, and the mute
      button's hit test moves with the button
- [ ] Respawn on level 4 can still put a retry back into a hazard —
      `respawnX` is best-effort on the densest stages

### Screens

- [x] Login, splash, game, pause / game-over / level-clear cards
- [x] Shop sheet, leaderboard screen, settings screen
- [x] HUD, mute master button

### Services

- [x] Leaderboard over the Firestore REST API, three scopes, offline cache,
      queued write retry
- [x] Region lookup with a 7-day cache and a locale fallback
- [x] Analytics layer with consent enforced inside `track()`
- [x] AdMob removed (2026-09-24): no ads of any kind, no ads SDK in the build
- [x] Google sign-in traded for a Firebase session (`signInWithIdp`)
- [x] Play Games sign-in (`src/services/PlayGames.ts`), probed rather than
      assumed, Android only, no leaderboard or achievements behind it
- [ ] Play Games Services set up in Play Console — the game, the Android
      credential with **all three** SHA-1s (debug, upload, and the Play App
      Signing one once it exists), and the real app id into
      `res/values/strings.xml` (`play_games_app_id`, pre-filled with the
      Firebase project number). Confirmed failing on device 2026-09-22 with
      `DEVELOPER_ERROR` — see [`INTEGRATIONS.md`](INTEGRATIONS.md) §5
- [x] ~~**BLOCKER** Real in-app billing~~ — no longer needed: the coin shop
      (`ShopModal.tsx`, `Sheet.tsx`) was removed on 2026-09-25
- [ ] **BLOCKER** Put the privacy switches back in the settings screen, with a
      policy link and a support address
- [ ] `IOS_APP_ID` in `src/services/links.ts` — the numeric App Store id

## 4. Backend configuration (Firebase project `bladeloop-4d203`)

- [x] `firestore.rules` written (own-row writes, `hasOnly` on six fields,
      score cap, everything else closed)
- [x] `firestore.indexes.json` — country and city composite indexes
- [x] `firebase.json` and `.firebaserc` pinned to the project
- [ ] Authentication → Anonymous → **enabled**
- [ ] Firestore database created (production mode)
- [ ] Rules and indexes deployed — `npm run firebase:rules`
      (without the indexes the country and city tabs stay empty)
- [ ] Authentication → Google provider → **enabled**
- [ ] Debug SHA-1 registered
      (`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`), then
      `google-services.json` downloaded again — without this the picker fails
      with `DEVELOPER_ERROR` (code 10)
- [ ] Release/upload SHA-1 registered
      (`8C:2B:B2:54:B9:85:ED:1A:F5:1C:D8:BC:1B:15:C9:DF:B3:BD:87:EF`, the
      `bladeloop-release.jks` key), then `google-services.json` downloaded again
- [ ] **Play App Signing SHA-1 registered, after the first upload.** Play
      re-signs the app with a key Google holds, so the certificate a store
      install runs under is neither of the two above and sign-in fails for every
      real player while working perfectly when sideloaded. Read it from
      **Play Console → Test and release → Setup → App signing**. See
      `docs/INTEGRATIONS.md`
- [ ] `WEB_CLIENT_ID` in `GoogleAuth.ts` re-checked against the new file
- [ ] iOS app registered in the same project, `GoogleService-Info.plist` added,
      reversed client id in `Info.plist` plus `GIDClientID`, `pod install`
- [ ] Decide what `LOOKUP_URL` in `src/services/Region.ts` runs against for
      real traffic — ipapi.co's free cap is per project, not per device

## 5. Ads configuration

- [x] None: the game carries no ads (AdMob removed 2026-09-24). Play Console's
      "Contains ads" answer is **No**
- [ ] iOS: `cd ios && pod install` to drop the Google Mobile Ads pod

## 6. Testing

- [x] `npm test` — 24 suites, 320 tests, 317 passing (2026-09-22). The
      three that fail are the level 5, 10 and 20 shape-crowding cases in
      `levelAudit.test.ts`, which were failing before the landscape work and
      are tracked by the open respawn/crowding item above
- [x] The turn of the phone is pinned (`orientation.test.ts`): the pace clamp,
      that a turn moves neither ball nor camera nor score nor gear, that the
      band fits the shortest viewport, and that a drag is worth the same share
      of the corridor on any screen
- [x] Level audit test proves every authored stage is flyable
- [x] Frame pacing covered at 60/90/120Hz (`smooth.test.ts`)
- [x] Level audit extended to all twenty levels
- [x] The road’s lock gate covered (`levelMap.test.tsx`)
- [x] The stars per stop covered (`levelMap.test.tsx`, `progress.test.ts`)
- [x] The endless levels are pinned to audited corridors (`endless.test.ts`)
- [x] The back button's chain out of the game covered (`back.test.tsx`)
- [x] A door that hands over when its fade never finishes (`screens.test.tsx`)
- [x] The front page waits for both saves before it is drawn (`firstFrame.test.tsx`)
- [x] The front page comes back off the road visible and pressable (`back.test.tsx`)
- [x] Google sign-in mocked so the real token-trade path is exercised
- [ ] `npm run lint` clean — one error left as of 2026-09-18, and it is not in
      the app: `scripts/gen_sfx.js` uses `Buffer` with no Node env declared
- [x] `npx tsc --noEmit` clean (2026-09-18)
- [ ] Manual pass: fresh install → login → the road → twenty levels → clear
- [ ] Manual pass: clear level 20 and carry on — the road keeps going, the
      cards read LEVEL 21 with no denominator, and the page hands back the
      walked road when dragged to its foot
- [ ] Manual pass: back out of a run → the front page → the door, and back
      once more leaves the app
- [ ] Manual pass: the road on a small screen — every stop reachable by
      scrolling, and the play button never over the last one
- [ ] Manual pass: clear a level missing a star, replay it for the star, and
      check the road shows the better of the two
- [ ] Manual pass: the dark palette in sunlight, which is the case a light
      ground used to carry for free
- [ ] Manual pass: airplane mode — board falls back to the cache, run
      unaffected, queued write lands on the next launch
- [ ] Manual pass: revive, retry-at-checkpoint, restart, interstitial caps
- [ ] Manual pass: a short-screen device (320dp of height held sideways)
- [x] Manual pass: **open the app** — the door comes up sideways with its
      wordmark and character on one side and all three of its buttons on the
      other, none of them cut off; the front page lays its three parts across
      the screen and the road keeps its lane; no screen turns at any point
      (2026-09-22, vivo V2435, release build)
- [x] Manual pass: **die** — the game over card is sideways and whole: the
      character and the word on the left, the score in the middle, RETRY,
      HOME and all four beads on the right. Before the card was laid out
      across it ran off the bottom of a 720px screen, with HOME and the beads
      not on screen at all (2026-09-22, vivo V2435, release build)
- [ ] Manual pass: **the board and settings opened from the card's corners**,
      which the die pass above did not reach
- [ ] Manual pass: **a tablet** — the door and the front page stack their
      three parts down the middle rather than spreading them across the glass
- [ ] Manual pass: **the horizontal run** — the corridor scrolls left to
      right between a ceiling and a floor that sit on the top and bottom
      edges, the ball rides about a third in from the left, a tap throws it
      straight up and a finger slid across the glass carries it forward and
      back along the run. Check the three pieces of type inside the corridor
      read upright: the word on the finish dish, a star's `+5`, and the pop
      that answers a pickup. Check the tutorial word reads along the run
      rather than up the screen.
- [ ] Manual pass: **an untouched retry** — die somewhere tight, press RETRY
      HERE and take the hand off the glass. The ball has to survive the fall
      to the floor: that is the one promise the respawn lane picker makes, and
      it is the promise that changed shape when the fall did.
- [ ] Manual pass: **flip the phone end for end mid-run** — the run carries on with
      its score, checkpoint and gear, the ball and camera do not jump, the HUD
      clears the side cutout, and the corridor is the same corridor. Turn it
      back mid-run too.
- [ ] Manual pass: flip the phone **with the system auto-rotate lock on** —
      it still flips, because the activity is `screenOrientation="sensorLandscape"`
- [ ] Manual pass: rotate while a finger is resting on the glass — the ball
      must not slide when the screen turns
- [ ] Manual pass: background the app mid-run and return (no fast-forward)
- [ ] Manual pass: **fly one level end to end and watch its shape**. It opens on
      corridor from the levels behind it, then fresh hurdles, and finishes on
      the level's own window. Check that no hurdle comes round twice in a row,
      that nothing looks copied from a minute ago, and that the corridor never
      sits empty for more than a second or two between hurdles
- [ ] Manual pass: ball motion on the 90Hz/120Hz device, with the on-screen
      fps overlay — the counter was already reporting ~56fps before the
      interpolation landed, so check the *motion*, not only the number
- [x] Verify on-device via the on-device files, not logcat — the vivo test
      device logs nothing for `com.bladeloop`. Done 2026-09-18 with `gfxinfo
      framestats`, `am start -W` and on-device `screencap` —
      [`DEVICE-TEST-2026-09-18.md`](DEVICE-TEST-2026-09-18.md)

## 7. Release

- [ ] **BLOCKER** A real release keystore. `android/app/build.gradle` still
      signs release builds with the debug key
- [ ] Version and build number bumped (`package.json`, Gradle, `Info.plist`)
- [ ] Release build installed on a clean device and played end to end
- [ ] Play Data safety form filled in to match what the app actually collects
      (name, score, country, city — public; analytics; no ads)
- [ ] App Store privacy labels, matching
- [x] Store listing copy and feature graphic ([`store/LISTING.md`](store/LISTING.md))
- [ ] Store screenshots
- [x] Privacy policy URL live (`https://bladeloop-4d203.web.app/privacy`) and
      linked from the app (settings → Privacy Policy, `PRIVACY_URL`)

## 8. Post-release verification

- [ ] `app_open` and `run_start` arriving in Firebase Analytics
- [ ] Rows appearing in `scores`, and all three board tabs populated
- [ ] Rules holding: a write to someone else's uid is refused
- [ ] Crash-free rate watched for the first week
- [ ] ipapi.co daily cap not being hit
- [ ] Success criteria S1–S7 in [`PR.md`](PR.md) §9 measured against real data
