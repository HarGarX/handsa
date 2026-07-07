import type { Point } from '../types/plan';

export function wallLength(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export function wallAngle(start: Point, end: Point): number {
  return Math.atan2(end.y - start.y, end.x - start.x);
}

/** Point at parametric position t (0..1) along the segment from start to end. */
export function pointAt(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

/** Unit vector along the segment direction (start -> end). Returns {x:1,y:0} for degenerate segments. */
export function unitDirection(start: Point, end: Point): Point {
  const len = wallLength(start, end);
  if (len === 0) return { x: 1, y: 0 };
  return { x: (end.x - start.x) / len, y: (end.y - start.y) / len };
}

/** Unit normal (perpendicular) vector to the segment. */
export function unitNormal(start: Point, end: Point): Point {
  const dir = unitDirection(start, end);
  return { x: -dir.y, y: dir.x };
}

export interface Projection {
  point: Point;
  t: number; // clamped 0..1
  distance: number; // distance from query point to projected point
}

/**
 * Projects `p` onto the segment start-end, clamped to the segment bounds.
 * Returns the closest point on the segment, its parametric t, and the distance.
 */
export function projectPointToSegment(p: Point, start: Point, end: Point): Projection {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;
  let t: number;
  if (lenSq === 0) {
    t = 0;
  } else {
    t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq;
    t = Math.min(1, Math.max(0, t));
  }
  const point = pointAt(start, end, t);
  return { point, t, distance: Math.hypot(p.x - point.x, p.y - point.y) };
}

/** Converts a parametric-t half-width (in cm) to a delta-t on a segment of the given length. */
export function halfWidthToDeltaT(halfWidthCm: number, segmentLength: number): number {
  if (segmentLength === 0) return 0;
  return halfWidthCm / segmentLength;
}

export interface SegmentIntersection {
  point: Point;
  tA: number; // 0..1 along segment A
  tB: number; // 0..1 along segment B
}

/**
 * True bounded segment-segment intersection (not the infinite-line
 * intersection): returns null unless the crossing point falls within both
 * segments' [0,1] range. Used to detect walls that cross mid-span, where
 * neither wall's endpoint sits at the crossing point.
 */
export function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): SegmentIntersection | null {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null; // parallel or degenerate

  const dx = b1.x - a1.x;
  const dy = b1.y - a1.y;
  const tA = (dx * d2y - dy * d2x) / denom;
  const tB = (dx * d1y - dy * d1x) / denom;
  if (tA < 0 || tA > 1 || tB < 0 || tB > 1) return null;

  return { point: { x: a1.x + d1x * tA, y: a1.y + d1y * tA }, tA, tB };
}
