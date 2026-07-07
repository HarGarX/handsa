import type { Opening, Wall } from '../types/plan';
import { wallLength } from './segment';

export interface OpeningExtent {
  id: string;
  tMin: number;
  tMax: number;
}

/** Returns the [tMin, tMax] extent (in parametric wall units) occupied by an opening. */
export function openingExtent(opening: Opening, wall: Wall): OpeningExtent {
  const len = wallLength(wall.start, wall.end);
  const halfT = len === 0 ? 0 : opening.width / 2 / len;
  return { id: opening.id, tMin: opening.t - halfT, tMax: opening.t + halfT };
}

/** True if the wall is too short to fit the opening's width at all. */
export function isOpeningInvalid(opening: Opening, wall: Wall): boolean {
  const len = wallLength(wall.start, wall.end);
  return opening.width >= len;
}

/**
 * Clamps a desired parametric position `desiredT` for `openingId` on `wall` so that:
 *  - the opening never extends past the wall's endpoints
 *  - the opening never overlaps any other opening on the same wall
 *
 * `allOpenings` should be all openings in the plan; this filters to the wall internally.
 */
export function clampOpeningT(
  wall: Wall,
  allOpenings: Opening[],
  openingId: string,
  desiredT: number,
  width: number,
): number {
  const len = wallLength(wall.start, wall.end);
  if (len === 0) return 0.5;

  const halfT = Math.min(0.5, width / 2 / len);
  let t = Math.min(1 - halfT, Math.max(halfT, desiredT));

  const others = allOpenings
    .filter((o) => o.wallId === wall.id && o.id !== openingId)
    .map((o) => openingExtent(o, wall))
    .sort((a, b) => a.tMin - b.tMin);

  // Push t away from any overlapping neighbor, iterating until stable or bailing out.
  for (let iter = 0; iter < others.length + 1; iter++) {
    let moved = false;
    for (const other of others) {
      const tMin = t - halfT;
      const tMax = t + halfT;
      const overlaps = tMin < other.tMax && tMax > other.tMin;
      if (!overlaps) continue;
      // Decide which side to push toward based on which is closer.
      const distToPushLeft = tMax - other.tMin; // amount to move left so tMax == other.tMin
      const distToPushRight = other.tMax - tMin; // amount to move right so tMin == other.tMax
      if (distToPushLeft <= distToPushRight) {
        t = other.tMin - halfT;
      } else {
        t = other.tMax + halfT;
      }
      t = Math.min(1 - halfT, Math.max(halfT, t));
      moved = true;
    }
    if (!moved) break;
  }

  return t;
}
