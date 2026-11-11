import { describe, it, expect } from 'vitest';
import { pickAssistTarget, intercept, distToSegment, catchPoints, starsFor, angleOf } from '../src/game/assist.js';

const from = { x: 0, z: 6 };

describe('aim assist', () => {
  it('does nothing at helper level 0 (cone 0)', () => {
    expect(pickAssistTarget(from, 0, [{ x: 0, z: 0, vx: 0, vz: 0 }], 0, 20, 30)).toBeNull();
  });

  it('snaps to a fish inside the cone and ignores fish outside it', () => {
    const fish = [{ x: 1, z: 0, vx: 0, vz: 0 }, { x: -8, z: 0, vx: 0, vz: 0 }];
    const r = pickAssistTarget(from, 0, fish, 0.3, 20, 30);
    expect(r.index).toBe(0);
    expect(r.angle).toBeCloseTo(angleOf(1, -6), 5);
  });

  it('leads a moving fish', () => {
    const p = intercept(from, { x: 0, z: 0, vx: 5, vz: 0 }, 10);
    expect(p.x).toBeGreaterThan(2);
  });

  it('ignores fish out of range', () => {
    expect(pickAssistTarget(from, 0, [{ x: 0, z: -40, vx: 0, vz: 0 }], 0.5, 20, 20)).toBeNull();
  });
});

describe('scoring', () => {
  it('measures distance to a fish body segment', () => {
    expect(distToSegment(0, 1, -1, 0, 1, 0)).toBeCloseTo(1);
    expect(distToSegment(3, 0, -1, 0, 1, 0)).toBeCloseTo(2);
  });

  it('caps the combo bonus at 2x', () => {
    expect(catchPoints(100, 0)).toBe(100);
    expect(catchPoints(100, 2)).toBe(140);
    expect(catchPoints(100, 50)).toBe(200);
  });

  it('always gives at least one star', () => {
    expect(starsFor(0)).toBe(1);
    expect(starsFor(1000)).toBe(3);
    expect(starsFor(99999)).toBe(5);
  });
});
