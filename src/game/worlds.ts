import { LEVEL_COUNT } from './level';

/**
 * The worlds the road runs through.
 *
 * A world is a block of levels and the place they are flown in: its own
 * ground, its own rails and its own scenery drifting behind the corridor.
 * Nothing about a level's hazards changes with its world -- that is the
 * level's signature, in `level.ts` -- so a world is what a stretch of the
 * road *looks like*, and reaching the first level of the next one is what
 * unlocks it.
 *
 * Three levels apiece, in the order they open: the gentle ones first, the
 * strange ones last, and the galaxy holding the crowned finale. Past the
 * authored twenty the road goes round them again, three levels at a time.
 */
export type WorldId =
  | 'nature'
  | 'candy'
  | 'frozen'
  | 'lava'
  | 'neon'
  | 'moon'
  | 'galaxy';

export interface WorldDef {
  id: WorldId;
  name: string;
  /** First level of the world, 1-based, on the authored road. */
  first: number;
}

/** Levels in one world. */
export const WORLD_SPAN = 3;

export const WORLDS: WorldDef[] = [
  { id: 'nature', name: 'Nature World', first: 1 },
  { id: 'candy', name: 'Candy World', first: 4 },
  { id: 'frozen', name: 'Frozen World', first: 7 },
  { id: 'lava', name: 'Lava World', first: 10 },
  { id: 'neon', name: 'Neon City', first: 13 },
  { id: 'moon', name: 'Moon World', first: 16 },
  { id: 'galaxy', name: 'Galaxy World', first: 19 },
];

/** Which world level `n` is flown in. */
export function worldOf(n: number): WorldDef {
  const level = Math.max(1, Math.round(n) || 1);
  if (level <= LEVEL_COUNT) {
    const i = Math.min(WORLDS.length - 1, Math.floor((level - 1) / WORLD_SPAN));
    return WORLDS[i];
  }
  // The endless road: round the worlds again from the first, a block at a time.
  const past = level - LEVEL_COUNT - 1;
  return WORLDS[Math.floor(past / WORLD_SPAN) % WORLDS.length];
}

/** True when level `n` is the first level of its world: where a world opens. */
export function opensWorld(n: number) {
  const level = Math.max(1, Math.round(n) || 1);
  if (level === 1) return false;
  return worldOf(level).id !== worldOf(level - 1).id;
}

/**
 * The worlds a player has reached, given the last level they cleared. A world
 * is unlocked once the level that opens it can be played.
 */
export function unlockedWorlds(cleared: number): WorldDef[] {
  const reach = Math.max(1, cleared + 1);
  return WORLDS.filter(w => w.first <= reach);
}
