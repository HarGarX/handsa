import { describe, expect, it } from 'vitest';
import type { Layer, Opening, PlacedSymbol, Wall } from '../../types/plan';
import { createDefaultLayers } from '../../types/plan';
import { detectRooms } from '../rooms';
import { roomBoundingWalls, suggestPlacements } from '../placementSuggestions';

function wall(id: string, start: [number, number], end: [number, number], thickness = 15): Wall {
  return { id, start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] }, thickness };
}

// A plain 6m x 4m room: long walls (600 cm) on top/bottom, short walls (400 cm) on the sides.
function boxWalls(): Wall[] {
  return [
    wall('top', [0, 0], [600, 0]),
    wall('right', [600, 0], [600, 400]),
    wall('bottom', [600, 400], [0, 400]),
    wall('left', [0, 400], [0, 0]),
  ];
}

const layers: Layer[] = createDefaultLayers();
const furnitureLayerId = layers.find((l) => l.kind === 'furniture')!.id;
const lightingLayerId = layers.find((l) => l.kind === 'lighting-power-hvac')!.id;

describe('roomBoundingWalls', () => {
  it('matches every polygon edge to its source wall with an inward-pointing normal', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    const segments = roomBoundingWalls(room, walls);
    expect(segments.every((s) => s !== null)).toBe(true);
    for (const seg of segments) {
      // Offsetting a wall's midpoint along its inward normal must land inside the room box.
      const mid = {
        x: (seg!.wall.start.x + seg!.wall.end.x) / 2 + seg!.inwardNormal.x * 10,
        y: (seg!.wall.start.y + seg!.wall.end.y) / 2 + seg!.inwardNormal.y * 10,
      };
      expect(mid.x).toBeGreaterThan(0);
      expect(mid.x).toBeLessThan(600);
      expect(mid.y).toBeGreaterThan(0);
      expect(mid.y).toBeLessThan(400);
    }
  });
});

describe('suggestPlacements', () => {
  it('suggests a sofa against the longest clear wall, offset inward and facing the room', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    const suggestions = suggestPlacements({ room, walls, openings: [], symbols: [], layers });

    const sofa = suggestions.find((s) => s.type === 'sofa');
    expect(sofa).toBeDefined();
    // One of the two 600cm walls (top or bottom) should be chosen over the 400cm side walls.
    expect(['top', 'bottom']).toContain(sofa!.wallId ?? wallIdNear(sofa!.position, walls));
    expect(sofa!.position.x).toBeGreaterThan(0);
    expect(sofa!.position.x).toBeLessThan(600);
    expect(sofa!.position.y).toBeGreaterThan(0);
    expect(sofa!.position.y).toBeLessThan(400);
  });

  it('produces every documented v1 suggestion type at least once for an empty room', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    const suggestions = suggestPlacements({ room, walls, openings: [], symbols: [], layers });
    const types = new Set(suggestions.map((s) => s.type));
    expect(types.has('sofa')).toBe(true);
    expect(types.has('tv-stand')).toBe(true);
    expect(types.has('wall-art')).toBe(true);
    expect(types.has('floor-lamp')).toBe(true);
  });

  it('prefers the wall opposite a window as the focal wall for seating', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    // A big window on the "bottom" wall makes it the focal wall.
    const openings: Opening[] = [{ id: 'win1', wallId: 'bottom', type: 'window', t: 0.5, width: 200 }];
    const suggestions = suggestPlacements({ room, walls, openings, symbols: [], layers });

    const sofa = suggestions.find((s) => s.type === 'sofa')!;
    // The sofa should sit against "top" (opposite "bottom"), not against the window wall itself.
    expect(sofa.position.y).toBeLessThan(200); // near the top wall (y=0), not the bottom (y=400)

    const tv = suggestions.find((s) => s.type === 'tv-stand')!;
    expect(tv.wallId).toBe('bottom');
  });

  it('keeps candidates clear of a door swing/walkway zone', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    // A door dead-center on the long "top" wall, hinged so it swings into the room.
    const openings: Opening[] = [
      { id: 'door1', wallId: 'top', type: 'door', t: 0.5, width: 90, hinge: 'start', swing: 'right' },
    ];
    const suggestions = suggestPlacements({ room, walls, openings, symbols: [], layers });
    const sofa = suggestions.find((s) => s.type === 'sofa')!;
    // A sofa on "top" would have to avoid the door's clearance zone around x=300; if it's still
    // on "top" it must sit clearly to one side, not straddling the door.
    if (Math.abs(sofa.position.y) < 5) {
      expect(Math.abs(sofa.position.x - 300)).toBeGreaterThan(100);
    }
  });

  it('does not re-suggest a type that is already placed in the room', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    const existingSofa: PlacedSymbol = {
      id: 'sofa1',
      layerId: furnitureLayerId,
      type: 'sofa',
      position: { x: 300, y: 20 },
      rotation: 0,
    };
    const suggestions = suggestPlacements({ room, walls, openings: [], symbols: [existingSofa], layers });
    expect(suggestions.some((s) => s.type === 'sofa')).toBe(false);
  });

  it('favors the corner farthest from an existing ceiling light for the floor lamp suggestion', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    // A ceiling light near the top-left corner should push the lamp suggestion toward the
    // opposite (bottom-right) side of the room.
    const light: PlacedSymbol = {
      id: 'light1',
      layerId: lightingLayerId,
      type: 'light-ceiling',
      position: { x: 30, y: 30 },
      rotation: 0,
    };
    const suggestions = suggestPlacements({ room, walls, openings: [], symbols: [light], layers });
    const lamp = suggestions.find((s) => s.type === 'floor-lamp')!;
    expect(lamp).toBeDefined();
    const distToLight = Math.hypot(lamp.position.x - 30, lamp.position.y - 30);
    expect(distToLight).toBeGreaterThan(300);
  });

  it('returns no suggestions for a room with no matched bounding walls', () => {
    const walls = boxWalls();
    const room = detectRooms(walls)[0]!;
    const suggestions = suggestPlacements({ room, walls: [], openings: [], symbols: [], layers });
    expect(suggestions).toEqual([]);
  });
});

function wallIdNear(position: { x: number; y: number }, walls: Wall[]): string {
  let best = walls[0]!;
  let bestDist = Infinity;
  for (const w of walls) {
    const dx = w.end.x - w.start.x;
    const dy = w.end.y - w.start.y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.max(0, Math.min(1, ((position.x - w.start.x) * dx + (position.y - w.start.y) * dy) / (len * len)));
    const px = w.start.x + dx * t;
    const py = w.start.y + dy * t;
    const dist = Math.hypot(position.x - px, position.y - py);
    if (dist < bestDist) {
      bestDist = dist;
      best = w;
    }
  }
  return best.id;
}
