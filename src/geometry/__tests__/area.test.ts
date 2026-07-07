import { describe, expect, it } from 'vitest';
import { polygonArea, polygonAreaM2, signedArea } from '../area';

describe('shoelace area', () => {
  it('computes the area of a 500cm x 400cm rectangle', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ];
    expect(polygonArea(points)).toBeCloseTo(200_000, 6); // cm^2
    expect(polygonAreaM2(points)).toBeCloseTo(20, 6); // 20 m^2, matches the acceptance test
  });

  it('returns positive area for CCW winding and negative for CW winding', () => {
    const ccw = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const cw = [...ccw].reverse();
    expect(signedArea(ccw)).toBeGreaterThan(0);
    expect(signedArea(cw)).toBeLessThan(0);
  });

  it('computes the area of a right triangle', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(polygonArea(points)).toBeCloseTo(5000, 6);
  });
});
