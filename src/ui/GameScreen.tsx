import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  GestureResponderEvent,
  NativeTouchEvent,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FIXED_DT,
  MAX_STEPS,
  DRAG_GAIN,
  DRAG_SLOP,
  FLAG_COINS,
  FLAG_SCORE,
  REVIVE_COST,
  runGear,
  paceFor,
  viewScale,
} from '../game/config';
import {
  createWorld,
  lift,
  restartFromCheckpoint,
  restartFromDeath,
  starsTaken,
  steerBy,
  step,
} from '../game/engine';
import { levelAt } from '../game/level';
import { worldOf } from '../game/worlds';
import * as Analytics from '../services/Analytics';
import * as Board from '../services/Leaderboard';
import * as Haptics from '../services/Haptics';
import * as Orientation from '../services/Orientation';
import * as PlayGames from '../services/PlayGames';
import * as Region from '../services/Region';
import { shareScore } from '../services/Sharing';
import * as Sound from '../services/SoundService';
import {
  getProgress,
  nextLevel,
  recordClear,
  recordRun,
  spendCoins,
  useProgress,
  whenHydrated,
} from '../state/progress';
import { account, useAccount } from '../state/account';
import { toggleMuted, useSettings } from '../state/settings';
import GameView from './GameView';
import Hud from './Hud';
import LoadingScreen from './LoadingScreen';
import LoginScreen from './LoginScreen';
import LeaderboardScreen from './LeaderboardScreen';
import LevelMap from './LevelMap';
import MuteButton, { muteButtonHit } from './MuteButton';
import { FinishOverlay, FlagFlash, GameOverOverlay, PauseOverlay } from './Overlays';
import SettingsScreen from './SettingsScreen';
import Splash from './Splash';
import { ThemeProvider, mixTheme } from './theme';

/** How long the burst of dots gets to play before the run picks back up. */
const DEATH_PAUSE = 0.6;

/** The first world of the session waits behind the front page for a tap. */
function openingWorld(level = 1) {
  const w = createWorld(level);
  w.status = 'paused';
  return w;
}

interface Summary {
  score: number;
  banked: number;
  cleared: boolean;
  /** True when this run is the one that set the best. */
  isBest: boolean;
  /** Which level the run was, so a card is never a level behind the world. */
  level: number;
}

