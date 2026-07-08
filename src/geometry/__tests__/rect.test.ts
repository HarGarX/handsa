import { describe, expect, it } from 'vitest';
import { localToWorld, normalizeRect, pointInRect, pointInRotatedRect, worldToLocal } from '../rect';

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

describe('pointInRotatedRect', () => {
  it('behaves like an axis-aligned check when rotation is 0', () => {
    const center = { x: 10, y: 20 };
    expect(pointInRotatedRect({ x: 10 + 40, y: 20 + 20 }, center, 100, 50, 0)).toBe(true);
    expect(pointInRotatedRect({ x: 10 + 60, y: 20 }, center, 100, 50, 0)).toBe(false);
  });

  it('is self-consistent under a forward rotation: a point derived by rotating a known local point lands inside', () => {
    const center = { x: 0, y: 0 };
    const width = 100;
    const depth = 50;
    const rotationDeg = 37; // arbitrary non-axis-aligned angle
    const theta = (rotationDeg * Math.PI) / 180;

    // A point just inside the local rectangle, rotated forward into world space.
    const localInside = { x: width / 2 - 1, y: depth / 2 - 1 };
    const worldInside = {
      x: localInside.x * Math.cos(theta) - localInside.y * Math.sin(theta),
      y: localInside.x * Math.sin(theta) + localInside.y * Math.cos(theta),
    };
    expect(pointInRotatedRect(worldInside, center, width, depth, rotationDeg)).toBe(true);

    // A point just outside along the same local direction should not be inside.
    const localOutside = { x: width / 2 + 5, y: depth / 2 - 1 };
    const worldOutside = {
      x: localOutside.x * Math.cos(theta) - localOutside.y * Math.sin(theta),
      y: localOutside.x * Math.sin(theta) + localOutside.y * Math.cos(theta),
    };
    expect(pointInRotatedRect(worldOutside, center, width, depth, rotationDeg)).toBe(false);
  });

  it('respects the rect center offset', () => {
    expect(pointInRotatedRect({ x: 100, y: 100 }, { x: 100, y: 100 }, 20, 20, 0)).toBe(true);
    expect(pointInRotatedRect({ x: 0, y: 0 }, { x: 100, y: 100 }, 20, 20, 0)).toBe(false);
  });
});

describe('worldToLocal / localToWorld', () => {
  it('round-trips through world -> local -> world for an arbitrary rotation', () => {
    const center = { x: 30, y: -15 };
    const rotationDeg = 52;
    const world = { x: 80, y: 40 };
    const local = worldToLocal(world, center, rotationDeg);
    const back = localToWorld(local, center, rotationDeg);
    expect(back.x).toBeCloseTo(world.x, 9);
    expect(back.y).toBeCloseTo(world.y, 9);
  });

  it('maps the center to local origin', () => {
    const center = { x: 12, y: 34 };
    expect(worldToLocal(center, center, 45)).toEqual({ x: 0, y: 0 });
  });
});
