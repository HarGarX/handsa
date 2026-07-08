import type { Label, Opening, PlacedSymbol, Point, Run, Wall } from '../types/plan';
import { openingExtent } from './opening';
import { projectPointToSegment } from './segment';
import { resolveSymbolPosition } from './placedSymbol';
import { pointInRotatedRect } from './rect';
import { symbolFootprint } from '../lib/symbolCatalog';
import type { WallEnd } from './endpoints';

/** Finds the wall whose body (thickness + tolerance) contains `point`, nearest first. */
export function hitTestWall(walls: Wall[], point: Point, toleranceCm: number): Wall | null {
  let best: Wall | null = null;
  let bestDist = Infinity;
  for (const w of walls) {
    const proj = projectPointToSegment(point, w.start, w.end);
    const limit = w.thickness / 2 + toleranceCm;
    if (proj.distance <= limit && proj.distance < bestDist) {
      bestDist = proj.distance;
      best = w;
    }
  }
  return best;
}

/** Nearest wall to `point` regardless of thickness, within `maxDistCm`. Used for hover-to-place tools. */
export function nearestWall(walls: Wall[], point: Point, maxDistCm: number): { wall: Wall; t: number } | null {
  let best: { wall: Wall; t: number } | null = null;
  let bestDist = maxDistCm;
  for (const w of walls) {
    const proj = projectPointToSegment(point, w.start, w.end);
    if (proj.distance <= bestDist) {
      bestDist = proj.distance;
      best = { wall: w, t: proj.t };
    }
  }
  return best;
}

/** Finds the opening under `point`, checking the host wall's local perpendicular offset and t-range. */
export function hitTestOpening(openings: Opening[], walls: Wall[], point: Point, toleranceCm: number): Opening | null {
  const wallById = new Map(walls.map((w) => [w.id, w]));
  let best: Opening | null = null;
  let bestDist = Infinity;
  for (const o of openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    const proj = projectPointToSegment(point, wall.start, wall.end);
    const ext = openingExtent(o, wall);
    const limit = wall.thickness / 2 + toleranceCm;
    if (proj.distance <= limit && proj.t >= ext.tMin && proj.t <= ext.tMax && proj.distance < bestDist) {
      bestDist = proj.distance;
      best = o;
    }
  }
  return best;
}

/** Approximate bounding-box hit test for a text label (no canvas measurement available in pure geometry). */
export function hitTestLabel(labels: Label[], point: Point, toleranceCm: number): Label | null {
  for (const l of labels) {
    const width = Math.max(l.fontSize * 0.6 * l.text.length, l.fontSize);
    const height = l.fontSize;
    const withinX = point.x >= l.position.x - toleranceCm && point.x <= l.position.x + width + toleranceCm;
    const withinY = point.y >= l.position.y - toleranceCm && point.y <= l.position.y + height + toleranceCm;
    if (withinX && withinY) return l;
  }
  return null;
}

/**
 * Finds the placed symbol under `point`, testing its true rotated-rectangle
 * footprint (not just a circular radius) since furniture footprints are
 * often rectangular and can be large enough that a circle would be a poor
 * approximation. Ties (overlapping symbols) break by center distance.
 */
export function hitTestSymbol(symbols: PlacedSymbol[], walls: Wall[], point: Point, toleranceCm: number): PlacedSymbol | null {
  let best: PlacedSymbol | null = null;
  let bestDist = Infinity;
  for (const s of symbols) {
    const pos = resolveSymbolPosition(s, walls);
    const { width, depth } = symbolFootprint(s);
    const inside = pointInRotatedRect(point, pos, width + toleranceCm * 2, depth + toleranceCm * 2, s.rotation);
    if (!inside) continue;
    const d = Math.hypot(pos.x - point.x, pos.y - point.y);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** Finds the run whose polyline passes within `toleranceCm` of `point`, nearest first. */
export function hitTestRun(runs: Run[], point: Point, toleranceCm: number): Run | null {
  let best: Run | null = null;
  let bestDist = toleranceCm;
  for (const r of runs) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const proj = projectPointToSegment(point, r.points[i]!, r.points[i + 1]!);
      if (proj.distance <= bestDist) {
        bestDist = proj.distance;
        best = r;
      }
    }
  }
  return best;
}

/** Finds the nearest wall endpoint handle to `point` within `radiusCm`, for drag-handle hit testing. */
export function hitTestEndpointHandle(
  walls: Wall[],
  point: Point,
  radiusCm: number,
): { wall: Wall; end: WallEnd } | null {
  let best: { wall: Wall; end: WallEnd } | null = null;
  let bestDist = radiusCm;
  for (const w of walls) {
    const dStart = Math.hypot(w.start.x - point.x, w.start.y - point.y);
    if (dStart <= bestDist) {
      bestDist = dStart;
      best = { wall: w, end: 'start' };
    }
    const dEnd = Math.hypot(w.end.x - point.x, w.end.y - point.y);
    if (dEnd <= bestDist) {
      bestDist = dEnd;
      best = { wall: w, end: 'end' };
    }
  }
  return best;
}
