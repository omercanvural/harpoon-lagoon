import { makeRng } from '../rng.js';
import { SPECIES, RARITY_ODDS, RARITY_POINTS } from './species.js';

// Turns a species recipe + seed into one concrete fish description ("spec").
// Pure data, no three.js, so it is cheap, testable and could be sent over a
// network or saved as "the fish you caught".

const roll = (rng, v) => (Array.isArray(v) ? rng.range(v[0], v[1]) : v);

function weighted(rng, pairs) {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let r = rng.next() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

// Nudge a hex colour's hue/lightness a little so no two fish match exactly.
function jitterColour(rng, hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (h + rng.range(-amount, amount) * 0.08 + 1) % 1;
  const l2 = Math.min(0.95, Math.max(0.05, l + rng.range(-amount, amount) * 0.06));
  const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s;
  const p = 2 * l2 - q;
  const hue = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(s === 0 ? l2 : hue(h + 1 / 3))}${to(s === 0 ? l2 : hue(h))}${to(s === 0 ? l2 : hue(h - 1 / 3))}`;
}

const GOLD = { back: '#e0a100', side: '#ffd34d', belly: '#fff2a8', accent: '#fff8d6', fin: '#ffcf33', tail: '#ffcf33', edge: '#b37a00' };

export function rollRarity(rng) {
  return weighted(rng, RARITY_ODDS);
}

export function makeFishSpec(speciesId, seed, opts = {}) {
  const recipe = SPECIES[speciesId];
  if (!recipe) throw new Error(`Unknown species: ${speciesId}`);
  const rng = makeRng(seed);

  const rarity = opts.rarity ?? (recipe.boss ? 'common' : rollRarity(rng));
  const basePalette = rng.pick(recipe.palettes);
  const palette = {};
  for (const [key, hex] of Object.entries(rarity === 'golden' ? { ...basePalette, ...GOLD } : basePalette)) {
    palette[key] = rarity === 'golden' ? hex : jitterColour(rng, hex, 1);
  }

  const fin = (f) =>
    f && { start: f.start, end: f.end, height: roll(rng, f.height), sweep: f.sweep };

  const length = roll(rng, recipe.size) * (rarity === 'common' ? 1 : 0.9);
  const speed = roll(rng, recipe.behaviour.speed) * (rarity === 'common' ? 1 : 1.35);

  return {
    species: speciesId,
    seed,
    rarity,
    length,
    body: {
      height: roll(rng, recipe.body.height),
      width: roll(rng, recipe.body.width),
      nose: recipe.body.nose * rng.range(0.92, 1.08),
      taper: recipe.body.taper,
      peduncle: recipe.body.peduncle,
    },
    tail: { type: recipe.tail.type, length: roll(rng, recipe.tail.length), span: roll(rng, recipe.tail.span) },
    dorsal: fin(recipe.dorsal),
    anal: fin(recipe.anal),
    pectoral: recipe.pectoral,
    eye: { size: roll(rng, recipe.eye.size), pos: recipe.eye.pos },
    palette,
    pattern: { type: weighted(rng, recipe.patterns), seed: rng.int(0, 1e9), count: rng.int(2, 4) },
    behaviour: {
      speed, // body lengths per second
      turn: recipe.behaviour.turn,
      points: Math.round(recipe.behaviour.points * RARITY_POINTS[rarity]),
    },
    boss: !!recipe.boss,
  };
}
