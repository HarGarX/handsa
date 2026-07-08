import { v4 as uuidv4 } from 'uuid';
import { usePlanStore } from '../store/usePlanStore';
import type { Point, Run } from '../types/plan';
import { RUN_TYPE_BY_LAYER_KIND } from '../lib/symbolCatalog';
import { snapPoint, snapPointToAngle, snapValue } from '../geometry/snapping';
import { unitDirection, wallLength } from '../geometry/segment';
import type { Tool, PointerInfo } from './types';

function computeSnappedPoint(raw: Point, lastPoint: Point | null, shiftKey: boolean): Point {
  const { snapEnabled, snapIncrement } = usePlanStore.getState();
  if (lastPoint && !shiftKey) {
    const angleSnapped = snapPointToAngle(lastPoint, raw, 15);
    const len = wallLength(lastPoint, angleSnapped);
    const snappedLen = snapEnabled ? snapValue(len, snapIncrement) : len;
    const dir = unitDirection(lastPoint, angleSnapped);
    return { x: lastPoint.x + dir.x * snappedLen, y: lastPoint.y + dir.y * snappedLen };
  }
  return snapPoint(raw, snapIncrement, snapEnabled);
}

class RunTool implements Tool {
  id = 'run' as const;

  private finish(commit: boolean): void {
    const { interaction, setInteraction } = usePlanStore.getState();
    const draft = interaction.runDraft;
    if (!draft) return;
    if (commit && draft.points.length >= 2) {
      const run: Run = { id: uuidv4(), layerId: draft.layerId, type: draft.type, points: draft.points };
      usePlanStore.getState().addRun(run);
    }
    setInteraction({ runDraft: null });
  }

  onPointerDown(info: PointerInfo): void {
    if (info.button !== 0) return;
    const { interaction, setInteraction, activeLayerId, plan } = usePlanStore.getState();
    const draft = interaction.runDraft;
    const lastPoint = draft ? draft.points[draft.points.length - 1]! : null;
    const snapped = computeSnappedPoint(info.world, lastPoint, info.shiftKey);

    if (!draft) {
      const layer = plan.layers.find((l) => l.id === activeLayerId);
      const runType =
        (layer && layer.kind !== 'architectural' ? RUN_TYPE_BY_LAYER_KIND[layer.kind] : undefined) ?? 'circuit';
      setInteraction({ runDraft: { layerId: activeLayerId, type: runType, points: [snapped], previewPoint: snapped } });
      return;
    }

    if (wallLength(lastPoint!, snapped) < 0.5) return; // ignore accidental double-clicks on the same spot
    setInteraction({ runDraft: { ...draft, points: [...draft.points, snapped], previewPoint: snapped } });
  }

  onPointerMove(info: PointerInfo): void {
    const { interaction, setInteraction } = usePlanStore.getState();
    const draft = interaction.runDraft;
    if (!draft) return;
    const lastPoint = draft.points[draft.points.length - 1]!;
    const snapped = computeSnappedPoint(info.world, lastPoint, info.shiftKey);
    setInteraction({ runDraft: { ...draft, previewPoint: snapped } });
  }

  onPointerUp(): void {
    // Run tool is click-driven; points are added in onPointerDown.
  }

  onDoubleClick(): void {
    this.finish(true);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.finish(true);
    else if (e.key === 'Escape') this.finish(false);
  }

  onDeactivate(): void {
    usePlanStore.getState().setInteraction({ runDraft: null });
  }
}

export const runTool = new RunTool();
