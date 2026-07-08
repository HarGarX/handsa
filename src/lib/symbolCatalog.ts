import type { LayerKind, RunType, SymbolType } from '../types/plan';

export interface SymbolCatalogEntry {
  type: SymbolType;
  label: string;
  /** wall-mounted symbols snap to & slide along the nearest wall, like doors/windows */
  wallMounted: boolean;
  /** nominal footprint (cm), local x-axis before rotation */
  width: number;
  /** nominal footprint (cm), local y-axis before rotation */
  depth: number;
  /** whether Select shows resize handles for this type (furniture only — fixture sizes are standardized) */
  resizable: boolean;
}

function fixture(type: SymbolType, label: string, wallMounted: boolean, size: number): SymbolCatalogEntry {
  return { type, label, wallMounted, width: size, depth: size, resizable: false };
}

function furniture(
  type: SymbolType,
  label: string,
  width: number,
  depth: number,
  wallMounted = false,
): SymbolCatalogEntry {
  return { type, label, wallMounted, width, depth, resizable: true };
}

/** Per-layer catalog of placeable fixture types, in the order they appear in the picker. */
export const SYMBOL_CATALOG: Record<Exclude<LayerKind, 'architectural'>, SymbolCatalogEntry[]> = {
  electrical: [
    fixture('outlet', 'Outlet', true, 15),
    fixture('switch', 'Switch', true, 12),
    fixture('panel', 'Panel', true, 40),
  ],
  plumbing: [
    fixture('sink', 'Sink', false, 55),
    fixture('toilet', 'Toilet', false, 40),
    fixture('shower', 'Shower', false, 90),
    fixture('water-heater', 'Water heater', false, 50),
    fixture('valve', 'Valve', false, 15),
  ],
  'lighting-power-hvac': [
    fixture('light-ceiling', 'Ceiling light', false, 30),
    fixture('light-wall', 'Wall light', true, 20),
    fixture('ac-unit', 'AC unit', true, 70),
    fixture('thermostat', 'Thermostat', true, 12),
  ],
  furniture: [
    furniture('bed', 'Bed', 150, 200),
    furniture('sofa', 'Sofa', 180, 90),
    furniture('sectional', 'Sectional', 250, 160),
    furniture('dining-table', 'Dining table', 150, 90),
    furniture('dining-table-round', 'Round table', 120, 120),
    furniture('chair', 'Chair', 45, 45),
    furniture('counter', 'Counter', 300, 60, true),
    furniture('island', 'Island', 150, 90),
    furniture('wardrobe', 'Wardrobe', 120, 60, true),
    furniture('desk', 'Desk', 120, 60),
  ],
};

export function symbolCatalogFor(kind: LayerKind): SymbolCatalogEntry[] {
  return kind === 'architectural' ? [] : SYMBOL_CATALOG[kind];
}

export function symbolCatalogEntry(type: SymbolType): SymbolCatalogEntry {
  for (const list of Object.values(SYMBOL_CATALOG)) {
    const found = list.find((e) => e.type === type);
    if (found) return found;
  }
  throw new Error(`Unknown symbol type: ${type}`);
}

/** Resolves a symbol's actual footprint: its own width/depth override, falling back to the catalog default. */
export function symbolFootprint(symbol: { type: SymbolType; width?: number; depth?: number }): {
  width: number;
  depth: number;
} {
  const entry = symbolCatalogEntry(symbol.type);
  return { width: symbol.width ?? entry.width, depth: symbol.depth ?? entry.depth };
}

// Furniture has no wiring/piping runs, so it's intentionally absent here —
// callers should only offer the Run tool for layer kinds present in this map.
export const RUN_TYPE_BY_LAYER_KIND: Partial<Record<Exclude<LayerKind, 'architectural'>, RunType>> = {
  electrical: 'circuit',
  plumbing: 'supply-pipe',
  'lighting-power-hvac': 'circuit',
};

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  circuit: 'Circuit',
  'supply-pipe': 'Supply pipe',
  'drain-pipe': 'Drain pipe',
};
