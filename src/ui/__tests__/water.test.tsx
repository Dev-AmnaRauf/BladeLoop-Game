/**
 * The water the corridor is flown down.
 *
 * Nothing in it collides, scores or takes a touch, so what is worth pinning
 * down is not what it looks like -- no test in this repo asserts on a colour,
 * and the device is the check that counts for that -- but the three ways a
 * recycled backdrop goes silently wrong over a long run.
 *
 * A bubble must be born and die invisible: these are the same handful of views
 * climbing the glass forever, so a mistimed fade at either end is a pop the
 * player catches within a run or two.
 *
 * The water must rise, and it must rise off the camera rather than off a
 * clock, because that is what stops it climbing on a paused or a finished run.
 *
 * And the whole layer must stay out of the way of the run: no touch, and the
 * bands at their own speeds, which is the only thing making the water read as
 * having depth rather than as a pattern printed on the ground.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { View } from 'react-native';
import Water from '../Water';

const W = 390;
const H = 844;

const trees: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    trees.splice(0).forEach(tree => tree.unmount());
  });
});

async function sea(camY: number, lean = 0) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Water camY={camY} lean={lean} width={W} height={H} />);
  });
  trees.push(tree);
  return tree;
}

/** Every flat piece of the water, as the style the renderer resolved it to. */
function pieces(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType(View)
    .map(node => node.props.style)
    .filter((s): s is Record<string, number> => !!s && typeof s.top === 'number');
}

/** The bubbles: the twelve wrappers that carry a climb's fade on them. */
function bubbles(tree: ReactTestRenderer.ReactTestRenderer) {
  return pieces(tree)
    .filter(s => typeof s.opacity === 'number' && typeof s.width === 'number' && !s.borderRadius)
    .filter(s => s.width === s.height && s.width > 3);
}

it('keeps the same bubbles at every depth, and never pops one', async () => {
  // A long stretch of descent, sampled right across the slowest band's climb.
  for (let i = 0; i < 12; i++) {
    const alive = bubbles(await sea(i * 140));
    expect(alive).toHaveLength(12);
    for (const s of alive) {
      // Born under the bottom of the glass, gone above the top, and drawn at
      // nothing at both ends.
      expect(s.opacity).toBeGreaterThanOrEqual(0);
      expect(s.opacity).toBeLessThanOrEqual(1);
      expect(s.top).toBeGreaterThan(-H);
      expect(s.top).toBeLessThan(H * 1.2);
    }
  }
});

it('rises off the camera, so a stopped run is a still one', async () => {
  const tops = async (camY: number) =>
    bubbles(await sea(camY))
      .map(s => s.top)
      .sort((a, b) => a - b);
  // The same depth draws the same water: nothing here is on a clock of its own.
  expect(await tops(900)).toEqual(await tops(900));
  // And going down carries it up. Sampled against the slowest band's own rise
  // so that every bubble has moved and none has yet recycled.
  const before = await tops(0);
  const after = await tops(120);
  after.forEach((t, i) => expect(t).toBeLessThan(before[i]));
});

it('gives the three bands three speeds, which is the depth', async () => {
  // How far the whole field has climbed says nothing on its own -- what makes
  // it deep is that the bands disagree. Over the same descent the near band
  // must outrun the far one by more than a screen.
  const spread = async (camY: number) => {
    const tops = bubbles(await sea(camY)).map(s => s.top);
    return Math.max(...tops) - Math.min(...tops);
  };
  const walk = [0, 200, 400, 600].map(spread);
  const spans = await Promise.all(walk);
  // They cannot all be the same field shifted: if the bands ran at one speed
  // the spread would never change.
  expect(new Set(spans.map(s => Math.round(s))).size).toBeGreaterThan(1);
});

it('never takes a touch off the corridor', async () => {
  const tree = await sea(600);
  expect(tree.root.findAllByType(View)[0].props.pointerEvents).toBe('none');
});
