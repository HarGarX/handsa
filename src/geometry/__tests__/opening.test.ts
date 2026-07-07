import { describe, expect, it } from 'vitest';
import type { Opening, Wall } from '../../types/plan';
import { clampOpeningT, isOpeningInvalid, openingExtent } from '../opening';

function makeWall(length: number, thickness = 15): Wall {
  return { id: 'w1', start: { x: 0, y: 0 }, end: { x: length, y: 0 }, thickness };
}

describe('openingExtent', () => {
  it('computes the tMin/tMax range for a centered opening', () => {
    const wall = makeWall(400);
    const opening: Opening = { id: 'o1', wallId: 'w1', type: 'door', t: 0.5, width: 90 };
    const ext = openingExtent(opening, wall);
    // half width in t units = 45/400 = 0.1125
    expect(ext.tMin).toBeCloseTo(0.5 - 0.1125, 9);
    expect(ext.tMax).toBeCloseTo(0.5 + 0.1125, 9);
  });
});

describe('isOpeningInvalid', () => {
  it('flags an opening wider than its wall', () => {
    const wall = makeWall(80);
    const opening: Opening = { id: 'o1', wallId: 'w1', type: 'door', t: 0.5, width: 90 };
    expect(isOpeningInvalid(opening, wall)).toBe(true);
  });

  it('does not flag an opening that fits', () => {
    const wall = makeWall(400);
    const opening: Opening = { id: 'o1', wallId: 'w1', type: 'door', t: 0.5, width: 90 };
    expect(isOpeningInvalid(opening, wall)).toBe(false);
  });
});

describe('clampOpeningT', () => {
  it('clamps a door so it cannot extend past the wall start', () => {
    const wall = makeWall(400);
    const t = clampOpeningT(wall, [], 'o1', -0.1, 90);
    const halfT = 45 / 400;
    expect(t).toBeCloseTo(halfT, 9);
  });

  it('clamps a door so it cannot extend past the wall end', () => {
    const wall = makeWall(400);
    const t = clampOpeningT(wall, [], 'o1', 1.5, 90);
    const halfT = 45 / 400;
    expect(t).toBeCloseTo(1 - halfT, 9);
  });

  it('prevents two openings on the same wall from overlapping', () => {
    const wall = makeWall(400);
    const existing: Opening = { id: 'o1', wallId: 'w1', type: 'window', t: 0.5, width: 120 };
    // Trying to drag a second 120cm-wide window so it overlaps the first (centered at 0.5).
    const t = clampOpeningT(wall, [existing], 'o2', 0.55, 120);
    const otherExtent = openingExtent(existing, wall);
    const halfT = 60 / 400;
    // Result must not overlap [otherExtent.tMin, otherExtent.tMax]
    const resultMin = t - halfT;
    const resultMax = t + halfT;
    const overlaps = resultMin < otherExtent.tMax && resultMax > otherExtent.tMin;
    expect(overlaps).toBe(false);
  });
});
