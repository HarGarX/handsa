import type { Point, Wall } from '../types/plan';
import { buildWallGraph } from './wallGraph';

export interface WallJoint {
  id: string;
  point: Point;
  /** half-size of the fill cap: for "square" this is the half side length, for "round" the radius */
  radius: number;
  wallIds: string[];
}

/**
 * Finds every point where 2+ walls meet (a shared corner, T-junction, or
 * crossing) and returns a fill "cap" for each — a square or circle centered
 * on the joint, sized to the thickest connecting wall.
 *
 * Why this size is always enough to cover the gap: at a shared joint, each
 * connecting wall's rendered rectangle has its end-corners offset purely
 * perpendicular to that wall, at a distance of exactly `wall.thickness / 2`
 * from the joint point (zero longitudinal offset, since it's right at the
 * wall's endpoint). So every connecting wall's corners lie within
 * `radius = maxConnectingThickness / 2` of the joint point — a circle of
 * that radius covers them regardless of the walls' angles, and an
 * axis-aligned square of that half-size does too (each corner's individual
 * x/y offset is bounded by its straight-line distance from the center).
 */
export function computeWallJoints(walls: Wall[], tolerance = 1): WallJoint[] {
  const { nodes } = buildWallGraph(walls, tolerance);
  const thicknessByWallId = new Map(walls.map((w) => [w.id, w.thickness]));

  const joints: WallJoint[] = [];
  for (const node of nodes) {
    if (node.wallIds.size < 2) continue;
    const wallIds = [...node.wallIds];
    const maxThickness = Math.max(...wallIds.map((id) => thicknessByWallId.get(id) ?? 0));
    if (maxThickness <= 0) continue;
    joints.push({
      id: `joint-${node.id}-${Math.round(node.point.x)}:${Math.round(node.point.y)}`,
      point: node.point,
      radius: maxThickness / 2,
      wallIds,
    });
  }
  return joints;
}
