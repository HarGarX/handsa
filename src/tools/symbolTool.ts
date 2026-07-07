import { v4 as uuidv4 } from 'uuid';
import { usePlanStore } from '../store/usePlanStore';
import type { PlacedSymbol, Point } from '../types/plan';
import { symbolCatalogEntry } from '../lib/symbolCatalog';
import { nearestWall } from '../geometry/hitTest';
import { pointAt, wallAngle, wallLength } from '../geometry/segment';
import { snapPoint, snapValue } from '../geometry/snapping';
import type { Tool, PointerInfo } from './types';

const HOVER_RADIUS_SCREEN_PX = 30;

interface Placement {
  position: Point;
  rotation: number;
  wallId?: string;
  t?: number;
}

function computePlacement(worldX: number, worldY: number): Placement | null {
  const { plan, viewport, snapEnabled, snapIncrement, activeSymbolType } = usePlanStore.getState();
  if (!activeSymbolType) return null;
  const entry = symbolCatalogEntry(activeSymbolType);
  const world = { x: worldX, y: worldY };

  if (entry.wallMounted) {
    const radiusCm = HOVER_RADIUS_SCREEN_PX / viewport.scale;
    const hit = nearestWall(plan.walls, world, radiusCm);
    if (!hit) return null;
    const len = wallLength(hit.wall.start, hit.wall.end);
    if (len === 0) return null;

    let t = hit.t;
    if (snapEnabled) {
      t = snapValue(t * len, snapIncrement) / len;
    }
    const halfT = Math.min(0.5, entry.size / 2 / len);
    t = Math.min(1 - halfT, Math.max(halfT, t));

    return {
      position: pointAt(hit.wall.start, hit.wall.end, t),
      rotation: (wallAngle(hit.wall.start, hit.wall.end) * 180) / Math.PI,
      wallId: hit.wall.id,
      t,
    };
  }

  return { position: snapPoint(world, snapIncrement, snapEnabled), rotation: 0 };
}

class SymbolTool implements Tool {
  id = 'symbol' as const;

  onPointerDown(info: PointerInfo): void {
    if (info.button !== 0) return;
    const { activeSymbolType, activeLayerId } = usePlanStore.getState();
    if (!activeSymbolType) return;
    const placement = computePlacement(info.world.x, info.world.y);
    if (!placement) return;

    const symbol: PlacedSymbol = {
      id: uuidv4(),
      layerId: activeLayerId,
      type: activeSymbolType,
      position: placement.position,
      rotation: placement.rotation,
      wallId: placement.wallId,
      t: placement.t,
    };
    usePlanStore.getState().addSymbol(symbol);
  }

  onPointerMove(info: PointerInfo): void {
    const { activeSymbolType, setInteraction } = usePlanStore.getState();
    if (!activeSymbolType) {
      setInteraction({ symbolGhost: null });
      return;
    }
    const placement = computePlacement(info.world.x, info.world.y);
    setInteraction({
      symbolGhost: placement
        ? { type: activeSymbolType, position: placement.position, rotation: placement.rotation }
        : null,
    });
  }

  onPointerUp(): void {
    // placement happens on pointer down
  }

  onDeactivate(): void {
    usePlanStore.getState().setInteraction({ symbolGhost: null });
  }
}

export const symbolTool = new SymbolTool();
