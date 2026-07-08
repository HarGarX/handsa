// Placement Assistant (Phase 4): a deterministic rules/scoring engine over the
// existing geometry, not an AI call — every input it needs (room polygon,
// bounding walls, door/window positions + swing arcs, already-placed symbols
// on any layer) already exists on `Plan`. See the README's "Placement
// Assistant" section for the design rationale.

import type { Layer, Opening, PlacedSymbol, Point, SymbolType, Wall } from '../types/plan';
import type { Room } from './rooms';
import { pointAt, projectPointToSegment, unitNormal, wallLength } from './segment';
import { openingExtent } from './opening';
import { resolveSymbolPosition } from './placedSymbol';
import { pointInPolygon } from './area';
import { symbolCatalogEntry } from '../lib/symbolCatalog';

const WALL_MATCH_TOLERANCE_CM = 3;
const WALL_GAP_CM = 3; // small breathing room between a piece's back and the wall face
const EDGE_MARGIN_CM = 8; // don't place flush against a free run's own ends (corner/obstacle)
const WALKWAY_DEPTH_CM = 70; // minimum clear lane kept in front of every door

export interface RoomWallSegment {
  wall: Wall;
  tStart: number;
  tEnd: number;
  lengthCm: number;
  /** Unit vector, perpendicular to the wall, pointing into this room. */
  inwardNormal: Point;
}

/**
 * Matches each edge of a detected room's polygon back to the original wall it
 * traces (room edges are wall-graph sub-spans, split at T-junctions/crossings,
 * so an edge is always a sub-range of exactly one wall's [0,1] span). Returns
 * one entry per polygon edge that could be matched, in polygon order, with
 * `null` for any edge that couldn't be matched to a wall (shouldn't happen for
 * a wall-bounded room, but kept defensive since this drives placement, not
 * just rendering).
 */
export function roomBoundingWalls(room: Room, walls: Wall[]): Array<RoomWallSegment | null> {
  const n = room.points.length;
  const segments: Array<RoomWallSegment | null> = [];

  for (let i = 0; i < n; i++) {
    const p0 = room.points[i]!;
    const p1 = room.points[(i + 1) % n]!;

    let best: { wall: Wall; t0: number; t1: number; dist: number } | null = null;
    for (const wall of walls) {
      if (wallLength(wall.start, wall.end) === 0) continue;
      const proj0 = projectPointToSegment(p0, wall.start, wall.end);
      const proj1 = projectPointToSegment(p1, wall.start, wall.end);
      const dist = Math.max(proj0.distance, proj1.distance);
      if (dist > WALL_MATCH_TOLERANCE_CM) continue;
      if (Math.abs(proj0.t - proj1.t) < 1e-4) continue; // degenerate zero-length match
      if (!best || dist < best.dist) best = { wall, t0: proj0.t, t1: proj1.t, dist };
    }

    if (!best) {
      segments.push(null);
      continue;
    }

    const tStart = Math.min(best.t0, best.t1);
    const tEnd = Math.max(best.t0, best.t1);
    let inwardNormal = unitNormal(best.wall.start, best.wall.end);
    const mid = pointAt(best.wall.start, best.wall.end, (tStart + tEnd) / 2);
    const towardCentroid = { x: room.centroid.x - mid.x, y: room.centroid.y - mid.y };
    if (inwardNormal.x * towardCentroid.x + inwardNormal.y * towardCentroid.y < 0) {
      inwardNormal = { x: -inwardNormal.x, y: -inwardNormal.y };
    }

    segments.push({
      wall: best.wall,
      tStart,
      tEnd,
      lengthCm: (tEnd - tStart) * wallLength(best.wall.start, best.wall.end),
      inwardNormal,
    });
  }

  return segments;
}

interface Interval {
  tMin: number;
  tMax: number;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.tMin - b.tMin);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.tMin <= last.tMax) last.tMax = Math.max(last.tMax, iv.tMax);
    else merged.push({ ...iv });
  }
  return merged;
}

