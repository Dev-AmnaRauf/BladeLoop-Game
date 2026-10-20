/**
 * The walls the corridor runs between.
 *
 * Drawn in the corridor's own axes, a wall down each side of a tall box, which
 * `GameView`'s quarter turn lays onto the screen as the ceiling and the floor
 * -- so everything below is measured against the box, and the box's "width" is
 * the screen's short side.
 *
 * The things worth pinning are the ones that would quietly stop being true and
 * only show up in a screenshot: that the walls land where the corridor
 * actually ends, that both of them are on the glass on every real shape, and
 * that nothing outside them ever *lightens* the room -- a wash over the run is
 * what once turned a saw's core and a `TvBox` face, both filled with `bg` so
 * they read as holes punched through, into discs glued on.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { View } from 'react-native';
import { HALF_W, viewScale } from '../../game/config';
import Walls from '../Walls';

/** Real landscape windows in dp, plus the tall shapes that stay reachable. */
const WINDOWS: [number, number][] = [
  [568, 320],
  [640, 360],
  [915, 412],
  [1024, 768],
  [1104, 884],
];

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    trees.splice(0).forEach(tree => tree.unmount());
  });
});

async function room(w: number, h: number) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Walls width={w} height={h} wall={HALF_W * viewScale(h)} />);
  });
  trees.push(tree);
  return tree;
}

/** Every piece of the room, as the style the renderer resolved it to. */
function pieces(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(View)
    .map(node => node.props.style)
    .filter((s): s is Record<string, number> => !!s && typeof s.left === 'number');
}

it('stands a wall exactly where the corridor ends, on every shape', async () => {
  for (const [w, h] of WINDOWS) {
    const half = HALF_W * viewScale(h);
    const faces = pieces(await room(w, h)).filter(s => s.width === 3);
    // One each side, and each one against the inside of its own edge: the
    // left wall's 3px sit just inside the corridor's left bound, the right
    // wall's just inside its right. A wall drawn a few px out is a wall the
    // ball dies against with daylight still showing.
    expect(faces).toHaveLength(2);
    expect(faces.map(s => s.left).sort((a, b) => a - b)).toEqual([w / 2 - half - 3, w / 2 + half]);
    // And both on the glass, with the corridor between them.
    for (const s of faces) {
      expect(s.left).toBeGreaterThanOrEqual(0);
      expect(s.left + 3).toBeLessThanOrEqual(w);
      expect(s.height).toBe(h);
    }
  }
});

it('never draws anything between the two walls but the glow off them', async () => {
  const [w, h] = [915, 412];
  const half = HALF_W * viewScale(h);
  for (const s of pieces(await room(w, h))) {
    const inside = s.left + s.width > w / 2 - half && s.left < w / 2 + half;
    if (!inside) continue;
    // The run is drawn over this layer, so anything laid across the corridor
    // is laid over the hazards: only the two lit faces and their 14px of glow
    // may reach in at all, and the glow at a tenth is an edge, not a wash.
    expect(s.width).toBeLessThanOrEqual(14);
    expect(s.opacity === undefined ? 1 : s.opacity).toBeLessThanOrEqual(0.55);
  }
});

it('falls away into the dark outward, rather than framing the corridor', async () => {
  const [w, h] = [915, 412];
  const half = HALF_W * viewScale(h);
  const bands = pieces(await room(w, h))
    // The water outside the right-hand wall, in the order it is drawn.
    .filter(s => s.left >= w / 2 + half && s.width > 14 && typeof s.opacity === 'number');
  expect(bands.length).toBeGreaterThan(3);
  const sorted = [...bands].sort((a, b) => a.left - b.left);
  for (let i = 1; i < sorted.length; i++) {
    // Lightest against the wall, darkest at the edge of the screen. The other
    // way round would draw a dark rule down each side of the corridor, which
    // is a frame around a portrait game rather than a room it sits in.
    expect(sorted[i].opacity).toBeGreaterThan(sorted[i - 1].opacity);
  }
  expect(sorted[0].opacity).toBeLessThan(0.2);
  expect(sorted[sorted.length - 1].opacity).toBeLessThan(0.6);
  // And the bands cover the whole band of water, edge to wall, with no gap.
  expect(sorted[0].left).toBeCloseTo(w / 2 + half, 6);
  const last = sorted[sorted.length - 1];
  expect(last.left + last.width).toBeCloseTo(w, 6);
});

it('puts the walls on the glass even in a window narrower than the corridor', async () => {
  // No phone is this shape, but a split screen and a freeform window can be
  // anything, and a wall off the side of its own viewport takes the lines and
  // launchers bolted to it with it.
  const faces = pieces(await room(240, 700)).filter(s => s.width === 3);
  expect(faces).toHaveLength(2);
  for (const s of faces) {
    expect(s.left).toBeGreaterThanOrEqual(0);
    expect(s.left + 3).toBeLessThanOrEqual(240);
  }
});
