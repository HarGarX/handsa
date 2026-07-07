import { useState } from 'react';
import { MousePointer2, BrickWall, DoorOpen, AppWindow, Type, Ruler, Shapes, Cable, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import type { ToolId } from '../store/types';
import { symbolCatalogFor } from '../lib/symbolCatalog';

interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
  Icon: LucideIcon;
}

const ARCHITECTURAL_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'V', Icon: MousePointer2 },
  { id: 'wall', label: 'Wall', shortcut: 'W', Icon: BrickWall },
  { id: 'door', label: 'Door', shortcut: 'D', Icon: DoorOpen },
  { id: 'window', label: 'Window', shortcut: 'N', Icon: AppWindow },
  { id: 'label', label: 'Label', shortcut: 'T', Icon: Type },
  { id: 'measure', label: 'Measure', shortcut: 'M', Icon: Ruler },
];

function ToolButton({ active, title, onClick, Icon }: { active: boolean; title: string; onClick: () => void; Icon: LucideIcon }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={20} />
    </button>
  );
}

export function Toolbar() {
  const activeTool = usePlanStore((s) => s.activeTool);
  const setActiveTool = usePlanStore((s) => s.setActiveTool);
  const layers = usePlanStore((s) => s.plan.layers);
  const activeLayerId = usePlanStore((s) => s.activeLayerId);
  const activeSymbolType = usePlanStore((s) => s.activeSymbolType);
  const setActiveSymbolType = usePlanStore((s) => s.setActiveSymbolType);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const isArchitectural = !activeLayer || activeLayer.kind === 'architectural';

  if (isArchitectural) {
    return (
      <div className="flex w-14 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
        {ARCHITECTURAL_TOOLS.map(({ id, label, shortcut, Icon }) => (
          <ToolButton key={id} active={activeTool === id} title={`${label} (${shortcut})`} onClick={() => setActiveTool(id)} Icon={Icon} />
        ))}
      </div>
    );
  }

  const catalog = symbolCatalogFor(activeLayer.kind);
  const activeEntry = catalog.find((e) => e.type === activeSymbolType);

  return (
    <div className="relative flex w-14 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      <ToolButton active={activeTool === 'select'} title="Select (V)" onClick={() => setActiveTool('select')} Icon={MousePointer2} />

      <div className="relative">
        <button
          type="button"
          title={activeEntry ? `Symbol: ${activeEntry.label}` : 'Symbol'}
          aria-pressed={activeTool === 'symbol'}
          onClick={() => {
            setActiveTool('symbol');
            setShowSymbolPicker((s) => !s);
          }}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
            activeTool === 'symbol' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Shapes size={20} />
        </button>

        {showSymbolPicker && (
          <div className="absolute left-full top-0 z-10 ml-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {catalog.map((entry) => (
              <button
                key={entry.type}
                type="button"
                onClick={() => {
                  setActiveSymbolType(entry.type);
                  setActiveTool('symbol');
                  setShowSymbolPicker(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                  activeSymbolType === entry.type ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {entry.label}
                {activeSymbolType === entry.type && <ChevronRight size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <ToolButton active={activeTool === 'run'} title="Run: draw a circuit/pipe line" onClick={() => setActiveTool('run')} Icon={Cable} />
    </div>
  );
}
