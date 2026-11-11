import { describe, it, expect } from 'vitest';
import { makeFishSpec } from '../src/fish/spec.js';
import { SPECIES } from '../src/fish/species.js';
import { buildFishGeometry } from '../src/fish/geometry.js';

describe('fish spec', () => {
  it('is deterministic for a species + seed', () => {
    expect(makeFishSpec('clown', 1234)).toEqual(makeFishSpec('clown', 1234));
  });

  it('varies between seeds', () => {
    const a = makeFishSpec('tang', 1);
    const b = makeFishSpec('tang', 2);
    expect(a.length).not.toBe(b.length);
  });

  it('honours a forced rarity and makes rare fish worth more', () => {
    const common = makeFishSpec('clown', 5, { rarity: 'common' });
    const golden = makeFishSpec('clown', 5, { rarity: 'golden' });
    expect(golden.rarity).toBe('golden');
    expect(golden.behaviour.points).toBeGreaterThan(common.behaviour.points);
  });

  it('rejects unknown species', () => {
    expect(() => makeFishSpec('kraken', 1)).toThrow();
  });
});

describe('fish geometry', () => {
  for (const species of Object.keys(SPECIES)) {
    it(`builds a valid mesh for ${species}`, () => {
      for (let seed = 0; seed < 5; seed++) {
        const geo = buildFishGeometry(makeFishSpec(species, seed));
        for (const part of [geo.body, geo.fins, geo.eyeWhites, geo.pupils]) {
          const pos = part.attributes.position.array;
          expect(pos.length).toBeGreaterThan(0);
          expect(pos.every(Number.isFinite)).toBe(true);
          expect(part.attributes.aFlap).toBeDefined();
        }
        // Fish fits in its unit length, nose at +0.5.
        geo.body.computeBoundingBox();
        expect(geo.body.boundingBox.max.z).toBeCloseTo(0.5, 2);
        expect(geo.body.boundingBox.min.z).toBeGreaterThan(-0.5);
      }
    });
  }
});
