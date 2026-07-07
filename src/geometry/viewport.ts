import type { Point } from '../types/plan';

export interface Viewport {
  offsetX: number; // screen px corresponding to world x=0
  offsetY: number; // screen px corresponding to world y=0
  scale: number; // screen px per world cm
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 10;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Converts a world-space point (cm) to a screen-space point (px). */
export function worldToScreen(vp: Viewport, p: Point): Point {
  return {
    x: p.x * vp.scale + vp.offsetX,
    y: p.y * vp.scale + vp.offsetY,
  };
}

/** Converts a screen-space point (px) to a world-space point (cm). */
export function screenToWorld(vp: Viewport, p: Point): Point {
  return {
    x: (p.x - vp.offsetX) / vp.scale,
    y: (p.y - vp.offsetY) / vp.scale,
  };
}

/** Converts a world-space length (cm) to a screen-space length (px). */
export function worldLengthToScreen(vp: Viewport, len: number): number {
  return len * vp.scale;
}

/** Converts a screen-space length (px) to a world-space length (cm). */
export function screenLengthToWorld(vp: Viewport, len: number): number {
  return len / vp.scale;
}

/**
 * Zoom the viewport by `factor`, keeping `screenPoint` (px) anchored to the
 * same world-space point before and after the zoom.
 */
export function zoomAt(vp: Viewport, screenPoint: Point, factor: number): Viewport {
  const worldBefore = screenToWorld(vp, screenPoint);
  const newScale = clampScale(vp.scale * factor);
  // Solve for offset such that worldToScreen(newVp, worldBefore) === screenPoint
  const offsetX = screenPoint.x - worldBefore.x * newScale;
  const offsetY = screenPoint.y - worldBefore.y * newScale;
  return { offsetX, offsetY, scale: newScale };
}

export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, offsetX: vp.offsetX + dx, offsetY: vp.offsetY + dy };
}

/** Computes a viewport that fits `points` within a screen region with padding. */
export function fitToPoints(
  points: Point[],
  screenWidth: number,
  screenHeight: number,
  paddingPx = 60,
): Viewport {
  if (points.length === 0) {
    return { offsetX: screenWidth / 2, offsetY: screenHeight / 2, scale: 1 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const worldWidth = Math.max(maxX - minX, 1);
  const worldHeight = Math.max(maxY - minY, 1);
  const availW = Math.max(screenWidth - paddingPx * 2, 10);
  const availH = Math.max(screenHeight - paddingPx * 2, 10);
  const scale = clampScale(Math.min(availW / worldWidth, availH / worldHeight));
  const worldCenterX = (minX + maxX) / 2;
  const worldCenterY = (minY + maxY) / 2;
  const offsetX = screenWidth / 2 - worldCenterX * scale;
  const offsetY = screenHeight / 2 - worldCenterY * scale;
  return { offsetX, offsetY, scale };
}