/** Sub-intervals of `segment` occupied by a door/window or a wall-mounted symbol already on this wall span. */
function occupiedIntervals(segment: RoomWallSegment, openings: Opening[], symbols: PlacedSymbol[]): Interval[] {
  const wallLen = wallLength(segment.wall.start, segment.wall.end);
  const raw: Interval[] = [];

  for (const o of openings) {
    if (o.wallId !== segment.wall.id) continue;
    if (o.t < segment.tStart - 1e-6 || o.t > segment.tEnd + 1e-6) continue;
    const ext = openingExtent(o, segment.wall);
    raw.push({ tMin: Math.max(segment.tStart, ext.tMin), tMax: Math.min(segment.tEnd, ext.tMax) });
  }

  for (const s of symbols) {
    if (s.wallId !== segment.wall.id || s.t === undefined) continue;
    if (s.t < segment.tStart - 1e-6 || s.t > segment.tEnd + 1e-6) continue;
    const entry = symbolCatalogEntry(s.type);
    const width = s.width ?? entry.width;
    const halfT = wallLen === 0 ? 0 : width / 2 / wallLen;
    raw.push({ tMin: Math.max(segment.tStart, s.t - halfT), tMax: Math.min(segment.tEnd, s.t + halfT) });
  }

  return mergeIntervals(raw);
}

export interface FreeRun {
  tStart: number;
  tEnd: number;
  lengthCm: number;
}

/** The uncovered sub-runs of `segment`, after subtracting `occupied` (door/window/symbol) intervals. */
export function freeRuns(segment: RoomWallSegment, occupied: Interval[]): FreeRun[] {
  const wallLen = wallLength(segment.wall.start, segment.wall.end);
  const runs: FreeRun[] = [];
  let cursor = segment.tStart;
  for (const iv of occupied) {
    if (iv.tMin > cursor) runs.push({ tStart: cursor, tEnd: iv.tMin, lengthCm: (iv.tMin - cursor) * wallLen });
    cursor = Math.max(cursor, iv.tMax);
  }
  if (cursor < segment.tEnd) runs.push({ tStart: cursor, tEnd: segment.tEnd, lengthCm: (segment.tEnd - cursor) * wallLen });
  return runs;
}

interface ClearanceZone {
  wall: Wall;
  tMin: number;
  tMax: number;
  depthCm: number; // how far this zone extends inward from the wall face
}

/**
 * A door needs its swing arc (if it swings into this room) plus a walkway
 * lane kept clear regardless of swing direction, so people can actually pass
 * through it. Modeled as a single generous rectangle per door rather than an
 * exact quarter-circle — a conservative superset is the right tradeoff for a
 * suggestion engine (never suggest a spot a door could hit), at the cost of
 * occasionally ruling out a spot that would technically have been fine.
 */
function doorClearanceZones(segments: Array<RoomWallSegment | null>, openings: Opening[]): ClearanceZone[] {
  const zones: ClearanceZone[] = [];
  for (const segment of segments) {
    if (!segment) continue;
    for (const o of openings) {
      if (o.type !== 'door' || o.wallId !== segment.wall.id) continue;
      if (o.t < segment.tStart - 1e-6 || o.t > segment.tEnd + 1e-6) continue;
      const ext = openingExtent(o, segment.wall);
      const normal = unitNormal(segment.wall.start, segment.wall.end);
      const swingSign = (o.swing ?? 'left') === 'left' ? -1 : 1;
      const leafDir = { x: normal.x * swingSign, y: normal.y * swingSign };
      const swingsIntoRoom = leafDir.x * segment.inwardNormal.x + leafDir.y * segment.inwardNormal.y > 0;
      const depthCm = swingsIntoRoom ? Math.max(WALKWAY_DEPTH_CM, o.width) : WALKWAY_DEPTH_CM;
      zones.push({
        wall: segment.wall,
        tMin: Math.max(segment.tStart, ext.tMin),
        tMax: Math.min(segment.tEnd, ext.tMax),
        depthCm,
      });
    }
  }
  return zones;
}

