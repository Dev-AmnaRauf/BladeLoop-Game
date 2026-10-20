import { LEVEL_COUNT } from '../level';
import { WORLDS, WORLD_SPAN, opensWorld, unlockedWorlds, worldOf } from '../worlds';

/**
 * The worlds are a way of reading the road, so what is worth pinning down is
 * that every level is in exactly one, in order, and that reaching a world's
 * first level is what opens it.
 */
describe('worlds', () => {
  it('puts every authored level in a world, a block at a time, in order', () => {
    const seen: string[] = [];
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const id = worldOf(n).id;
      if (seen[seen.length - 1] !== id) seen.push(id);
    }
    expect(seen).toEqual(WORLDS.map(w => w.id));
    for (const w of WORLDS) expect(worldOf(w.first).id).toBe(w.id);
  });

  it('gives each world its own name and at most a block of levels', () => {
    expect(new Set(WORLDS.map(w => w.name)).size).toBe(WORLDS.length);
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const w = worldOf(n);
      expect(n - w.first).toBeLessThan(WORLD_SPAN);
    }
  });

  it('opens a world on its first level and nowhere else', () => {
    const opens = [];
    for (let n = 1; n <= LEVEL_COUNT; n++) if (opensWorld(n)) opens.push(n);
    expect(opens).toEqual(WORLDS.slice(1).map(w => w.first));
  });

  it('unlocks a world once its first level can be played', () => {
    expect(unlockedWorlds(0).map(w => w.id)).toEqual(['nature']);
    expect(unlockedWorlds(2).map(w => w.id)).toEqual(['nature']);
    expect(unlockedWorlds(3).map(w => w.id)).toEqual(['nature', 'candy']);
    expect(unlockedWorlds(LEVEL_COUNT)).toEqual(WORLDS);
  });

  it('goes round the worlds again on the endless road', () => {
    expect(worldOf(LEVEL_COUNT + 1).id).toBe(WORLDS[0].id);
    expect(worldOf(LEVEL_COUNT + WORLD_SPAN + 1).id).toBe(WORLDS[1].id);
    expect(worldOf(LEVEL_COUNT + WORLD_SPAN * WORLDS.length + 1).id).toBe(WORLDS[0].id);
  });
});
