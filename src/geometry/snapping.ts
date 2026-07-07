import type { Point } from '../types/plan';

export type SnapIncrement = 1 | 5 | 10;

/** Snaps a single world-space coordinate value to the nearest multiple of `increment` cm. */
export function snapValue(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

/** Snaps a world-space point to the grid, or returns it unchanged if snapping is disabled. */
export function snapPoint(p: Point, increment: number, enabled: boolean): Point {
  if (!enabled) return p;
  return { x: snapValue(p.x, increment), y: snapValue(p.y, increment) };
}

/**
 * Snaps an angle (radians) to the nearest `stepDegrees` increment.
 * Returns the snapped angle in radians.
 */
export function snapAngle(angleRad: number, stepDegrees = 15): number {
  const stepRad = (stepDegrees * Math.PI) / 180;
  return Math.round(angleRad / stepRad) * stepRad;
}

/**
 * Given a fixed start point and a free-moving end point, returns an end point
 * whose angle from start is snapped to `stepDegrees` increments, preserving
 * the distance between start and the original end.
 */
export function snapPointToAngle(start: Point, end: Point, stepDegrees = 15): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return end;
  const angle = Math.atan2(dy, dx);
  const snapped = snapAngle(angle, stepDegrees);
  return {
    x: start.x + Math.cos(snapped) * dist,
    y: start.y + Math.sin(snapped) * dist,
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
