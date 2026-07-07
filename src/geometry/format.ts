import type { UnitSystem } from '../store/types';

/** Formats a length in cm as meters with 2 decimals, e.g. "3.45 m". */
export function formatLengthM(cm: number): string {
  return `${(cm / 100).toFixed(2)} m`;
}

/** Formats a length in cm, e.g. "345 cm". */
export function formatLengthCm(cm: number): string {
  return `${Math.round(cm)} cm`;
}

/** Formats an angle in radians as degrees, e.g. "45°". */
export function formatAngleDeg(rad: number): string {
  let deg = (rad * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return `${deg.toFixed(0)}°`;
}

/** Formats an area in m^2 with 1 decimal, e.g. "14.2 m²". */
export function formatAreaM2(m2: number): string {
  return `${m2.toFixed(1)} m²`;
}

export const CM_PER_INCH = 2.54;
export const CM_PER_FOOT = CM_PER_INCH * 12;

/** Formats a length in cm as feet + whole inches, e.g. "11' 4"". */
export function formatLengthFtIn(cm: number): string {
  const totalInches = cm / CM_PER_INCH;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}' ${inches}"`;
}

/** Formats an area in m^2 as square feet with 1 decimal, e.g. "153.0 sq ft". */
export function formatAreaSqFt(m2: number): string {
  const sqft = m2 * 10.7639;
  return `${sqft.toFixed(1)} sq ft`;
}

/** Formats a length in cm using whichever unit system is active. */
export function formatLength(cm: number, unit: UnitSystem): string {
  return unit === 'metric' ? formatLengthM(cm) : formatLengthFtIn(cm);
}

/** Like `formatLength`, but for signed coordinates (e.g. a cursor position) rather than a positive distance. */
export function formatSignedLength(cm: number, unit: UnitSystem): string {
  const sign = cm < 0 ? '-' : '';
  return `${sign}${formatLength(Math.abs(cm), unit)}`;
}

/** Formats an area in m^2 using whichever unit system is active. */
export function formatArea(m2: number, unit: UnitSystem): string {
  return unit === 'metric' ? formatAreaM2(m2) : formatAreaSqFt(m2);
}

/**
 * Converts a cm value to the number shown in an editable length field: cm
 * itself for metric, decimal feet for imperial (a single numeric field, not
 * a compound feet+inches widget — simpler input at the cost of not matching
 * `formatLengthFtIn`'s feet+inches display exactly).
 */
export function cmToFieldValue(cm: number, unit: UnitSystem): number {
  return unit === 'metric' ? cm : cm / CM_PER_FOOT;
}

/** Inverse of `cmToFieldValue` — converts an editable field's value back to cm for storage. */
export function fieldValueToCm(value: number, unit: UnitSystem): number {
  return unit === 'metric' ? value : value * CM_PER_FOOT;
}

export function lengthFieldSuffix(unit: UnitSystem): string {
  return unit === 'metric' ? 'cm' : 'ft';
}

const NICE_SCALE_BAR_LENGTHS_CM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
// Nice round foot lengths, expressed in cm so the same "closest to targetPx" search applies.
const NICE_SCALE_BAR_LENGTHS_FT_IN_CM = [1, 2, 3, 6, 12, 24, 60, 120, 240, 600, 1200, 3000, 6000].map(
  (ft) => ft * CM_PER_FOOT,
);

export interface ScaleBarInfo {
  lengthCm: number;
  pixelWidth: number;
  label: string;
}

/** Picks a "nice" round-number scale bar length whose pixel width is close to `targetPx`. */
export function computeScaleBar(pxPerCm: number, targetPx = 100, unit: UnitSystem = 'metric'): ScaleBarInfo {
  const candidates = unit === 'metric' ? NICE_SCALE_BAR_LENGTHS_CM : NICE_SCALE_BAR_LENGTHS_FT_IN_CM;
  let best = candidates[0]!;
  let bestDiff = Infinity;
  for (const cm of candidates) {
    const px = cm * pxPerCm;
    const diff = Math.abs(px - targetPx);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = cm;
    }
  }
  const label =
    unit === 'metric' ? (best >= 100 ? `${best / 100} m` : `${best} cm`) : `${Math.round(best / CM_PER_FOOT)} ft`;
  return { lengthCm: best, pixelWidth: best * pxPerCm, label };
}
