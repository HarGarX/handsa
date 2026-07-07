import { useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import type { Hinge, RunType, SymbolType, Swing } from '../types/plan';
import { unitDirection, wallLength } from '../geometry/segment';
import { cmToFieldValue, fieldValueToCm, lengthFieldSuffix } from '../geometry/format';
import { RUN_TYPE_LABELS, symbolCatalogEntry, symbolCatalogFor } from '../lib/symbolCatalog';

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  function commit() {
    const parsed = parseFloat(text);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
      onCommit(clamped);
      setText(String(clamped));
    } else {
      setText(String(value));
    }
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      {label}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-400"
        />
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </div>
    </label>
  );
}

/** Wraps NumberField for cm-stored values, displaying/accepting them in the active unit system. */
function LengthField({
  label,
  valueCm,
  minCm,
  maxCm,
  onCommitCm,
}: {
  label: string;
  valueCm: number;
  minCm?: number;
  maxCm?: number;
  onCommitCm: (cm: number) => void;
}) {
  const unit = usePlanStore((s) => s.unitSystem);
  const displayValue = cmToFieldValue(valueCm, unit);
  return (
    <NumberField
      key={unit}
      label={`${label} (${lengthFieldSuffix(unit)})`}
      value={unit === 'metric' ? Math.round(displayValue) : Math.round(displayValue * 100) / 100}
      min={minCm !== undefined ? cmToFieldValue(minCm, unit) : undefined}
      max={maxCm !== undefined ? cmToFieldValue(maxCm, unit) : undefined}
      step={unit === 'metric' ? 1 : 0.1}
      onCommit={(v) => onCommitCm(fieldValueToCm(v, unit))}
    />
  );
}

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-500">
      {label}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-400"
      />
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h3>;
}

