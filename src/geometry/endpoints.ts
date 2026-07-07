import type { Point, Wall } from '../types/plan';

export type WallEnd = 'start' | 'end';

export interface EndpointRef {
  wallId: string;
  end: WallEnd;
}

/**
 * Finds every wall endpoint that coincides (within `tolerance` cm) with `point`.
 * Used so that dragging a shared corner moves every connected wall together.
 */
export function findCoincidentEndpoints(walls: Wall[], point: Point, tolerance = 1): EndpointRef[] {
  const refs: EndpointRef[] = [];
  for (const w of walls) {
    if (Math.hypot(w.start.x - point.x, w.start.y - point.y) <= tolerance) {
      refs.push({ wallId: w.id, end: 'start' });
    }
    if (Math.hypot(w.end.x - point.x, w.end.y - point.y) <= tolerance) {
      refs.push({ wallId: w.id, end: 'end' });
    }
  }
  return refs;
}

/** Finds the nearest wall endpoint (from any wall) within `radiusCm` of `point`, for endpoint magnetism. */
export function findNearestEndpoint(
  walls: Wall[],
  point: Point,
  radiusCm: number,
  excludeWallId?: string,
): Point | null {
  let best: Point | null = null;
  let bestDist = radiusCm;
  for (const w of walls) {
    if (w.id === excludeWallId) continue;
    for (const p of [w.start, w.end]) {
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d <= bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  return best;
}
