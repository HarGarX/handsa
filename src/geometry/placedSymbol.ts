import type { PlacedSymbol, Point, Wall } from '../types/plan';
import { pointAt } from './segment';

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
