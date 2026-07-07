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

const NICE_SCALE_BAR_LENGTHS_CM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

export interface ScaleBarInfo {
  lengthCm: number;
  pixelWidth: number;
  label: string;
}

/** Picks a "nice" round-number scale bar length whose pixel width is close to `targetPx`. */
export function computeScaleBar(pxPerCm: number, targetPx = 100): ScaleBarInfo {
  let best = NICE_SCALE_BAR_LENGTHS_CM[0]!;
  let bestDiff = Infinity;
  for (const cm of NICE_SCALE_BAR_LENGTHS_CM) {
    const px = cm * pxPerCm;
    const diff = Math.abs(px - targetPx);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = cm;
    }
  }
  const label = best >= 100 ? `${best / 100} m` : `${best} cm`;
  return { lengthCm: best, pixelWidth: best * pxPerCm, label };
}
