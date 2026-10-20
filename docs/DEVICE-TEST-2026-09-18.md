# BladeLoop — on-device test report

**Date:** 2026-09-18
**Device:** vivo V2435 (`10FF5P06C30006L`), Android 16, 720x1608 @ 300dpi
**Display:** panel supports 60/90/120 Hz, running at **60 Hz** (`renderFrameRate 60.000004`)
**Build under test:** `com.bladeloop` v1.0, installed 2026-09-15, flags `DEBUGGABLE TEST_ONLY`,
dev bundle cached on device (`files/BridgelessReactNativeDevBundle.js`), Metro live on 8081 + 8082
**Method:** `am start -W`, `dumpsys gfxinfo … framestats` (per-frame ns timestamps),
`dumpsys meminfo`, on-device `screencap`, scripted `input tap` / `input swipe`, and `npm test`

> **Read the numbers as a floor, not a ceiling.** This is a debug build served by Metro. A release
> build with a minified bundle will start faster and leave more headroom on every frame below.

### What was actually under test

The two halves of the build are from different days, and it matters:

- **JavaScript: current.** The app pulled a fresh bundle from Metro during this session — the
  on-device cache `files/BridgelessReactNativeDevBundle.js` was rewritten at **14:47 today**. Every
  behaviour below is today's working-tree code, `src/ui/handover.ts` included.
- **Native shell: 2026-09-15.** The installed APK predates the working-tree changes to
  `AndroidManifest.xml`, `build.gradle`, `google-services.json` and the launcher icons. None of
  those are in the build that ran, which is also why Google sign-in is absent from it.

So the findings below are real findings against current app code, but anything native — icons,
manifest, Firebase config, sign-in — needs a fresh `npm run android` before it can be judged.

---

## 1. Verdict

| Area | Result |
| --- | --- |
| Gameplay frame pacing | **Pass** — locked 60 fps, 0 dropped frames in 120 consecutive frames |
| Death / Game Over card | **Pass** — 60 fps, 0.8% jank |
| Level map | **Concern** — ~49 fps, 20% of frames miss a vsync |
| Cold start | **Concern** — ~1.3 s to first frame, ~2.3 s to live UI, blank grey throughout |
| Launch screen order | **Defect, fixed** — front page showed PLAY + "LEVEL 1" before the login gate |
| Post-login state | **Defect, fixed** — front page came back off the road invisible and dead |
| Controls | **Pass** — tap-to-jump and drag-to-slide both registered |
| Persistence | **Pass** — best 731, 47 gems, level 6, level-5 stars survived process restarts |
| Ads | **Works, but test unit IDs still wired** |
| Memory | **Watch** — 448 MB PSS; the OS evicted the app on its first backgrounding |
| Unit tests | **Pass** — 212 tests, 17 suites after the fixes, but 558 s and one leaked worker |

---

## 2. Timing

### Cold start (measured launches)

| Measure | Run 1 | Run 2 | What it is |
| --- | --- | --- | --- |
| `TotalTime` | 1338 ms | 1313 ms | Activity window's first frame |
| `WaitTime` | 1354 ms | 1331 ms | Same, including the system's own work |
| First RN content frame | — | ~2280 ms | Frame counter starts climbing continuously |
| Sustained 60 fps | — | ~2340 ms | ~5 frames per 75 ms poll |

Measured device-side. An adb round trip on this phone costs ~2.5–3 s, so host-side polling cannot
resolve anything below that; the poll loop was run inside `adb shell`, where each `dumpsys` costs
~32–75 ms.

Breakdown of run 2:

```
t+0ms      am start
t+1313ms   activity first frame  (blank grey window)
t+1730ms   frame counter = 2, then flat
t+2215ms   still flat  <- ~500 ms of nothing while the JS bundle loads
t+2336ms   7 frames    <- RN content is up
t+2716ms   29 frames   -> ~66 fps, the animated front page is live
```

### Interaction timing

| Action | Cost |
| --- | --- |
| `input tap` dispatch (device-side) | ~172 ms |
| On-device `screencap` | ~700 ms |
| `PLAY LEVEL 6` → HUD + scrolling corridor | between 1 s and 3 s |

