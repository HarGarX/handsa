import { memo } from 'react';
import type { Point, Wall } from '../types/plan';
import type { MarqueeDraft, MeasureDraft, OpeningGhost, RunDraft, SymbolGhost, UnitSystem, WallDraft } from '../store/types';
import { formatAngleDeg, formatLength } from '../geometry/format';
import { normalizeRect } from '../geometry/rect';
import { pointAt, unitNormal, wallAngle, wallLength } from '../geometry/segment';
import { symbolCatalogEntry } from '../lib/symbolCatalog';
import { SymbolIcon } from './SymbolsLayer';

interface ToolPreviewLayerProps {
  wallDraft: WallDraft | null;
  measureDraft: MeasureDraft | null;
  openingGhost: OpeningGhost | null;
  runDraft: RunDraft | null;
  symbolGhost: SymbolGhost | null;
  marquee: MarqueeDraft | null;
  walls: Wall[];
  hoveredEndpoint: Point | null;
  scale: number;
  unit: UnitSystem;
}

function DimensionText({ x, y, scale, text, color = '#2563eb' }: { x: number; y: number; scale: number; text: string; color?: string }) {
  return (
    <text x={x} y={y} fontSize={13 / scale} fill={color} textAnchor="middle" dominantBaseline="middle">
      {text}
    </text>
  );
}

function WallDraftPreview({ draft, scale, unit }: { draft: WallDraft; scale: number; unit: UnitSystem }) {
  const allPoints = draft.previewPoint ? [...draft.points, draft.previewPoint] : draft.points;
  if (allPoints.length === 0) return null;

  let previewInfo: { mid: Point; text: string } | null = null;
  if (draft.points.length > 0 && draft.previewPoint) {
    const last = draft.points[draft.points.length - 1]!;
    const len = wallLength(last, draft.previewPoint);
    const angle = wallAngle(last, draft.previewPoint);
    const mid = pointAt(last, draft.previewPoint, 0.5);
    previewInfo = { mid, text: `${formatLength(len, unit)}  ${formatAngleDeg(angle)}` };
  }

  return (
    <g>
      <polyline
        points={allPoints.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#2563eb"
        strokeWidth={15}
        strokeOpacity={0.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={allPoints.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#2563eb"
        strokeWidth={1.5 / scale}
        strokeDasharray={`${5 / scale} ${3 / scale}`}
      />
      {allPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5 / scale} fill="#2563eb" />
      ))}
      {previewInfo && (
        <g transform={`translate(${previewInfo.mid.x} ${previewInfo.mid.y - 10 / scale})`}>
          <DimensionText x={0} y={0} scale={scale} text={previewInfo.text} />
        </g>
      )}
    </g>
  );
}

function MeasurePreview({ draft, scale, unit }: { draft: MeasureDraft; scale: number; unit: UnitSystem }) {
  if (!draft.start || !draft.end) return null;
  const len = wallLength(draft.start, draft.end);
  const mid = pointAt(draft.start, draft.end, 0.5);
  const normal = unitNormal(draft.start, draft.end);
  const textPos = { x: mid.x + normal.x * (14 / scale), y: mid.y + normal.y * (14 / scale) };
  return (
    <g>
      <line x1={draft.start.x} y1={draft.start.y} x2={draft.end.x} y2={draft.end.y} stroke="#f59e0b" strokeWidth={1.5 / scale} strokeDasharray={`${6 / scale} ${3 / scale}`} />
      <circle cx={draft.start.x} cy={draft.start.y} r={3.5 / scale} fill="#f59e0b" />
      <circle cx={draft.end.x} cy={draft.end.y} r={3.5 / scale} fill="#f59e0b" />
      <DimensionText x={textPos.x} y={textPos.y} scale={scale} text={formatLength(len, unit)} color="#b45309" />
    </g>
  );
}

