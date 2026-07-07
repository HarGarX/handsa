import type { Point } from '../types/plan';
import type { ToolId } from '../store/types';

export interface PointerInfo {
  world: Point;
  screen: Point;
  shiftKey: boolean;
  button: number;
  pointerId: number;
}

/**
 * Shared interface implemented by each tool module. Tools are plain singleton
 * objects (not React components/hooks) that read/write the Zustand store
 * directly via `usePlanStore.getState()`, so interaction logic stays out of
 * the render tree and is trivially unit-testable in isolation.
 */
export interface Tool {
  id: ToolId;
  onPointerDown(info: PointerInfo): void;
  onPointerMove(info: PointerInfo): void;
  onPointerUp(info: PointerInfo): void;
  onDoubleClick?(info: PointerInfo): void;
  onKeyDown?(e: KeyboardEvent): void;
  onDeactivate?(): void;
}
