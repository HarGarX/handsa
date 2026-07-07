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

// --- Layers (Phase 2: multi-discipline overlays) ---
//
// Walls/openings/labels above predate the layer system and conceptually
// belong to the always-present "architectural" layer; they don't carry an
// explicit layerId to avoid a breaking migration. Symbols and runs below are
// the new layer-aware entities and always reference one of the non-
// architectural layers via layerId.

export type LayerKind = 'architectural' | 'electrical' | 'plumbing' | 'lighting-power-hvac';

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  color: string; // accent color used for this layer's symbols/runs when active
  visible: boolean;
}

export type SymbolType =
  // electrical
  | 'outlet'
  | 'switch'
  | 'panel'
  // plumbing
  | 'sink'
  | 'toilet'
  | 'shower'
  | 'water-heater'
  | 'valve'
  // lighting / power / hvac
  | 'light-ceiling'
  | 'light-wall'
  | 'ac-unit'
  | 'thermostat';

export interface PlacedSymbol {
  id: string;
  layerId: string;
  type: SymbolType;
  position: Point;
  rotation: number; // degrees
  wallId?: string; // set for wall-mounted types (outlets, switches, wall lights, thermostats)
  t?: number; // 0..1 position along wallId, only set alongside wallId
}

export type RunType = 'circuit' | 'supply-pipe' | 'drain-pipe';

export interface Run {
  id: string;
  layerId: string;
  type: RunType;
  points: Point[];
}

export interface Plan {
  id: string;
  name: string;
  walls: Wall[];
  openings: Opening[];
  labels: Label[];
  layers: Layer[];
  symbols: PlacedSymbol[];
  runs: Run[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_WALL_THICKNESS = 15;
export const DEFAULT_DOOR_WIDTH = 90;
export const DEFAULT_WINDOW_WIDTH = 120;

export const ARCHITECTURAL_LAYER_ID = 'layer-architectural';

/** The default layer set every new (or legacy, pre-layer) plan gets. */
export function createDefaultLayers(): Layer[] {
  return [
    { id: ARCHITECTURAL_LAYER_ID, name: 'Architectural', kind: 'architectural', color: '#374151', visible: true },
    { id: 'layer-electrical', name: 'Electrical', kind: 'electrical', color: '#f59e0b', visible: true },
    { id: 'layer-plumbing', name: 'Plumbing', kind: 'plumbing', color: '#0ea5e9', visible: true },
    {
      id: 'layer-lighting-power-hvac',
      name: 'Lighting, Sockets & AC',
      kind: 'lighting-power-hvac',
      color: '#22c55e',
      visible: true,
    },
  ];
}

export function createEmptyPlan(id: string, name: string): Plan {
  const now = new Date().toISOString();
  return {
    id,
    name,
    walls: [],
    openings: [],
    labels: [],
    layers: createDefaultLayers(),
    symbols: [],
    runs: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Fills in the layer system for a plan saved before it existed (or missing
 * fields for any other reason) with sensible defaults, rather than treating
 * older saved/exported plans as invalid. Safe to call on an already-current
 * plan (no-op).
 */
export function normalizePlan(plan: Plan): Plan {
  return {
    ...plan,
    layers: plan.layers && plan.layers.length > 0 ? plan.layers : createDefaultLayers(),
    symbols: plan.symbols ?? [],
    runs: plan.runs ?? [],
  };
}

/**
 * Type guard used to validate imported JSON before accepting it as a Plan.
 * `layers`/`symbols`/`runs` are optional here (backfilled by `normalizePlan`)
 * so plans exported before the layer system still import successfully.
 */
export function isValidPlanShape(value: unknown): value is Omit<Plan, 'layers' | 'symbols' | 'runs'> & {
  layers?: unknown;
  symbols?: unknown;
  runs?: unknown;
} {
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

  if (v.layers !== undefined) {
    if (!Array.isArray(v.layers)) return false;
    for (const l of v.layers) {
      if (typeof l !== 'object' || l === null) return false;
      const layer = l as Record<string, unknown>;
      if (typeof layer.id !== 'string' || typeof layer.name !== 'string') return false;
      if (typeof layer.kind !== 'string' || typeof layer.color !== 'string') return false;
      if (typeof layer.visible !== 'boolean') return false;
    }
  }

  if (v.symbols !== undefined) {
    if (!Array.isArray(v.symbols)) return false;
    for (const s of v.symbols) {
      if (typeof s !== 'object' || s === null) return false;
      const sym = s as Record<string, unknown>;
      if (typeof sym.id !== 'string' || typeof sym.layerId !== 'string') return false;
      if (typeof sym.type !== 'string') return false;
      if (!isPoint(sym.position) || typeof sym.rotation !== 'number') return false;
    }
  }

  if (v.runs !== undefined) {
    if (!Array.isArray(v.runs)) return false;
    for (const r of v.runs) {
      if (typeof r !== 'object' || r === null) return false;
      const run = r as Record<string, unknown>;
      if (typeof run.id !== 'string' || typeof run.layerId !== 'string') return false;
      if (typeof run.type !== 'string') return false;
      if (!Array.isArray(run.points) || !run.points.every(isPoint)) return false;
    }
  }

  return true;
}
