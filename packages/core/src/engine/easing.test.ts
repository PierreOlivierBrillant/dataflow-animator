import { describe, expect, it } from 'vitest';
import { easeTravel } from './easing';
import { easeInOutCubic } from './timeline';

describe('easeTravel', () => {
  it('starts at 0 and finishes at 1', () => {
    expect(easeTravel(0)).toBe(0);
    expect(easeTravel(1)).toBe(1);
  });

  it('clamps outside [0, 1]', () => {
    expect(easeTravel(-0.5)).toBe(0);
    expect(easeTravel(1.5)).toBe(1);
  });

  it('never goes backwards', () => {
    let previous = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const value = easeTravel(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('stays inside [0, 1] throughout — no overshoot', () => {
    for (let i = 0; i <= 100; i++) {
      const value = easeTravel(i / 100);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('is ASYMMETRIC — the property the symmetric cubic lacks', () => {
    // A symmetric curve satisfies f(t) + f(1-t) === 1 everywhere. That identity
    // is exactly what this curve breaks, and breaking it is the point.
    const symmetry = (f: (t: number) => number, t: number) => f(t) + f(1 - t);
    expect(symmetry(easeInOutCubic, 0.25)).toBeCloseTo(1, 6);
    expect(symmetry(easeTravel, 0.25)).not.toBeCloseTo(1, 2);
  });

  it('spends the back half settling, so the packet arrives rather than stops', () => {
    // Past the midpoint it is already most of the way there, leaving the rest
    // of the time to close the last stretch slowly.
    expect(easeTravel(0.5)).toBeGreaterThan(easeInOutCubic(0.5));
    expect(easeTravel(0.8)).toBeGreaterThan(0.95);
  });

  it('leaves at a decided pace rather than creeping off', () => {
    // A tenth of the way through the time, a visible fraction of the trip is
    // already covered — otherwise the departure reads as hesitation.
    expect(easeTravel(0.1)).toBeGreaterThan(easeInOutCubic(0.1));
  });
});
