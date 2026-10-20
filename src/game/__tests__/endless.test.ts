/**
 * The road past the twenty authored levels.
 *
 * The one thing that must stay true out here is that an endless level is an
 * authored corridor dealt again. Every claim the audit makes -- that a level
 * never pinches below a ball's width, that a retry lane exists at every
 * height -- is a claim about the stages and hurdles inside it. The hurdles are
 * dealt from a deck seeded by the window, so an endless level deals exactly
 * what its authored twin deals. This pins the endless levels to the windows
 * that were written and tested, which is what lets the audit's twenty levels
 * stand for all of them.
 */
import { createWorld } from '../engine';
import { LEVELS, LEVEL_COUNT, levelAt, isEndless } from '../level';

/** The windows the authored levels are cut from, as `from-to` keys. */
const windows = new Set(LEVELS.map(d => `${d.from}-${d.to}`));

test('the authored levels are still handed back exactly as written', () => {
  for (const def of LEVELS) expect(levelAt(def.n)).toEqual(def);
  expect(isEndless(LEVEL_COUNT)).toBe(false);
  expect(isEndless(LEVEL_COUNT + 1)).toBe(true);
});

test('there is a level at every number, however far down the road', () => {
  for (const n of [LEVEL_COUNT + 1, 50, 137, 1000, 99999]) {
    const def = levelAt(n);
    expect(def.n).toBe(n);
    expect(def.name).toBeTruthy();
    // ...and it is one of the corridors the audit has already flown down.
    expect(windows.has(`${def.from}-${def.to}`)).toBe(true);
    expect(def.dark).toBeGreaterThan(0);
    expect(def.dark).toBeLessThanOrEqual(def.to - def.from);
  }
});

test('the endless run deals the later corridors, never the tutorial ones', () => {
  // The first five are the game teaching itself; a player who has cleared
  // twenty must not be dropped back into them.
  const early = new Set(LEVELS.slice(0, 5).map(d => `${d.from}-${d.to}`));
  const late = new Set(LEVELS.slice(5).map(d => `${d.from}-${d.to}`));
  for (let n = LEVEL_COUNT + 1; n <= LEVEL_COUNT + 40; n++) {
    const key = `${levelAt(n).from}-${levelAt(n).to}`;
    expect(late.has(key)).toBe(true);
    expect(early.has(key)).toBe(false);
  }
});

test('a level a long way out still builds a world with a dish to reach', () => {
  const def = levelAt(400);
  const w = createWorld(400);
  expect(w.level).toBe(400);
  expect(w.props.length).toBeGreaterThan(0);
  expect(w.finishY).toBeGreaterThan(w.startY);
  // Stage for stage, the corridor it was dealt from -- dish included.
  const twin = createWorld(LEVELS.find(d => d.from === def.from && d.to === def.to)!.n);
  expect(w.stages.map(st => st.name)).toEqual(twin.stages.map(st => st.name));
  expect(w.finishY).toBe(twin.finishY);
});

test('each lap of the road is darker than the one before it', () => {
  const first = levelAt(LEVEL_COUNT + 1);
  const second = levelAt(LEVEL_COUNT + 1 + (LEVEL_COUNT - 5));
  expect(second.from).toBe(first.from);
  expect(second.dark).toBeGreaterThanOrEqual(first.dark);
  expect(second.name).not.toBe(first.name);
});
