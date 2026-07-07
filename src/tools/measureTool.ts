import { usePlanStore } from '../store/usePlanStore';
import { snapPoint } from '../geometry/snapping';
import type { Tool, PointerInfo } from './types';

class MeasureTool implements Tool {
  id = 'measure' as const;

  onPointerDown(info: PointerInfo): void {
    if (info.button !== 0) return;
    const { snapEnabled, snapIncrement, interaction, setInteraction } = usePlanStore.getState();
    const point = snapPoint(info.world, snapIncrement, snapEnabled);
    const draft = interaction.measureDraft;
    if (!draft || !draft.start) {
      setInteraction({ measureDraft: { start: point, end: point } });
    } else {
      setInteraction({ measureDraft: { start: draft.start, end: point } });
    }
  }

  onPointerMove(info: PointerInfo): void {
    const { snapEnabled, snapIncrement, interaction, setInteraction } = usePlanStore.getState();
    const draft = interaction.measureDraft;
    if (!draft || !draft.start) return;
    const point = snapPoint(info.world, snapIncrement, snapEnabled);
    setInteraction({ measureDraft: { start: draft.start, end: point } });
  }

  onPointerUp(): void {
    // handled in onPointerDown
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      usePlanStore.getState().setInteraction({ measureDraft: null });
    }
  }

  onDeactivate(): void {
    usePlanStore.getState().setInteraction({ measureDraft: null });
  }
}

export const measureTool = new MeasureTool();