function WallProperties({ wallId }: { wallId: string }) {
  const wall = usePlanStore((s) => s.plan.walls.find((w) => w.id === wallId));
  const commitImmediate = usePlanStore((s) => s.commitImmediate);
  if (!wall) return null;
  const length = wallLength(wall.start, wall.end);

  function setLength(newLengthCm: number) {
    if (!wall || newLengthCm <= 0) return;
    const dir = unitDirection(wall.start, wall.end);
    const end = { x: wall.start.x + dir.x * newLengthCm, y: wall.start.y + dir.y * newLengthCm };
    commitImmediate((plan) => ({
      ...plan,
      walls: plan.walls.map((w) => (w.id === wallId ? { ...w, end } : w)),
    }));
  }

  function setThickness(t: number) {
    commitImmediate((plan) => ({
      ...plan,
      walls: plan.walls.map((w) => (w.id === wallId ? { ...w, thickness: t } : w)),
    }));
  }

  return (
    <div key={wallId} className="flex flex-col gap-3">
      <SectionTitle>Wall</SectionTitle>
      <LengthField label="Length" valueCm={length} minCm={1} maxCm={5000} onCommitCm={setLength} />
      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Thickness (cm)
        <select
          value={wall.thickness}
          onChange={(e) => setThickness(Number(e.target.value))}
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-400"
        >
          {[10, 15, 20, 25, 30].map((t) => (
            <option key={t} value={t}>
              {t} cm
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function OpeningProperties({ openingId }: { openingId: string }) {
  const opening = usePlanStore((s) => s.plan.openings.find((o) => o.id === openingId));
  const commitImmediate = usePlanStore((s) => s.commitImmediate);
  if (!opening) return null;

  function setWidth(w: number) {
    commitImmediate((plan) => ({
      ...plan,
      openings: plan.openings.map((o) => (o.id === openingId ? { ...o, width: w } : o)),
    }));
  }
  function setHinge(hinge: Hinge) {
    commitImmediate((plan) => ({
      ...plan,
      openings: plan.openings.map((o) => (o.id === openingId ? { ...o, hinge } : o)),
    }));
  }
  function setSwing(swing: Swing) {
    commitImmediate((plan) => ({
      ...plan,
      openings: plan.openings.map((o) => (o.id === openingId ? { ...o, swing } : o)),
    }));
  }

  return (
    <div key={openingId} className="flex flex-col gap-3">
      <SectionTitle>{opening.type === 'door' ? 'Door' : 'Window'}</SectionTitle>
      <LengthField label="Width" valueCm={opening.width} minCm={30} maxCm={400} onCommitCm={setWidth} />
      {opening.type === 'door' && (
        <>
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            Hinge side
            <div className="flex gap-1">
              {(['start', 'end'] as Hinge[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHinge(h)}
                  className={`flex-1 rounded border px-2 py-1 text-sm ${
                    (opening.hinge ?? 'start') === h
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            Swing side
            <div className="flex gap-1">
              {(['left', 'right'] as Swing[]).map((sw) => (
                <button
                  key={sw}
                  type="button"
                  onClick={() => setSwing(sw)}
                  className={`flex-1 rounded border px-2 py-1 text-sm ${
                    (opening.swing ?? 'left') === sw
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {sw}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <p className="text-xs text-gray-400">
        {opening.type === 'door'
          ? 'Tip: click a placed door with the Select tool to cycle its hinge/swing.'
          : 'Windows render as a double line cut into the wall.'}
      </p>
    </div>
  );
}

function LabelProperties({ labelId }: { labelId: string }) {
  const label = usePlanStore((s) => s.plan.labels.find((l) => l.id === labelId));
  const commitImmediate = usePlanStore((s) => s.commitImmediate);
  if (!label) return null;

  function setText(text: string) {
    commitImmediate((plan) => ({ ...plan, labels: plan.labels.map((l) => (l.id === labelId ? { ...l, text } : l)) }));
  }
  function setFontSize(fontSize: number) {
    commitImmediate((plan) => ({
      ...plan,
      labels: plan.labels.map((l) => (l.id === labelId ? { ...l, fontSize } : l)),
    }));
  }

  return (
    <div key={labelId} className="flex flex-col gap-3">
      <SectionTitle>Label</SectionTitle>
      <TextField label="Text" value={label.text} onCommit={setText} />
      <NumberField label="Font size (cm)" value={label.fontSize} min={5} max={200} onCommit={setFontSize} />
    </div>
  );
}

function SymbolProperties({ symbolId }: { symbolId: string }) {
  const symbol = usePlanStore((s) => s.plan.symbols.find((sym) => sym.id === symbolId));
  const layers = usePlanStore((s) => s.plan.layers);
  const commitImmediate = usePlanStore((s) => s.commitImmediate);
  if (!symbol) return null;
  const layer = layers.find((l) => l.id === symbol.layerId);
  const entry = symbolCatalogEntry(symbol.type);
  const catalog = layer && layer.kind !== 'architectural' ? symbolCatalogFor(layer.kind) : [];

  function setType(type: SymbolType) {
    commitImmediate((plan) => ({
      ...plan,
      symbols: plan.symbols.map((s) => (s.id === symbolId ? { ...s, type } : s)),
    }));
  }
  function setRotation(rotation: number) {
    commitImmediate((plan) => ({
      ...plan,
      symbols: plan.symbols.map((s) => (s.id === symbolId ? { ...s, rotation } : s)),
    }));
  }

  return (
    <div key={symbolId} className="flex flex-col gap-3">
      <SectionTitle>{layer?.name ?? 'Symbol'}</SectionTitle>
      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Type
        <select
          value={symbol.type}
          onChange={(e) => setType(e.target.value as SymbolType)}
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-400"
        >
          {catalog.map((c) => (
            <option key={c.type} value={c.type}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <NumberField label="Rotation (degrees)" value={Math.round(symbol.rotation)} min={0} max={359} onCommit={setRotation} />
      <p className="text-xs text-gray-400">
        {symbol.wallId
          ? `Wall-mounted — slides along its wall in the Select tool.`
          : `Free-placed — drag to reposition.`}{' '}
        Footprint: {entry.size} cm.
      </p>
    </div>
  );
}

function RunProperties({ runId }: { runId: string }) {
  const run = usePlanStore((s) => s.plan.runs.find((r) => r.id === runId));
  const layers = usePlanStore((s) => s.plan.layers);
  const commitImmediate = usePlanStore((s) => s.commitImmediate);
  if (!run) return null;
  const layer = layers.find((l) => l.id === run.layerId);

  function setType(type: RunType) {
    commitImmediate((plan) => ({ ...plan, runs: plan.runs.map((r) => (r.id === runId ? { ...r, type } : r)) }));
  }

  return (
    <div key={runId} className="flex flex-col gap-3">
      <SectionTitle>{layer?.name ?? 'Run'}</SectionTitle>
      <label className="flex flex-col gap-1 text-xs text-gray-500">
        Type
        <select
          value={run.type}
          onChange={(e) => setType(e.target.value as RunType)}
          className="w-full rounded border border-gray-200 px-2 py-1 text-sm text-gray-900 outline-none focus:border-blue-400"
        >
          {(Object.keys(RUN_TYPE_LABELS) as RunType[]).map((t) => (
            <option key={t} value={t}>
              {RUN_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-gray-400">{run.points.length} points along this run.</p>
    </div>
  );
}

function PlanStats() {
  const plan = usePlanStore((s) => s.plan);
  const renamePlan = usePlanStore((s) => s.renamePlan);
  const [name, setName] = useState(plan.name);

  return (
    <div key={plan.id} className="flex flex-col gap-3">
      <SectionTitle>Plan</SectionTitle>
      <TextField
        label="Name"
        value={name}
        onCommit={(v) => {
          setName(v);
          if (v.trim()) renamePlan(v.trim());
        }}
      />
      <dl className="grid grid-cols-2 gap-y-1 text-xs text-gray-500">
        <dt>Walls</dt>
        <dd className="text-right text-gray-900">{plan.walls.length}</dd>
        <dt>Doors</dt>
        <dd className="text-right text-gray-900">{plan.openings.filter((o) => o.type === 'door').length}</dd>
        <dt>Windows</dt>
        <dd className="text-right text-gray-900">{plan.openings.filter((o) => o.type === 'window').length}</dd>
        <dt>Labels</dt>
        <dd className="text-right text-gray-900">{plan.labels.length}</dd>
        <dt>Symbols</dt>
        <dd className="text-right text-gray-900">{plan.symbols.length}</dd>
        <dt>Runs</dt>
        <dd className="text-right text-gray-900">{plan.runs.length}</dd>
      </dl>
      <p className="text-xs text-gray-400">Select an item on the canvas to edit its properties.</p>
    </div>
  );
}

export function PropertiesPanel() {
  const selection = usePlanStore((s) => s.selection);
  const collapsed = usePlanStore((s) => s.propertiesPanelCollapsed);
  const setCollapsed = usePlanStore((s) => s.setPropertiesPanelCollapsed);

  if (collapsed) {
    return (
      <div className="flex w-10 flex-col items-center border-l border-gray-200 bg-white py-3">
        <button
          type="button"
          title="Expand properties panel"
          onClick={() => setCollapsed(false)}
          className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
        >
          <PanelRightOpen size={18} />
        </button>
      </div>
    );
  }

  let content: React.ReactNode;
  if (selection.length === 1) {
    const entry = selection[0]!;
    if (entry.type === 'wall') content = <WallProperties wallId={entry.id} />;
    else if (entry.type === 'opening') content = <OpeningProperties openingId={entry.id} />;
    else if (entry.type === 'symbol') content = <SymbolProperties symbolId={entry.id} />;
    else if (entry.type === 'run') content = <RunProperties runId={entry.id} />;
    else content = <LabelProperties labelId={entry.id} />;
  } else if (selection.length > 1) {
    content = <p className="text-sm text-gray-500">{selection.length} items selected</p>;
  } else {
    content = <PlanStats />;
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-4 border-l border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Properties</span>
        <button
          type="button"
          title="Collapse properties panel"
          onClick={() => setCollapsed(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
        >
          <PanelRightClose size={16} />
        </button>
      </div>
      {content}
    </div>
  );
}
