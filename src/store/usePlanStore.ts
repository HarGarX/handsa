import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Label, Opening, Plan, Point, Wall } from '../types/plan';
import { createEmptyPlan } from '../types/plan';
import type { Viewport } from '../geometry/viewport';
import { clampScale, zoomAt as geomZoomAt, panBy as geomPanBy, fitToPoints } from '../geometry/viewport';
import type { EndpointRef } from '../geometry/endpoints';
import type { InteractionState, JointStyle, SelectionEntry, SnapIncrement, ToolId } from './types';
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
  hoveredEndpoint: null,
  pendingLabel: null,
  editingLabelId: null,
  cursorWorld: null,
  isPanning: false,
  isSpaceDown: false,
};

export interface PlanStore {
  plan: Plan;
  pendingBase: Plan | null;
  past: Plan[];
  future: Plan[];

  selection: SelectionEntry[];
  viewport: Viewport;
  activeTool: ToolId;
  snapEnabled: boolean;
  snapIncrement: SnapIncrement;
  jointStyle: JointStyle;
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

  // --- plan meta ---
  renamePlan: (name: string) => void;

  // --- selection ---
  select: (entries: SelectionEntry[], additive?: boolean) => void;
  clearSelection: () => void;
  deleteSelected: () => void;

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

  selection: [],
  viewport: { offsetX: 0, offsetY: 0, scale: 0.5 },
  activeTool: 'select',
  snapEnabled: true,
  snapIncrement: 5,
  jointStyle: 'square',
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
    if (wallIds.size === 0 && openingIds.size === 0 && labelIds.size === 0) return;
    get().commitImmediate((plan) => ({
      ...plan,
      walls: plan.walls.filter((w) => !wallIds.has(w.id)),
      // deleting a wall deletes its openings too
      openings: plan.openings.filter((o) => !openingIds.has(o.id) && !wallIds.has(o.wallId)),
      labels: plan.labels.filter((l) => !labelIds.has(l.id)),
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
    set({ plan: copy, past: [], future: [], pendingBase: null, selection: [], plansIndex: loadPlansIndex() });
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
          set({ plan: next, past: [], future: [], pendingBase: null, selection: [], plansIndex: loadPlansIndex() });
          return;
        }
      }
      const fresh = createEmptyPlan(uuidv4(), 'Untitled Plan');
      savePlan(fresh);
      saveActivePlanId(fresh.id);
      set({ plan: fresh, past: [], future: [], pendingBase: null, selection: [], plansIndex: loadPlansIndex() });
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
      plansIndex: loadPlansIndex(),
    });
  },
}));

/** Clamp helper exposed for tools that need to pre-clamp a scale value before calling setViewport. */
export { clampScale };