/**
 * Conservative candidate-vs-clearance-zone overlap test: projects the
 * candidate's center onto the zone's wall (u = distance along the wall from
 * its start, v = signed inward distance from the wall face) and inflates the
 * zone by the candidate's own half-diagonal, so a "no overlap" result is safe
 * even though it isn't full rectangle-rectangle collision. Right tradeoff for
 * suggestions that the user reviews and can decline, not a hard constraint.
 */
function overlapsClearanceZone(center: Point, halfDiagonal: number, zone: ClearanceZone): boolean {
  const { wall } = zone;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return false;
  const tangent = { x: dx / len, y: dy / len };
  const normal = unitNormal(wall.start, wall.end);

  const rel = { x: center.x - wall.start.x, y: center.y - wall.start.y };
  const u = rel.x * tangent.x + rel.y * tangent.y;
  // Candidates are only ever generated on the room's own side of the wall
  // (offset along that room's inward normal), so folding both sides via
  // abs() is a harmless simplification here, not a correctness gap: it can
  // only make the exclusion more conservative on a side no candidate ever
  // occupies.
  const v = Math.abs(rel.x * normal.x + rel.y * normal.y);

  const uMin = zone.tMin * len - halfDiagonal;
  const uMax = zone.tMax * len + halfDiagonal;
  const vMax = zone.depthCm + halfDiagonal;

  return u >= uMin && u <= uMax && v <= vMax;
}

function circleOverlap(a: Point, aRadius: number, b: Point, bRadius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < aRadius + bRadius;
}

function halfDiagonalOf(width: number, depth: number): number {
  return Math.hypot(width, depth) / 2;
}

export interface PlacementSuggestion {
  id: string;
  type: SymbolType;
  position: Point;
  rotation: number;
  wallId?: string;
  t?: number;
  width: number;
  depth: number;
  score: number;
  rationale: string;
}

interface Obstacle {
  position: Point;
  radius: number;
}

/** Rotation (deg, SVG/clockwise convention) so a symbol's local -y edge (its "back") faces the given inward normal. */
function rotationFacingInward(inwardNormal: Point): number {
  const theta = Math.atan2(-inwardNormal.x, inwardNormal.y);
  return (theta * 180) / Math.PI;
}

const WALL_HUGGING_FREE_TYPES: SymbolType[] = ['sofa', 'sectional', 'bed', 'desk'];
const WALL_MOUNTED_SUGGESTIBLE_TYPES: SymbolType[] = ['tv-stand', 'wall-art', 'wardrobe'];

function bestClearRun(
  segments: Array<RoomWallSegment | null>,
  itemWidth: number,
  openings: Opening[],
  existingWallSymbols: PlacedSymbol[],
  clearanceZones: ClearanceZone[],
  obstacles: Obstacle[],
  itemHalfDiagonal: number,
  preferSegmentWallId?: string,
  avoidWallIds?: Set<string>,
): { segment: RoomWallSegment; t: number; lengthCm: number } | null {
  let best: { segment: RoomWallSegment; t: number; lengthCm: number; score: number } | null = null;

  for (const segment of segments) {
    if (!segment) continue;
    if (avoidWallIds?.has(segment.wall.id)) continue;

    const occupied = occupiedIntervals(segment, openings, existingWallSymbols);
    for (const run of freeRuns(segment, occupied)) {
      if (run.lengthCm < itemWidth + 2 * EDGE_MARGIN_CM) continue;

      const t = (run.tStart + run.tEnd) / 2;
      const point = pointAt(segment.wall.start, segment.wall.end, t);
      const center = {
        x: point.x + segment.inwardNormal.x * itemHalfDiagonal,
        y: point.y + segment.inwardNormal.y * itemHalfDiagonal,
      };

      if (clearanceZones.some((z) => overlapsClearanceZone(center, itemHalfDiagonal, z))) continue;
      if (obstacles.some((o) => circleOverlap(center, itemHalfDiagonal, o.position, o.radius))) continue;

      let score = run.lengthCm;
      if (preferSegmentWallId && segment.wall.id === preferSegmentWallId) score += 10_000;
      if (!best || score > best.score) best = { segment, t, lengthCm: run.lengthCm, score };
    }
  }

  return best;
}

