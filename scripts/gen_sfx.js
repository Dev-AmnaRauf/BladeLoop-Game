/* Generates the BladeLoop SFX as 16-bit mono WAVs. Synthesised tones, so the
 * set is licence-free and each event is audibly distinct from its neighbours. */
const fs = require('fs');
const path = require('path');

const SR = 22050;
const OUT = process.argv[2];

function wav(samples) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);   // PCM
  b.writeUInt16LE(1, 22);   // mono
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return b;
}

const len = sec => Math.round(sec * SR);

/** One note. `harm` are amplitudes of harmonics 1..n; `decay` is the time
 *  constant of the exponential fall, in seconds. */
function note(freq, dur, { harm = [1], decay = 0.08, gain = 0.5, sweepTo = null } = {}) {
  const n = len(dur);
  const out = new Float32Array(n);
  const attack = len(0.004);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = sweepTo == null ? freq : freq + (sweepTo - freq) * (i / n);
    let v = 0;
    for (let h = 0; h < harm.length; h++) {
      v += harm[h] * Math.sin(2 * Math.PI * f * (h + 1) * t);
    }
    let env = Math.exp(-t / decay);
    if (i < attack) env *= i / attack;              // no click on the way in
    if (i > n - attack) env *= (n - i) / attack;    // nor on the way out
    out[i] = v * env * gain;
  }
  return out;
}

function noise(dur, { decay = 0.05, gain = 0.4 } = {}) {
  const n = len(dur);
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // Lightly low-passed white noise -- a thud rather than a hiss.
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
    out[i] = last * Math.exp(-t / decay) * gain;
  }
  return out;
}

const silence = dur => new Float32Array(len(dur));

function concat(...parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Overlays parts at offset 0, sized to the longest -- lets notes ring on. */
function mix(...parts) {
  const n = Math.max(...parts.map(p => p.length));
  const out = new Float32Array(n);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

/** Pads `p` with `dur` of leading silence, for laying notes out in time. */
const at = (dur, p) => concat(silence(dur), p);

// Equal temperament, A4 = 440.
const HZ = {
  C4: 261.63, EB4: 311.13, G4: 392.0,
  C5: 523.25, E5: 659.26, G5: 783.99, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
};

const BELL = [1, 0.35, 0.12];
const ARCADE = [1, 0, 0.3];

const SOUNDS = {
  // Generic UI tap: one dry blip, deliberately plain so it never competes
  // with the event sounds below.
  'button.wav': note(760, 0.09, { harm: [1, 0.25], decay: 0.025, gain: 0.45 }),

  // Starting a run: a rising major triad, the longest and brightest cue here.
  'start.wav': mix(
    note(HZ.C5, 0.34, { harm: BELL, decay: 0.13, gain: 0.3 }),
    at(0.065, note(HZ.E5, 0.30, { harm: BELL, decay: 0.13, gain: 0.3 })),
    at(0.130, note(HZ.G5, 0.26, { harm: BELL, decay: 0.14, gain: 0.3 })),
    at(0.195, note(HZ.C6, 0.24, { harm: BELL, decay: 0.16, gain: 0.32 })),
  ),

  // Passing a flag: two quick notes a fifth up. Shorter and higher than the
  // start cue, so it reads as progress mid-run without stopping the ear.
  'checkpoint.wav': mix(
    note(HZ.G5, 0.20, { harm: BELL, decay: 0.07, gain: 0.34 }),
    at(0.075, note(HZ.D6, 0.20, { harm: BELL, decay: 0.10, gain: 0.36 })),
  ),

  // Coin: the classic two-note arcade pickup, thinner than the flag so a
  // string of them stays in the background.
  'coin.wav': concat(
    note(HZ.B5, 0.055, { harm: ARCADE, decay: 0.05, gain: 0.26 }),
    note(HZ.E6, 0.13, { harm: ARCADE, decay: 0.055, gain: 0.26 }),
  ),

  // Hitting a blade: a thud plus a fast downward sweep. Fires on impact.
  'collision.wav': mix(
    noise(0.16, { decay: 0.035, gain: 0.5 }),
    note(300, 0.26, { harm: [1, 0.4], decay: 0.075, gain: 0.42, sweepTo: 80 }),
  ),

  // Game over: a falling minor triad, played when the card comes up -- the
  // run's full stop, distinct from the impact that caused it.
  'gameover.wav': mix(
    note(HZ.G4, 0.48, { harm: BELL, decay: 0.18, gain: 0.28 }),
    at(0.145, note(HZ.EB4, 0.44, { harm: BELL, decay: 0.18, gain: 0.28 })),
    at(0.290, note(HZ.C4, 0.42, { harm: BELL, decay: 0.24, gain: 0.30 })),
  ),

  // Reviving: an upward sweep -- the start cue's shape, without its finality.
  'revive.wav': note(280, 0.40, { harm: [1, 0.3, 0.1], decay: 0.22, gain: 0.32, sweepTo: 880 }),
};

for (const [name, samples] of Object.entries(SOUNDS)) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, wav(samples));
  console.log(name, fs.statSync(p).size, 'bytes');
}
