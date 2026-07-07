import type { Point, Wall } from '../types/plan';
import { projectPointToSegment, segmentIntersection, wallLength } from './segment';

export interface WallGraphNode {
  id: string;
  point: Point;
  /** ids of every wall that has an endpoint, T-junction, or crossing at this node */
  wallIds: Set<string>;
}

export interface WallGraphEdge {
  a: string;
  b: string;
}

interface Junction {
  node: WallGraphNode;
  t: number;
}

/**
 * Builds a planar graph from wall endpoints, merging coincident endpoints
 * within `tolerance` cm and splitting walls at:
 *  - T-junctions, where another wall's endpoint lands in the interior of
 *    this wall's span (e.g. a partition wall meeting an exterior wall
 *    mid-span rather than at a shared corner), and
 *  - true mid-span crossings, where two walls cross without either
 *    endpoint sitting at the crossing point (e.g. two full walls forming a
 *    four-way intersection).
 *
 * Shared by room detection (`rooms.ts`, which needs the edges for face
 * tracing) and wall-joint fill (`joints.ts`, which only needs `wallIds` per
 * node to know how many/which walls converge there).
 */
export function buildWallGraph(walls: Wall[], tolerance = 1): { nodes: WallGraphNode[]; edges: WallGraphEdge[] } {
  const nodes: WallGraphNode[] = [];
  function findOrCreateNode(p: Point): WallGraphNode {
    for (const n of nodes) {
      if (Math.hypot(n.point.x - p.x, n.point.y - p.y) <= tolerance) return n;
    }
    const node: WallGraphNode = { id: `n${nodes.length}`, point: p, wallIds: new Set() };
    nodes.push(node);
    return node;
  }

  const wallEndpoints = walls.map((w) => ({
    start: findOrCreateNode(w.start),
    end: findOrCreateNode(w.end),
  }));
  walls.forEach((wall, idx) => {
    const { start, end } = wallEndpoints[idx]!;
    start.wallIds.add(wall.id);
    end.wallIds.add(wall.id);
  });

  const extraJunctions: Junction[][] = walls.map(() => []);

  // Pass 1: existing nodes landing on another wall's interior span (T-junctions).
  walls.forEach((wall, idx) => {
    const { start, end } = wallEndpoints[idx]!;
    const len = wallLength(wall.start, wall.end);
    if (len === 0) return;
    const tTol = tolerance / len;
    for (const n of nodes) {
      if (n.id === start.id || n.id === end.id) continue;
      const proj = projectPointToSegment(n.point, wall.start, wall.end);
      if (proj.distance <= tolerance && proj.t > tTol && proj.t < 1 - tTol) {
        extraJunctions[idx]!.push({ node: n, t: proj.t });
        n.wallIds.add(wall.id);
      }
    }
  });

  // Pass 2: pairwise mid-span crossings (neither endpoint sits at the intersection).
  for (let i = 0; i < walls.length; i++) {
    const wi = walls[i]!;
    const li = wallLength(wi.start, wi.end);
    if (li === 0) continue;
    const tTolI = tolerance / li;

    for (let j = i + 1; j < walls.length; j++) {
      const wj = walls[j]!;
      const lj = wallLength(wj.start, wj.end);
      if (lj === 0) continue;
      const tTolJ = tolerance / lj;

      const inter = segmentIntersection(wi.start, wi.end, wj.start, wj.end);
      if (!inter) continue;
      // Skip crossings at or near either wall's own endpoint — those are
      // already handled as shared endpoints or T-junctions above.
      if (inter.tA <= tTolI || inter.tA >= 1 - tTolI) continue;
      if (inter.tB <= tTolJ || inter.tB >= 1 - tTolJ) continue;

      const node = findOrCreateNode(inter.point);
      node.wallIds.add(wi.id);
      node.wallIds.add(wj.id);
      extraJunctions[i]!.push({ node, t: inter.tA });
      extraJunctions[j]!.push({ node, t: inter.tB });
    }
  }

  // Build each wall's chain of edges: start -> (sorted unique junctions) -> end.
  const edges: WallGraphEdge[] = [];
  walls.forEach((_wall, idx) => {
    const { start, end } = wallEndpoints[idx]!;
    const seen = new Set<string>([start.id, end.id]);
    const uniqueSorted = extraJunctions[idx]!
      .filter((j) => {
        if (seen.has(j.node.id)) return false;
        seen.add(j.node.id);
        return true;
      })
      .sort((a, b) => a.t - b.t);

    const chain = [start, ...uniqueSorted.map((j) => j.node), end];
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i]!;
      const b = chain[i + 1]!;
      if (a.id !== b.id) edges.push({ a: a.id, b: b.id });
    }
  });

  return { nodes, edges };
}