/** Total width of window openings on a segment — used to find the room's "focal wall." */
function windowWidthOnSegment(segment: RoomWallSegment, openings: Opening[]): number {
  return openings
    .filter((o) => o.type === 'window' && o.wallId === segment.wall.id && o.t >= segment.tStart - 1e-6 && o.t <= segment.tEnd + 1e-6)
    .reduce((sum, o) => sum + o.width, 0);
}

function findFocalSegment(
  segments: Array<RoomWallSegment | null>,
  openings: Opening[],
): { segment: RoomWallSegment; reason: 'windows' | 'opposite-entry' | 'longest' } | null {
  const real = segments.filter((s): s is RoomWallSegment => s !== null);
  if (real.length === 0) return null;

  const byWindow = [...real].sort((a, b) => windowWidthOnSegment(b, openings) - windowWidthOnSegment(a, openings));
  if (byWindow[0] && windowWidthOnSegment(byWindow[0], openings) > 0) {
    return { segment: byWindow[0], reason: 'windows' };
  }

  const doors = openings.filter((o) => o.type === 'door' && real.some((s) => s.wall.id === o.wallId));
  if (doors.length > 0) {
    const mainDoor = [...doors].sort((a, b) => b.width - a.width)[0]!;
    const entrySegment = real.find((s) => s.wall.id === mainDoor.wallId);
    if (entrySegment) {
      const opposite = [...real].sort(
        (a, b) =>
          a.inwardNormal.x * entrySegment.inwardNormal.x +
          a.inwardNormal.y * entrySegment.inwardNormal.y -
          (b.inwardNormal.x * entrySegment.inwardNormal.x + b.inwardNormal.y * entrySegment.inwardNormal.y),
      )[0];
      if (opposite) return { segment: opposite, reason: 'opposite-entry' };
    }
  }

  return { segment: [...real].sort((a, b) => b.lengthCm - a.lengthCm)[0]!, reason: 'longest' };
}

export interface SuggestPlacementsParams {
  room: Room;
  walls: Wall[];
  openings: Opening[];
  symbols: PlacedSymbol[];
  layers: Layer[];
}

/**
 * v1 rule set (each directly checkable from data already on `Plan`):
 *  - clearance & traffic flow (door swing arcs + a walkway lane per door)
 *  - long-wall preference (sofa/bed/wardrobe/desk score higher against the
 *    longest uninterrupted wall segment)
 *  - focal-point orientation (seating faces the room's main window wall, or
 *    the wall opposite the main entry if there are no windows)
 *  - lighting-gap awareness (a floor lamp checks the Lighting layer's already
 *    -placed ceiling/wall lights and favors a corner far from existing light)
 *  - open-wall preference for wall art (favors the wall segment with the most
 *    uninterrupted open run)
 */
