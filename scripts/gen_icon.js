#!/usr/bin/env node
/**
 * BladeLoop app icon generator.
 *
 * Draws the launcher icon from scratch. There is no image tooling on the
 * build machines and no design source to import, so the mark is defined here
 * as maths and rasterised by a small software renderer. Everything is
 * supersampled once at high resolution and then area-resampled down to each
 * target, which keeps the 48px launcher as clean as the 1024 store icon.
 *
 * The mark: the ball the game is played with -- a glossy blue-violet bubble
 * with big eyes, blush and a smile -- on the lavender sky it flies under,
 * with a couple of bubbles and one red saw blade peeking in.
 *
 *   node scripts/gen_icon.js
 */
/* eslint-disable no-bitwise -- a PNG's CRC, row filters and colour packing are byte maths */
/* global Buffer */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ PNG -- */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Paeth predictor, per the PNG spec. */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Encodes 8-bit samples. `bpp` is 4 for RGBA, 3 for RGB -- the App Store icon may not carry alpha. */
function encodePNG(px, w, h, bpp) {
  const stride = w * bpp;
  const out = Buffer.alloc((stride + 1) * h);
  const prev = Buffer.alloc(stride);
  const cand = [];
  for (let f = 0; f < 5; f++) cand.push(Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride);
    let best = 0;
    let bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      const c = cand[f];
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0;
        const b = prev[i];
        const d = i >= bpp ? prev[i - bpp] : 0;
        let v;
        if (f === 0) v = row[i];
        else if (f === 1) v = row[i] - a;
        else if (f === 2) v = row[i] - b;
        else if (f === 3) v = row[i] - ((a + b) >> 1);
        else v = row[i] - paeth(a, b, d);
        v &= 0xff;
        c[i] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        best = f;
      }
    }
    out[y * (stride + 1)] = best;
    cand[best].copy(out, y * (stride + 1) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = bpp === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------- maths -- */

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => {
  const a = lo === undefined ? 0 : lo;
  const b = hi === undefined ? 1 : hi;
  return v < a ? a : v > b ? b : v;
};
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Samples a colour ramp of [stop, [r,g,b]] pairs. */
function ramp(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mix3(stops[i - 1][1], stops[i][1], k);
    }
  }
  return stops[stops.length - 1][1];
}

/* -------------------------------------------------------------- design -- */

const L = 1024; // logical canvas; every measurement below is in these units

// The sky the game is played under: lavender at the top, blush at the bottom.
const SKY_HI = rgb(0x7f6cf0);
const SKY_LO = rgb(0xf0dcff);
const CLOUD = rgb(0xffffff);

// The ball, as the game draws it: a glossy blue-violet bubble with a dark rim.
const BODY_LO = rgb(0x4a2fd0);
const BODY_HI = rgb(0x9fb2ff);
const RIM = rgb(0x24135e);
const HALO = rgb(0xc9b8ff);
const INK = rgb(0x1c1147);
const BLUSH = rgb(0xff86c4);
const TONGUE = rgb(0xff6f9e);

// The saw blade peeking in, red with the dark ring and white eye it has in game.
const SAW = rgb(0xf0365a);
const SAW_DARK = rgb(0x2a0f2f);

/** Every distance the mark needs, for a mark box of `markScale` of the canvas. */
function geometry(markScale) {
  const u = L * markScale;
  const g = { u, cx: L / 2 - 0.02 * u, cy: L / 2 + 0.04 * u, R: 0.3 * u };
  // the saw, up and to the right of the ball
  g.sx = g.cx + 0.33 * u;
  g.sy = g.cy - 0.3 * u;
  g.sr = 0.085 * u;
  // two small bubbles drifting up on the left
  g.bubbles = [
    [g.cx - 0.36 * u, g.cy - 0.26 * u, 0.055 * u],
    [g.cx - 0.27 * u, g.cy - 0.39 * u, 0.032 * u],
  ];
  return g;
}

