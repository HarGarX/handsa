// Core data model. All geometry values are in world centimeters unless noted.

export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number; // cm, default 15
}

export type OpeningType = 'door' | 'window';
export type Hinge = 'start' | 'end';
export type Swing = 'left' | 'right';

export interface Opening {
  id: string;
  wallId: string;
  type: OpeningType;
  t: number; // 0..1, position of opening CENTER along wall from start to end
  width: number; // cm
  hinge?: Hinge; // doors only
  swing?: Swing; // doors only
}

export interface Label {
  id: string;
  position: Point;
  text: string;
  fontSize: number; // cm-based so it scales with zoom
}

export interface Plan {
  id: string;
  name: string;
  walls: Wall[];
  openings: Opening[];
  labels: Label[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_WALL_THICKNESS = 15;
export const DEFAULT_DOOR_WIDTH = 90;
export const DEFAULT_WINDOW_WIDTH = 120;

export function createEmptyPlan(id: string, name: string): Plan {
  const now = new Date().toISOString();
  return {
    id,
    name,
    walls: [],
    openings: [],
    labels: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Type guard used to validate imported JSON before accepting it as a Plan. */
export function isValidPlanShape(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string') return false;
  if (!Array.isArray(v.walls) || !Array.isArray(v.openings) || !Array.isArray(v.labels)) {
    return false;
  }
  if (typeof v.createdAt !== 'string' || typeof v.updatedAt !== 'string') return false;

  const isPoint = (p: unknown): p is Point =>
    typeof p === 'object' && p !== null &&
    typeof (p as Point).x === 'number' && typeof (p as Point).y === 'number';

  for (const w of v.walls) {
    if (typeof w !== 'object' || w === null) return false;
    const wall = w as Record<string, unknown>;
    if (typeof wall.id !== 'string') return false;
    if (!isPoint(wall.start) || !isPoint(wall.end)) return false;
    if (typeof wall.thickness !== 'number') return false;
  }

  for (const o of v.openings) {
    if (typeof o !== 'object' || o === null) return false;
    const op = o as Record<string, unknown>;
    if (typeof op.id !== 'string' || typeof op.wallId !== 'string') return false;
    if (op.type !== 'door' && op.type !== 'window') return false;
    if (typeof op.t !== 'number' || typeof op.width !== 'number') return false;
  }

  for (const l of v.labels) {
    if (typeof l !== 'object' || l === null) return false;
    const label = l as Record<string, unknown>;
    if (typeof label.id !== 'string' || typeof label.text !== 'string') return false;
    if (!isPoint(label.position) || typeof label.fontSize !== 'number') return false;
  }

  return true;
}
