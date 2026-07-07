import { v4 as uuidv4 } from 'uuid';
import { usePlanStore } from '../store/usePlanStore';
import { DEFAULT_WALL_THICKNESS } from '../types/plan';
import type { Point, Wall } from '../types/plan';
import { findNearestEndpoint } from '../geometry/endpoints';
import { snapPoint, snapPointToAngle, snapValue } from '../geometry/snapping';
import { unitDirection, wallLength } from '../geometry/segment';
import type { Tool, PointerInfo } from './types';

const ENDPOINT_MAGNET_SCREEN_PX = 20;

function computeSnappedPoint(raw: Point, lastPoint: Point | null, shiftKey: boolean): { point: Point; magnetized: boolean } {
  const { snapEnabled, snapIncrement, viewport, plan } = usePlanStore.getState();
  const magnetRadiusCm = ENDPOINT_MAGNET_SCREEN_PX / viewport.scale;
  const nearestEndpoint = findNearestEndpoint(plan.walls, raw, magnetRadiusCm);
  if (nearestEndpoint) {
    return { point: nearestEndpoint, magnetized: true };
  }

  if (lastPoint && !shiftKey) {
    const angleSnapped = snapPointToAngle(lastPoint, raw, 15);
    const len = wallLength(lastPoint, angleSnapped);
    const snappedLen = snapEnabled ? snapValue(len, snapIncrement) : len;
    const dir = unitDirection(lastPoint, angleSnapped);
    return {
      point: { x: lastPoint.x + dir.x * snappedLen, y: lastPoint.y + dir.y * snappedLen },
      magnetized: false,
    };
  }

  return { point: snapPoint(raw, snapIncrement, snapEnabled), magnetized: false };
}

class WallTool implements Tool {
  id = 'wall' as const;

  private applyTypedLength(lastPoint: Point, rawPreview: Point, buffer: string, shiftKey: boolean): Point {
    const typed = parseFloat(buffer);
    if (!Number.isFinite(typed) || typed <= 0) return rawPreview;
    const dirSource = shiftKey ? rawPreview : snapPointToAngle(lastPoint, rawPreview, 15);
    const dir = unitDirection(lastPoint, dirSource);
    return { x: lastPoint.x + dir.x * typed, y: lastPoint.y + dir.y * typed };
  }

  onPointerDown(info: PointerInfo): void {
    if (info.button !== 0) return;
    const { interaction, setInteraction } = usePlanStore.getState();
    const draft = interaction.wallDraft;
    const lastPoint = draft && draft.points.length > 0 ? draft.points[0]! : null;

    let { point: snapped } = computeSnappedPoint(info.world, lastPoint, info.shiftKey);
    if (lastPoint && draft && draft.lengthInputBuffer) {
      snapped = this.applyTypedLength(lastPoint, info.world, draft.lengthInputBuffer, info.shiftKey);
    }

    if (!lastPoint) {
      setInteraction({ wallDraft: { points: [snapped], previewPoint: snapped, lengthInputBuffer: '' } });
      return;
    }

    if (wallLength(lastPoint, snapped) < 0.5) return; // avoid zero-length walls from double clicks

    const wall: Wall = { id: uuidv4(), start: lastPoint, end: snapped, thickness: DEFAULT_WALL_THICKNESS };
    usePlanStore.getState().addWall(wall);
    setInteraction({ wallDraft: { points: [snapped], previewPoint: snapped, lengthInputBuffer: '' } });
  }

  onPointerMove(info: PointerInfo): void {
    const { interaction, setInteraction } = usePlanStore.getState();
    const draft = interaction.wallDraft;
    setInteraction({ hoveredEndpoint: null });
    if (!draft) return;
    const lastPoint = draft.points[0]!;
    let { point: snapped, magnetized } = computeSnappedPoint(info.world, lastPoint, info.shiftKey);
    if (draft.lengthInputBuffer) {
      snapped = this.applyTypedLength(lastPoint, info.world, draft.lengthInputBuffer, info.shiftKey);
    }
    setInteraction({
      wallDraft: { ...draft, previewPoint: snapped },
      hoveredEndpoint: magnetized ? snapped : null,
    });
  }

  onPointerUp(_info: PointerInfo): void {
    // Wall tool is click-driven; placement happens in onPointerDown.
  }

  onDoubleClick(_info: PointerInfo): void {
    usePlanStore.getState().setInteraction({ wallDraft: null, hoveredEndpoint: null });
  }

  onKeyDown(e: KeyboardEvent): void {
    const { interaction, setInteraction } = usePlanStore.getState();
    const draft = interaction.wallDraft;
    if (!draft) return;

    if (e.key === 'Escape') {
      setInteraction({ wallDraft: null, hoveredEndpoint: null });
      return;
    }

    if (e.key === 'Enter') {
      if (draft.lengthInputBuffer) {
        const lastPoint = draft.points[0]!;
        const typed = parseFloat(draft.lengthInputBuffer);
        if (Number.isFinite(typed) && typed > 0 && draft.previewPoint) {
          const dir = unitDirection(lastPoint, draft.previewPoint);
          const end = { x: lastPoint.x + dir.x * typed, y: lastPoint.y + dir.y * typed };
          const wall: Wall = { id: uuidv4(), start: lastPoint, end, thickness: DEFAULT_WALL_THICKNESS };
          usePlanStore.getState().addWall(wall);
          setInteraction({ wallDraft: { points: [end], previewPoint: end, lengthInputBuffer: '' } });
        }
      } else {
        setInteraction({ wallDraft: null, hoveredEndpoint: null });
      }
      return;
    }

    if (e.key === 'Backspace') {
      setInteraction({ wallDraft: { ...draft, lengthInputBuffer: draft.lengthInputBuffer.slice(0, -1) } });
      return;
    }

    if (/^[0-9.]$/.test(e.key)) {
      setInteraction({ wallDraft: { ...draft, lengthInputBuffer: draft.lengthInputBuffer + e.key } });
    }
  }

  onDeactivate(): void {
    usePlanStore.getState().setInteraction({ wallDraft: null, hoveredEndpoint: null });
  }
}

export const wallTool = new WallTool();
