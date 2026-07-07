import { describe, expect, it } from 'vitest';
import { snapAngle, snapPoint, snapPointToAngle, snapValue } from '../snapping';

describe('snapValue', () => {
  it('snaps to the nearest 5cm increment', () => {
    expect(snapValue(12, 5)).toBe(10);
    expect(snapValue(13, 5)).toBe(15);
    expect(snapValue(-3, 5)).toBe(-5);
  });

  it('snaps to the nearest 1cm increment (no-op for integers)', () => {
    expect(snapValue(7.4, 1)).toBe(7);
    expect(snapValue(7.6, 1)).toBe(8);
  });
});

describe('snapPoint', () => {
  it('snaps both coordinates when enabled', () => {
    expect(snapPoint({ x: 12, y: 18 }, 5, true)).toEqual({ x: 10, y: 20 });
  });

  it('returns the point unchanged when disabled', () => {
    const p = { x: 12.3, y: 18.7 };
    expect(snapPoint(p, 5, false)).toBe(p);
  });
});

describe('snapAngle', () => {
  it('snaps to 15 degree increments', () => {
    const rad = (7 * Math.PI) / 180; // 7deg -> should snap to 0
    expect(snapAngle(rad, 15)).toBeCloseTo(0, 9);
    const rad2 = (12 * Math.PI) / 180; // 12deg -> should snap to 15
    expect(snapAngle(rad2, 15)).toBeCloseTo((15 * Math.PI) / 180, 9);
  });
});

describe('snapPointToAngle', () => {
  it('preserves distance while snapping the angle', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 10 }; // close to 0deg, dist ~100.5
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const snapped = snapPointToAngle(start, end, 15);
    const newDist = Math.hypot(snapped.x - start.x, snapped.y - start.y);
    expect(newDist).toBeCloseTo(dist, 6);
    expect(snapped.y).toBeCloseTo(0, 6); // snapped to 0deg (horizontal)
  });
});