export default function GameScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useProgress();
  const settings = useSettings();
  const worldRef = useRef(openingWorld());
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [summary, setSummary] = useState<Summary | null>(null);
  /**
   * The flag banner, or null while there is none up.
   *
   * `id` is what makes a second flag taken while the first banner is still on
   * screen restart it rather than be swallowed: the component is keyed off it,
   * so a new flag is a new banner with a fresh animation rather than the same
   * one part way through its fade.
   */
  const [flash, setFlash] = useState<{
    id: number;
    score: number;
    coins: number;
    gear: number;
  } | null>(null);
  const [board, setBoard] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const [splash, setSplash] = useState(true);
  /**
   * True while the road between the levels is up.
   *
   * It sits in front of the front page rather than instead of it: PLAY opens
   * the road, the road opens a level. The world waiting behind both is still
   * the one the front page built, so picking a different stop on the road
   * rebuilds it the same way the ribbon used to.
   */
  const [map, setMap] = useState(false);
  /**
   * Which level the road is pointing at, and so which one PLAY LEVEL opens.
   *
   * It starts at the first one not yet cleared and the cards move it from
   * there. The saved count is read once, when it lands off disk -- after that
   * this screen owns the number, so replaying a cleared level does not snap
   * back to the furthest one on the next render.
   */
  const [level, setLevel] = useState(1);
  /** True while there is a paused run behind the front page to go back to. */
  const [resumable, setResumable] = useState(false);
  /**
   * Which level the loading screen is opening, or 0 while it is not up.
   *
   * The work it covers is the first frame of a run rather than the building of
   * the level -- a level is arithmetic and costs nothing -- so the screen is
   * shown on the way *into* one and never on a retry. See `LoadingScreen`.
   */
  const [opening, setOpening] = useState(0);
  /** What to do once that bar is full: the body of whichever button opened it. */
  const afterOpen = useRef<(() => void) | null>(null);
  const acct = useAccount();
  /**
   * True while the front page's LOGIN pill is asking for the door back, as
   * opposed to the door simply not having been walked through yet.
   */
  const [door, setDoor] = useState(false);
  /**
   * True when the door was opened by walking back out of the game rather than
   * by the LOGIN pill.
   *
   * The two want opposite things from the next back press. A door the pill
   * asked for is a card over the front page, so back closes it and the player
   * is where they were. A door the back button walked out to is the bottom of
   * the game -- front page behind it, run behind that -- so back there leaves
   * the app, which is what stops the two screens bouncing off each other
   * forever.
   */
  const backDoor = useRef(false);
  /**
   * False until the player has come off the door on this launch.
   *
   * The door is the game's first screen, every launch, a returning player
   * included -- the decision it carries is which account a run goes on the
   * board under, and that is worth asking before the game is played rather
   * than after. It costs a returning player one tap on CONTINUE, which is
   * what the button becomes once the phone already knows them; see
   * `LoginScreen`. Nothing is signed out and nothing is asked twice.
   */
  const [entered, setEntered] = useState(false);
  // ...and the door waits for the saved account before it opens. Every store
  // reads as its defaults until then, and the default is "nobody has signed
  // in" -- so opening on the first frame would ask a player the phone already
  // knows to sign in, and only correct itself to CONTINUE a frame later.
  const [acctReady, setAcctReady] = useState(false);
  const login = acctReady && (door || !entered);
  /**
   * False until the saved progress has landed as well.
   *
   * The front page waits on both stores, not just the one the door waits on.
   * Rendered any earlier it is a page built entirely out of defaults: a live
   * PLAY with no door in front of it yet, over a ribbon reading LEVEL 1 for a
   * player who is twenty levels down. Pressing it in that window opens the
   * first level rather than theirs, which is a run they did not ask for and
   * cannot get back. There is nothing to show in the meantime and nothing
   * worth showing -- the world is already drawing behind all of this -- so the
   * page simply waits the reads out.
   */
  const [saveReady, setSaveReady] = useState(false);
  const saved = acctReady && saveReady;

  // True while the banner is the one the console popped up, so closing it drops
  // the player straight back into the run instead of into the pause card.

  // Read inside the loop so a rotation retunes the corridor without a restart.
  // Both sides of the screen go in: the width is how much of the run is on
  // screen, and the height is the scale that width is measured at.
  const paceRef = useRef(1);
  paceRef.current = paceFor(W, H);

  /**
   * How far past the last whole simulation step this frame fell, 0 to 1.
   *
   * The world moves in whole sixtieths and the screen does not: a 90Hz panel
   * asks for a frame half way through a step, a 120Hz one every half step.
   * Drawing the last whole step on all of those refreshes is what made the
   * ball stutter -- it stood still for a third of the frames on a 90 and half
   * of them on a 120, then covered two steps in one. The drawing is handed
   * this instead and puts the ball, the camera and every blade's clock where
   * they were at the instant the screen actually asked for.
   */
  const alphaRef = useRef(1);

  // Decode the sound effects once, before the first one is fired mid-run, and
  // bring up the services that talk to the outside world. Analytics no-ops
  // when its SDK is not in the build, so this is safe either way.
  useEffect(() => {
    Sound.preload();
    const stopConsent = Analytics.init();
    Analytics.track('app_open', {});
    // The door is the first screen either way and reports itself; all this
    // waits for is the saved account, which decides what the door offers.
    account.hydrated().then(() => setAcctReady(true));
    return stopConsent;
  }, []);

  // A score that never made it up gets another go -- but only once the saved
  // counts are in, since the board stores a run total alongside the score and
  // an unhydrated store would send a zero.
  useEffect(() => {
    whenHydrated().then(async () => {
      const { runs, best } = getProgress();
      Analytics.setUserProps({ runs, best });
      // A Play Games player whose Firebase link did not take at sign-in gets
      // another go first, so the flush below lands on the row it should.
      await account.hydrated();
      await PlayGames.ensureLinked();
      await Board.flush(runs);
      // Where the player is, for the country and city boards -- cached for a
      // week, so this is one request on the first open and none after it. A
      // row that went up before the place was known, or from somewhere the
      // player has since left, is put right once it lands.
      await Region.resolve();
      Board.syncName(runs);
    });
  }, []);

  // Where the player got to, once the save lands. Only ever read here: after
  // this the front page and the cards move the level between them.
  useEffect(() => {
    whenHydrated().then(() => {
      setLevel(nextLevel());
      setSaveReady(true);
    });
  }, []);

  /**
   * Keep the world waiting behind the front page on the level the front page
   * is advertising.
   *
   * The opening world is built before the save has come off disk, so it is
   * level one until it is not. Rebuilding it costs nothing while no run has
   * started, and it is the only way PLAY can open the level the ribbon says.
   */
  useEffect(() => {
    if (!splash || resumable) return;
    if (worldRef.current.level === level) return;
    worldRef.current = openingWorld(level);
    force();
  }, [splash, resumable, level]);

  // The sound service takes flags rather than reading settings itself; keep it
  // in step with the two switches.
  useEffect(() => {
    Sound.setAudio({ sfx: settings.sfx, music: settings.music });
  }, [settings.sfx, settings.music]);

  // Backgrounding the app should not leave the loop playing over whatever the
  // player switched to -- nor leave the run itself going. A call arriving
  // mid-descent is not a death the player earned, so the world is held exactly
  // as the pause card holds it and the card is there to let them back in.
  const [appActive, setAppActive] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      const active = state === 'active';
      setAppActive(active);
      const cur = worldRef.current;
      if (!active && cur.status === 'playing') cur.status = 'paused';
    });
    return () => sub.remove();
  }, []);

  // --- frame loop ---------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let alive = true;
    // Leftover real time that has not been simulated yet. The world only ever
    // advances in whole fixed steps, so the descent runs at the same speed on
    // a phone dropping frames as on one holding 60.
    let acc = 0;
    // Tracks the checkpoint so a flag pickup can be told apart from a star/TV one.
    let lastCheckpointY = worldRef.current.checkpoint.y;
    // Set the moment a death happens, so the burst of dots gets to finish
    // playing before the game over card covers it.
    let deadAt: number | null = null;
    // Carried from the frame the run ended to the frame the card goes up.
    let endedBest = false;

    const frame = (ts: number) => {
      if (!alive) return;
      // A frame that took longer than a few steps is a stall, not slow play:
      // drop the excess rather than fast-forwarding the ball through blades.
      const elapsed = last ? Math.min((ts - last) / 1000, FIXED_DT * MAX_STEPS) : FIXED_DT;
      last = ts;
      acc += elapsed;
      const w = worldRef.current;
      w.pace = paceRef.current;
      const before = w.status;
      let steps = 0;
      while (acc >= FIXED_DT && steps < MAX_STEPS) {
        step(w, FIXED_DT);
        acc -= FIXED_DT;
        steps++;
      }
      // Whatever real time is left over is how far into the next step this
      // frame fell. The drawing interpolates along it.
      alphaRef.current = acc / FIXED_DT;
      if (!steps) {
        // The world did not move -- but the screen still did, and the ball is
        // a fraction further along the step it is in the middle of than it
        // was last frame, so a run in progress is still worth redrawing. A
        // world that is not being played has nothing to interpolate towards
        // and is left exactly as it is.
        if (w.status === 'playing') force();
        raf = requestAnimationFrame(frame);
        return;
      }

      if (w.checkpoint.y !== lastCheckpointY) {
        lastCheckpointY = w.checkpoint.y;
        Sound.play('checkpoint');
        Haptics.buzz('light');
      }
      // A flag says so out loud: what it paid, and what it has just done to
      // the descent. It has its own chime already, so it is kept out of the
      // coin one -- two sounds on the same frame is a clatter, not an event.
      if (w.pickup === 3) {
        setFlash({
          id: w.nextId,
          score: FLAG_SCORE,
          coins: FLAG_COINS,
          gear: runGear(w.gear, w.creep),
        });
      } else if (w.pickup) {
        Sound.play('coin');
      }

      const ended = before === 'playing' && (w.status === 'dead' || w.status === 'finished');
      if (ended) {
        if (w.status === 'dead') {
          Sound.play('collision');
          Haptics.death();
          deadAt = w.t;
        }
        const gained = w.runCoins;
        w.runCoins = 0;
        w.banked += gained;
        const score = Math.floor(w.score);
        endedBest = recordRun(score, gained);

        const runs = getProgress().runs;
        Analytics.track(w.status === 'finished' ? 'level_clear' : 'run_end', {
          score,
          coins: gained,
          runs,
          best: endedBest,
          level: w.level,
        });
        // Only a run that beat this device's best is worth a write; the
        // service decides the rest and never rejects.
        if (endedBest) {
          Board.submit(score, runs).then(result => {
            Analytics.track('leaderboard_submit', { score, result });
          });
        }

        if (w.status === 'finished') {
          // The level and the stars picked up in it are banked here rather
          // than on the card, so they are won by finishing the level and not
          // by the card happening to be rendered.
          recordClear(w.level, starsTaken(w));
          setSummary({
            score,
            banked: w.banked,
            cleared: true,
            isBest: endedBest,
            level: w.level,
          });
        }
      }

      if (deadAt !== null && w.t - deadAt >= DEATH_PAUSE) {
        deadAt = null;
        Sound.play('gameover');
        setSummary({
          score: Math.floor(w.score),
          banked: w.banked,
          cleared: false,
          isBest: endedBest,
          level: w.level,
        });
      }

      force();
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const w = worldRef.current;

  // The loop follows the run: it plays while the world is moving and holds --
  // without rewinding -- for the splash, the pause card, either of
  // the two pages, and both ways a run can end. Derived from the state rather
  // than fired from each handler, so no path out of 'playing' can forget it.
  const musicOn =
    appActive &&
    w.status === 'playing' &&
    !board &&
    !prefs &&
    !splash &&
    !map &&
    !login &&
    !opening;
  useEffect(() => {
    if (musicOn) Sound.startMusic();
    else Sound.pauseMusic();
  }, [musicOn]);

  // --- input: tap to jump, drag to nudge along the run ----------------------
  //
  // Nothing here reads a position into the ball. A finger landing is a jump
  // and a finger resting is a direction, and neither of them ever says where
  // the ball should be -- so the ball is never put anywhere: it can only get
  // somewhere by travelling there.
  //
  // Vertically the ball is always falling. Every touch that lands throws it
  // back up the screen once, on the frame it lands, and leaving that finger
  // down does nothing further -- so the player keeps the ball up by tapping in
  // time with the fall, and a hand left on the glass is a ball on its way
  // down. That is the whole of it: tap = up, no tap = down.
  //
  // Sideways, the ball is dragged. One finger owns the drag; sliding it moves
  // the ball by the same distance, and stopping it stops the ball on that
  // frame, in that lane. Nothing is held and nothing has to be let go of.
  //
  // Fingers are tracked by id rather than counted, so the jump fires once per
  // finger that actually lands: the responder system reports the same still
  // finger through several handlers and none of those may be a second jump,
  // while a second finger coming down beside a dragging thumb is a real tap
  // and does jump. That is what lets a player drag with one thumb and tap
  // with the other.
  //
  /** Ids of the fingers currently down on the playfield. */
  const downIds = useRef<Set<number>>(new Set());
  /**
   * The finger the ball is being dragged with, if any.
   *
   * One finger owns the drag and keeps owning it until it comes off, rather
   * than the ball following whichever touch moved last -- two thumbs sliding
   * at once would otherwise hand the ball back and forth between them and it
   * would follow neither.
   *
   * `travel` is how far this finger has moved since it landed, and `live` is
   * whether that has passed `DRAG_SLOP` yet. Until it has, the touch is a pure
   * tap and moves nothing: every real thumb-press wobbles a few px, and
   * without the slop every jump would smear the ball sideways.
   */
  const drag = useRef<{
    id: number;
    lastX: number;
    travel: number;
    live: boolean;
  } | null>(null);

  /**
   * A turn of the phone lets go of the drag.
   *
   * `lastX` is a `pageX`, so it is a reading on a screen of one shape. After a
   * rotation the same thumb, in the same place on the glass, reports a wholly
   * different number, and the next move event would be read as that finger
   * having leapt across the phone -- throwing the ball the width of the
   * corridor by a hand that never moved.
   *
   * Dropping the drag is enough, and the fingers deliberately stay on the
   * books. `fold` rebuilds `downIds` from the live touch list on every event,
   * so nothing can go stale there; clearing it here would instead make a
   * finger that never left the glass read as having just landed, and every
   * turn taken mid-drag would come with a jump nobody asked for.
   *
   * What is left is a drag that has to be started again: the next move seeds
   * it from wherever the finger is now, with `DRAG_SLOP` to travel before the
   * ball answers. That is the same promise the scheme makes everywhere else --
   * a touch never moves the ball until it travels.
   */
  useEffect(() => {
    drag.current = null;
  }, [W, H]);

  /**
   * Fold the touches currently down into a jump and a drag.
   *
   * Touches on the mute button are dropped first: it is a sibling of this
   * full-screen layer rather than a child, so its presses would otherwise fly
   * the ball as well as work the button. On an end event the fingers that just
   * came off go with them -- the platform still lists a lifting finger among
   * the current touches, and counting it would leave the ball dragging after
   * the hand had gone and, worse, leave its id on the books so that finger's
   * next tap read as the same one still resting.
   */
  const fold = useCallback(
    (e: GestureResponderEvent, ending: boolean) => {
      const ne = e.nativeEvent;
      // An empty list is a real answer -- the last finger coming off -- so only
      // a missing one falls back to reading the bare event as the one touch.
      const all: readonly NativeTouchEvent[] = ne.touches ?? [ne];
      const gone = ending ? new Set((ne.changedTouches ?? [ne]).map(t => t.identifier)) : null;
      const live = all.filter(
        t =>
          !gone?.has(t.identifier) &&
          !muteButtonHit(t.pageX, t.pageY, W, H, insets.right, insets.bottom),
      );

      const ids = new Set<number>();
      let landed = false;
      for (const t of live) {
        ids.add(t.identifier);
        // A finger the last report did not have is a finger that just arrived.
        if (!downIds.current.has(t.identifier)) landed = true;
      }
      downIds.current = ids;

      const held = drag.current;
      const moving = held ? live.find(t => t.identifier === held.id) : undefined;
      if (held && moving) {
        // A finger sliding across the glass slides the ball the same way along
        // the run, so the drag is read off `pageX` and always was -- what
        // changed under it is which world axis that is. The screen is drawn
        // scaled, so a px of finger is not a px of world: dividing the scale
        // back out keeps a drag worth the same share of the run whatever size
        // the screen it was made on.
        const dx = moving.pageX - held.lastX;
        held.lastX = moving.pageX;
        held.travel += Math.abs(dx);
        if (!held.live && held.travel >= DRAG_SLOP) held.live = true;
        if (held.live) steerBy(worldRef.current, (dx * DRAG_GAIN) / viewScale(H));
      } else {
        // Either nothing owns the drag or the finger that did has come off.
        // Whichever finger is left takes it over from where it is now, so the
        // ball is never yanked to meet a thumb that was already resting.
        const next = live[0];
        drag.current = next
          ? { id: next.identifier, lastX: next.pageX, travel: 0, live: false }
          : null;
      }

      // One jump per landing, thrown the moment it lands: the tap is the press
      // itself, not a press-and-release, so the ball answers on the frame the
      // player touched the glass.
      if (landed) lift(worldRef.current);
    },
    // The insets are in here because the mute button is pinned inside them:
    // a phone flipped end for end swaps left for right, and a handler still
    // holding the old pair would keep refusing taps over bare corridor and
    // steering the run through the button that moved.
    [W, H, insets.right, insets.bottom],
  );

  const onTouch = useCallback((e: GestureResponderEvent) => fold(e, false), [fold]);
  const onTouchEnd = useCallback((e: GestureResponderEvent) => fold(e, true), [fold]);

  const onRelease = useCallback(() => {
    downIds.current.clear();
    drag.current = null;
  }, []);

  // An ordinary retry picks the run back up at the blade that ended it. No ad
  // is ever shown here: this is the button the player is already pressing
  // twice a minute, and it is the one that has to stay instant.
  const onRetry = useCallback(() => {
    Sound.play('button');
    Haptics.buzz('light');
    Analytics.track('run_start', { from: 'retry' });
    restartFromDeath(worldRef.current);
    setSummary(null);
    setFlash(null);
  }, []);

  const onCarryOn = useCallback(() => {
    if (!spendCoins(REVIVE_COST)) return;
    Sound.play('revive');
    Haptics.buzz('medium');
    Analytics.track('revive', { cost: REVIVE_COST });
    // Back to the last flag: somewhere the run is known to be survivable from,
    // rather than back onto the blade that just ended it.
    restartFromCheckpoint(worldRef.current);
    setSummary(null);
    setFlash(null);
  }, []);

  /** Off the login screen and onto the front page, whichever button got here. */
  const onLoggedIn = useCallback(() => {
    setDoor(false);
    setEntered(true);
    Analytics.screen('splash');
  }, []);

  /** The front page's LOGIN pill: back to the door, on purpose this time. */
  const onLogin = useCallback(() => {
    Sound.play('button');
    backDoor.current = false;
    setDoor(true);
    Analytics.screen('login');
  }, []);

  /**
   * Put the loading screen up on the way into a level, and run the button's
   * own work once its bar is full.
   *
   * The work is deferred rather than done now on purpose: the screen it opens
   * is the last frame before a run, and doing the teardown behind it would
   * mount a corridor's worth of rods on the same frame the bar is animating.
   */
  const openLevel = useCallback((n: number, go: () => void) => {
    afterOpen.current = go;
    setOpening(n);
  }, []);

  /** The bar is full: down with the screen, and on with whatever opened it. */
  const onOpened = useCallback(() => {
    const go = afterOpen.current;
    afterOpen.current = null;
    setOpening(0);
    go?.();
  }, []);

  /** PLAY on the front page: onto the road, to pick which level. */
  const onStart = useCallback(() => {
    Sound.play('button');
    setMap(true);
    Analytics.screen('map');
  }, []);

  /** A stop on the road. Only ever one the road drew as reachable. */
  const onPickLevel = useCallback((n: number) => {
    Sound.play('button');
    setLevel(n);
  }, []);

  /**
   * PLAY LEVEL N on the road: the level the road is pointing at, from the top.
   *
   * It never resumes. A player who backed out of a run onto the front page
   * gets the back arrow for that -- this button says which level it is opening
   * on its own face, and a button that quietly did something else instead
   * would be the one lie on the page.
   */
  const onPlayLevel = useCallback(() => {
    Sound.play('start');
    Analytics.track('run_start', { from: 'map', level });
    openLevel(level, () => {
      Analytics.screen('game');
      setMap(false);
      setSplash(false);
      setSummary(null);
      setFlash(null);
      const cur = worldRef.current;
      // Anything but the pristine world this level was opened with is thrown
      // away: a half-played run of the same level would otherwise resume.
      if (resumable || cur.level !== level || cur.status !== 'paused') {
        worldRef.current = createWorld(level);
      }
      worldRef.current.status = 'playing';
      setResumable(false);
    });
  }, [level, resumable, openLevel]);

  /** The road's back arrow: onto the front page it was opened from. */
  const onLeaveMap = useCallback(() => {
    Sound.play('button');
    setMap(false);
    Analytics.screen('splash');
  }, []);

  /**
   * A fresh run opens on this level's first bar, not wherever the last one
   * died -- and on *this* level: starting over is not giving up a star.
   */
  const onStartOver = useCallback(() => {
    Sound.stopMusic();
    Analytics.track('run_start', { from: 'start_over', level });
    worldRef.current = createWorld(level);
    setSummary(null);
    setFlash(null);
  }, [level]);

  /**
   * The cleared card's first button: back out to the road, with the level that
   * was just opened by this clear pointed at and ready.
   *
   * It does not drop the player straight into the next level. A level is
   * chosen on the road, every time, so the game has one place where that
   * decision is made rather than two -- and the road is where the stars this
   * run just picked up are now showing over the stop that was cleared, which
   * is worth coming back out to see before the next descent starts.
   */
  const onNextLevel = useCallback(() => {
    // One past the level the run was. There is no last level to stop at: the
    // road carries on past the authored twenty for as long as the player does.
    const next = (summary?.level ?? level) + 1;
    Sound.stopMusic();
    Sound.play('button');
    Analytics.screen('map');
    setLevel(next);
    setSummary(null);
    setFlash(null);
    // The run that was just cleared is put away and the world waiting behind
    // the road is the next level, paused, exactly as it is on a fresh launch.
    worldRef.current = openingWorld(next);
    setResumable(false);
    setSplash(true);
    setMap(true);
  }, [summary, level]);

  const pause = useCallback(() => {
    Sound.play('button');
    const cur = worldRef.current;
    if (cur.status === 'playing') cur.status = 'paused';
  }, []);

  const resume = useCallback(() => {
    Sound.play('button');
    const cur = worldRef.current;
    if (cur.status === 'paused') cur.status = 'playing';
  }, []);

  // The two pages hold the run the same way the pause card does, so opening
  // one mid-game cannot cost the player the ball.
  const openBoard = useCallback(() => {
    pause();
    setBoard(true);
  }, [pause]);

  const openPrefs = useCallback(() => {
    pause();
    setPrefs(true);
  }, [pause]);

  const closeBoard = useCallback(() => setBoard(false), []);
  const closePrefs = useCallback(() => setPrefs(false), []);

  /**
   * The hardware back button walks the game back one screen at a time: out of
   * a run and onto the front page, and off the front page out of the game. The
   * front page is the root now -- there is nothing behind it to back into -- so
   * that last step is the one handed to the system.
   *
   * A run is paused rather than thrown away, exactly as the pause card pauses
   * it, so nothing is torn down on the way out -- but the front page no longer
   * offers a way back into it. PLAY opens the level fresh from there.
   *
   * This is registered on mount, before any sheet or page can register one of
   * its own, and Android runs the newest subscription first -- so an open
   * board or settings still closes itself instead of dropping the player onto
   * the front page behind it.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (login) {
        // A door the LOGIN pill asked for closes back onto the page underneath
        // it. The one the back button walked out to is the end of the road:
        // there is nothing behind it but the home screen.
        if (door && !backDoor.current) {
          setDoor(false);
          return true;
        }
        return false;
      }
      if (map) {
        setMap(false);
        return true;
      }
      // The front page is not the bottom any more: one more press opens the
      // door, so a player can change account -- or sign in after playing as a
      // guest -- without killing the app and starting it again.
      if (splash) {
        backDoor.current = true;
        setDoor(true);
        Analytics.screen('login');
        return true;
      }
      pause();
      setSummary(null);
      setFlash(null);
      setSplash(true);
      setResumable(true);
      Analytics.screen('splash');
      return true;
    });
    return () => sub.remove();
  }, [login, door, splash, map, pause]);

  /**
   * Out of the account and back to the door.
   *
   * The settings card has to be sent away with it, since it is drawn over the
   * login screen rather than under it, and the run is put back to an opening
   * one: signing out lands exactly where a first launch does, instead of
   * leaving whoever signs in next behind a paused game they never started.
   */
  const onSignedOut = useCallback(() => {
    setDoor(false);
    setEntered(false);
    setMap(false);
    setPrefs(false);
    setBoard(false);
    setSummary(null);
    setFlash(null);
    setSplash(true);
    setResumable(false);
    worldRef.current = openingWorld(level);
  }, [level]);

  // The board's "pick a name" prompt hands the player straight to settings.
  const boardToPrefs = useCallback(() => {
    setBoard(false);
    setPrefs(true);
  }, []);

  const onShare = useCallback(() => {
    // The score on the card if there is one, otherwise the run to be proud of.
    shareScore(summary?.score ?? progress.best, Board.getBoard().rank, 'card');
  }, [summary, progress.best]);

  const onToggleMute = useCallback(() => {
    toggleMuted();
  }, []);

  /** The flag banner has said its piece and faded out. */
  const clearFlash = useCallback(() => setFlash(null), []);

  const covered = board || prefs;
  /**
   * True from the frame the run is over -- card and all -- to the frame it is
   * left or started again.
   *
   * Kept apart from `showOver`, which is the card actually being drawn: the
   * card's own corners open the board and settings, which sets `covered` and
   * takes the card down over a run that is still dead.
   */
  const over = w.status === 'dead' && summary !== null;
  const showClear = w.status === 'finished' && summary !== null && !covered;
  const showOver = over && !covered;
  const showPause = w.status === 'paused' && !covered && !splash && !login;

  /**
   * Sideways, once, for the whole session.
   *
   * The game used to be read upright and played sideways, and this effect was
   * the rule for which: it ran on every change of screen and turned the phone
   * on the way into a level and back on the way out. Every page is laid out
   * for a short, wide viewport now, so there is one answer and it is asked for
   * at launch -- `AndroidManifest.xml` and `Info.plist` say the same thing, so
   * this is belt and braces on Android and the only lock on a platform whose
   * native half is not built yet.
   */
  useEffect(() => {
    Orientation.lock('landscape');
  }, []);

  const cardActions = useMemo(
    () => ({ onLeaderboard: openBoard, onSettings: openPrefs, onShare }),
    [openBoard, openPrefs, onShare],
  );

  // Where the player is, spelled the one way every card and the front page
  // read it. A card quotes the level the *run* was, which is not always the
  // one the screen has moved on to.
  const cardLevel = summary?.level ?? w.level;
  const levelInfo = { level: cardLevel, cleared: progress.cleared };

  // One palette drives the world and the HUD, so the dark stretch fades as one.
  // Quantised, so the context value only changes when the fade visibly moves --
  // otherwise every themed shape re-renders on every frame.
  const darkStep = Math.round(w.darkness * 20) / 20;
  const worldId = worldOf(w.level).id;
  const theme = useMemo(() => mixTheme(darkStep, worldId), [darkStep, worldId]);

  return (
    <ThemeProvider value={theme}>
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        {/* The top of the sky is the deep end of its own periwinkle on every
            screen in the game -- the front page, a run, and the night the
            settings and the board are read on -- so this never flips back. */}
        <StatusBar barStyle="light-content" />
        <GameView world={w} W={W} H={H} alpha={alphaRef.current} />

        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={onTouch}
          onResponderStart={onTouch}
          onResponderMove={onTouch}
          onResponderEnd={onTouchEnd}
          onResponderRelease={onRelease}
          onResponderTerminate={onRelease}
        />

        {!splash && !login && (
          <Hud
            score={Math.floor(w.score)}
            coins={progress.coins}
            level={w.level}
            top={insets.top}
            // Held sideways, the cutout and the rounded corners are down the
            // *side* of the screen rather than across the top, so the pause
            // button and the coin chip are what would sit under them.
            left={insets.left}
            right={insets.right}
            bonusLeft={Math.ceil(Math.max(0, w.bonusUntil - w.t))}
            gear={runGear(w.gear, w.creep)}
            onPause={pause}
          />
        )}

        {/* The flag banner. Over the run and under everything that stops it:
            a card going up is the run over, and a banner about what the run
            just earned has no business on top of it. */}
        {flash && !covered && !splash && !login && w.status === 'playing' && (
          <FlagFlash
            key={flash.id}
            score={flash.score}
            coins={flash.coins}
            gear={flash.gear}
            onDone={clearFlash}
          />
        )}

        {showClear && summary && (
          <FinishOverlay
            score={summary.score}
            best={progress.best}
            runCoins={summary.banked}
            onNext={onNextLevel}
            onReplay={onStartOver}
            {...levelInfo}
            {...cardActions}
          />
        )}

        {showOver && summary && (
          <GameOverOverlay
            score={summary.score}
            best={progress.best}
            runCoins={summary.banked}
            isBest={summary.isBest}
            reviveCost={REVIVE_COST}
            canRevive={progress.coins >= REVIVE_COST && w.checkpoint.y > w.startY}
            onRetry={onRetry}
            onStartOver={onStartOver}
            onRevive={onCarryOn}
            {...levelInfo}
            {...cardActions}
          />
        )}

        {showPause && (
          <PauseOverlay
            score={Math.floor(w.score)}
            best={progress.best}
            runCoins={w.runCoins}
            onResume={resume}
            onRetry={onStartOver}
            {...levelInfo}
            {...cardActions}
          />
        )}

        {/* Above the cards but below the two pages: the front
            page has to cover the run behind it, and the board and the settings
            its corners offer have to come up over it rather than behind it. */}
        {splash && saved && (
          <Splash
            front={!map && !login}
            level={level}
            levelName={levelAt(level).name}
            playerName={acct.name}
            onStart={onStart}
            onLogin={onLogin}
            onLeaderboard={openBoard}
            onSettings={openPrefs}
          />
        )}

        {/* The road, in front of the front page it was opened from. Only
            while the front page is up: nothing reaches it from a run. */}
        {splash && map && !login && (
          <LevelMap
            cleared={progress.cleared}
            stars={progress.stars}
            level={level}
            onPick={onPickLevel}
            onPlay={onPlayLevel}
            onBack={onLeaveMap}
          />
        )}

        {/* Over the front page and the road both, on the way into a level. */}
        {opening > 0 && (
          <LoadingScreen level={opening} levelName={levelAt(opening).name} onDone={onOpened} />
        )}

        {/* In front of all of it: on a first open, after a sign-out, or
            whenever the front page's LOGIN pill asks for the door back. */}
        {login && <LoginScreen onDone={onLoggedIn} />}

        {/* Whole pages rather than sheets, and last in the tree, so each one
            covers the splash and the run alike. */}
        <LeaderboardScreen
          visible={board}
          best={progress.best}
          runs={progress.runs}
          onBack={closeBoard}
          onOpenSettings={boardToPrefs}
        />

        <SettingsScreen visible={prefs} onBack={closePrefs} onSignOut={onSignedOut} />

        {!covered && !login && !map && (
          <MuteButton
            muted={!settings.sfx && !settings.music}
            right={insets.right}
            bottom={insets.bottom}
            onPress={onToggleMute}
          />
        )}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
