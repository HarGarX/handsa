import { memo } from 'react';
import { computeGridLines } from '../geometry/grid';
import type { Viewport } from '../geometry/viewport';

interface GridLayerProps {
  viewport: Viewport;
  width: number;
  height: number;
}

/** Renders grid lines in screen space (drawn outside the world transform group). */
function GridLayerImpl({ viewport, width, height }: GridLayerProps) {
  const lines = computeGridLines(viewport, width, height);
  return (
    <g>
      {lines.map((line) => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={line.major ? '#d1d5db' : '#e9eaed'}
          strokeWidth={1}
        />
      ))}
    </g>
  );
}

export const GridLayer = memo(GridLayerImpl);
