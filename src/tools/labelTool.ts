import { usePlanStore } from '../store/usePlanStore';
import { snapPoint } from '../geometry/snapping';
import type { Tool, PointerInfo } from './types';

const DEFAULT_FONT_SIZE_CM = 20;

class LabelTool implements Tool {
  id = 'label' as const;

  onPointerDown(info: PointerInfo): void {
    if (info.button !== 0) return;
    const { snapEnabled, snapIncrement, interaction } = usePlanStore.getState();
    if (interaction.pendingLabel) return; // already placing one; ignore extra clicks
    const position = snapPoint(info.world, snapIncrement, snapEnabled);
    usePlanStore.getState().setInteraction({ pendingLabel: { position, fontSize: DEFAULT_FONT_SIZE_CM } });
  }

  onPointerMove(): void {
    // no hover preview needed
  }

  onPointerUp(): void {
    // placement happens on pointer down
  }

  onDeactivate(): void {
    usePlanStore.getState().setInteraction({ pendingLabel: null, editingLabelId: null });
  }
}

export const labelTool = new LabelTool();
