import { describe, expect, it } from 'vitest';
import type { Wall } from '../../types/plan';
import { computeWallJoints } from '../joints';

function wall(id: string, start: [number, number], end: [number, number], thickness = 15): Wall {
  return { id, start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] }, thickness };
}

describe('computeWallJoints', () => {
  it('finds no joints for a single isolated wall', () => {
    const walls: Wall[] = [wall('w1', [0, 0], [400, 0])];
    expect(computeWallJoints(walls)).toHaveLength(0);
  });

  it('finds one joint at a shared corner between two walls, sized to the thicker wall', () => {
    const walls: Wall[] = [
      wall('w1', [0, 0], [400, 0], 10),
      wall('w2', [400, 0], [400, 300], 20),
    ];
    const joints = computeWallJoints(walls);
    expect(joints).toHaveLength(1);
    expect(joints[0]!.point).toEqual({ x: 400, y: 0 });
    expect(joints[0]!.radius).toBe(10); // max(10,20)/2
    expect(joints[0]!.wallIds.sort()).toEqual(['w1', 'w2']);
  });

  it('finds a joint at a T-junction where a partition wall meets mid-span', () => {
    const walls: Wall[] = [
      wall('w1', [0, 0], [400, 0]),
      wall('w2', [200, 0], [200, 300]), // meets w1 at its midpoint, not an endpoint
    ];
    const joints = computeWallJoints(walls);
    expect(joints).toHaveLength(1);
    expect(joints[0]!.point).toEqual({ x: 200, y: 0 });
    expect(joints[0]!.wallIds.sort()).toEqual(['w1', 'w2']);
  });

  it('does not create a joint at a dangling (degree-1) endpoint', () => {
    const walls: Wall[] = [wall('w1', [0, 0], [400, 0]), wall('w2', [400, 100], [400, 300])];
    // w2 doesn't touch w1 at all here, so both walls have two degree-1 endpoints each.
    expect(computeWallJoints(walls)).toHaveLength(0);
  });

  it('handles a four-way crossing with a single joint', () => {
    const walls: Wall[] = [
      wall('w1', [-200, 0], [200, 0]),
      wall('w2', [0, -200], [0, 200]),
    ];
    const joints = computeWallJoints(walls);
    expect(joints).toHaveLength(1);
    expect(joints[0]!.point).toEqual({ x: 0, y: 0 });
  });
});
