import { describe, expect, it } from 'vitest';
import { normalizeRect, pointInRect } from '../rect';

describe('normalizeRect', () => {
  it('normalizes corners regardless of drag direction', () => {
    const rect = normalizeRect({ x: 100, y: 100 }, { x: 0, y: 50 });
    expect(rect).toEqual({ minX: 0, minY: 50, maxX: 100, maxY: 100 });
  });
});

describe('pointInRect', () => {
  const rect = normalizeRect({ x: 0, y: 0 }, { x: 100, y: 100 });

  it('returns true for a point inside the rect', () => {
    expect(pointInRect({ x: 50, y: 50 }, rect)).toBe(true);
  });

  it('returns true for a point exactly on the boundary', () => {
    expect(pointInRect({ x: 0, y: 100 }, rect)).toBe(true);
  });

  it('returns false for a point outside the rect', () => {
    expect(pointInRect({ x: 150, y: 50 }, rect)).toBe(false);
  });
});
