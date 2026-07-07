import { renderToStaticMarkup } from 'react-dom/server';
import { v4 as uuidv4 } from 'uuid';
import type { Plan } from '../types/plan';
import { isValidPlanShape, normalizePlan } from '../types/plan';
import type { Viewport } from '../geometry/viewport';
import { RoomsLayer } from '../render/RoomsLayer';
import { JointsLayer } from '../render/JointsLayer';
import { WallsLayer } from '../render/WallsLayer';
import { OpeningsLayer } from '../render/OpeningsLayer';
import { LabelsLayer } from '../render/LabelsLayer';
import { SymbolsLayer } from '../render/SymbolsLayer';
import { RunsLayer } from '../render/RunsLayer';
import type { JointStyle, UnitSystem } from '../store/types';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-z0-9\-_ ]/gi, '_') || 'plan';
}

export function exportPlanJson(plan: Plan): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${sanitizeFilename(plan.name)}.json`);
}

export class InvalidPlanFileError extends Error {}

export async function readPlanJsonFile(file: File): Promise<Plan> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidPlanFileError('The selected file is not valid JSON.');
  }
  if (!isValidPlanShape(parsed)) {
    throw new InvalidPlanFileError('The selected file does not match the expected floor plan format.');
  }
  const now = new Date().toISOString();
  return normalizePlan({ ...parsed, id: uuidv4(), updatedAt: now } as Plan);
}

const EXPORT_PADDING_PX = 60;
const EXPORT_SCALE_MULTIPLIER = 2;
const EXPORT_MAX_DIMENSION_PX = 4000;
// At 1:100 (the default), 1 real-world cm renders as this many export pixels.
// Not a physical-print DPI calibration (this is a PNG for on-screen viewing,
// not a paper size) - chosen so the default scale produces a comfortably
// crisp image. Phase 4's PDF export can swap this for a true paper-size +
// DPI calculation once physical printing is actually in scope.
const BASE_PX_PER_CM_AT_1_100 = 4;

function pxPerCmForScale(scaleDenominator: number): number {
  return BASE_PX_PER_CM_AT_1_100 * (100 / scaleDenominator);
}

function buildExportSvgMarkup(
  plan: Plan,
  jointStyle: JointStyle,
  unit: UnitSystem,
  scaleDenominator: number,
): { markup: string; width: number; height: number } {
  const points = [
    ...plan.walls.flatMap((w) => [w.start, w.end]),
    ...plan.labels.map((l) => l.position),
    ...plan.symbols.map((s) => s.position),
    ...plan.runs.flatMap((r) => r.points),
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (points.length === 0) {
    minX = -250;
    minY = -250;
    maxX = 250;
    maxY = 250;
  }
  const worldWidth = Math.max(maxX - minX, 100);
  const worldHeight = Math.max(maxY - minY, 100);

  let pxPerCm = pxPerCmForScale(scaleDenominator);
  let width = worldWidth * pxPerCm + EXPORT_PADDING_PX * 2;
  let height = worldHeight * pxPerCm + EXPORT_PADDING_PX * 2;
  const maxDim = Math.max(width, height);
  if (maxDim > EXPORT_MAX_DIMENSION_PX) {
    const shrink = EXPORT_MAX_DIMENSION_PX / maxDim;
    pxPerCm *= shrink;
    width *= shrink;
    height *= shrink;
  }

  const viewport: Viewport = {
    offsetX: EXPORT_PADDING_PX - minX * pxPerCm,
    offsetY: EXPORT_PADDING_PX - minY * pxPerCm,
    scale: pxPerCm,
  };

  const inner = renderToStaticMarkup(
    <>
      <RoomsLayer walls={plan.walls} scale={viewport.scale} unit={unit} />
      <JointsLayer walls={plan.walls} selectedWallIds={new Set()} jointStyle={jointStyle} />
      <WallsLayer
        walls={plan.walls}
        openings={plan.openings}
        selectedIds={new Set()}
        scale={viewport.scale}
        showAllDimensions
        unit={unit}
      />
      <OpeningsLayer walls={plan.walls} openings={plan.openings} selectedIds={new Set()} scale={viewport.scale} />
      <LabelsLayer labels={plan.labels} selectedIds={new Set()} />
      {plan.layers
        .filter((l) => l.kind !== 'architectural' && l.visible)
        .map((l) => (
          <g key={l.id}>
            <SymbolsLayer
              symbols={plan.symbols.filter((s) => s.layerId === l.id)}
              walls={plan.walls}
              selectedIds={new Set()}
              color={l.color}
              scale={viewport.scale}
            />
            <RunsLayer runs={plan.runs.filter((r) => r.layerId === l.id)} selectedIds={new Set()} color={l.color} scale={viewport.scale} />
          </g>
        ))}
    </>,
  );

  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    <g transform="translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})">${inner}</g>
    <text x="${EXPORT_PADDING_PX / 2}" y="${height - EXPORT_PADDING_PX / 3}" font-size="14" font-family="sans-serif" fill="#6b7280">Scale 1:${scaleDenominator}</text>
  </svg>`;

  return { markup, width, height };
}

export async function exportPlanPng(
  plan: Plan,
  jointStyle: JointStyle,
  unit: UnitSystem,
  scaleDenominator: number,
): Promise<void> {
  const { markup, width, height } = buildExportSvgMarkup(plan, jointStyle, unit, scaleDenominator);
  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to rasterize the plan SVG.'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * EXPORT_SCALE_MULTIPLIER;
    canvas.height = height * EXPORT_SCALE_MULTIPLIER;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('Failed to encode PNG.');
    downloadBlob(pngBlob, `${sanitizeFilename(plan.name)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
