import { memo, useMemo } from 'react';
import type { Wall } from '../types/plan';
import type { UnitSystem } from '../store/types';
import { detectRooms } from '../geometry/rooms';
import { formatArea } from '../geometry/format';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface RoomsLayerProps {
  walls: Wall[];
  scale: number;
  unit?: UnitSystem;
}

function RoomsLayerImpl({ walls, scale, unit = 'metric' }: RoomsLayerProps) {
  const debouncedWalls = useDebouncedValue(walls, 150);
  const rooms = useMemo(() => detectRooms(debouncedWalls), [debouncedWalls]);

  return (
    <g>
      {rooms.map((room) => (
        <g key={room.id}>
          <polygon
            points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="#3b82f6"
            fillOpacity={0.05}
            stroke="none"
          />
          <text
            x={room.centroid.x}
            y={room.centroid.y}
            fontSize={13 / scale}
            fill="#9ca3af"
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ userSelect: 'none' }}
          >
            {formatArea(room.areaM2, unit)}
          </text>
        </g>
      ))}
    </g>
  );
}

export const RoomsLayer = memo(RoomsLayerImpl);
