import type { Point } from '../types/plan';

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Builds an axis-aligned rect from two arbitrary corner points (drag can go in any direction). */
export function normalizeRect(a: Point, b: Point): Rect {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

export function pointInRect(p: Point, rect: Rect): boolean {
  return p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;
}

/**
 * Converts a world-space point into the local (unrotated) frame of a
 * rectangle centered at `center` and rotated by `rotationDeg` — the same
 * rotation convention as SVG's `rotate()` transform (clockwise, in a y-down
 * coordinate system), which is how symbol icons are drawn. Inverse of
 * `localToWorld`.
 */
export function worldToLocal(p: Point, center: Point, rotationDeg: number): Point {
  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  // Inverse rotation (rotation matrices are orthogonal, so R(theta)^-1 == R(-theta)).
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/** Converts a point in a rectangle's local (unrotated) frame back to world space. Inverse of `worldToLocal`. */
export function localToWorld(local: Point, center: Point, rotationDeg: number): Point {
  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: center.x + local.x * cos - local.y * sin,
    y: center.y + local.x * sin + local.y * cos,
  };
}

/**
 * True if `p` falls inside a rectangle of the given `width` (local x-axis)
 * and `depth` (local y-axis), centered at `center` and rotated by
 * `rotationDeg`.
 */
export function pointInRotatedRect(
  p: Point,
  center: Point,
  width: number,
  depth: number,
  rotationDeg: number,
): boolean {
  const local = worldToLocal(p, center, rotationDeg);
  return Math.abs(local.x) <= width / 2 && Math.abs(local.y) <= depth / 2;
}