function circleSD(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

/** Approximate distance to an axis-aligned ellipse, good enough at these sizes. */
function ellipseSD(x, y, cx, cy, a, b) {
  return (Math.hypot((x - cx) / a, (y - cy) / b) - 1) * Math.min(a, b);
}

/** A rotated ellipse, for the tilted gloss. */
function tiltedSD(x, y, cx, cy, a, b, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const dx = x - cx;
  const dy = y - cy;
  return ellipseSD(dx * c + dy * s, -dx * s + dy * c, 0, 0, a, b);
}

/** The saw: a disc with ten teeth round its edge. */
function sawSD(g, x, y) {
  const dx = x - g.sx;
  const dy = y - g.sy;
  const turns = ((Math.atan2(dy, dx) + 0.2) / TAU) * 10;
  const tooth = 1 - Math.abs((turns - Math.floor(turns)) * 2 - 1);
  return Math.hypot(dx, dy) - g.sr * (0.84 + 0.2 * tooth);
}

function roundRectSD(x, y, half, rad) {
  const qx = Math.abs(x - L / 2) - (half - rad);
  const qy = Math.abs(y - L / 2) - (half - rad);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - rad;
}

/** Cloud puffs along the bottom of the sky, and two up in the top corner. */
const PUFFS = [
  [0.12, 1.02, 0.2],
  [0.34, 0.97, 0.17],
  [0.58, 1.04, 0.22],
  [0.86, 0.95, 0.19],
  [0.95, 0.2, 0.13],
  [0.82, 0.14, 0.1],
];

/* ------------------------------------------------------------ renderer -- */

const SS = 3; // samples per axis

/**
 * Renders once at `size * SS` and returns a premultiplied RGBA buffer at that
 * resolution, ready to be resampled down to any target.
 */
function render(cfg) {
  const S = cfg.size * SS;
  const buf = new Float64Array(S * S * 4);
  const g = geometry(cfg.markScale);
  const aa = L / S; // one sample, in logical units
  const half = L / 2;
  const maskRad = 0.215 * L;
  const R = g.R;
  const skyMid = mix3(SKY_HI, SKY_LO, 0.55);

  for (let sy = 0; sy < S; sy++) {
    const y = ((sy + 0.5) / S) * L;
    for (let sx = 0; sx < S; sx++) {
      const x = ((sx + 0.5) / S) * L;

      // premultiplied accumulator
      let pr = 0;
      let pg = 0;
      let pb = 0;
      let pa = 0;
      const over = (c, a) => {
        if (a <= 0) return;
        const k = 1 - a;
        pr = c[0] * a + pr * k;
        pg = c[1] * a + pg * k;
        pb = c[2] * a + pb * k;
        pa = a + pa * k;
      };
      const cov = (d) => clamp(0.5 - d / aa);

      /* 1. sky, with a bank of cloud along the bottom */
      if (cfg.bg) {
        over(
          ramp(
            [
              [0, SKY_HI],
              [0.55, skyMid],
              [1, SKY_LO],
            ],
            y / L,
          ),
          1,
        );
        let dc = 1e9;
        for (const p of PUFFS) dc = Math.min(dc, circleSD(x, y, p[0] * L, p[1] * L, p[2] * L));
        over(CLOUD, 0.55 * smoothstep(0.02 * L, -0.03 * L, dc));
      }

      if (cfg.mark) {
        const dBall = circleSD(x, y, g.cx, g.cy, R);
        const dSaw = sawSD(g, x, y);

        if (cfg.mono) {
          // Themed icon: the ball's silhouette and the saw, with the face cut
          // out of it -- eyes with their pupils left in, a smile, and the shine
          // -- so it still reads as the character in one colour.
          let a = Math.max(cov(dBall), cov(dSaw));
          for (const b of g.bubbles) {
            a = Math.max(a, cov(Math.abs(circleSD(x, y, b[0], b[1], b[2])) - 0.012 * g.u));
          }
          let hole = 0;
          let fill = 0;
          for (const side of [-1, 1]) {
            const ex = g.cx + side * 0.3 * R;
            const ey = g.cy - 0.04 * R;
            hole = Math.max(hole, cov(circleSD(x, y, ex, ey, 0.19 * R)));
            fill = Math.max(fill, cov(circleSD(x, y, ex + 0.04 * R, ey + 0.03 * R, 0.12 * R)));
            fill *= 1 - cov(circleSD(x, y, ex - 0.01 * R, ey - 0.03 * R, 0.045 * R));
          }
          const my = g.cy + 0.24 * R;
          hole = Math.max(hole, cov(Math.max(circleSD(x, y, g.cx, my, 0.16 * R), my - y)));
          hole = Math.max(hole, cov(tiltedSD(x, y, g.cx - 0.4 * R, g.cy - 0.52 * R, 0.3 * R, 0.14 * R, -0.6)));
          a = Math.max(a * (1 - hole), fill);
          over([1, 1, 1], a);
        } else {
          /* 2. soft halo and a faint ring, as the ball wears in game */
          if (dBall > 0) over(HALO, 0.55 * Math.exp(-Math.pow(dBall / (0.16 * R), 2) * 0.9));
          over(HALO, 0.35 * cov(Math.abs(circleSD(x, y, g.cx, g.cy, R * 1.28)) - 0.012 * g.u));

          /* 3. the bubbles: thin rings with a glint */
          for (const b of g.bubbles) {
            const d = circleSD(x, y, b[0], b[1], b[2]);
            over([1, 1, 1], 0.28 * cov(d));
            over([1, 1, 1], 0.9 * cov(Math.abs(d) - 0.009 * g.u));
            over([1, 1, 1], cov(circleSD(x, y, b[0] - b[2] * 0.4, b[1] - b[2] * 0.4, b[2] * 0.22)));
          }

          /* 4. the saw, with a drop shadow */
          over(INK, 0.25 * smoothstep(0.03 * g.u, -0.01 * g.u, sawSD(g, x, y - 0.015 * g.u)));
          over(SAW, cov(dSaw));
          over(SAW_DARK, cov(circleSD(x, y, g.sx, g.sy, g.sr * 0.42)));
          over([1, 1, 1], cov(circleSD(x, y, g.sx, g.sy, g.sr * 0.17)));

          /* 5. the ball's shadow, then its dark rim */
          over(INK, 0.3 * smoothstep(0.05 * g.u, -0.02 * g.u, circleSD(x, y, g.cx, g.cy + 0.03 * g.u, R)));
          over(RIM, cov(dBall));

          /* 6. the glossy body, lit from the top left */
          const aBody = cov(circleSD(x, y, g.cx, g.cy, R * 0.9));
          if (aBody > 0) {
            const nx = (x - g.cx) / (R * 0.9);
            const ny = (y - g.cy) / (R * 0.9);
            const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            const lam = clamp(-0.45 * nx - 0.55 * ny + 0.7 * nz);
            over(mix3(BODY_LO, BODY_HI, Math.pow(lam, 1.1)), aBody);
          }

          /* 7. the gloss: a big tilted streak and a dot */
          over([1, 1, 1], 0.85 * cov(tiltedSD(x, y, g.cx - 0.4 * R, g.cy - 0.52 * R, 0.3 * R, 0.14 * R, -0.6)));
          over([1, 1, 1], 0.9 * cov(circleSD(x, y, g.cx - 0.66 * R, g.cy - 0.2 * R, 0.06 * R)));

          /* 8. the face: eyes with a sparkle, blush, and an open smile */
          for (const side of [-1, 1]) {
            const ex = g.cx + side * 0.3 * R;
            const ey = g.cy - 0.04 * R;
            over(INK, cov(circleSD(x, y, ex, ey, 0.225 * R)));
            over([1, 1, 1], cov(circleSD(x, y, ex, ey, 0.19 * R)));
            over(INK, cov(circleSD(x, y, ex + 0.04 * R, ey + 0.03 * R, 0.12 * R)));
            over([1, 1, 1], cov(circleSD(x, y, ex - 0.01 * R, ey - 0.03 * R, 0.045 * R)));
            over(BLUSH, 0.75 * cov(ellipseSD(x, y, g.cx + side * 0.58 * R, g.cy + 0.25 * R, 0.14 * R, 0.08 * R)));
          }
          const mx = g.cx;
          const my = g.cy + 0.24 * R;
          const dMouth = Math.max(circleSD(x, y, mx, my, 0.16 * R), my - y);
          over(INK, cov(dMouth));
          over(TONGUE, cov(Math.max(dMouth + 0.02 * R, circleSD(x, y, mx, my + 0.15 * R, 0.1 * R))));
        }
      }

      /* 9. mask, plus a lit bevel on the edge */
      if (cfg.mask !== 'none') {
        const dm = cfg.mask === 'round' ? circleSD(x, y, half, half, half) : roundRectSD(x, y, half, maskRad);
        if (cfg.bg) {
          const up = clamp(-(y - half) / half);
          const band = smoothstep(-0.007 * L, -0.002 * L, dm) * smoothstep(0, -0.0015 * L, dm);
          over([1, 1, 1], band * 0.2 * Math.pow(up, 1.3));
        }
        const m = cov(dm);
        pr *= m;
        pg *= m;
        pb *= m;
        pa *= m;
      }

      const o = (sy * S + sx) * 4;
      buf[o] = pr;
      buf[o + 1] = pg;
      buf[o + 2] = pb;
      buf[o + 3] = pa;
    }
  }
  return { buf, S };
}

/* ------------------------------------------------------------- output -- */

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Area-averages down to `n` px, unpremultiplies, dithers, encodes. */
function emit(src, n, file, opts) {
  const alpha = !opts || opts.alpha !== false;
  const buf = src.buf;
  const S = src.S;
  const bpp = alpha ? 4 : 3;
  const px = Buffer.alloc(n * n * bpp);
  const scale = S / n;
  for (let y = 0; y < n; y++) {
    const y0 = y * scale;
    const y1 = y0 + scale;
    for (let x = 0; x < n; x++) {
      const x0 = x * scale;
      const x1 = x0 + scale;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let wsum = 0;
      for (let sy = Math.floor(y0); sy < Math.min(S, Math.ceil(y1)); sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        for (let sx = Math.floor(x0); sx < Math.min(S, Math.ceil(x1)); sx++) {
          const w = wy * (Math.min(x1, sx + 1) - Math.max(x0, sx));
          const o = (sy * S + sx) * 4;
          r += buf[o] * w;
          g += buf[o + 1] * w;
          b += buf[o + 2] * w;
          a += buf[o + 3] * w;
          wsum += w;
        }
      }
      r /= wsum;
      g /= wsum;
      b /= wsum;
      a /= wsum;
      if (a > 1e-6) {
        r /= a;
        g /= a;
        b /= a;
      }
      const d = (BAYER[y & 3][x & 3] / 16 - 0.5) / 255;
      const o = (y * n + x) * bpp;
      px[o] = clamp(r + d) * 255 + 0.5;
      px[o + 1] = clamp(g + d) * 255 + 0.5;
      px[o + 2] = clamp(b + d) * 255 + 0.5;
      if (alpha) px[o + 3] = clamp(a) * 255 + 0.5;
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(px, n, n, bpp));
  console.log('  ' + path.relative(ROOT, file).replace(/\\/g, '/') + '  ' + n + 'px');
}

/** [density, legacy px, adaptive px] */
const DPI = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];

const IOS = [
  ['Icon-20@2x.png', 40],
  ['Icon-20@3x.png', 60],
  ['Icon-29@2x.png', 58],
  ['Icon-29@3x.png', 87],
  ['Icon-40@2x.png', 80],
  ['Icon-40@3x.png', 120],
  ['Icon-60@2x.png', 120],
  ['Icon-60@3x.png', 180],
  ['Icon-1024.png', 1024],
];

/** `--preview <dir>` renders the square and one launcher-size icon, and stops. */
function preview(dir) {
  emit(render({ size: 512, markScale: 1, bg: true, mark: true, mask: 'none' }), 512, path.join(dir, 'preview.png'), {
    alpha: false,
  });
  emit(render({ size: 96, markScale: 1, bg: true, mark: true, mask: 'rect' }), 96, path.join(dir, 'preview-96.png'));
}

function main() {
  const pv = process.argv.indexOf('--preview');
  if (pv !== -1) {
    preview(process.argv[pv + 1]);
    return;
  }
  const res = path.join(ROOT, 'android/app/src/main/res');
  const ios = path.join(ROOT, 'ios/BladeLoop/Images.xcassets/AppIcon.appiconset');
  const brand = path.join(ROOT, 'docs/branding');

  // iOS masks the corners itself, so its art is a full-bleed square with no alpha.
  console.log('square (iOS + store)');
  const square = render({ size: 1024, markScale: 1, bg: true, mark: true, mask: 'none' });
  for (const entry of IOS) emit(square, entry[1], path.join(ios, entry[0]), { alpha: false });
  emit(square, 1024, path.join(brand, 'icon-master-1024.png'), { alpha: false });
  emit(square, 512, path.join(brand, 'playstore-icon-512.png'), { alpha: false });

  console.log('legacy launcher');
  const rounded = render({ size: 512, markScale: 1, bg: true, mark: true, mask: 'rect' });
  const round = render({ size: 512, markScale: 1, bg: true, mark: true, mask: 'round' });
  for (const d of DPI) {
    emit(rounded, d[1], path.join(res, 'mipmap-' + d[0], 'ic_launcher.png'));
    emit(round, d[1], path.join(res, 'mipmap-' + d[0], 'ic_launcher_round.png'));
  }

  console.log('adaptive');
  // two thirds of the 108dp canvas keeps the whole mark inside the 66dp safe zone
  const fg = render({ size: 512, markScale: 2 / 3, bg: false, mark: true, mask: 'none' });
  const bg = render({ size: 512, markScale: 1, bg: true, mark: false, mask: 'none' });
  const mono = render({ size: 512, markScale: 2 / 3, bg: false, mark: true, mask: 'none', mono: true });
  for (const d of DPI) {
    emit(fg, d[2], path.join(res, 'mipmap-' + d[0], 'ic_launcher_foreground.png'));
    emit(bg, d[2], path.join(res, 'mipmap-' + d[0], 'ic_launcher_background.png'));
    emit(mono, d[2], path.join(res, 'mipmap-' + d[0], 'ic_launcher_monochrome.png'));
  }

  const xml =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
    '    <background android:drawable="@mipmap/ic_launcher_background" />\n' +
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n' +
    '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n' +
    '</adaptive-icon>\n';
  const anydpi = path.join(res, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpi, { recursive: true });
  for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    fs.writeFileSync(path.join(anydpi, f), xml);
    console.log('  android/app/src/main/res/mipmap-anydpi-v26/' + f);
  }

  const contents = {
    images: IOS.map((entry) => {
      const filename = entry[0];
      if (entry[1] === 1024) {
        return { filename: filename, idiom: 'ios-marketing', scale: '1x', size: '1024x1024' };
      }
      const m = filename.match(/Icon-(\d+)@(\d)x/);
      return { filename: filename, idiom: 'iphone', scale: m[2] + 'x', size: m[1] + 'x' + m[1] };
    }),
    info: { author: 'xcode', version: 1 },
  };
  fs.writeFileSync(path.join(ios, 'Contents.json'), JSON.stringify(contents, null, 2) + '\n');
  console.log('  ios/BladeLoop/Images.xcassets/AppIcon.appiconset/Contents.json');
}

main();