Roughly 1.5 s of that level-open cost is by design: `LoadingScreen`'s `FILL_MS` 900 ms plus
`HANDOVER_GRACE` 600 ms.

---

## 3. Animation and frame pacing

Each row is one `framestats` capture (last 120 frames). **Presented interval** is the real on-screen
cadence taken from `DisplayPresentTime`; 16.7 ms means every vsync was hit.

| Capture | What was on screen | Janky | Frame p50 | Frame p99 | GPU p50 | Presented p50 / p90 | Vsyncs skipped |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `long` | Level opening animation, 3 s | 1.6% | 25 ms | 38 ms | 8 ms | 16.7 / 16.7 | **0 / 119** |
| `play1` | Level 6 run, 8 rapid taps | 1.9% | 34 ms | 53 ms | 13 ms | 16.7 / 16.7 | 1 / 53 |
| `play2` | Level 6 run, drags + taps | 1.2% | 38 ms | 69 ms | 13 ms | 16.7 / 16.7 | 1 / 80 |
| `play3` | Game Over card, idle 2 s | 0.8% | 31 ms | 42 ms | 13 ms | 16.7 / 16.7 | 0 / 119 |
| `runA` | Level 6 run, no input, 2.5 s | 4.3% | 25 ms | **117 ms** | 12 ms | 16.7 / 16.7 | 3 / 87 |
| `map` | Level map, idle 5 s | **17.6%** | 44 ms | 69 ms | 10 ms | 16.7 / **33.3** | **24 / 119 (20%)** |

On reading `frame p50`: it is `FrameCompleted − IntendedVsync`, which on a triple-buffered pipeline
is steady-state latency, not stutter. The column that matters for smoothness is the last one.

