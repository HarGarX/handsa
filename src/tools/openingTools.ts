import { v4 as uuidv4 } from 'uuid';
import { usePlanStore } from '../store/usePlanStore';
import { DEFAULT_DOOR_WIDTH, DEFAULT_WINDOW_WIDTH } from '../types/plan';
import type { Opening, OpeningType } from '../types/plan';
import { nearestWall } from '../geometry/hitTest';
import { clampOpeningT } from '../geometry/opening';
import { snapValue } from '../geometry/snapping';
import { wallLength } from '../geometry/segment';
import type { Tool, PointerInfo } from './types';

const HOVER_RADIUS_SCREEN_PX = 30;

class OpeningTool implements Tool {
  id: 'door' | 'window';
  private width: number;

  constructor(type: OpeningType) {
    this.id = type;
    this.width = type === 'door' ? DEFAULT_DOOR_WIDTH : DEFAULT_WINDOW_WIDTH;
  }

  private computeGhostT(rawWorldX: number, rawWorldY: number): { wallId: string; t: number } | null {
    const { plan, viewport, snapEnabled, snapIncrement } = usePlanStore.getState();
    const radiusCm = HOVER_RADIUS_SCREEN_PX / viewport.scale;
    const hit = nearestWall(plan.walls, { x: rawWorldX, y: rawWorldY }, radiusCm);
    if (!hit) return null;
    const len = wallLength(hit.wall.start, hit.wall.end);
    let t = hit.t;
    if (snapEnabled && len > 0) {
      const cmAlong = t * len;
      const snappedCm = snapValue(cmAlong, snapIncrement);
      t = snappedCm / len;
    }
    t = clampOpeningT(hit.wall, plan.openings, '__ghost__', t, this.width);
    return { wallId: hit.wall.id, t };
  }

  onPointerDown(info: PointerInfo): void {
    if (info.button !== 0) return;
    const ghost = this.computeGhostT(info.world.x, info.world.y);
    if (!ghost) return;
    const opening: Opening = {
      id: uuidv4(),
      wallId: ghost.wallId,
      type: this.id,
      t: ghost.t,
      width: this.width,
      ...(this.id === 'door' ? { hinge: 'start' as const, swing: 'right' as const } : {}),
    };
    usePlanStore.getState().addOpening(opening);
  }

  onPointerMove(info: PointerInfo): void {
    const ghost = this.computeGhostT(info.world.x, info.world.y);
    usePlanStore.getState().setInteraction({
      openingGhost: ghost ? { wallId: ghost.wallId, t: ghost.t, type: this.id } : null,
    });
  }

  onPointerUp(): void {
    // placement happens on pointer down
  }

  onDeactivate(): void {
    usePlanStore.getState().setInteraction({ openingGhost: null });
  }
}

export const doorTool = new OpeningTool('door');
export const windowTool = new OpeningTool('window');
