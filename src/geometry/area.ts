import type { Point } from '../types/plan';

/**
 * Shoelace formula. Returns the signed area of a polygon (cm^2);
 * positive for counter-clockwise vertex order, negative for clockwise.
 */
export function signedArea(points: Point[]): number {
  let sum = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Unsigned polygon area (cm^2). */
export function polygonArea(points: Point[]): number {
  return Math.abs(signedArea(points));
}

export function polygonAreaM2(points: Point[]): number {
  return polygonArea(points) / 10_000; // 1 m^2 = 10,000 cm^2
}

export function polygonCentroid(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  let a = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p0 = points[i]!;
    const p1 = points[(i + 1) % n]!;
    const cross = p0.x * p1.y - p1.x * p0.y;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
    a += cross;
  }
  a = a / 2;
  if (a === 0) {
    // Degenerate polygon; fall back to averaging vertices.
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / n, y: sum.y / n };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}