export function suggestPlacements({ room, walls, openings, symbols, layers }: SuggestPlacementsParams): PlacementSuggestion[] {
  const segments = roomBoundingWalls(room, walls);
  if (segments.every((s) => s === null)) return [];

  const layerKindById = new Map(layers.map((l) => [l.id, l.kind]));
  const symbolsInRoom = symbols.filter((s) => pointInPolygon(resolveSymbolPosition(s, walls), room.points));
  const furnitureInRoom = symbolsInRoom.filter((s) => layerKindById.get(s.layerId) === 'furniture');
  const lightingInRoom = symbolsInRoom.filter(
    (s) => layerKindById.get(s.layerId) === 'lighting-power-hvac' && (s.type === 'light-ceiling' || s.type === 'light-wall'),
  );
  const alreadyPlacedTypes = new Set(furnitureInRoom.map((s) => s.type));

  const clearanceZones = doorClearanceZones(segments, openings);
  const furnitureObstacles: Obstacle[] = furnitureInRoom.map((s) => {
    const entry = symbolCatalogEntry(s.type);
    const width = s.width ?? entry.width;
    const depth = s.depth ?? entry.depth;
    return { position: resolveSymbolPosition(s, walls), radius: halfDiagonalOf(width, depth) };
  });

  const suggestions: PlacementSuggestion[] = [];
  const chosenWallIdByType = new Map<SymbolType, string>();
  const focal = findFocalSegment(segments, openings);

  // --- Wall-hugging free-placed furniture: sofa, sectional, bed, desk ---
  for (const type of WALL_HUGGING_FREE_TYPES) {
    if (alreadyPlacedTypes.has(type)) continue;
    const entry = symbolCatalogEntry(type);
    const halfDiag = halfDiagonalOf(entry.width, entry.depth);
    const isSeating = type === 'sofa' || type === 'sectional';
    const preferWallId = isSeating && focal ? oppositeSegmentWallId(segments, focal.segment) : undefined;

    const best = bestClearRun(
      segments,
      entry.width,
      openings,
      furnitureInRoom.filter((s) => s.wallId !== undefined),
      clearanceZones,
      furnitureObstacles,
      halfDiag + WALL_GAP_CM,
      preferWallId,
    );
    if (!best) continue;

    const point = pointAt(best.segment.wall.start, best.segment.wall.end, best.t);
    const offset = entry.depth / 2 + WALL_GAP_CM;
    const position = {
      x: point.x + best.segment.inwardNormal.x * offset,
      y: point.y + best.segment.inwardNormal.y * offset,
    };
    const rotation = rotationFacingInward(best.segment.inwardNormal);

    let rationale = `Longest clear wall run here (${Math.round(best.lengthCm)} cm open), clear of door swings.`;
    if (isSeating && preferWallId && best.segment.wall.id === preferWallId) {
      rationale =
        focal!.reason === 'windows'
          ? `Faces the room's main window wall — natural focal point, and clear of door swings.`
          : `Faces the wall opposite the main entry, clear of door swings.`;
    }

    chosenWallIdByType.set(type, best.segment.wall.id);
    suggestions.push({
      id: `${room.id}:${type}`,
      type,
      position,
      rotation,
      width: entry.width,
      depth: entry.depth,
      score: best.lengthCm + (preferWallId && best.segment.wall.id === preferWallId ? 500 : 0),
      rationale,
    });
  }

  // --- Wall-mounted furniture: TV stand, wall art, wardrobe ---
  for (const type of WALL_MOUNTED_SUGGESTIBLE_TYPES) {
    if (alreadyPlacedTypes.has(type)) continue;
    const entry = symbolCatalogEntry(type);
    const sofaWallId = chosenWallIdByType.get('sofa') ?? chosenWallIdByType.get('sectional');

    const preferWallId = type === 'tv-stand' && focal ? focal.segment.wall.id : undefined;
    const avoidWallIds = type === 'tv-stand' && sofaWallId ? new Set([sofaWallId]) : undefined;

    const best = bestClearRun(
      segments,
      entry.width,
      openings,
      furnitureInRoom.filter((s) => s.wallId !== undefined),
      clearanceZones,
      furnitureObstacles,
      entry.width / 2, // wall-mounted candidates sit flush on the wall line, not offset inward
      preferWallId,
      avoidWallIds,
    );
    if (!best) continue;

    const len = wallLength(best.segment.wall.start, best.segment.wall.end);
    const halfT = len === 0 ? 0 : entry.width / 2 / len;
    const t = Math.min(best.segment.tEnd - halfT, Math.max(best.segment.tStart + halfT, best.t));
    const position = pointAt(best.segment.wall.start, best.segment.wall.end, t);
    const rotation = (Math.atan2(best.segment.wall.end.y - best.segment.wall.start.y, best.segment.wall.end.x - best.segment.wall.start.x) * 180) / Math.PI;

    const rationale =
      type === 'tv-stand'
        ? focal?.segment.wall.id === best.segment.wall.id
          ? `On the room's focal wall — visible from typical seating across the room.`
          : `Longest clear wall run available (${Math.round(best.lengthCm)} cm open).`
        : type === 'wall-art'
          ? `Longest uninterrupted open wall (${Math.round(best.lengthCm)} cm) — thin footprint stays clear of traffic.`
          : `Longest clear wall run (${Math.round(best.lengthCm)} cm open).`;

    suggestions.push({
      id: `${room.id}:${type}`,
      type,
      position,
      rotation,
      wallId: best.segment.wall.id,
      t,
      width: entry.width,
      depth: entry.depth,
      score: best.lengthCm,
      rationale,
    });
  }

  // --- Floor lamp: corner farthest from existing Lighting-layer fixtures ---
  if (!alreadyPlacedTypes.has('floor-lamp')) {
    const entry = symbolCatalogEntry('floor-lamp');
    const halfDiag = halfDiagonalOf(entry.width, entry.depth);
    const offset = halfDiag + WALL_GAP_CM;

    let bestCorner: { position: Point; score: number } | null = null;
    const n = room.points.length;
    for (let i = 0; i < n; i++) {
      const prev = segments[(i - 1 + n) % n];
      const cur = segments[i];
      if (!prev || !cur) continue;
      const avgNormal = {
        x: prev.inwardNormal.x + cur.inwardNormal.x,
        y: prev.inwardNormal.y + cur.inwardNormal.y,
      };
      const len = Math.hypot(avgNormal.x, avgNormal.y);
      if (len === 0) continue;
      const insetDir = { x: avgNormal.x / len, y: avgNormal.y / len };
      const corner = room.points[i]!;
      const position = { x: corner.x + insetDir.x * offset, y: corner.y + insetDir.y * offset };

      if (clearanceZones.some((z) => overlapsClearanceZone(position, halfDiag, z))) continue;
      if (furnitureObstacles.some((o) => circleOverlap(position, halfDiag, o.position, o.radius))) continue;

      const darkness =
        lightingInRoom.length === 0
          ? 0
          : Math.min(...lightingInRoom.map((s) => Math.hypot(resolveSymbolPosition(s, walls).x - position.x, resolveSymbolPosition(s, walls).y - position.y)));
      const spaciousness =
        furnitureObstacles.length === 0 ? 0 : Math.min(...furnitureObstacles.map((o) => Math.hypot(o.position.x - position.x, o.position.y - position.y)));
      const score = darkness * 2 + spaciousness;

      if (!bestCorner || score > bestCorner.score) bestCorner = { position, score };
    }

    if (bestCorner) {
      const rationale =
        lightingInRoom.length > 0
          ? `Corner farthest from the existing ceiling/wall lights — brightens the dimmest part of the room.`
          : `Open corner, clear of door swings and other furniture.`;
      suggestions.push({
        id: `${room.id}:floor-lamp`,
        type: 'floor-lamp',
        position: bestCorner.position,
        rotation: 0,
        width: entry.width,
        depth: entry.depth,
        score: bestCorner.score,
        rationale,
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

function oppositeSegmentWallId(segments: Array<RoomWallSegment | null>, from: RoomWallSegment): string | undefined {
  const real = segments.filter((s): s is RoomWallSegment => s !== null && s.wall.id !== from.wall.id);
  if (real.length === 0) return undefined;
  const opposite = [...real].sort(
    (a, b) =>
      a.inwardNormal.x * from.inwardNormal.x + a.inwardNormal.y * from.inwardNormal.y -
      (b.inwardNormal.x * from.inwardNormal.x + b.inwardNormal.y * from.inwardNormal.y),
  )[0];
  return opposite?.wall.id;
}
