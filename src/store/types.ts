import type { Point } from '../types/plan';

export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'label' | 'measure';

export type SnapIncrement = 1 | 5 | 10;

export type SelectableType = 'wall' | 'opening' | 'label';

export interface SelectionEntry {
  type: SelectableType;
  id: string;
}

export interface WallDraft {
  points: Point[]; // chain anchor point(s); always length 1 while drawing
  previewPoint: Point | null; // live cursor point (before commit)
  lengthInputBuffer: string; // power-user: typed exact length in cm, empty when not typing
}

export interface MeasureDraft {
  start: Point | null;
  end: Point | null;
}

export interface OpeningGhost {
  wallId: string;
  t: number;
  type: 'door' | 'window';
}

export interface PendingLabel {
  position: Point;
  fontSize: number;
}

export interface InteractionState {
  wallDraft: WallDraft | null;
  measureDraft: MeasureDraft | null;
  openingGhost: OpeningGhost | null;
  hoveredEndpoint: Point | null;
  pendingLabel: PendingLabel | null;
  editingLabelId: string | null;
  cursorWorld: Point | null;
  isPanning: boolean;
  isSpaceDown: boolean;
}
