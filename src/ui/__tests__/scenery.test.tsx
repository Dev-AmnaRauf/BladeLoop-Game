/**
 * What each world draws behind its corridor.
 *
 * No test here asserts on a colour -- the device is the check for that -- but
 * every world has to build, stay out of the way of a touch, and hold still
 * when the camera does, the same three promises the water made.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { View } from 'react-native';
import { WORLDS } from '../../game/worlds';
import Scenery from '../Scenery';

const W = 390;
const H = 844;

async function draw(world: (typeof WORLDS)[number]['id'], camY: number) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<Scenery world={world} camY={camY} width={W} height={H} />);
  });
  return tree;
}

describe.each(WORLDS.map(w => [w.id] as const))('%s scenery', id => {
  it('builds, and never takes a touch', async () => {
    const tree = await draw(id, 1200);
    const root = tree.root.findAllByType(View)[0];
    expect(root.props.pointerEvents).toBe('none');
    expect(tree.root.findAllByType(View).length).toBeGreaterThan(10);
    await ReactTestRenderer.act(() => tree.unmount());
  });

  it('draws the same thing twice for the same camera', async () => {
    const a = await draw(id, 5000);
    const b = await draw(id, 5000);
    expect(JSON.stringify(a.toJSON())).toBe(JSON.stringify(b.toJSON()));
    await ReactTestRenderer.act(() => {
      a.unmount();
      b.unmount();
    });
  });
});
