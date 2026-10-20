# Leaderboard, analytics, settings and sign-in

Four things were added around the game: a global leaderboard, an analytics
layer, a settings screen that owns the switches for all of them, and a
login screen in front of the splash.

They are wired in different ways on purpose.

| Piece | Works today | Needs a native install |
| --- | --- | --- |
| Settings screen | yes | no |
| Share / rate links | yes | no |
| Vibration | yes | no |
| Leaderboard | yes, once the Firebase project is configured | no — it is plain HTTPS |
| Analytics | events are recorded locally | yes, to report anywhere |
| Login screen | yes | Android: rebuild. iOS: `pod install` + a client id |
| Play Games sign-in | no — needs a Play Console game | Android rebuild. No iOS side at all |

Nothing here can fail the game. Every service answers honestly when its backend
is missing, and the run carries on.

---

## 1. Leaderboard (works now, needs Firebase console setup)

The board uses the **Firestore REST API** rather than `@react-native-firebase`,
so it needs no native module and no rebuild. `src/services/firebase.ts` holds
the project id and web API key, both copied from
`android/app/google-services.json` (project `bladeloop-4d203`).

A Firebase web API key is a public client identifier, not a secret — it names
the project, and what a caller may do is decided by the rules. Shipping it in
the bundle is how Firebase is meant to be used.

### Console steps

1. **Authentication → Sign-in method → Anonymous → Enable.**
   Every device signs itself in once and keeps the refresh token; the uid it
   gets is the id of that device's row.
2. **Firestore Database → Create database** (production mode, any region).
3. **Deploy the rules** in [`firestore.rules`](../firestore.rules):
   ```sh
   npm i -g firebase-tools
   firebase login
   npm run firebase:rules
   ```
   Until they are deployed, production-mode defaults deny everything and the
   board will show "Offline — showing the last board seen" forever.

The whole Firebase side of this is in the repo:

| File | What it is |
| --- | --- |
| `firestore.rules` | The rules themselves |
| `firebase.json` | Points the CLI at the rules, and sets the emulator ports |
| `.firebaserc` | Pins the default project to `bladeloop-4d203` |
| `firestore.indexes.json` | The composite indexes the country and city boards need |

The world board needs none of them — it orders on one field and counts on one
field, both of which Firestore indexes on its own. The other two boards filter
before they order, which is what the file is for.

### Trying the rules without touching the live board

```sh
npm run firebase:emulators
```

Auth on 9099, Firestore on 8080, the emulator UI on 4000 — all clear of
Metro's 8081/8082. To point the app at them, change the hosts in
`src/services/firebase.ts`, and change them back afterwards.

### What the rules do and do not stop

They stop a caller writing to somebody else's row, bolting extra fields onto a
document every player downloads, posting a name long enough to break the list,
and reading or writing anything else in the project.

They cannot stop a tampered client posting a score it never earned — with
client-side writes, nothing can. The score cap keeps that bounded. The two real
fixes, if it ever becomes a problem, are Firebase App Check (attest that the
caller really is the app) or moving the write behind a Cloud Function that
re-checks the run. Neither is worth doing before anyone is playing.

### What a row looks like

`scores/{uid}` →
`{ name: string, score: int, runs: int, at: string, country: string, city: string }`

One document per device holding only its best. A write happens only when a run
beats what that device already sent — or when the name or the place on the row
changed — so a long session costs one write.

### The three boards

`country` and `city` are what let one collection serve three lists. The
leaderboard screen has a tab each for **world**, **country** and **city**; the
narrow two are the same query with a filter in front of it, so they cost what
the world board costs.

Both filtered queries need a composite index, which is why
[`firestore.indexes.json`](../firestore.indexes.json) is no longer empty:

```sh
npm run firebase:rules   # deploys the rules and the indexes together
```

Without them the country and city tabs come back empty (Firestore answers a
`FAILED_PRECONDITION`, which the service treats like any other failed read).

### Where the player is

`src/services/Region.ts` works the place out from the player's IP address
through **ipapi.co** — no key, free up to a daily cap, and, more to the point,
no location permission prompt on the first run. The answer is cached for a
week; a device that cannot reach the lookup falls back to the country its
locale is set to, and one that cannot manage that plays on the world board
alone.

