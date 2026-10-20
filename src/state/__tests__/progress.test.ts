/**
 * What a clear banks.
 *
 * Two things ride on this and neither is visible until a player has already
 * lost them: which level the road opens next, and how many of a level's stars
 * it draws over the stop. The second one is the easier to get wrong, because
 * the obvious implementation -- write what this run picked up -- quietly takes
 * stars back off a player who replays a level and skips them.
 */
import {
  getProgress,
  nextLevel,
  recordClear,
  resetProgress,
  starsWon,
  whenHydrated,
} from '../progress';
import { LEVEL_COUNT } from '../../game/level';

beforeEach(async () => {
  resetProgress();
  await whenHydrated();
});

test('the first clear of a level is what opens the next one', () => {
  expect(recordClear(1, 0)).toBe(true);
  expect(getProgress().cleared).toBe(1);

  // Playing it again is worth the score and the coins, but there is no second
  // level opened by it.
  expect(recordClear(1, 3)).toBe(false);
  expect(getProgress().cleared).toBe(1);
});

test('a replay can win the stars that were missed, and cannot lose them', () => {
  recordClear(1, 1);
  expect(starsWon(getProgress(), 1)).toBe(1);

  // Back in for the ones left behind.
  recordClear(1, 3);
  expect(starsWon(getProgress(), 1)).toBe(3);

  // ...and a fast run through it that touches nothing does not take them away.
  recordClear(1, 0);
  expect(starsWon(getProgress(), 1)).toBe(3);
});

test('a level never cleared has no stars against it', () => {
  expect(starsWon(getProgress(), 4)).toBe(0);
});

test('the count runs on past the authored levels, because the road does', () => {
  recordClear(LEVEL_COUNT + 3, 2);
  expect(getProgress().cleared).toBe(LEVEL_COUNT + 3);
  // ...and the next level is always one past it. There is no last level to
  // come to rest on.
  expect(nextLevel()).toBe(LEVEL_COUNT + 4);
});
