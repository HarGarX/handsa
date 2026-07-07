import type { Plan } from '../types/plan';
import { isValidPlanShape, normalizePlan } from '../types/plan';

const INDEX_KEY = 'floorplan.plans.index';
const ACTIVE_KEY = 'floorplan.activePlanId';
const PLAN_KEY_PREFIX = 'floorplan.plan.';

export interface PlanSummary {
  id: string;
  name: string;
  updatedAt: string;
}

function planKey(id: string): string {
  return `${PLAN_KEY_PREFIX}${id}`;
}

export function loadPlansIndex(): PlanSummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PlanSummary =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as PlanSummary).id === 'string' &&
        typeof (p as PlanSummary).name === 'string',
    );
  } catch {
    return [];
  }
}

function savePlansIndex(index: PlanSummary[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadPlan(id: string): Plan | null {
  try {
    const raw = localStorage.getItem(planKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidPlanShape(parsed)) return null;
    return normalizePlan(parsed as Plan);
  } catch {
    return null;
  }
}

export function savePlan(plan: Plan): void {
  localStorage.setItem(planKey(plan.id), JSON.stringify(plan));
  const index = loadPlansIndex();
  const existingIdx = index.findIndex((p) => p.id === plan.id);
  const summary: PlanSummary = { id: plan.id, name: plan.name, updatedAt: plan.updatedAt };
  if (existingIdx >= 0) {
    index[existingIdx] = summary;
  } else {
    index.push(summary);
  }
  savePlansIndex(index);
}

export function deletePlanFromStorage(id: string): void {
  localStorage.removeItem(planKey(id));
  const index = loadPlansIndex().filter((p) => p.id !== id);
  savePlansIndex(index);
}

export function loadActivePlanId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActivePlanId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce-saves the plan to localStorage 1s after the last call. */
export function scheduleAutosave(plan: Plan): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    savePlan(plan);
  }, 1000);
}
