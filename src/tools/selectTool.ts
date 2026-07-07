import { usePlanStore } from '../store/usePlanStore';
import type { Point } from '../types/plan';
import { findCoincidentEndpoints, findNearestEndpoint, type EndpointRef } from '../geometry/endpoints';
import { hitTestLabel, hitTestOpening, hitTestRun, hitTestSymbol, hitTestWall } from '../geometry/hitTest';
import { clampOpeningT } from '../geometry/opening';
import { projectPointToSegment } from '../geometry/segment';
import { snapPoint, snapValue } from '../geometry/snapping';
import type { SelectionEntry } from '../store/types';
import type { Tool, PointerInfo } from './types';

const ENDPOINT_HANDLE_SCREEN_PX = 9;
const WALL_HIT_SCREEN_PX = 5;
const OPENING_HIT_SCREEN_PX = 10;
const LABEL_HIT_SCREEN_PX = 10;
const SYMBOL_HIT_SCREEN_PX = 8;
const RUN_HIT_SCREEN_PX = 8;
const DRAG_THRESHOLD_SCREEN_PX = 3;
const ENDPOINT_MAGNET_SCREEN_PX = 20;

type DragMode = 'none' | 'endpoint' | 'wall' | 'opening' | 'label' | 'symbol' | 'run';

class SelectTool implements Tool {
  id = 'select' as const;

  private dragMode: DragMode = 'none';
  private pointerDownScreen: Point | null = null;
  private moved = false;
  private pendingSingleSelect: SelectionEntry | null = null;

  private endpointRefs: EndpointRef[] = [];
  private wallDragIds: string[] = [];
  private wallDragOriginals: { id: string; start: Point; end: Point }[] = [];
  private wallDragStartWorld: Point = { x: 0, y: 0 };
  private openingDragId: string | null = null;
  private openingDragWallId: string | null = null;
  private labelDragId: string | null = null;
  private doorClickCandidate: string | null = null;
  private symbolDragId: string | null = null;
  private symbolDragWallId: string | null = null;
  private runDragId: string | null = null;
  private runDragOriginalPoints: Point[] = [];
  private runDragStartWorld: Point = { x: 0, y: 0 };

  private applySelectionOnDown(entry: SelectionEntry, shiftKey: boolean, currentSelection: SelectionEntry[]): void {
    const alreadySelected = currentSelection.some((s) => s.type === entry.type && s.id === entry.id);
    if (shiftKey) {
      usePlanStore.getState().select([entry], true);
      this.pendingSingleSelect = null;
    } else if (alreadySelected) {
      this.pendingSingleSelect = entry;
    } else {
      usePlanStore.getState().select([entry], false);
      this.pendingSingleSelect = null;
    }
  }

  onPointerDown(info: PointerInfo): void {
    if (info.button !== 0) return;
    const state = usePlanStore.getState();
    this.pointerDownScreen = info.screen;
    this.moved = false;
    this.pendingSingleSelect = null;
    this.dragMode = 'none';
    this.doorClickCandidate = null;

    const { plan, selection, viewport, activeLayerId } = state;
    const activeLayer = plan.layers.find((l) => l.id === activeLayerId);
    const isArchitectural = !activeLayer || activeLayer.kind === 'architectural';

    if (!isArchitectural) {
      const symbol = hitTestSymbol(
        plan.symbols.filter((s) => s.layerId === activeLayerId),
        plan.walls,
        info.world,
        SYMBOL_HIT_SCREEN_PX / viewport.scale,
      );
      if (symbol) {
        this.applySelectionOnDown({ type: 'symbol', id: symbol.id }, info.shiftKey, selection);
        this.dragMode = 'symbol';
        this.symbolDragId = symbol.id;
        this.symbolDragWallId = symbol.wallId ?? null;
        return;
      }

      const run = hitTestRun(
        plan.runs.filter((r) => r.layerId === activeLayerId),
        info.world,
        RUN_HIT_SCREEN_PX / viewport.scale,
      );
      if (run) {
        this.applySelectionOnDown({ type: 'run', id: run.id }, info.shiftKey, selection);
        this.dragMode = 'run';
        this.runDragId = run.id;
        this.runDragOriginalPoints = run.points;
        this.runDragStartWorld = info.world;
        return;
      }

      if (!info.shiftKey) state.clearSelection();
      return;
    }

    const endpointRadiusCm = ENDPOINT_HANDLE_SCREEN_PX / viewport.scale;
    const selectedWallIds = new Set(selection.filter((s) => s.type === 'wall').map((s) => s.id));
    const selectedWalls = plan.walls.filter((w) => selectedWallIds.has(w.id));
    let endpointHit: Point | null = null;
    for (const w of selectedWalls) {
      for (const p of [w.start, w.end]) {
        if (Math.hypot(p.x - info.world.x, p.y - info.world.y) <= endpointRadiusCm) {
          endpointHit = p;
          break;
        }
      }
      if (endpointHit) break;
    }
    if (endpointHit) {
      this.dragMode = 'endpoint';
      this.endpointRefs = findCoincidentEndpoints(plan.walls, endpointHit, 1);
      return;
    }

    const opening = hitTestOpening(plan.openings, plan.walls, info.world, OPENING_HIT_SCREEN_PX / viewport.scale);
    if (opening) {
      this.applySelectionOnDown({ type: 'opening', id: opening.id }, info.shiftKey, selection);
      this.dragMode = 'opening';
      this.openingDragId = opening.id;
      this.openingDragWallId = opening.wallId;
      this.doorClickCandidate = opening.type === 'door' ? opening.id : null;
      return;
    }

    const wall = hitTestWall(plan.walls, info.world, WALL_HIT_SCREEN_PX / viewport.scale);
    if (wall) {
      this.applySelectionOnDown({ type: 'wall', id: wall.id }, info.shiftKey, selection);
      const resultingSelection = usePlanStore.getState().selection;
      const resultingWallIds = resultingSelection.filter((s) => s.type === 'wall').map((s) => s.id);
      this.dragMode = 'wall';
      this.wallDragIds = resultingWallIds.includes(wall.id) ? resultingWallIds : [wall.id];
      this.wallDragOriginals = plan.walls
        .filter((w) => this.wallDragIds.includes(w.id))
        .map((w) => ({ id: w.id, start: w.start, end: w.end }));
      this.wallDragStartWorld = info.world;
      return;
    }

    const label = hitTestLabel(plan.labels, info.world, LABEL_HIT_SCREEN_PX / viewport.scale);
    if (label) {
      this.applySelectionOnDown({ type: 'label', id: label.id }, info.shiftKey, selection);
      this.dragMode = 'label';
      this.labelDragId = label.id;
      return;
    }

    if (!info.shiftKey) state.clearSelection();
  }