Two things to know before this gets big: the free cap is per project rather
than per device, and IP geolocation puts a player in the right city most of the
time and in the wrong one some of the time. Swap `LOOKUP_URL` for a paid
endpoint (or your own proxy) when either starts to matter.

### Behaviour worth knowing

- A failed read falls back to the last board the device saw. Each of the three
  boards is cached separately.
- A failed write is queued and retried on the next app open or board open.
- A score is written with whatever place is already known — it never waits on
  the lookup. When the place lands later, `syncName` pushes the row up again.
- `settings.submitScores` off keeps every run on the device.
- Names are public, and so are the country and city — the settings screen and
  the board both say so.

---

## 2. Analytics (Firebase Analytics)

`src/services/Analytics.ts` records every event today and forwards them to
Firebase the moment the SDK is installed. No call sites change.

```sh
npm install @react-native-firebase/app @react-native-firebase/analytics
```

**Android** — `android/build.gradle`, in `buildscript.dependencies`:

```gradle
classpath("com.google.gms:google-services:4.4.2")
```

`android/app/build.gradle`, under the existing `apply plugin` lines:

```gradle
apply plugin: "com.google.gms.google-services"
```

`android/app/google-services.json` is already in place.

**iOS** — download `GoogleService-Info.plist` for the iOS app from the Firebase
console, add it to the Xcode project, then `cd ios && pod install`.

Then rebuild (`npm run android` / `npm run ios`). `Analytics.isLive()` says
whether it took — the dev footer that used to report it went with the rest of
the settings screen's trimming.

### Events

`app_open`, `run_start`, `run_end`, `level_clear`, `revive`, `checkpoint`,
`shop_open`, `shop_purchase`, `ad_request`, `ad_impression`, `ad_reward`,
`ad_failed`, `leaderboard_open`, `leaderboard_submit`, `settings_open`,
`setting_change`, `share`, `rate`, `progress_reset`, `screen_view`.

Consent is enforced inside `track`, so no screen can report around it. Turning
the switch off also calls `setAnalyticsCollectionEnabled(false)`, which stops
the SDK collecting sessions on its own.

---

## 3. AdMob — removed

AdMob was taken out on 2026-09-24. `react-native-google-mobile-ads`,
`src/services/Ads.ts`, the shop's "Watch ad" card and the interstitial on
START OVER / NEXT LEVEL are all gone, and the game shows no ads. iOS needs
`cd ios && pod install` once so the Google Mobile Ads pod drops out of the
workspace.

---

## 4. Settings

`src/ui/SettingsScreen.tsx` — a whole page rather than a sheet, reachable from
the gear in the splash's top-left corner, the pause card, the game over card
and the level clear card. The leaderboard is the same shape
(`src/ui/LeaderboardScreen.tsx`, behind the trophy in the opposite corner), and
both wear `src/ui/Screen.tsx`. The shop is still a sheet: it is a quick
in-and-out and reads better over the paused run.

- **Sound** — effects, music and vibration, each its own switch. The floating
  speaker button is a master over the first two rather than a third setting
  that could disagree with them.
- **Player** — the player's name (public, and shown next to where they are
  playing from) and whether scores are sent at all.
- **Share** — one filled button that opens the platform share sheet, then rate,
  then a reset that clears progress but keeps settings and the row already on
  the board.

The screen deliberately carries nothing else: no policy links, no support
mailto, no version footer.

> **The analytics switch is no longer on it.** `settings.analytics` still
> exists, still defaults to on and is still what `Analytics` reads — there is
> simply no way for a player to reach it. That is fine while the app is
> unlisted; it is not fine in a store listing that carries analytics. Put the
> switch back (and a policy link with it) before submitting a build that
> reports anything.

Preferences live in `bladeloop.settings.v1` and progress in
`bladeloop.progress.v1`, so a reset cannot take the player's settings with it.

---

## 5. Sign-in (login screen)

`src/ui/LoginScreen.tsx` — the first thing a fresh install shows, in front of
the splash. Up to three ways in: **sign in with Play Games**, **sign in with
Google**, or **START**, which plays as a guest. The first two only appear on a
device that can actually open them. It is kept in `bladeloop.account.v1`
(`src/state/account.ts`) and every later launch goes straight to the splash.

