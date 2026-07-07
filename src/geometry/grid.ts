import type { Viewport } from './viewport';
import { screenToWorld } from './viewport';

export interface GridLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  major: boolean; // true = every 100cm line, false = every 10cm line
}

/**
 * Computes visible grid lines (in screen px) for the current viewport.
 * Minor (10cm) lines are omitted once they would render closer than ~6px apart.
 */
export function computeGridLines(vp: Viewport, screenWidth: number, screenHeight: number): GridLine[] {
  const minorSpacingPx = 10 * vp.scale;
  const showMinor = minorSpacingPx >= 6;
  const step = showMinor ? 10 : 100;

  const topLeft = screenToWorld(vp, { x: 0, y: 0 });
  const bottomRight = screenToWorld(vp, { x: screenWidth, y: screenHeight });

  const minX = Math.floor(Math.min(topLeft.x, bottomRight.x) / step) * step;
  const maxX = Math.ceil(Math.max(topLeft.x, bottomRight.x) / step) * step;
  const minY = Math.floor(Math.min(topLeft.y, bottomRight.y) / step) * step;
  const maxY = Math.ceil(Math.max(topLeft.y, bottomRight.y) / step) * step;

  const lines: GridLine[] = [];

  for (let x = minX; x <= maxX; x += step) {
    const major = Math.round(x) % 100 === 0;
    const sx = x * vp.scale + vp.offsetX;
    lines.push({ key: `v${x}`, x1: sx, y1: 0, x2: sx, y2: screenHeight, major });
  }
  for (let y = minY; y <= maxY; y += step) {
    const major = Math.round(y) % 100 === 0;
    const sy = y * vp.scale + vp.offsetY;
    lines.push({ key: `h${y}`, x1: 0, y1: sy, x2: screenWidth, y2: sy, major });
  }

  return lines;
}