  onPointerMove(info: PointerInfo): void {
    const state = usePlanStore.getState();

    if (this.pointerDownScreen) {
      const dx = info.screen.x - this.pointerDownScreen.x;
      const dy = info.screen.y - this.pointerDownScreen.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_SCREEN_PX) this.moved = true;
    }
    if (!this.moved || this.dragMode === 'none') return;

    const { plan, snapEnabled, snapIncrement, viewport } = state;

    if (this.dragMode === 'endpoint') {
      const draggedWallIds = new Set(this.endpointRefs.map((r) => r.wallId));
      const otherWalls = plan.walls.filter((w) => !draggedWallIds.has(w.id));
      const magnetRadiusCm = ENDPOINT_MAGNET_SCREEN_PX / viewport.scale;
      const magnet = findNearestEndpoint(otherWalls, info.world, magnetRadiusCm);
      const newPoint = magnet ?? snapPoint(info.world, snapIncrement, snapEnabled);
      state.moveEndpointGroupLive(this.endpointRefs, newPoint);
      state.setInteraction({ hoveredEndpoint: magnet });
      return;
    }

    if (this.dragMode === 'wall') {
      let dx = info.world.x - this.wallDragStartWorld.x;
      let dy = info.world.y - this.wallDragStartWorld.y;
      if (snapEnabled) {
        dx = snapValue(dx, snapIncrement);
        dy = snapValue(dy, snapIncrement);
      }
      const updates = this.wallDragOriginals.map((w) => ({
        id: w.id,
        start: { x: w.start.x + dx, y: w.start.y + dy },
        end: { x: w.end.x + dx, y: w.end.y + dy },
      }));
      state.setWallEndpointsLive(updates);
      return;
    }

    if (this.dragMode === 'opening' && this.openingDragId && this.openingDragWallId) {
      const wall = plan.walls.find((w) => w.id === this.openingDragWallId);
      if (!wall) return;
      const proj = projectPointToSegment(info.world, wall.start, wall.end);
      const opening = plan.openings.find((o) => o.id === this.openingDragId);
      if (!opening) return;
      const clampedT = clampOpeningT(wall, plan.openings, opening.id, proj.t, opening.width);
      state.updateOpeningLive(opening.id, { t: clampedT });
      return;
    }

    if (this.dragMode === 'label' && this.labelDragId) {
      const position = snapPoint(info.world, snapIncrement, snapEnabled);
      state.updateLabelLive(this.labelDragId, { position });
      return;
    }

    if (this.dragMode === 'symbol' && this.symbolDragId) {
      if (this.symbolDragWallId) {
        const wall = plan.walls.find((w) => w.id === this.symbolDragWallId);
        if (!wall) return;
        const proj = projectPointToSegment(info.world, wall.start, wall.end);
        state.updateSymbolLive(this.symbolDragId, { t: proj.t, position: proj.point });
      } else {
        const position = snapPoint(info.world, snapIncrement, snapEnabled);
        state.updateSymbolLive(this.symbolDragId, { position });
      }
      return;
    }

    if (this.dragMode === 'run' && this.runDragId) {
      let dx = info.world.x - this.runDragStartWorld.x;
      let dy = info.world.y - this.runDragStartWorld.y;
      if (snapEnabled) {
        dx = snapValue(dx, snapIncrement);
        dy = snapValue(dy, snapIncrement);
      }
      const points = this.runDragOriginalPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      state.updateRunLive(this.runDragId, { points });
    }
  }

  onPointerUp(_info: PointerInfo): void {
    const state = usePlanStore.getState();
    if (state.pendingBase) {
      state.commitTransaction();
    } else if (!this.moved && this.doorClickCandidate) {
      state.cycleDoorState(this.doorClickCandidate);
      if (this.pendingSingleSelect) state.select([this.pendingSingleSelect], false);
    } else if (this.pendingSingleSelect) {
      state.select([this.pendingSingleSelect], false);
    }
    this.dragMode = 'none';
    this.pointerDownScreen = null;
    this.moved = false;
    this.pendingSingleSelect = null;
    this.endpointRefs = [];
    this.wallDragIds = [];
    this.wallDragOriginals = [];
    this.openingDragId = null;
    this.openingDragWallId = null;
    this.labelDragId = null;
    this.doorClickCandidate = null;
    this.symbolDragId = null;
    this.symbolDragWallId = null;
    this.runDragId = null;
    this.runDragOriginalPoints = [];
    usePlanStore.getState().setInteraction({ hoveredEndpoint: null });
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      usePlanStore.getState().deleteSelected();
    } else if (e.key === 'Escape') {
      usePlanStore.getState().clearSelection();
    }
  }

  onDeactivate(): void {
    this.dragMode = 'none';
  }
}

export const selectTool = new SelectTool();
