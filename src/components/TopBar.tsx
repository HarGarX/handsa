import { useRef, useState } from 'react';
import { Undo2, Redo2, Download, Upload, FolderOpen, HelpCircle, Image as ImageIcon, Magnet } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import type { SnapIncrement } from '../store/types';
import { exportPlanJson, exportPlanPng, readPlanJsonFile, InvalidPlanFileError } from '../lib/exportImport';

export function TopBar() {
  const plan = usePlanStore((s) => s.plan);
  const past = usePlanStore((s) => s.past);
  const future = usePlanStore((s) => s.future);
  const undo = usePlanStore((s) => s.undo);
  const redo = usePlanStore((s) => s.redo);
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const snapEnabled = usePlanStore((s) => s.snapEnabled);
  const snapIncrement = usePlanStore((s) => s.snapIncrement);
  const setSnapEnabled = usePlanStore((s) => s.setSnapEnabled);
  const setSnapIncrement = usePlanStore((s) => s.setSnapIncrement);
  const setShowPlansModal = usePlanStore((s) => s.setShowPlansModal);
  const setShowShortcutModal = usePlanStore((s) => s.setShowShortcutModal);
  const importPlan = usePlanStore((s) => s.importPlan);
  const setToast = usePlanStore((s) => s.setToast);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(plan.name);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportingPng, setExportingPng] = useState(false);

  function commitName() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== plan.name) renamePlan(trimmed);
    setEditingName(false);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await readPlanJsonFile(file);
      importPlan(imported);
      setToast(`Imported "${imported.name}" as a new plan.`);
    } catch (err) {
      const message = err instanceof InvalidPlanFileError ? err.message : 'Failed to import file.';
      setToast(message);
    }
  }

  async function handleExportPng() {
    setExportingPng(true);
    try {
      await exportPlanPng(plan);
    } catch {
      setToast('Failed to export PNG.');
    } finally {
      setExportingPng(false);
    }
  }

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <span className="text-sm font-semibold text-gray-900">Blueprint</span>
      <div className="h-6 w-px bg-gray-200" />

      {editingName ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName();
            else if (e.key === 'Escape') {
              setNameDraft(plan.name);
              setEditingName(false);
            }
          }}
          className="rounded border border-blue-400 px-2 py-1 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          title="Click to rename"
          onClick={() => {
            setNameDraft(plan.name);
            setEditingName(true);
          }}
          className="rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          {plan.name}
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          usePlanStore.getState().refreshPlansIndex();
          setShowPlansModal(true);
        }}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
      >
        <FolderOpen size={16} />
        My Plans
      </button>

      <div className="h-6 w-px bg-gray-200" />

      <button
        type="button"
        title="Undo (Ctrl+Z)"
        disabled={past.length === 0}
        onClick={() => undo()}
        className="flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Undo2 size={17} />
      </button>
      <button
        type="button"
        title="Redo (Ctrl+Shift+Z)"
        disabled={future.length === 0}
        onClick={() => redo()}
        className="flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Redo2 size={17} />
      </button>

      <div className="h-6 w-px bg-gray-200" />

      <button
        type="button"
        title="Toggle grid snapping"
        aria-pressed={snapEnabled}
        onClick={() => setSnapEnabled(!snapEnabled)}
        className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-sm ${
          snapEnabled ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Magnet size={16} />
        Snap
      </button>
      <select
        value={snapIncrement}
        onChange={(e) => setSnapIncrement(Number(e.target.value) as SnapIncrement)}
        className="rounded border border-gray-200 px-1.5 py-1 text-sm text-gray-700"
        title="Snap increment"
      >
        <option value={1}>1 cm</option>
        <option value={5}>5 cm</option>
        <option value={10}>10 cm</option>
      </select>

      <div className="flex-1" />

      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
      <button
        type="button"
        title="Import JSON"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
      >
        <Upload size={16} />
        Import
      </button>
      <button
        type="button"
        title="Export JSON"
        onClick={() => exportPlanJson(plan)}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
      >
        <Download size={16} />
        JSON
      </button>
      <button
        type="button"
        title="Export PNG"
        onClick={handleExportPng}
        disabled={exportingPng}
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        <ImageIcon size={16} />
        {exportingPng ? 'Exporting…' : 'PNG'}
      </button>

      <div className="h-6 w-px bg-gray-200" />

      <button
        type="button"
        title="Keyboard shortcuts (?)"
        onClick={() => setShowShortcutModal(true)}
        className="flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
      >
        <HelpCircle size={18} />
      </button>
    </div>
  );
}
