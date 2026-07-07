import { X } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';

const SHORTCUTS: [string, string][] = [
  ['V', 'Select tool'],
  ['W', 'Wall tool (click to draw, chains automatically)'],
  ['D', 'Door tool'],
  ['N', 'Window tool'],
  ['T', 'Label tool'],
  ['M', 'Measure tool'],
  ['Shift + drag (wall tool)', 'Draw at a free angle (disable 15° snap)'],
  ['Type a number + Enter (wall tool)', 'Set an exact wall length'],
  ['Layer tabs (top)', 'Switch between Architectural / Electrical / Plumbing / Lighting-Power-AC — the tool bar changes to match'],
  ['Symbol tool (non-architectural layers)', 'Click the icon to open a fixture picker, then click the canvas to place'],
  ['Run tool (non-architectural layers)', 'Click to draw a circuit/pipe line; Enter or double-click finishes, Escape cancels'],
  ['Shift + click', 'Add/remove from selection'],
  ['Drag on empty canvas (select tool)', 'Rubber-band select everything inside the box; hold Shift to add/remove from the current selection'],
  ['Arrow keys', 'Nudge the selection by one snap increment (×10 with Shift)'],
  ['Delete / Backspace', 'Delete selected items'],
  ['Escape', 'Cancel current tool / clear selection'],
  ['Space + drag, or middle-drag', 'Pan the canvas'],
  ['Scroll wheel', 'Zoom towards cursor'],
  ['Ctrl/Cmd + Z', 'Undo'],
  ['Ctrl/Cmd + Shift + Z (or Ctrl+Y)', 'Redo'],
  ['Ctrl/Cmd + C', 'Copy the current selection'],
  ['Ctrl/Cmd + V', 'Paste (offset from the original)'],
  ['Ctrl/Cmd + D', 'Duplicate the current selection'],
  ['?', 'Show this help'],
];

export function ShortcutModal() {
  const show = usePlanStore((s) => s.showShortcutModal);
  const setShow = usePlanStore((s) => s.setShowShortcutModal);
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
      <div className="w-[28rem] max-w-[90vw] rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 text-sm">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">{key}</span>
              <span className="text-right text-gray-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
