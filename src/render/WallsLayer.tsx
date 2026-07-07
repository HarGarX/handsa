import { memo } from 'react';
import type { Opening, Wall } from '../types/plan';
import { computeWallSegments } from '../geometry/wallShape';
import { formatLengthM } from '../geometry/format';
import { wallAngle, wallLength, unitNormal, pointAt } from '../geometry/segment';

interface WallViewProps {
  wall: Wall;
  openings: Opening[];
  selected: boolean;
  scale: number;
  showDimension?: boolean;
}

const WALL_FILL = '#374151';
const WALL_FILL_SELECTED = '#1d4ed8';

function WallViewImpl({ wall, openings, selected, scale, showDimension }: WallViewProps) {
  const segments = computeWallSegments(wall, openings);
  const len = wallLength(wall.start, wall.end);
  const angle = wallAngle(wall.start, wall.end);

  let dimensionText: { x: number; y: number; rotationDeg: number; text: string } | null = null;
  if ((showDimension ?? selected) && len > 0) {
    const mid = pointAt(wall.start, wall.end, 0.5);
    const normal = unitNormal(wall.start, wall.end);
    const offsetCm = (wall.thickness / 2 + 10) / scale + 20 / scale;
    const tx = mid.x + normal.x * offsetCm;
    const ty = mid.y + normal.y * offsetCm;
    let rotationDeg = (angle * 180) / Math.PI;
    // Keep text upright/readable rather than upside-down.
    if (rotationDeg > 90 || rotationDeg < -90) rotationDeg += 180;
    dimensionText = { x: tx, y: ty, rotationDeg, text: formatLengthM(len) };
  }

  return (
    <g>
      {segments.map((seg) => (
        <polygon
          key={seg.key}
          points={seg.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={selected ? WALL_FILL_SELECTED : WALL_FILL}
        />
      ))}
      {selected && (
        <line
          x1={wall.start.x}
          y1={wall.start.y}
          x2={wall.end.x}
          y2={wall.end.y}
          stroke="#60a5fa"
          strokeWidth={1.5 / scale}
          strokeDasharray={`${4 / scale} ${3 / scale}`}
        />
      )}
      {dimensionText && (
        <text
          x={dimensionText.x}
          y={dimensionText.y}
          fontSize={12 / scale}
          fill="#1d4ed8"
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(${dimensionText.rotationDeg} ${dimensionText.x} ${dimensionText.y})`}
        >
          {dimensionText.text}
        </text>
      )}
    </g>
  );
}

const WallView = memo(WallViewImpl);

interface WallsLayerProps {
  walls: Wall[];
  openings: Opening[];
  selectedIds: Set<string>;
  scale: number;
  showAllDimensions?: boolean;
}

function WallsLayerImpl({ walls, openings, selectedIds, scale, showAllDimensions }: WallsLayerProps) {
  return (
    <g>
      {walls.map((wall) => (
        <WallView
          key={wall.id}
          wall={wall}
          openings={openings}
          selected={selectedIds.has(wall.id)}
          scale={scale}
          showDimension={showAllDimensions ? true : undefined}
        />
      ))}
    </g>
  );
}

export const WallsLayer = memo(WallsLayerImpl);
