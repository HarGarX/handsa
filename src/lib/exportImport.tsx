import { renderToStaticMarkup } from 'react-dom/server';
import { v4 as uuidv4 } from 'uuid';
import type { Plan } from '../types/plan';
import { isValidPlanShape } from '../types/plan';
import { fitToPoints } from '../geometry/viewport';
import { RoomsLayer } from '../render/RoomsLayer';
import { JointsLayer } from '../render/JointsLayer';
import { WallsLayer } from '../render/WallsLayer';
import { OpeningsLayer } from '../render/OpeningsLayer';
import { LabelsLayer } from '../render/LabelsLayer';
import type { JointStyle } from '../store/types';

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
  return { ...parsed, id: uuidv4(), updatedAt: now };
}

const EXPORT_BASE_WIDTH = 1400;
const EXPORT_BASE_HEIGHT = 1000;
const EXPORT_PADDING_PX = 60;
const EXPORT_SCALE_MULTIPLIER = 2;

function buildExportSvgMarkup(
  plan: Plan,
  jointStyle: JointStyle,
): { markup: string; width: number; height: number } {
  const points = [...plan.walls.flatMap((w) => [w.start, w.end]), ...plan.labels.map((l) => l.position)];
  const viewport = fitToPoints(points, EXPORT_BASE_WIDTH, EXPORT_BASE_HEIGHT, EXPORT_PADDING_PX);

  const inner = renderToStaticMarkup(
    <>
      <RoomsLayer walls={plan.walls} scale={viewport.scale} />
      <JointsLayer walls={plan.walls} selectedWallIds={new Set()} jointStyle={jointStyle} />
      <WallsLayer
        walls={plan.walls}
        openings={plan.openings}
        selectedIds={new Set()}
        scale={viewport.scale}
        showAllDimensions
      />
      <OpeningsLayer walls={plan.walls} openings={plan.openings} selectedIds={new Set()} scale={viewport.scale} />
      <LabelsLayer labels={plan.labels} selectedIds={new Set()} />
    </>,
  );

  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_BASE_WIDTH}" height="${EXPORT_BASE_HEIGHT}" viewBox="0 0 ${EXPORT_BASE_WIDTH} ${EXPORT_BASE_HEIGHT}">
    <rect x="0" y="0" width="${EXPORT_BASE_WIDTH}" height="${EXPORT_BASE_HEIGHT}" fill="#ffffff" />
    <g transform="translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})">${inner}</g>
  </svg>`;

  return { markup, width: EXPORT_BASE_WIDTH, height: EXPORT_BASE_HEIGHT };
}

export async function exportPlanPng(plan: Plan, jointStyle: JointStyle): Promise<void> {
  const { markup, width, height } = buildExportSvgMarkup(plan, jointStyle);
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
