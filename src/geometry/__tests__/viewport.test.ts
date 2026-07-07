import { describe, expect, it } from 'vitest';
import { clampScale, screenToWorld, worldToScreen, zoomAt, type Viewport } from '../viewport';

describe('worldToScreen / screenToWorld', () => {
  it('round-trips a point through world -> screen -> world', () => {
    const vp: Viewport = { offsetX: 100, offsetY: 50, scale: 2.5 };
    const world = { x: 123.4, y: -56.7 };
    const screen = worldToScreen(vp, world);
    const back = screenToWorld(vp, screen);
    expect(back.x).toBeCloseTo(world.x, 9);
    expect(back.y).toBeCloseTo(world.y, 9);
  });

  it('maps the origin to the viewport offset', () => {
    const vp: Viewport = { offsetX: 40, offsetY: 30, scale: 1 };
    expect(worldToScreen(vp, { x: 0, y: 0 })).toEqual({ x: 40, y: 30 });
  });
});

describe('clampScale', () => {
  it('clamps below the minimum', () => {
    expect(clampScale(0.001)).toBe(0.05);
  });
  it('clamps above the maximum', () => {
    expect(clampScale(100)).toBe(10);
  });
  it('leaves in-range values unchanged', () => {
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('zoomAt', () => {
  it('keeps the world point under the cursor fixed after zooming', () => {
    const vp: Viewport = { offsetX: 0, offsetY: 0, scale: 1 };
    const cursor = { x: 300, y: 200 };
    const worldBefore = screenToWorld(vp, cursor);
    const zoomed = zoomAt(vp, cursor, 2);
    const worldAfter = screenToWorld(zoomed, cursor);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
    expect(zoomed.scale).toBeCloseTo(2, 9);
  });
});
