import type { Point, Wall } from '../types/plan';
import { polygonAreaM2, polygonCentroid, signedArea } from './area';
import { buildWallGraph, type WallGraphEdge } from './wallGraph';

export interface Room {
  id: string;
  points: Point[];
  areaM2: number;
  centroid: Point;
}

interface AdjEntry {
  to: string;
  angle: number;
}

/**
 * Detects rooms (minimal bounded faces) formed by the wall graph.
 *
 * Approach: build a planar graph from wall endpoints (merged within `tolerance`
 * cm, and split at T-junctions), then trace faces using the standard "next
 * edge in rotational order" algorithm. Each connected component yields exactly
 * one unbounded outer face (the largest by area) plus zero or more bounded
 * interior faces, which we report as rooms. Dangling (degree-1) wall spikes
 * degrade gracefully: the trace walks out and back along the same edge,
 * contributing zero net area, so open/unclosed wall chains never produce
 * phantom rooms.
 */
export function detectRooms(walls: Wall[], tolerance = 1): Room[] {
  if (walls.length === 0) return [];

  const { nodes, edges } = buildWallGraph(walls, tolerance);
  if (edges.length === 0) return [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Union-find to split into connected components.
  const parent = new Map<string, string>();
  for (const n of nodes) parent.set(n.id, n.id);
  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root) ?? root;
    }
    parent.set(x, root);
    return root;
  }
  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const e of edges) union(e.a, e.b);

  const componentsByRoot = new Map<string, WallGraphEdge[]>();
  for (const e of edges) {
    const root = find(e.a);
    const list = componentsByRoot.get(root) ?? [];
    list.push(e);
    componentsByRoot.set(root, list);
  }

  const rooms: Room[] = [];

  for (const componentEdges of componentsByRoot.values()) {
    const adjacency = new Map<string, AdjEntry[]>();
    function addAdj(from: string, to: string): void {
      const arr = adjacency.get(from) ?? [];
      const fromNode = nodeById.get(from)!;
      const toNode = nodeById.get(to)!;
      const angle = Math.atan2(toNode.point.y - fromNode.point.y, toNode.point.x - fromNode.point.x);
      arr.push({ to, angle });
      adjacency.set(from, arr);
    }
    for (const e of componentEdges) {
      addAdj(e.a, e.b);
      addAdj(e.b, e.a);
    }
    for (const arr of adjacency.values()) arr.sort((x, y) => x.angle - y.angle);

    const visited = new Set<string>();
    const faces: Point[][] = [];

    for (const e of componentEdges) {
      for (const [startA, startB] of [
        [e.a, e.b],
        [e.b, e.a],
      ] as [string, string][]) {
        const startKey = `${startA}->${startB}`;
        if (visited.has(startKey)) continue;

        const faceNodeIds: string[] = [];
        let curFrom = startA;
        let curTo = startB;
        let guard = 0;
        const maxGuard = componentEdges.length * 2 + 10;

        while (guard < maxGuard) {
          const dkey = `${curFrom}->${curTo}`;
          if (visited.has(dkey)) break;
          visited.add(dkey);
          faceNodeIds.push(curFrom);

          const adjAtTo = adjacency.get(curTo) ?? [];
          const idx = adjAtTo.findIndex((a) => a.to === curFrom);
          if (idx === -1 || adjAtTo.length === 0) break;
          const nextIdx = (idx - 1 + adjAtTo.length) % adjAtTo.length;
          const nextNeighbor = adjAtTo[nextIdx]!;

          const nextFrom = curTo;
          const nextTo = nextNeighbor.to;
          curFrom = nextFrom;
          curTo = nextTo;
          guard++;

          if (curFrom === startA && curTo === startB) break;
        }

        if (faceNodeIds.length >= 3) {
          faces.push(faceNodeIds.map((id) => nodeById.get(id)!.point));
        }
      }
    }

    if (faces.length < 2) continue; // no bounded interior face in this component

    // The outer (unbounded) face wraps the whole component and has the largest area.
    let outerIdx = 0;
    let maxArea = -Infinity;
    faces.forEach((pts, i) => {
      const a = Math.abs(signedArea(pts));
      if (a > maxArea) {
        maxArea = a;
        outerIdx = i;
      }
    });

    faces.forEach((pts, i) => {
      if (i === outerIdx) return;
      const areaM2 = polygonAreaM2(pts);
      if (areaM2 < 0.01) return; // ignore degenerate slivers/spikes
      const centroid = polygonCentroid(pts);
      const idKey = pts
        .map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`)
        .sort()
        .join('|');
      rooms.push({ id: `room-${idKey}`, points: pts, areaM2, centroid });
    });
  }

  return rooms;
}
