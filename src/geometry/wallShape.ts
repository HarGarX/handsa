import type { Opening, Point, Wall } from '../types/plan';
import { openingExtent } from './opening';
import { pointAt, unitNormal } from './segment';

export interface WallSegmentRect {
  key: string;
  points: [Point, Point, Point, Point]; // closed quad, world coords
}

/**
 * Computes the filled rectangle(s) for a wall, split around any opening gaps.
 * Openings are rendered as sub-rectangles between gaps rather than SVG masks so
 * that mitered corners can be added later without changing the rendering model.
 */
export function computeWallSegments(wall: Wall, openings: Opening[]): WallSegmentRect[] {
  const half = wall.thickness / 2;
  const normal = unitNormal(wall.start, wall.end);

  const relevant = openings
    .filter((o) => o.wallId === wall.id)
    .map((o) => openingExtent(o, wall))
    .map((e) => ({ tMin: Math.max(0, e.tMin), tMax: Math.min(1, e.tMax) }))
    .sort((a, b) => a.tMin - b.tMin);

  // Merge overlapping gaps defensively (shouldn't happen after clamping, but keeps rendering robust).
  const gaps: { tMin: number; tMax: number }[] = [];
  for (const g of relevant) {
    const last = gaps[gaps.length - 1];
    if (last && g.tMin <= last.tMax) {
      last.tMax = Math.max(last.tMax, g.tMax);
    } else {
      gaps.push({ ...g });
    }
  }

  const solidRanges: [number, number][] = [];
  let cursor = 0;
  for (const g of gaps) {
    if (g.tMin > cursor) solidRanges.push([cursor, g.tMin]);
    cursor = Math.max(cursor, g.tMax);
  }
  if (cursor < 1) solidRanges.push([cursor, 1]);

  const segments: WallSegmentRect[] = [];
  for (const [t0, t1] of solidRanges) {
    if (t1 - t0 <= 1e-6) continue;
    const p0 = pointAt(wall.start, wall.end, t0);
    const p1 = pointAt(wall.start, wall.end, t1);
    const a: Point = { x: p0.x + normal.x * half, y: p0.y + normal.y * half };
    const b: Point = { x: p1.x + normal.x * half, y: p1.y + normal.y * half };
    const c: Point = { x: p1.x - normal.x * half, y: p1.y - normal.y * half };
    const d: Point = { x: p0.x - normal.x * half, y: p0.y - normal.y * half };
    segments.push({ key: `${wall.id}-${t0.toFixed(4)}-${t1.toFixed(4)}`, points: [a, b, c, d] });
  }

  return segments;
}

export function wallOutline(wall: Wall): [Point, Point, Point, Point] {
  const half = wall.thickness / 2;
  const normal = unitNormal(wall.start, wall.end);
  return [
    { x: wall.start.x + normal.x * half, y: wall.start.y + normal.y * half },
    { x: wall.end.x + normal.x * half, y: wall.end.y + normal.y * half },
    { x: wall.end.x - normal.x * half, y: wall.end.y - normal.y * half },
    { x: wall.start.x - normal.x * half, y: wall.start.y - normal.y * half },
  ];
}
