import {
  CEIL_X,
  FIXED_DT,
  SPIKE_REST,
  SPIKE_UP,
  SPIKE_WARN,
  spikeState,
} from '../config';
import { createWorld, lift, restartFromDeath, step } from '../engine';
import type { World } from '../types';

/** A world with the level stripped out, so only the floor is under test. */
function bare() {
  const w = createWorld();
  w.pace = 1;
  w.props = [];
  return w;
}

function run(w: World, seconds: number) {
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) step(w, FIXED_DT);
}

const CYCLE = SPIKE_REST + SPIKE_WARN + SPIKE_UP;

describe('the floor spikes', () => {
  it('rest, warn, stand up for two seconds, then go back down', () => {
    expect(spikeState(0)).toEqual({ out: 0, lethal: false });
    expect(spikeState(SPIKE_REST - 0.01).lethal).toBe(false);
    const warn = spikeState(SPIKE_REST + SPIKE_WARN / 2);
    expect(warn.lethal).toBe(false);
    expect(warn.out).toBeGreaterThan(0);
    expect(spikeState(SPIKE_REST + SPIKE_WARN + 0.5)).toEqual({ out: 1, lethal: true });
    expect(spikeState(CYCLE - 0.01).lethal).toBe(true);
    expect(SPIKE_UP).toBe(2);
    // And round again.
    expect(spikeState(CYCLE + 0.01)).toEqual({ out: 0, lethal: false });
    expect(spikeState(CYCLE + SPIKE_REST + SPIKE_WARN + 0.5).lethal).toBe(true);
  });

  it('leave a ball resting on the floor alone until they come up', () => {
    const w = bare();
    run(w, SPIKE_REST + SPIKE_WARN - 0.1);
    expect(w.status).toBe('playing');
  });

  it('end the run of a ball left on the floor once they are up', () => {
    const w = bare();
    run(w, SPIKE_REST + SPIKE_WARN + 0.3);
    expect(w.status).toBe('dead');
  });

  it('cannot reach a ball held up off the floor', () => {
    const w = bare();
    w.ball.fly = w.ball.x = CEIL_X;
    for (let i = 0; i < Math.round((CYCLE * 2) / FIXED_DT); i++) {
      // Tap a few times a second, as a player keeping it up would.
      if (i % 20 === 0) lift(w);
      step(w, FIXED_DT);
    }
    expect(w.status).toBe('playing');
  });

  it('start every retry from a bare floor', () => {
    const w = bare();
    run(w, SPIKE_REST + SPIKE_WARN + 0.3);
    expect(w.status).toBe('dead');
    restartFromDeath(w);
    expect(w.spikeClock).toBe(0);
    expect(spikeState(w.spikeClock).lethal).toBe(false);
  });

  it('do not count down while the run is not being played', () => {
    const w = bare();
    w.status = 'paused';
    run(w, CYCLE);
    expect(w.spikeClock).toBe(0);
  });
});