A guest is not a second class of player. The device already has an anonymous
Firebase account — `services/firebase` opens one the first time the board is
touched — so a guest's scores go up and come back exactly like anyone else's.
What signing in with Google buys is an account that outlives the install.

### Google sign-in — installed, one console step left

`@react-native-google-signin/google-signin` (v16) is installed and autolinked
on both platforms. `src/services/GoogleAuth.ts` still reaches for it with
`require` at runtime rather than importing it, the same way `PlayGames` reaches
for its module — so a JS bundle running ahead of the native build, or a device with no
Play Services, hides the button instead of crashing the screen.

**Android** needs a rebuild (`npx react-native run-android`) — Metro alone
does not add a native module — and then one thing in the console:

1. **Authentication → Sign-in method → Google**: turn the provider on.
2. **Project settings → Your apps → Android → Add fingerprint**: the debug
   key's SHA-1 is

   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```

   (`keytool -list -v -keystore android/app/debug.keystore -alias
   androiddebugkey -storepass android`). Add the release key's too when there
   is one. Then download `google-services.json` again: registering a
   fingerprint is what makes Firebase mint the `client_type: 1` Android OAuth
   client, and the file in the repo only has the web one today.

   **Until this is done the picker fails with `DEVELOPER_ERROR` (code 10).**
   That is the single most common reason a first attempt does not work, and the
   error says nothing useful about why.
3. `WEB_CLIENT_ID` in `GoogleAuth.ts` is the `client_type: 3` entry from
   that file. Google's library wants the *web* client id even on Android — the
   Android client is matched by signing certificate instead — so this value
   does not change when the fingerprint is added. Re-check it anyway.

**iOS** is not finished. It needs `cd ios && pod install`, an **iOS** app
registered in the same Firebase project (there is no `GoogleService-Info.plist`
in the repo), and that client's reversed id added to `Info.plist` as a URL
scheme plus `GIDClientID`. Until then an iOS build shows the guest button
alone, which is the fallback working as intended rather than a break.

The id token the SDK returns is traded for a Firebase session by
`signInWithGoogle` in `src/services/firebase.ts` (the `signInWithIdp`
endpoint), which stores it under the same key the anonymous session uses. So
the leaderboard needs no changes at all: it asks `auth()` for a session and
gets whichever one this device ended up with.

Under Jest the SDK is replaced by
`__mocks__/@react-native-google-signin/google-signin.js`, so the login screen's
tests drive the real sign-in path — token, trade and all — without Play
Services. `__setSignInResult` on that mock is how a test asks for a dismissed
picker or a failure.

### Play Games sign-in — wired, and inert until Play Console has the game

`react-native-google-play-games` (v0.4.0) is installed and autolinked.
`src/services/PlayGames.ts` wraps it the same way `GoogleAuth` wraps its SDK,
with two differences worth knowing before debugging anything here.

**The package is patched.** It does not compile against react-native 0.87 as
published: 0.87 rewrote `ReactContextBaseJavaModule` in Kotlin, where
`getCurrentActivity()` is a deprecated *function* rather than a Java getter, so
the synthetic property access the module makes (`val activity = currentActivity`)
is a compile error. One line, in `patches/react-native-google-play-games+0.4.0.patch`,
applied by `patch-package` from a `postinstall` script. **A `npm install` that
skips scripts leaves the patch off and the Android build fails on
`:react-native-google-play-games:compileDebugKotlin`** — that is the error to
recognise. Worth pushing upstream; the package is a young one with a single
maintainer, which is the standing risk of having taken it as a dependency.

**It is Android only.** Play Games Services is an Android product, and the
package throws on every call made from iOS. The service checks the platform
*before* it reaches for the module, so an iOS build behaves exactly as a build
without the package does: no button, no error.

**Availability is asked for, not read.** The package's JS loads happily with no
TurboModule behind it — `TurboModuleRegistry.getEnforcing` is only called on the
first API call, not at import — so a successful `require` proves nothing. It
also cannot know on its own whether Play Games is installed on the phone, or
whether this build's signing certificate is the one registered in Play Console.
So `PlayGames.probe()` makes one round trip, caches the answer, and the login
screen puts the button up when that answer comes back. This is why the Play
Games door can appear a beat after the screen does, and why it never appears at
all on a device that cannot use it.

There is no `signOut`. Play Games Services v2 dropped it: the session belongs to
the phone's Google account and the Play Games app owns it, not this game.
Signing out in settings clears the app's own account and puts the door back up,
and the next press signs the same player straight back in — which is what every
other Play Games title does.

#### Console steps

None of this works until the game exists in Play Console, and the app is not
there yet (see `docs/PR.md`). When it is:

1. **Play Console → the game → Grow Users → Play Games Services → Setup and
   management → Configuration.** Create the Play Games Services project and
   link it to a Google Cloud project. Linking it to the same project Firebase
   already uses (`bladeloop-4d203`, project number `541403839742`) is the
   cheaper choice — the OAuth clients are already there.
2. **Credentials → Add credential → Android.** The package name is
   **`com.bladeloop.game`**, which is now the `applicationId`, the `namespace`,
   the Kotlin package and the name `google-services.json` is registered against,
   all four agreeing. The SHA-1 has to match the key the build is signed with:
   the upload key's is in `PROJECT.md`, the debug key's is in the Google sign-in
   steps above. Add both, or Play Games works in a release build and silently
   fails in a debug one.
3. **Copy the app id** — the numeric one on that Configuration page — into
   `android/app/src/main/res/values/strings.xml` as `play_games_app_id`. It is
   pre-filled with `541403839742` on the assumption above; confirm it rather
   than trusting it. The manifest points
   `com.google.android.gms.games.APP_ID` at that string, and the SDK reads it at
   launch from a `ContentProvider` inside the package. It must be a **string
   resource**: an inline value of all digits is merged in as an integer and the
   SDK then fails to read it.
4. **Testers.** Until the Play Games Services project is published, only accounts
   listed as testers on it can sign in. Everyone else gets a failure, which the
   login screen reports and then takes the button away for.

**Confirmed on the device, 2026-09-22.** None of the above has been done yet,
and this is exactly what it looks like from the phone. `probe()` comes back
`available: true` — `isAuthenticated()` answers honestly that nobody is signed
in — so the button *is* offered, and pressing it fails. In logcat:

```
E PlayGamesServices[SignInAuthenticator]: **** APP NOT CORRECTLY CONFIGURED TO USE GOOGLE PLAY GAME SERVICES
E PlayGamesServices[SignInAuthenticator]: **** DEVELOPER_ERROR
E PlayGamesServices[SignInAuthenticator]: **** Package name         : com.bladeloop.game
E PlayGamesServices[SignInAuthenticator]: **** Cert SHA1 fingerprint: 8C:2B:B2:54:B9:85:ED:1A:F5:1C:D8:BC:1B:15:C9:DF:B3:BD:87:EF
E PlayGamesServices[SignInAuthenticator]: **** App ID from manifest : 541403839742
```

That fingerprint is the upload key in `android/app/bladeloop-release.jks`, and
it is the one to register at step 2. Note that the app's own JS logs nothing on
this device — the `PlayGamesServices` tag is where the answer is.

The same registration is missing on the Google sign-in side, and for the same
reason: `android/app/google-services.json` carries a `client_type: 3` web client
and no `certificate_hash` at all, so there is no Android OAuth client for
`com.bladeloop.game` and `PLAY WITH GOOGLE` cannot succeed either. Adding the
fingerprint above under **Project settings → Your apps → Android → Add
fingerprint** and re-downloading `google-services.json` is what unblocks both
doors. Until then the honest way in is `PLAY AS GUEST`.

### Which fingerprints to register — there are three, not one

Every one of these has to go in **both** places: Firebase (**Project settings →
Your apps → Android → Add fingerprint**, then re-download
`google-services.json`) and Play Games Services (**Credentials → Add credential
→ Android**). A key registered in one and not the other fails in exactly the
way a key registered nowhere does.

| Key | SHA-1 | Signs |
| --- | --- | --- |
| Debug | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | `npx react-native run-android`, every day of development |
| Upload | `8C:2B:B2:54:B9:85:ED:1A:F5:1C:D8:BC:1B:15:C9:DF:B3:BD:87:EF` | `assembleRelease` / `bundleRelease` — the APK sideloaded to a test phone, and the artefact uploaded to Play |
| **App signing** | **not known yet** — Play Console generates it | What the public actually installs |

The third is the one that is easy to miss, and it is the one that matters to
players. `bladeloop-release.jks` is an *upload* key: Play App Signing strips
that signature on upload and re-signs the app with a key Google holds and this
machine never sees. So a build that signs in perfectly when sideloaded can fail
for every single user who installs it from the store, because the certificate
they are running is not one either console has been told about.

It cannot be registered in advance — it does not exist until something has been
uploaded. After the first upload, read it from **Play Console → Test and release
→ Setup → App signing**, which lists both the app signing key and the upload key
Google has on file, and add the app signing one alongside the two above.

Regenerate these rather than trusting the table if the keystores are ever
replaced:

```bash
keytool -list -v -keystore android/app/debug.keystore \
  -alias androiddebugkey -storepass android | grep SHA1:
keytool -list -v -keystore android/app/bladeloop-release.jks \
  -alias bladeloop | grep SHA1:          # password from ~/.gradle/gradle.properties
```

SHA-256 is not needed for either sign-in door. Firebase will take it and Play
Games asks for SHA-1; the only thing that wants SHA-256 is Android App Links,
which this game does not use.

Until all of that is done, `probe()` comes back with `available: false` on a
device and the login screen shows the Google and guest doors alone. That is the
fallback working, not a break.

Under Jest the package is replaced by a `jest.mock` inside
`src/services/__tests__/playGames.test.ts`, which wears its exact shape —
including the `E_SIGN_IN_CANCELLED` and `E_NO_ACTIVITY` codes its native module
rejects with. The login screen's own tests stub `PlayGames.probe` instead, since
what they are about is the door rather than the service behind it. Note that
`Platform.OS` is `ios` under the RN Jest preset, so a suite that does not do one
of those two things sees this service as unavailable — which is correct, and is
why the existing login tests were unaffected by any of this.

### Behaviour worth knowing

- **A dismissed account picker is not an error.** It leaves the screen exactly
  as it was. Only a real failure — no network, no Play Services, provider
  switched off — puts a line of red under the button, and the guest button
  underneath still works.
- **Nothing decides on the first frame.** Saved state reads as its defaults
  until AsyncStorage answers, and the default is "nobody has signed in", so
  `GameScreen` waits for `account.hydrated()` before showing the login
  screen. Without that it would flash past a signed-in player every launch.
- **Signing in fills in the board name** when the player has never set one:
  the Google account's first name, which the settings page can still change.
- **There is no sign-out in the UI.** `signOut()` exists in
  `state/account.ts` and puts the login screen back; nothing calls it yet.

---

## Before the app is listed

- [ ] `IOS_APP_ID` in `src/services/links.ts` — the numeric App Store id.
- [ ] Register the **release** key's SHA-1 with Firebase and turn the Google
      provider on, or the Google button on the login screen fails with
      `DEVELOPER_ERROR` in the listed build. iOS additionally needs
      `pod install`, an iOS app in the project and its URL scheme.
- [ ] Put the privacy switches, a policy link and a support address back in the
      settings screen. Both stores require a real policy as soon as an app
      carries analytics, and this one does. The policy itself is
      written and live — [`PRIVACY-POLICY.md`](PRIVACY-POLICY.md) for the text,
      `public/privacy.html` for the page, served at
      `https://bladeloop-4d203.web.app/privacy` (`PRIVACY_URL` in
      `src/services/links.ts`) and re-deployed with `npm run firebase:site`. Re-publish after any change to what the app
      collects. Since 2026-09-24 it says the game carries no ads.
- [ ] Deploy the leaderboard's composite indexes (`npm run firebase:rules`
      covers both), or the country and city tabs stay empty.
- [ ] Decide what the country/city lookup runs against for real traffic —
      `LOOKUP_URL` in `src/services/Region.ts` is a free endpoint with a daily
      cap shared by every player.
- [x] ~~Replace the placeholder purchases~~ — the shop was removed on 2026-09-25.
- [ ] A real release keystore. `android/app/build.gradle` still signs release
      builds with the debug key.
- [ ] Fill in the Play Data safety form and the App Store privacy labels to
      match what the switches actually do.
