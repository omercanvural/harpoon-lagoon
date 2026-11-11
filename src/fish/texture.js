import * as THREE from 'three';
import { makeRng } from '../rng.js';

// Paints a fish's body texture from its spec.
// Texture space: u = 0 at the nose .. 1 at the tail, v wraps around the body
// (v = 0.75 is the top of the back, v = 0.25 the belly).

const W = 256;
const H = 128;

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Each pattern returns null (keep base colour) or { colour, amount }.
const PATTERNS = {
  plain: () => () => null,

  sideStripe: (spec, c) => (u, top) => {
    const d = Math.abs(top - 0.12);
    if (u < 0.12 || u > 0.97) return null;
    return { colour: c.accent, amount: 1 - smooth(0.05, 0.09, d) };
  },

  // Clownfish / angelfish style vertical bands, with a dark edge if the palette has one.
  bands: (spec, c) => {
    const n = spec.species === 'clown' ? 3 : spec.pattern.count + 1;
    const centres = Array.from({ length: n }, (_, i) =>
      spec.species === 'clown' ? [0.2, 0.52, 0.88][i] : 0.18 + (0.72 * i) / Math.max(1, n - 1));
    const half = spec.species === 'clown' ? 0.06 : 0.035;
    return (u, top) => {
      let best = 1;
      for (const cx of centres) best = Math.min(best, Math.abs(u - cx - top * 0.03));
      if (c.edge && best < half + 0.018) {
        return best < half ? { colour: c.accent, amount: 1 } : { colour: c.edge, amount: 1 };
      }
      return { colour: c.accent, amount: 1 - smooth(half - 0.01, half + 0.01, best) };
    };
  },

  // Blue-tang style dark "saddle" shape along the upper side.
  saddle: (spec, c) => (u, top) => {
    if (u < 0.12 || u > 0.9) return null;
    const centre = 0.25 + 0.25 * Math.sin(Math.PI * (u - 0.12) / 0.78);
    const d = Math.abs(top - centre) - 0.18 * Math.sin(Math.PI * (u - 0.12) / 0.78);
    return { colour: c.accent, amount: 1 - smooth(-0.02, 0.03, d) };
  },

  spots: (spec, c) => {
    const rng = makeRng(spec.pattern.seed);
    // Measure in fish-length units so spots stay round on any body shape.
    const uLen = 1 - spec.tail.length;
    const circ = Math.PI * (spec.body.height + spec.body.width) * 0.8;
    const spots = Array.from({ length: 26 + spec.pattern.count * 4 }, () => ({
      u: rng.range(0.15, 0.9),
      v: rng.range(0.42, 1.08) % 1,
      r: rng.range(0.022, 0.035),
    }));
    return (u, top, v) => {
      for (const s of spots) {
        let dv = Math.abs(v - s.v);
        dv = Math.min(dv, 1 - dv);
        const d = Math.hypot((u - s.u) * uLen, dv * circ);
        if (d < s.r) return { colour: c.accent, amount: 1 - smooth(s.r * 0.75, s.r, d) };
      }
      return null;
    };
  },
};

export function paintBodyTexture(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  const c = {};
  for (const [k, hex] of Object.entries(spec.palette)) c[k] = hexToRgb(hex);
  const pattern = (PATTERNS[spec.pattern.type] ?? PATTERNS.plain)(spec, c);
  const white = [255, 255, 255];

  for (let y = 0; y < H; y++) {
    // Canvas row 0 is the top of the image = v 1 (CanvasTexture flips Y by default).
    const v = 1 - (y + 0.5) / H;
    const t = v * Math.PI * 2 - Math.PI;
    const top = Math.sin(t);
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      // Countershading: darker back, lighter belly, like real fish.
      let col = mix(c.belly, c.side, smooth(-0.85, 0.0, top));
      col = mix(col, c.back, smooth(0.0, 0.85, top));
      const p = pattern(u, top, v);
      if (p) col = mix(col, p.colour, p.amount);
      // Soft white cheek / gill line for a friendly face.
      if (u > 0.21 && u < 0.24 && top > -0.3 && top < 0.5) col = mix(col, white, 0.18);
      // Darken the very nose a touch so the face reads.
      if (u < 0.04) col = mix(col, [30, 30, 40], (0.04 - u) * 6);
      const i = (y * W + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