function OpeningGhostPreview({ ghost, walls, scale }: { ghost: OpeningGhost; walls: Wall[]; scale: number }) {
  const wall = walls.find((w) => w.id === ghost.wallId);
  if (!wall) return null;
  const width = ghost.type === 'door' ? 90 : 120;
  const len = wallLength(wall.start, wall.end);
  const halfT = width / 2 / len;
  const t0 = Math.max(0, ghost.t - halfT);
  const t1 = Math.min(1, ghost.t + halfT);
  const p0 = pointAt(wall.start, wall.end, t0);
  const p1 = pointAt(wall.start, wall.end, t1);
  const normal = unitNormal(wall.start, wall.end);
  const half = wall.thickness / 2;
  const a = { x: p0.x + normal.x * half, y: p0.y + normal.y * half };
  const b = { x: p1.x + normal.x * half, y: p1.y + normal.y * half };
  const c = { x: p1.x - normal.x * half, y: p1.y - normal.y * half };
  const d = { x: p0.x - normal.x * half, y: p0.y - normal.y * half };
  return (
    <polygon
      points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
      fill="#2563eb"
      fillOpacity={0.35}
      stroke="#2563eb"
      strokeWidth={1 / scale}
    />
  );
}

function RunDraftPreview({ draft, scale }: { draft: RunDraft; scale: number }) {
  const allPoints = draft.previewPoint ? [...draft.points, draft.previewPoint] : draft.points;
  if (allPoints.length === 0) return null;
  return (
    <g>
      <polyline
        points={allPoints.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#2563eb"
        strokeWidth={1.5 / scale}
        strokeDasharray={`${5 / scale} ${3 / scale}`}
      />
      {allPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3 / scale} fill="#2563eb" />
      ))}
    </g>
  );
}

function SymbolGhostPreview({ ghost, scale }: { ghost: SymbolGhost; scale: number }) {
  const entry = symbolCatalogEntry(ghost.type);
  return (
    <g transform={`translate(${ghost.position.x} ${ghost.position.y}) rotate(${ghost.rotation})`} opacity={0.5}>
      <SymbolIcon type={ghost.type} size={entry.size} color="#2563eb" scale={scale} />
    </g>
  );
}

function MarqueePreview({ marquee, scale }: { marquee: MarqueeDraft; scale: number }) {
  const rect = normalizeRect(marquee.start, marquee.end);
  return (
    <rect
      x={rect.minX}
      y={rect.minY}
      width={rect.maxX - rect.minX}
      height={rect.maxY - rect.minY}
      fill="#2563eb"
      fillOpacity={0.08}
      stroke="#2563eb"
      strokeWidth={1 / scale}
      strokeDasharray={`${4 / scale} ${3 / scale}`}
    />
  );
}

function ToolPreviewLayerImpl({
  wallDraft,
  measureDraft,
  openingGhost,
  runDraft,
  symbolGhost,
  marquee,
  walls,
  hoveredEndpoint,
  scale,
  unit,
}: ToolPreviewLayerProps) {
  return (
    <g>
      {openingGhost && <OpeningGhostPreview ghost={openingGhost} walls={walls} scale={scale} />}
      {symbolGhost && <SymbolGhostPreview ghost={symbolGhost} scale={scale} />}
      {wallDraft && <WallDraftPreview draft={wallDraft} scale={scale} unit={unit} />}
      {runDraft && <RunDraftPreview draft={runDraft} scale={scale} />}
      {measureDraft && <MeasurePreview draft={measureDraft} scale={scale} unit={unit} />}
      {marquee && <MarqueePreview marquee={marquee} scale={scale} />}
      {hoveredEndpoint && (
        <circle cx={hoveredEndpoint.x} cy={hoveredEndpoint.y} r={6 / scale} fill="none" stroke="#22c55e" strokeWidth={2 / scale} />
      )}
    </g>
  );
}

export const ToolPreviewLayer = memo(ToolPreviewLayerImpl);
