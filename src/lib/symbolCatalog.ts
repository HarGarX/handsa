import type { LayerKind, RunType, SymbolType } from '../types/plan';

export interface SymbolCatalogEntry {
  type: SymbolType;
  label: string;
  /** wall-mounted symbols snap to & slide along the nearest wall, like doors/windows */
  wallMounted: boolean;
  /** nominal footprint (cm) used for rendering + wall-mounted overlap clamping */
  size: number;
}

/** Per-layer catalog of placeable fixture types, in the order they appear in the picker. */
export const SYMBOL_CATALOG: Record<Exclude<LayerKind, 'architectural'>, SymbolCatalogEntry[]> = {
  electrical: [
    { type: 'outlet', label: 'Outlet', wallMounted: true, size: 15 },
    { type: 'switch', label: 'Switch', wallMounted: true, size: 12 },
    { type: 'panel', label: 'Panel', wallMounted: true, size: 40 },
  ],
  plumbing: [
    { type: 'sink', label: 'Sink', wallMounted: false, size: 55 },
    { type: 'toilet', label: 'Toilet', wallMounted: false, size: 40 },
    { type: 'shower', label: 'Shower', wallMounted: false, size: 90 },
    { type: 'water-heater', label: 'Water heater', wallMounted: false, size: 50 },
    { type: 'valve', label: 'Valve', wallMounted: false, size: 15 },
  ],
  'lighting-power-hvac': [
    { type: 'light-ceiling', label: 'Ceiling light', wallMounted: false, size: 30 },
    { type: 'light-wall', label: 'Wall light', wallMounted: true, size: 20 },
    { type: 'ac-unit', label: 'AC unit', wallMounted: true, size: 70 },
    { type: 'thermostat', label: 'Thermostat', wallMounted: true, size: 12 },
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

export const RUN_TYPE_BY_LAYER_KIND: Record<Exclude<LayerKind, 'architectural'>, RunType> = {
  electrical: 'circuit',
  plumbing: 'supply-pipe',
  'lighting-power-hvac': 'circuit',
};

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  circuit: 'Circuit',
  'supply-pipe': 'Supply pipe',
  'drain-pipe': 'Drain pipe',
};
