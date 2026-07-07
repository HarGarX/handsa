import type { Point, RunType, SymbolType } from '../types/plan';

export type ToolId = 'select' | 'wall' | 'door' | 'window' | 'label' | 'measure' | 'symbol' | 'run';

export type SnapIncrement = 1 | 5 | 10;

export type JointStyle = 'square' | 'round';

export type SelectableType = 'wall' | 'opening' | 'label' | 'symbol' | 'run';

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

export interface RunDraft {
  layerId: string;
  type: RunType;
  points: Point[]; // committed chain points (world cm)
  previewPoint: Point | null; // live cursor point (before commit)
}

export interface SymbolGhost {
  type: SymbolType;
  position: Point;
  rotation: number;
}

export interface InteractionState {
  wallDraft: WallDraft | null;
  measureDraft: MeasureDraft | null;
  openingGhost: OpeningGhost | null;
  runDraft: RunDraft | null;
  symbolGhost: SymbolGhost | null;
  hoveredEndpoint: Point | null;
  pendingLabel: PendingLabel | null;
  editingLabelId: string | null;
  cursorWorld: Point | null;
  isPanning: boolean;
  isSpaceDown: boolean;
}
