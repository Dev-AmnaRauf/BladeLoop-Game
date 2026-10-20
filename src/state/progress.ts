/**
 * What the player has earned: gems, cleared levels, their best run, and how
 * many runs it took.
 *
 * Audio and privacy preferences used to live here too; they moved to
 * `settings`, which a "reset progress" deliberately leaves alone.
 */
import { createStore } from './store';

export interface Progress {
  coins: number;
  best: number;
  runs: number;
  /**
   * How many levels have been cleared, which is also how many of the stars on
   * the cards and the road are lit. A level is only ever cleared in
   * order, so one number carries both the stars won and the level the player
   * is up to -- the next one is one past it.
   *
   * It has no ceiling. The authored levels run out at `LEVEL_COUNT` and the
   * road carries on past them, so a player who keeps clearing keeps counting.
   */
  cleared: number;
  /**
   * How many of a level's own stars the player picked up on their best run of
   * it, keyed by level number.
   *
   * This is what the road draws over a cleared stop. The stars are lying in
   * the corridor rather than handed out for finishing, so a level can be
   * cleared without them -- and going back for the ones that were missed is
   * the reason to replay a level that is already beaten.
   *
   * It goes through JSON on the way to disk and comes back with string keys,
   * so it is typed as a string map and indexed with the level number, which is
   * what JavaScript does to the key either way.
   */
  stars: Record<string, number>;
}

const DEFAULTS: Progress = {
  coins: 0,
  best: 0,
  runs: 0,
  cleared: 0,
  stars: {},
};

const store = createStore<Progress>('bladeloop.progress.v1', DEFAULTS);

export const getProgress = store.get;
export const useProgress = store.use;
export const setProgress = store.set;
/** Resolves once the saved progress has loaded (or failed to). */
export const whenHydrated = store.hydrated;
/** Back to a fresh save: no gems, no stars, no best. Settings are untouched. */
export const resetProgress = store.reset;

export function spendCoins(n: number) {
  const { coins } = store.get();
  if (coins < n) return false;
  store.set({ coins: coins - n });
  return true;
}

/**
 * Bank a finished run. Returns whether it beat the previous best, which is
 * what decides if the score is worth sending to the leaderboard and worth
 * telling the player about.
 */
export function recordRun(score: number, coins: number) {
  const prev = store.get();
  const isBest = score > prev.best;
  store.set({
    best: isBest ? score : prev.best,
    coins: prev.coins + coins,
    runs: prev.runs + 1,
  });
  return isBest;
}

/**
 * Bank a cleared level and the stars the run picked up inside it. Returns
 * whether this is the first time the level has been finished, which is what
 * opens the one after it.
 *
 * The stars are kept at the best any run of that level has managed rather than
 * at the last one, so a quick replay that skips them cannot take back what the
 * road is already showing.
 */
export function recordClear(level: number, stars = 0) {
  const prev = store.get();
  const first = level > prev.cleared;
  const patch: Partial<Progress> = {};
  if (first) patch.cleared = level;
  if (stars > (prev.stars[level] ?? 0)) patch.stars = { ...prev.stars, [level]: stars };
  if (patch.cleared !== undefined || patch.stars) store.set(patch);
  return first;
}

/** How many of level `n`'s stars the player has, on their best run of it. */
export function starsWon(p: Progress, n: number) {
  return p.stars[n] ?? 0;
}

/**
 * The level a player who has just opened the game should be dropped into.
 *
 * One past whatever they last cleared, and never capped: there is always a
 * next level, however far down the road they are.
 */
export function nextLevel() {
  return store.get().cleared + 1;
}
