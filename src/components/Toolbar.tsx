import { useEffect, useState } from 'react';
import { MousePointer2, BrickWall, DoorOpen, AppWindow, Type, Ruler, Shapes, Cable, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import type { ToolId } from '../store/types';
import { RUN_TYPE_BY_LAYER_KIND, RUN_TYPE_LABELS, symbolCatalogFor } from '../lib/symbolCatalog';

interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
  description: string;
  Icon: LucideIcon;
}

const ARCHITECTURAL_TOOLS: ToolDef[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'V',
    description: 'Select, move, and edit walls, openings, labels, symbols & runs. Drag on empty canvas to box-select.',
    Icon: MousePointer2,
  },
  {
    id: 'wall',
    label: 'Wall',
    shortcut: 'W',
    description: 'Draw walls — click to place points, it chains automatically. Enter/double-click to finish, Shift for a free angle.',
    Icon: BrickWall,
  },
  {
    id: 'door',
    label: 'Door',
    shortcut: 'D',
    description: 'Place a door — hover over a wall to preview it, then click to place.',
    Icon: DoorOpen,
  },
  {
    id: 'window',
    label: 'Window',
    shortcut: 'N',
    description: 'Place a window — hover over a wall to preview it, then click to place.',
    Icon: AppWindow,
  },
  {
    id: 'label',
    label: 'Label',
    shortcut: 'T',
    description: 'Add a text label — click to place, type, Enter to confirm or Esc to cancel.',
    Icon: Type,
  },
  {
    id: 'measure',
    label: 'Measure',
    shortcut: 'M',
    description: 'Measure a distance — click two points to see a temporary dimension line.',
    Icon: Ruler,
  },
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

  // The picker's open/closed state is local to this component and otherwise
  // survives a layer switch untouched. Left open (e.g. the user switches
  // layers without picking an option), the *next* click on the Symbol
  // button would toggle it closed instead of opening a fresh picker for the
  // newly active layer — reset it whenever the active layer changes so each
  // layer always starts with the picker closed.
  useEffect(() => {
    setShowSymbolPicker(false);
  }, [activeLayerId]);

  // Same reasoning: switching to a different tool (Select/Run) without
  // picking an option should close a picker left open, not leave it
  // floating stale over whichever tool is now active.
  useEffect(() => {
    if (activeTool !== 'symbol') setShowSymbolPicker(false);
  }, [activeTool]);

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const isArchitectural = !activeLayer || activeLayer.kind === 'architectural';

  if (isArchitectural) {
    return (
      <div className="flex w-14 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
        {ARCHITECTURAL_TOOLS.map(({ id, label, shortcut, description, Icon }) => (
          <ToolButton
            key={id}
            active={activeTool === id}
            title={`${label} (${shortcut}) — ${description}`}
            onClick={() => setActiveTool(id)}
            Icon={Icon}
          />
        ))}
      </div>
    );
  }

  const catalog = symbolCatalogFor(activeLayer.kind);
  const activeEntry = catalog.find((e) => e.type === activeSymbolType);
  // `isArchitectural` above already returned early for the architectural
  // layer, so `activeLayer.kind` here is always one of the fixture kinds —
  // narrow the type to match `RUN_TYPE_BY_LAYER_KIND`'s key set.
  const runType = RUN_TYPE_BY_LAYER_KIND[activeLayer.kind as Exclude<typeof activeLayer.kind, 'architectural'>];

  return (
    <div className="relative flex w-14 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3">
      <ToolButton
        active={activeTool === 'select'}
        title="Select (V) — select, move, and edit this layer's symbols & runs. Drag empty canvas to box-select."
        onClick={() => setActiveTool('select')}
        Icon={MousePointer2}
      />

      <div className="relative">
        <button
          type="button"
          title={
            activeEntry
              ? `Symbol: ${activeEntry.label} — click to change type, then click the canvas to place one`
              : 'Symbol — click to pick a fixture type, then click the canvas to place it'
          }
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
                title={
                  entry.wallMounted
                    ? `${entry.label} — snaps to and slides along the nearest wall`
                    : `${entry.label} — click anywhere in the room to place it`
                }
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

      {runType && (
        <ToolButton
          active={activeTool === 'run'}
          title={`Run: draw a ${RUN_TYPE_LABELS[runType]} line — click to add points, Enter or double-click to finish (saved automatically even if you switch tools)`}
          onClick={() => setActiveTool('run')}
          Icon={Cable}
        />
      )}
    </div>
  );
}
