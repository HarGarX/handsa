import { memo, useMemo } from 'react';
import type { Wall } from '../types/plan';

interface SelectionOverlayProps {
  selectedWalls: Wall[];
  scale: number;
}

function SelectionOverlayImpl({ selectedWalls, scale }: SelectionOverlayProps) {
  const points = useMemo(() => {
    const seen = new Map<string, { x: number; y: number }>();
    for (const w of selectedWalls) {
      seen.set(`${w.start.x.toFixed(2)}:${w.start.y.toFixed(2)}`, w.start);
      seen.set(`${w.end.x.toFixed(2)}:${w.end.y.toFixed(2)}`, w.end);
    }
    return [...seen.entries()].map(([key, p]) => ({ key, p }));
  }, [selectedWalls]);

  const r = 5 / scale;

  return (
    <g>
      {points.map(({ key, p }) => (
        <circle
          key={key}
          cx={p.x}
          cy={p.y}
          r={r}
          fill="#ffffff"
          stroke="#1d4ed8"
          strokeWidth={2 / scale}
        />
      ))}
    </g>
  );
}

export const SelectionOverlay = memo(SelectionOverlayImpl);
