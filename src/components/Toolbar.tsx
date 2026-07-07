import { MousePointer2, BrickWall, DoorOpen, AppWindow, Type, Ruler } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import type { ToolId } from '../store/types';

interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
  Icon: LucideIcon;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'V', Icon: MousePointer2 },
  { id: 'wall', label: 'Wall', shortcut: 'W', Icon: BrickWall },
  { id: 'door', label: 'Door', shortcut: 'D', Icon: DoorOpen },
  { id: 'window', label: 'Window', shortcut: 'N', Icon: AppWindow },
  { id: 'label', label: 'Label', shortcut: 'T', Icon: Type },
  { id: 'measure', label: 'Measure', shortcut: 'M', Icon: Ruler },
];

export function Toolbar() {
  const activeTool = usePlanStore((s) => s.activeTool);
  const setActiveTool = usePlanStore((s) => s.setActiveTool);

  return (
    <div className="flex w-14 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      {TOOLS.map(({ id, label, shortcut, Icon }) => {
        const active = activeTool === id;
        return (
          <button
            key={id}
            type="button"
            title={`${label} (${shortcut})`}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setActiveTool(id)}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
}