**What the run itself looks like:** during play the presented interval never left 16.7 ms. The
fixed-step simulation (`FIXED_DT = 1/60`, `MAX_STEPS = 5`) is exactly matched to this panel's 60 Hz,
and the interpolation path in [`GameScreen.tsx:288`](../src/ui/GameScreen.tsx#L288) is doing its
job — nothing in the corridor, the tail, the bobbing blades or the wheel rims costs a frame.

**Every `Animated` call in `src/ui/` passes `useNativeDriver: true`** (18 call sites checked), so
animation work stays off the JS thread across the whole app.

---

## 4. Memory

Taken during a Level 6 run:

```
TOTAL PSS: 459168 KB (~448 MB)   TOTAL RSS: 566104 KB   TOTAL SWAP PSS: 101306 KB
Native Heap: 120560 KB           Dalvik Heap: 14244 KB
Graphics: 26744 KB               EGL mtrack: 19504 KB   GL mtrack: 3496 KB
```

448 MB PSS is large. Some of it is the debug bundle and dev tooling, but it is worth re-measuring on
a release build, because of what followed: **the OS killed the app the first time it went to the
background** (pid 26735 → 31050, with no force-stop from me). A player who taps an interstitial,
lands in Chrome and comes back gets a cold restart.

---

## 5. Findings

### 5.1 Front page renders before the login gate, advertising the wrong level — high

On launch the front page comes up first, with a live **PLAY** button and the chip reading
**"LEVEL 1 · FIRST BLADES"**, and only afterwards does the login gate ("WELCOME BACK" /
PLAY WITH GOOGLE / CONTINUE) cover it. On this device the two screenshots are seconds apart.

The player's actual progress is level 6.

Root cause, both halves in [`src/ui/GameScreen.tsx`](../src/ui/GameScreen.tsx):

```ts
const [level, setLevel] = useState(1);                               // :113
const [acctReady, setAcctReady] = useState(false);                   // :159
const login = acctReady && (door || !entered);                       // :160
account.hydrated().then(() => setAcctReady(true));                   // :192
whenHydrated().then(() => setLevel(nextLevel()));                    // :216
```

`login` is false until the account store hydrates, so nothing gates the front page in the meantime;
`level` is 1 until the progress store hydrates. Both stores sit behind `AsyncStorage`
([`src/state/store.ts:47`](../src/state/store.ts#L47)), so the window is short in principle — but it
was long enough to screenshot, and PLAY is tappable inside it. A player who taps it starts level 1
instead of level 6.

**Fixed, 2026-09-18.** The front page now waits on both stores (`saveReady`, `saved`) instead of
rendering a page built out of defaults and correcting it. Covered by
[`src/ui/__tests__/firstFrame.test.tsx`](../src/ui/__tests__/firstFrame.test.tsx), which holds the
saved progress back by hand so the window is looked at rather than raced: the door is up, the page
behind it is not, and it arrives the moment the save lands.

### 5.2 Screen with no HUD and no controls — high, **root cause found and fixed**

After dismissing the login gate with CONTINUE, the app sat for 10+ seconds on the play world —
backdrop, ball parked mid-screen, one pole, the "ROTATE" run-word watermark — with **no HUD (no
score, no pause, no gem counter), no front page and no buttons except the mute chip.**

Foreground was confirmed as `com.bladeloop/.MainActivity` throughout, and rendering was healthy
(this is the `long` capture above: 60 fps, zero dropped frames), so the app was not hung — it was
drawing a state with nothing to press.

**Root cause.** `PLAY` does not unmount the front page — the road is drawn *over* it, and
[`GameScreen.tsx`](../src/ui/GameScreen.tsx) keeps `splash` true the whole time the road is up
(`{splash && map && !login && <LevelMap/>}`). Meanwhile `Splash` fades itself out by animating
`leave` to 0, which is the opacity of its entire page
([`Splash.tsx:286`](../src/ui/Splash.tsx#L286)), and latches `started.current = true` so PLAY cannot
fire twice. **Neither is ever put back.**

So coming off the road lands on a front page drawn at zero opacity with its one button already
spent, and no HUD either, because `splash` is still true. Exactly what the device showed: a live
world at 60 fps behind a page that is invisible and dead.

The existing test *"back comes off the road onto the front page"* passed straight through this — it
asserts on text, and every word of the page is still in the tree at opacity 0.

**Fixed, 2026-09-18.** `Splash` takes a `front` prop and, when it is uncovered again, stands down any
pending handover, resets `started` and sets `leave` back to 1. Covered by *"the front page comes back
off the road visible and pressable"*, which checks the rendered opacity **and** presses PLAY a second
time. Both new tests were confirmed to fail against the unfixed code.

### Both fixes re-tested on the device, 2026-09-18 16:07

Metro's reverse tunnel had dropped, so the app was pulling its old cached bundle; `adb reverse
tcp:8081 tcp:8081` and a cold start refetched the bundle (cache rewritten 16:04) and the run below is
against the fixed code.

| Step | Before | After |
| --- | --- | --- |
| Cold start | front page with PLAY + "LEVEL 1 · FIRST BLADES", then the door over it | the door first, nothing before it |
| Off the road via the back arrow | blank world, no HUD, no buttons | front page drawn, chip reads "LEVEL 7 · CROSSFIRE" — the player's real level |
| PLAY a second time | dead | the road opens again on LEVEL 7 |

Worth noting for whoever tests next: **Metro on 8082 is wedged** — `/status` answers but
`/index.bundle` never does. 8081 serves a bundle in about a minute. Check `adb reverse --list` first;
an empty list is why the app shows "Unable to load script".

### 5.3 Level map drops one frame in five — medium

The map holds ~49 fps against the run's 60, with 20% of frames missing their vsync and a p90
presented interval of 33.3 ms — a visible judder on the pulsing level node and the drifting clouds.

It is not the GPU (10 ms p50, *lower* than during play) and not view traversal (0.2 ms p50).
`gfxinfo` attributes all 46 janky frames to **"Slow UI thread"** and also logs
`Number High input latency: 432`. The node pulse is native-driven
([`LevelMap.tsx:493`](../src/ui/LevelMap.tsx#L493)), so it is not a JS animation loop either.
Pinning the real cause needs a systrace / Perfetto capture on a release build.

### 5.4 No splash — a plain grey window for the first 1.3–2.3 s — medium

From launch until RN's first content frame the screen is the default dark-grey window background:
no logo, no colour from the game, no progress. That is ~1.3 s minimum (activity first frame) and
~2.3 s until the front page draws; under screenshot load it stretched past 5 s.

A themed launch background (`windowBackground` set to `COLORS.bg`, or an Android 12+ splash screen
carrying the BLADE LOOP mark) would cover this at zero runtime cost.

### 5.5 Interstitial ads work, and still use Google's test unit IDs — expected, release blocker

An interstitial appeared after a run. One of my scripted taps landed on it and opened
`developers.google.com` in Chrome — which is exactly what a Google *test* ad does when clicked, so
the ad path is wired correctly end to end.

The IDs in [`src/services/Ads.ts:30`](../src/services/Ads.ts#L30) and
[`:35`](../src/services/Ads.ts#L35) are still `ca-app-pub-3940256099942544/...`, AdMob's public test
units. They must be swapped for the real unit IDs before any release build.

Two related observations: blind taps right after a run can land on the ad, and returning from that
browser found the app **restarted** (see §4).

### 5.6 One-off 133–183 ms hitch during a run — low

In the `runA` capture one frame ran 146.9 ms and the presented interval reached 183.3 ms — roughly
8–11 frames dropped in a row, which is a visible freeze. p99 for that window was 117 ms. It did not
reproduce in the clean 3 s sample (p99 38 ms, zero drops), and `adb`/`dumpsys` traffic was competing
for the CPU at the time, so it may be measurement noise. Worth watching for on a release build.

### 5.7 Jest suite takes 9.3 minutes and leaks a worker — low

`npm test`: **16 suites, 210 tests, all passing**, in 558 s. Two things stand out — the wall-clock
time for a suite this size, and the warning that closes the run:

```
A worker process has failed to exit gracefully and has been force exited.
This is likely caused by tests leaking due to improper teardown.
```

Worth a `--detectOpenHandles` pass; a leaked timer is the usual cause and may also explain the
runtime.

The runtime has a second cost, found while adding the tests for §5.1 and §5.2: **screen tests that
pass alone time out in the full run**, because most of them take Jest's default five seconds while
mounting a screen costs a second on a quiet machine and several with sixteen other suites sharing
the cores. `levelMap.test.tsx` failed that way once — every test in it lands in under 1.8 s run
alone. It now sets `jest.setTimeout(20000)` for the file, which is the allowance `back.test.tsx` and
`screens.test.tsx` already give each of their tests. Any new screen test wants the same.

### 5.8 `config.ts` describes a ground the game no longer renders — doc only

The `COLORS` block says the game "is played in deep space: `bg` is a near-black indigo". On device
the run is played on the **pastel lavender sky** — the deep indigo only appears once a card dims it
with `COLORS.dim`. The `night` comment further down describes the actual behaviour correctly; the
`bg` paragraph reads as stale.

---

## 6. Verified working

- Tap-to-jump and drag-to-slide both register; the ball answered taps and moved sideways on swipes,
  matching the relative-drag scheme documented in `config.ts`.
- The "ROTATE" run word renders as the corridor watermark (matches the reference, by design).
- Score, flag bonus (`+25`), gem counter, level label and the trail all render correctly mid-run.
- Game Over card: score, best score, RETRY, HOME and the four action chips all draw; RETRY restarted
  the level.
- Level map: cleared nodes, star counts, locked nodes with padlocks, the READY! pin on the current
  level and PLAY LEVEL 6 all correct.
- Progress survived two process restarts: best 731, 47 gems, level 6 current, 2/3 stars on level 5.
- Guest session persisted — a later launch went to the front page rather than asking again.
- Unit suite green: 210 tests across 16 suites.

## 7. Not covered this session

- **Google sign-in.** The gate offers PLAY WITH GOOGLE but the button was not pressed; `RNGoogleSignin`
  is not in the installed APK, which predates the working-tree native changes.
- **Anything native.** Launcher icons, `AndroidManifest.xml`, `build.gradle` and `google-services.json`
  have all changed in the working tree since the installed APK was built. Re-install before judging
  them.
- Pause card, settings page, leaderboard page, the shop banner and the rewarded-ad path.
- Level clear / finish plate — every run this session ended in a death.
- Release-build numbers, and behaviour at 90/120 Hz.
- Landscape, where `paceFor()` and `viewScale()` change the descent.
- The phone was picked up and used for something else mid-session, which ended device testing early.
