import type { PlacedSymbol, Point, Wall } from '../types/plan';
import { pointAt } from './segment';
import { localToWorld } from './rect';

/**
 * Resolves a symbol's current world position. Wall-mounted symbols (wallId +
 * t set) are re-derived from their host wall every time, exactly like
 * openings, so they automatically follow the wall if it's moved or resized —
 * the symbol's own `position` field is only a last-known snapshot and is
 * ignored here whenever the host wall can still be found.
 */
export function resolveSymbolPosition(symbol: PlacedSymbol, walls: Wall[]): Point {
  if (symbol.wallId !== undefined && symbol.t !== undefined) {
    const wall = walls.find((w) => w.id === symbol.wallId);
    if (wall) return pointAt(wall.start, wall.end, symbol.t);
  }
  return symbol.position;
}

export interface SymbolResizeHandles {
  widthHandle: Point; // edge midpoint along the local x-axis (+width/2, 0)
  depthHandle: Point; // edge midpoint along the local y-axis (0, +depth/2)
}

/** World-space positions of a resizable symbol's two edge-midpoint resize handles. */
export function symbolResizeHandles(
  center: Point,
  rotationDeg: number,
  width: number,
  depth: number,
): SymbolResizeHandles {
  return {
    widthHandle: localToWorld({ x: width / 2, y: 0 }, center, rotationDeg),
    depthHandle: localToWorld({ x: 0, y: depth / 2 }, center, rotationDeg),
  };
}
