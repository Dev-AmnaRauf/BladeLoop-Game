/**
 * The quarter turn that lays the corridor across a sideways screen.
 *
 * The corridor, its walls, its water and every prop in it are drawn in the
 * corridor's own axes -- x across the corridor, y along the run -- and one
 * transform on one node turns the whole layer onto the glass. That is the
 * single thing standing between "the levels are authored in world px" and
 * "the run reads left to right", so it is worth pinning: it would break
 * silently, into a game that still passes every simulation test and draws the
 * run climbing the screen.
 *
 * What is pinned here is the turn itself, the box it turns, and the three
 * pieces of type that have to turn back out of it.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { HALF_W, viewScale } from '../../game/config';
import { createWorld } from '../../game/engine';
import GameView from '../GameView';
import Walls from '../Walls';
import Scenery from '../Scenery';
import { PopChip, StarChip, UPRIGHT } from '../entities';

/** Real landscape windows in dp, plus the tall shapes that stay reachable. */
const WINDOWS: [number, number][] = [
  [568, 320],
  [640, 360],
  [915, 412],
  [1024, 768],
];

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    trees.splice(0).forEach(tree => tree.unmount());
  });
});

async function corridor(w: number, h: number) {
  const world = createWorld();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<GameView world={world} W={w} H={h} />);
  });
  trees.push(tree);
  return tree;
}

/**
 * The component a `React.memo` wrapper is wrapping.
 *
 * The renderer walks the wrapped component, not the wrapper, so looking a
 * memoised export up by the thing this file imported finds nothing at all.
 */
function inner(c: unknown) {
  return (c as { type?: unknown }).type ?? c;
}

type Turned = { style: Record<string, unknown> };

/** Every node carrying a rotation, with the style that carries it. */
function turns(tree: ReactTestRenderer.ReactTestRenderer): Turned[] {
  const out: Turned[] = [];
  // Host nodes only. A memoised component and the view it renders carry the
  // same props, so counting both would double every turn in the tree.
  for (const node of tree.root.findAll(n => typeof n.type === 'string', { deep: true })) {
    const style = node.props?.style;
    if (!style || Array.isArray(style) || typeof style !== 'object') continue;
    const t = (style as { transform?: { rotate?: string }[] }).transform;
    if (Array.isArray(t) && t.some(entry => entry && entry.rotate)) {
      out.push({ style: style as Record<string, unknown> });
    }
  }
  return out;
}

describe('the corridor turned onto the screen', () => {
  it('turns the whole layer exactly one quarter, the way the run travels', async () => {
    const tree = await corridor(800, 360);
    const quarter = turns(tree).filter(n =>
      (n.style.transform as { rotate?: string }[]).some(t => t.rotate === '-90deg'),
    );
    // One turn, on one node. More than one would mean a shape turning itself
    // as well, which is the thing this layer exists to make unnecessary.
    expect(quarter).toHaveLength(1);
    // `-90deg` and not `90deg`: the other one sends the run leftward and the
    // level arrives at the player backwards.
    expect((quarter[0].style.transform as { rotate?: string }[])[0].rotate).toBe('-90deg');
  });

  it('lays the box out as the screen turned on its side, centred on it', async () => {
    for (const [w, h] of WINDOWS) {
      const tree = await corridor(w, h);
      const box = turns(tree).find(n =>
        (n.style.transform as { rotate?: string }[]).some(t => t.rotate === '-90deg'),
      )!;
      // As wide as the screen is tall and as tall as it is wide, centred: the
      // turn then lands it over the screen exactly, with nothing spare.
      expect(box.style.width).toBe(h);
      expect(box.style.height).toBe(w);
      expect(box.style.left).toBe((w - h) / 2);
      expect(box.style.top).toBe((h - w) / 2);
    }
  });

  it('hands the room and the scenery the box, not the screen', async () => {
    for (const [w, h] of WINDOWS) {
      const tree = await corridor(w, h);
      // Both are drawn inside the turn, so both are asked about the box. A
      // wall measured against the screen's own width would be drawn down the
      // length of the run instead of across it.
      for (const kind of [Walls, Scenery]) {
        const node = tree.root.findAll(n => n.type === inner(kind))[0];
        expect(node.props.width).toBe(h);
        expect(node.props.height).toBe(w);
      }
      // And the walls land at the corridor's own edge, scaled to the glass.
      const walls = tree.root.findAll(n => n.type === inner(Walls))[0];
      expect(walls.props.wall).toBeCloseTo(HALF_W * viewScale(h), 6);
    }
  });
});

describe('the type inside the corridor', () => {
  it('turns back out of the quarter, so it reads upright on the glass', () => {
    // Exactly the turn the layer makes, the other way: the two cancel.
    expect(UPRIGHT).toEqual({ rotate: '90deg' });
  });

  it('is carried by the pieces that have any', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <>
          <StarChip x={0} y={0} />
          <PopChip x={0} y={0} label="+5" fade={1} />
        </>,
      );
    });
    trees.push(tree);
    // Both chips carry it on the chip itself rather than on the text inside,
    // so the pill turns with its label and stays centred on the point in the
    // corridor it was given.
    const turned = turns(tree).filter(n =>
      (n.style.transform as { rotate?: string }[]).some(t => t.rotate === '90deg'),
    );
    expect(turned).toHaveLength(2);
  });
});
