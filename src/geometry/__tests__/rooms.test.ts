import { describe, expect, it } from 'vitest';
import type { Wall } from '../../types/plan';
import { detectRooms } from '../rooms';

function wall(id: string, start: [number, number], end: [number, number]): Wall {
  return { id, start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] }, thickness: 15 };
}

describe('detectRooms', () => {
  it('detects a single closed 5m x 4m room as 20.0 m^2', () => {
    const walls: Wall[] = [
      wall('w1', [0, 0], [500, 0]),
      wall('w2', [500, 0], [500, 400]),
      wall('w3', [500, 400], [0, 400]),
      wall('w4', [0, 400], [0, 0]),
    ];
    const rooms = detectRooms(walls);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.areaM2).toBeCloseTo(20, 1);
  });

  it('splits into two rooms when an interior wall is added', () => {
    const walls: Wall[] = [
      wall('w1', [0, 0], [500, 0]),
      wall('w2', [500, 0], [500, 400]),
      wall('w3', [500, 400], [0, 400]),
      wall('w4', [0, 400], [0, 0]),
      wall('w5', [250, 0], [250, 400]), // splits into two 2.5m x 4m rooms
    ];
    const rooms = detectRooms(walls);
    expect(rooms).toHaveLength(2);
    const areas = rooms.map((r) => r.areaM2).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(10, 1);
    expect(areas[1]).toBeCloseTo(10, 1);
  });

  it('does not create a phantom room from an open (unclosed) wall chain', () => {
    const walls: Wall[] = [
      wall('w1', [0, 0], [500, 0]),
      wall('w2', [500, 0], [500, 400]),
      wall('w3', [500, 400], [0, 400]),
      // missing the fourth wall - chain is not closed
    ];
    const rooms = detectRooms(walls);
    expect(rooms).toHaveLength(0);
  });

  it('ignores a dangling spike off a closed room', () => {
    const walls: Wall[] = [
      wall('w1', [0, 0], [500, 0]),
      wall('w2', [500, 0], [500, 400]),
      wall('w3', [500, 400], [0, 400]),
      wall('w4', [0, 400], [0, 0]),
      wall('spike', [500, 0], [600, -50]), // dangling wall off a corner
    ];
    const rooms = detectRooms(walls);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.areaM2).toBeCloseTo(20, 1);
  });
});
