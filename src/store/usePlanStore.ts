import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Label, Opening, PlacedSymbol, Plan, Point, Run, SymbolType, Wall } from '../types/plan';
import { ARCHITECTURAL_LAYER_ID, createEmptyPlan } from '../types/plan';
import type { Viewport } from '../geometry/viewport';
import { clampScale, zoomAt as geomZoomAt, panBy as geomPanBy, fitToPoints } from '../geometry/viewport';
import type { EndpointRef } from '../geometry/endpoints';
import { symbolCatalogFor } from '../lib/symbolCatalog';
import type { InteractionState, JointStyle, SelectionEntry, SnapIncrement, ToolId, UnitSystem } from './types';
import {
  loadActivePlanId,
  loadPlan,
  loadPlansIndex,
  savePlan,
  saveActivePlanId,
  deletePlanFromStorage,
  scheduleAutosave,
  type PlanSummary,
} from './persistence';

const HISTORY_CAP = 100;

function deepClonePlan(plan: Plan): Plan {
  return JSON.parse(JSON.stringify(plan)) as Plan;
}

function touchedNow(plan: Plan): Plan {
  return { ...plan, updatedAt: new Date().toISOString() };
}

function initialPlan(): Plan {
  const existingId = loadActivePlanId();
  if (existingId) {
    const existing = loadPlan(existingId);
    if (existing) return existing;
  }
  // Fall back to the most recently updated plan in the index, if any.
  const index = loadPlansIndex();
  if (index.length > 0) {
    const sorted = [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const first = sorted[0];
    if (first) {
      const p = loadPlan(first.id);
      if (p) return p;
    }
  }
  const fresh = createEmptyPlan(uuidv4(), 'Untitled Plan');
  savePlan(fresh);
  saveActivePlanId(fresh.id);
  return fresh;
}

const emptyInteraction: InteractionState = {
  wallDraft: null,
  measureDraft: null,
  openingGhost: null,
  runDraft: null,
  symbolGhost: null,
  marquee: null,
  hoveredEndpoint: null,
  pendingLabel: null,
  editingLabelId: null,
  cursorWorld: null,
  isPanning: false,
  isSpaceDown: false,
};

export interface ClipboardContent {
  walls: Wall[];
  openings: Opening[];
  labels: Label[];
  symbols: PlacedSymbol[];
  runs: Run[];
}

export interface PlanStore {
  plan: Plan;
  pendingBase: Plan | null;
  past: Plan[];
  future: Plan[];
  clipboard: ClipboardContent | null;

  selection: SelectionEntry[];
  viewport: Viewport;
  activeTool: ToolId;
  activeLayerId: string;
  activeSymbolType: SymbolType | null;
  snapEnabled: boolean;
  snapIncrement: SnapIncrement;
  jointStyle: JointStyle;
  unitSystem: UnitSystem;
  exportScaleDenominator: number;
  interaction: InteractionState;
  propertiesPanelCollapsed: boolean;
  plansIndex: PlanSummary[];
  showPlansModal: boolean;
  showShortcutModal: boolean;
  toastMessage: string | null;

  // --- transactions / history ---
  beginTransaction: () => void;
  updateLive: (updater: (plan: Plan) => Plan) => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;
  commitImmediate: (updater: (plan: Plan) => Plan) => void;
  undo: () => void;
  redo: () => void;

  // --- walls ---
  addWall: (wall: Wall) => void;
  updateWallLive: (id: string, patch: Partial<Wall>) => void;
  moveEndpointGroupLive: (refs: EndpointRef[], newPoint: Point) => void;
  setWallEndpointsLive: (updates: { id: string; start: Point; end: Point }[]) => void;
  deleteEntities: (entries: SelectionEntry[]) => void;

  // --- openings ---
  addOpening: (opening: Opening) => void;
  updateOpeningLive: (id: string, patch: Partial<Opening>) => void;
  cycleDoorState: (id: string) => void;

  // --- labels ---
  addLabel: (label: Label) => void;
  updateLabelLive: (id: string, patch: Partial<Label>) => void;

  // --- symbols (electrical/plumbing/lighting-power-hvac fixtures) ---
  addSymbol: (symbol: PlacedSymbol) => void;
  updateSymbolLive: (id: string, patch: Partial<PlacedSymbol>) => void;

  // --- runs (circuit / pipe polylines) ---
  addRun: (run: Run) => void;
  updateRunLive: (id: string, patch: Partial<Run>) => void;

  // --- layers ---
  setActiveLayer: (layerId: string) => void;
  setActiveSymbolType: (type: SymbolType | null) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;

  // --- plan meta ---
  renamePlan: (name: string) => void;

  // --- selection ---
  select: (entries: SelectionEntry[], additive?: boolean) => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;

  // --- viewport ---
  setViewport: (vp: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAtScreenPoint: (screenPoint: Point, factor: number) => void;
  zoomToFit: (screenWidth: number, screenHeight: number) => void;

  // --- tool / snap ---
  setActiveTool: (tool: ToolId) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapIncrement: (inc: SnapIncrement) => void;
  setJointStyle: (style: JointStyle) => void;
  setUnitSystem: (unit: UnitSystem) => void;
  setExportScaleDenominator: (denominator: number) => void;

  // --- interaction (transient) ---
  setInteraction: (patch: Partial<InteractionState>) => void;
  resetInteraction: () => void;

  // --- UI ---
  setPropertiesPanelCollapsed: (collapsed: boolean) => void;
  setShowPlansModal: (show: boolean) => void;
  setShowShortcutModal: (show: boolean) => void;
  setToast: (message: string | null) => void;

  // --- multi-plan management ---
  refreshPlansIndex: () => void;
  newPlan: () => void;
  duplicatePlan: () => void;
  switchPlan: (id: string) => void;
  deletePlan: (id: string) => void;

  // --- import/export ---
  importPlan: (plan: Plan) => void;
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  plan: initialPlan(),
  pendingBase: null,
  past: [],
  future: [],
  clipboard: null,

  selection: [],
  viewport: { offsetX: 0, offsetY: 0, scale: 0.5 },
  activeTool: 'select',
  activeLayerId: ARCHITECTURAL_LAYER_ID,
  activeSymbolType: null,
  snapEnabled: true,
  snapIncrement: 5,
  jointStyle: 'square',
  unitSystem: 'metric',
  exportScaleDenominator: 100,
  interaction: emptyInteraction,
  propertiesPanelCollapsed: false,
  plansIndex: loadPlansIndex(),
  showPlansModal: false,
  showShortcutModal: false,
  toastMessage: null,

  beginTransaction: () => {
    if (get().pendingBase) return;
    set({ pendingBase: deepClonePlan(get().plan) });
  },

  updateLive: (updater) => {
    if (!get().pendingBase) {
      set({ pendingBase: deepClonePlan(get().plan) });
    }
    set((state) => ({ plan: updater(state.plan) }));
  },

  commitTransaction: () => {
    const { pendingBase, plan, past } = get();
    if (!pendingBase) return;
    const finalPlan = touchedNow(plan);
    const newPast = [...past, pendingBase].slice(-HISTORY_CAP);
    set({ plan: finalPlan, past: newPast, future: [], pendingBase: null });
    scheduleAutosave(finalPlan);
  },

  cancelTransaction: () => {
    const { pendingBase } = get();
    if (!pendingBase) return;
    set({ plan: pendingBase, pendingBase: null });
  },

  commitImmediate: (updater) => {
    const { plan, past } = get();
    const base = deepClonePlan(plan);
    const finalPlan = touchedNow(updater(plan));
    const newPast = [...past, base].slice(-HISTORY_CAP);
    set({ plan: finalPlan, past: newPast, future: [], pendingBase: null });
    scheduleAutosave(finalPlan);
  },

  undo: () => {
    const { past, plan, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1]!;
    const newPast = past.slice(0, -1);
    const newFuture = [plan, ...future].slice(0, HISTORY_CAP);
    set({ plan: previous, past: newPast, future: newFuture, selection: [] });
    scheduleAutosave(previous);
  },

  redo: () => {
    const { past, plan, future } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    const newFuture = future.slice(1);
    const newPast = [...past, plan].slice(-HISTORY_CAP);
    set({ plan: next, past: newPast, future: newFuture, selection: [] });
    scheduleAutosave(next);
  },

  addWall: (wall) => {
    get().commitImmediate((plan) => ({ ...plan, walls: [...plan.walls, wall] }));
  },

  updateWallLive: (id, patch) => {
    get().updateLive((plan) => ({
      ...plan,
      walls: plan.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  },

  moveEndpointGroupLive: (refs, newPoint) => {
    if (refs.length === 0) return;
    get().updateLive((p) => ({
      ...p,
      walls: p.walls.map((w) => {
        const ref = refs.find((r) => r.wallId === w.id);
        if (!ref) return w;
        return ref.end === 'start' ? { ...w, start: newPoint } : { ...w, end: newPoint };
      }),
    }));
  },

  setWallEndpointsLive: (updates) => {
    const byId = new Map(updates.map((u) => [u.id, u]));
    get().updateLive((plan) => ({
      ...plan,
      walls: plan.walls.map((w) => {
        const u = byId.get(w.id);
        return u ? { ...w, start: u.start, end: u.end } : w;
      }),
    }));
  },

  deleteEntities: (entries) => {
    const wallIds = new Set(entries.filter((e) => e.type === 'wall').map((e) => e.id));
    const openingIds = new Set(entries.filter((e) => e.type === 'opening').map((e) => e.id));
    const labelIds = new Set(entries.filter((e) => e.type === 'label').map((e) => e.id));
    const symbolIds = new Set(entries.filter((e) => e.type === 'symbol').map((e) => e.id));
    const runIds = new Set(entries.filter((e) => e.type === 'run').map((e) => e.id));
    if (
      wallIds.size === 0 &&
      openingIds.size === 0 &&
      labelIds.size === 0 &&
      symbolIds.size === 0 &&
      runIds.size === 0
    ) {
      return;
    }
    get().commitImmediate((plan) => ({
      ...plan,
      walls: plan.walls.filter((w) => !wallIds.has(w.id)),
      // deleting a wall deletes its openings and any wall-mounted symbols too
      openings: plan.openings.filter((o) => !openingIds.has(o.id) && !wallIds.has(o.wallId)),
      labels: plan.labels.filter((l) => !labelIds.has(l.id)),
      symbols: plan.symbols.filter((s) => !symbolIds.has(s.id) && !(s.wallId && wallIds.has(s.wallId))),
      runs: plan.runs.filter((r) => !runIds.has(r.id)),
    }));
    set({ selection: [] });
  },

  addOpening: (opening) => {
    get().commitImmediate((plan) => ({ ...plan, openings: [...plan.openings, opening] }));
  },

  updateOpeningLive: (id, patch) => {
    get().updateLive((plan) => ({
      ...plan,
      openings: plan.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  },

  cycleDoorState: (id) => {
    get().commitImmediate((plan) => ({
      ...plan,
      openings: plan.openings.map((o) => {
        if (o.id !== id || o.type !== 'door') return o;
        // cycle: hinge start+swing left -> start+right -> end+left -> end+right -> back
        const hinge = o.hinge ?? 'start';
        const swing = o.swing ?? 'left';
        if (hinge === 'start' && swing === 'left') return { ...o, hinge: 'start', swing: 'right' };
        if (hinge === 'start' && swing === 'right') return { ...o, hinge: 'end', swing: 'left' };
        if (hinge === 'end' && swing === 'left') return { ...o, hinge: 'end', swing: 'right' };
        return { ...o, hinge: 'start', swing: 'left' };
      }),
    }));
  },

  addLabel: (label) => {
    get().commitImmediate((plan) => ({ ...plan, labels: [...plan.labels, label] }));
  },

  updateLabelLive: (id, patch) => {
    get().updateLive((plan) => ({
      ...plan,
      labels: plan.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  },

  addSymbol: (symbol) => {
    get().commitImmediate((plan) => ({ ...plan, symbols: [...plan.symbols, symbol] }));
  },

  updateSymbolLive: (id, patch) => {
    get().updateLive((plan) => ({
      ...plan,
      symbols: plan.symbols.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  },

  addRun: (run) => {
    get().commitImmediate((plan) => ({ ...plan, runs: [...plan.runs, run] }));
  },

  updateRunLive: (id, patch) => {
    get().updateLive((plan) => ({
      ...plan,
      runs: plan.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  },

  setActiveLayer: (layerId) => {
    get().cancelTransaction();
    const { plan } = get();
    const layer = plan.layers.find((l) => l.id === layerId);
    const catalog = symbolCatalogFor(layer?.kind ?? 'architectural');
    set({
      activeLayerId: layerId,
      activeTool: 'select',
      activeSymbolType: catalog.length > 0 ? catalog[0]!.type : null,
      interaction: emptyInteraction,
      selection: [],
    });
  },

  setActiveSymbolType: (type) => set({ activeSymbolType: type }),

  setLayerVisibility: (layerId, visible) => {
    const { plan } = get();
    const updated = touchedNow({
      ...plan,
      layers: plan.layers.map((l) => (l.id === layerId ? { ...l, visible } : l)),
    });
    // Not pushed to undo history: toggling visibility is a view preference,
    // not a content edit, even though it's persisted on the plan.
    set({ plan: updated });
    scheduleAutosave(updated);
  },

  renamePlan: (name) => {
    get().commitImmediate((plan) => ({ ...plan, name }));
  },

  select: (entries, additive = false) => {
    if (!additive) {
      set({ selection: entries });
      return;
    }
    set((state) => {
      const next = [...state.selection];
      for (const e of entries) {
        const idx = next.findIndex((s) => s.type === e.type && s.id === e.id);
        if (idx >= 0) next.splice(idx, 1); // shift-click toggles
        else next.push(e);
      }
      return { selection: next };
    });
  },

  clearSelection: () => set({ selection: [] }),

  deleteSelected: () => {
    const { selection } = get();
    get().deleteEntities(selection);
  },

  nudgeSelected: (dx, dy) => {
    const { selection, plan } = get();
    if (selection.length === 0) return;
    const wallIds = new Set(selection.filter((s) => s.type === 'wall').map((s) => s.id));
    const labelIds = new Set(selection.filter((s) => s.type === 'label').map((s) => s.id));
    const selectedSymbolIds = new Set(selection.filter((s) => s.type === 'symbol').map((s) => s.id));
    const runIds = new Set(selection.filter((s) => s.type === 'run').map((s) => s.id));
    // Only free-placed symbols have a position to translate; wall-mounted
    // symbols and openings are parametric (t along a wall) and aren't
    // meaningfully "nudged" independent of their host wall.
    const freeSymbolIds = new Set(
      plan.symbols.filter((s) => selectedSymbolIds.has(s.id) && !s.wallId).map((s) => s.id),
    );
    if (wallIds.size === 0 && labelIds.size === 0 && freeSymbolIds.size === 0 && runIds.size === 0) return;

    get().commitImmediate((p) => ({
      ...p,
      walls: p.walls.map((w) =>
        wallIds.has(w.id)
          ? { ...w, start: { x: w.start.x + dx, y: w.start.y + dy }, end: { x: w.end.x + dx, y: w.end.y + dy } }
          : w,
      ),
      labels: p.labels.map((l) =>
        labelIds.has(l.id) ? { ...l, position: { x: l.position.x + dx, y: l.position.y + dy } } : l,
      ),
      symbols: p.symbols.map((s) =>
        freeSymbolIds.has(s.id) ? { ...s, position: { x: s.position.x + dx, y: s.position.y + dy } } : s,
      ),
      runs: p.runs.map((r) =>
        runIds.has(r.id) ? { ...r, points: r.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) } : r,
      ),
    }));
  },

  copySelection: () => {
    const { selection, plan } = get();
    const wallIds = new Set(selection.filter((s) => s.type === 'wall').map((s) => s.id));
    const walls = plan.walls.filter((w) => wallIds.has(w.id));
    // A copied wall brings its openings and any wall-mounted symbols along.
    const openings = plan.openings.filter(
      (o) => wallIds.has(o.wallId) || selection.some((s) => s.type === 'opening' && s.id === o.id),
    );
    const labels = plan.labels.filter((l) => selection.some((s) => s.type === 'label' && s.id === l.id));
    const symbols = plan.symbols.filter(
      (sym) => (sym.wallId && wallIds.has(sym.wallId)) || selection.some((s) => s.type === 'symbol' && s.id === sym.id),
    );
    const runs = plan.runs.filter((r) => selection.some((s) => s.type === 'run' && s.id === r.id));

    if (walls.length + openings.length + labels.length + symbols.length + runs.length === 0) return;
    set({ clipboard: { walls, openings, labels, symbols, runs } });
  },

  pasteClipboard: () => {
    const { clipboard } = get();
    if (!clipboard) return;
    const OFFSET = 20; // cm, so a paste never lands exactly on top of the original

    const wallIdMap = new Map<string, string>();
    const newWalls: Wall[] = clipboard.walls.map((w) => {
      const newId = uuidv4();
      wallIdMap.set(w.id, newId);
      return {
        ...w,
        id: newId,
        start: { x: w.start.x + OFFSET, y: w.start.y + OFFSET },
        end: { x: w.end.x + OFFSET, y: w.end.y + OFFSET },
      };
    });
    const newOpenings: Opening[] = clipboard.openings.map((o) => ({
      ...o,
      id: uuidv4(),
      wallId: wallIdMap.get(o.wallId) ?? o.wallId,
    }));
    const newLabels: Label[] = clipboard.labels.map((l) => ({
      ...l,
      id: uuidv4(),
      position: { x: l.position.x + OFFSET, y: l.position.y + OFFSET },
    }));
    const newSymbols: PlacedSymbol[] = clipboard.symbols.map((s) => ({
      ...s,
      id: uuidv4(),
      wallId: s.wallId ? (wallIdMap.get(s.wallId) ?? s.wallId) : undefined,
      position: s.wallId ? s.position : { x: s.position.x + OFFSET, y: s.position.y + OFFSET },
    }));
    const newRuns: Run[] = clipboard.runs.map((r) => ({
      ...r,
      id: uuidv4(),
      points: r.points.map((p) => ({ x: p.x + OFFSET, y: p.y + OFFSET })),
    }));

    get().commitImmediate((plan) => ({
      ...plan,
      walls: [...plan.walls, ...newWalls],
      openings: [...plan.openings, ...newOpenings],
      labels: [...plan.labels, ...newLabels],
      symbols: [...plan.symbols, ...newSymbols],
      runs: [...plan.runs, ...newRuns],
    }));

    const newSelection: SelectionEntry[] = [
      ...newWalls.map((w) => ({ type: 'wall' as const, id: w.id })),
      ...newLabels.map((l) => ({ type: 'label' as const, id: l.id })),
      ...newSymbols.map((s) => ({ type: 'symbol' as const, id: s.id })),
      ...newRuns.map((r) => ({ type: 'run' as const, id: r.id })),
    ];
    set({ selection: newSelection });
  },

  duplicateSelection: () => {
    get().copySelection();
    get().pasteClipboard();
  },

  setViewport: (vp) => set({ viewport: vp }),

  panBy: (dx, dy) => set((state) => ({ viewport: geomPanBy(state.viewport, dx, dy) })),

  zoomAtScreenPoint: (screenPoint, factor) =>
    set((state) => ({ viewport: geomZoomAt(state.viewport, screenPoint, factor) })),

  zoomToFit: (screenWidth, screenHeight) => {
    const { plan } = get();
    const points: Point[] = [];
    for (const w of plan.walls) {
      points.push(w.start, w.end);
    }
    for (const l of plan.labels) points.push(l.position);
    if (points.length === 0) {
      set({ viewport: { offsetX: screenWidth / 2, offsetY: screenHeight / 2, scale: 0.5 } });
      return;
    }
    set({ viewport: fitToPoints(points, screenWidth, screenHeight) });
  },

  setActiveTool: (tool) => {
    get().cancelTransaction();
    set({ activeTool: tool, interaction: emptyInteraction, selection: [] });
  },

  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  setSnapIncrement: (inc) => set({ snapIncrement: inc }),
  setJointStyle: (style) => set({ jointStyle: style }),
  setUnitSystem: (unit) => set({ unitSystem: unit }),
  setExportScaleDenominator: (denominator) =>
    set({ exportScaleDenominator: Math.max(1, Math.round(denominator)) }),

  setInteraction: (patch) => set((state) => ({ interaction: { ...state.interaction, ...patch } })),
  resetInteraction: () => set({ interaction: emptyInteraction }),

  setPropertiesPanelCollapsed: (collapsed) => set({ propertiesPanelCollapsed: collapsed }),
  setShowPlansModal: (show) => set({ showPlansModal: show }),
  setShowShortcutModal: (show) => set({ showShortcutModal: show }),
  setToast: (message) => set({ toastMessage: message }),

  refreshPlansIndex: () => set({ plansIndex: loadPlansIndex() }),

  newPlan: () => {
    const fresh = createEmptyPlan(uuidv4(), 'Untitled Plan');
    savePlan(fresh);
    saveActivePlanId(fresh.id);
    set({
      plan: fresh,
      past: [],
      future: [],
      pendingBase: null,
      selection: [],
      activeLayerId: ARCHITECTURAL_LAYER_ID,
      activeTool: 'select',
      activeSymbolType: null,
      plansIndex: loadPlansIndex(),
      showPlansModal: false,
    });
  },

  duplicatePlan: () => {
    const { plan } = get();
    const now = new Date().toISOString();
    const copy: Plan = { ...deepClonePlan(plan), id: uuidv4(), name: `${plan.name} (copy)`, createdAt: now, updatedAt: now };
    savePlan(copy);
    saveActivePlanId(copy.id);
    set({
      plan: copy,
      past: [],
      future: [],
      pendingBase: null,
      selection: [],
      activeLayerId: ARCHITECTURAL_LAYER_ID,
      activeTool: 'select',
      activeSymbolType: null,
      plansIndex: loadPlansIndex(),
    });
  },

  switchPlan: (id) => {
    const target = loadPlan(id);
    if (!target) return;
    saveActivePlanId(id);
    set({
      plan: target,
      past: [],
      future: [],
      pendingBase: null,
      selection: [],
      activeLayerId: ARCHITECTURAL_LAYER_ID,
      activeTool: 'select',
      activeSymbolType: null,
      showPlansModal: false,
    });
  },

  deletePlan: (id) => {
    const { plan, plansIndex } = get();
    deletePlanFromStorage(id);
    const remainingIndex = plansIndex.filter((p) => p.id !== id);
    if (plan.id === id) {
      if (remainingIndex.length > 0) {
        const sorted = [...remainingIndex].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        const nextSummary = sorted[0]!;
        const next = loadPlan(nextSummary.id);
        if (next) {
          saveActivePlanId(next.id);
          set({
            plan: next,
            past: [],
            future: [],
            pendingBase: null,
            selection: [],
            activeLayerId: ARCHITECTURAL_LAYER_ID,
            activeTool: 'select',
            activeSymbolType: null,
            plansIndex: loadPlansIndex(),
          });
          return;
        }
      }
      const fresh = createEmptyPlan(uuidv4(), 'Untitled Plan');
      savePlan(fresh);
      saveActivePlanId(fresh.id);
      set({
        plan: fresh,
        past: [],
        future: [],
        pendingBase: null,
        selection: [],
        activeLayerId: ARCHITECTURAL_LAYER_ID,
        activeTool: 'select',
        activeSymbolType: null,
        plansIndex: loadPlansIndex(),
      });
      return;
    }
    set({ plansIndex: loadPlansIndex() });
  },

  importPlan: (plan) => {
    savePlan(plan);
    saveActivePlanId(plan.id);
    set({
      plan,
      past: [],
      future: [],
      pendingBase: null,
      selection: [],
      activeLayerId: ARCHITECTURAL_LAYER_ID,
      activeTool: 'select',
      activeSymbolType: null,
      plansIndex: loadPlansIndex(),
    });
  },
}));

/** Clamp helper exposed for tools that need to pre-clamp a scale value before calling setViewport. */
export { clampScale };
