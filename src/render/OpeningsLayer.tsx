import { memo } from 'react';
import type { Opening, Wall } from '../types/plan';
import { openingExtent, isOpeningInvalid } from '../geometry/opening';
import { pointAt, unitNormal } from '../geometry/segment';

interface DoorViewProps {
  wall: Wall;
  opening: Opening;
  selected: boolean;
  scale: number;
}

function DoorViewImpl({ wall, opening, selected, scale }: DoorViewProps) {
  const ext = openingExtent(opening, wall);
  const invalid = isOpeningInvalid(opening, wall);
  const normal = unitNormal(wall.start, wall.end);
  const width = opening.width;
  const hinge = opening.hinge ?? 'start';
  const swing = opening.swing ?? 'left';

  const hingeT = hinge === 'start' ? ext.tMin : ext.tMax;
  const jambT = hinge === 'start' ? ext.tMax : ext.tMin;
  const H = pointAt(wall.start, wall.end, hingeT);
  const J = pointAt(wall.start, wall.end, jambT);

  const swingSign = swing === 'left' ? -1 : 1;
  const leafDir = { x: normal.x * swingSign, y: normal.y * swingSign };
  const leafTip = { x: H.x + leafDir.x * width, y: H.y + leafDir.y * width };

  const cross = leafDir.x * (J.y - H.y) - leafDir.y * (J.x - H.x);
  const sweepFlag = cross > 0 ? 1 : 0;

  const color = invalid ? '#dc2626' : selected ? '#1d4ed8' : '#4b5563';

  return (
    <g>
      {/* jamb posts */}
      <line x1={H.x} y1={H.y} x2={leafTip.x} y2={leafTip.y} stroke={color} strokeWidth={2 / scale} />
      <path
        d={`M ${leafTip.x} ${leafTip.y} A ${width} ${width} 0 0 ${sweepFlag} ${J.x} ${J.y}`}
        fill="none"
        stroke={color}
        strokeWidth={1 / scale}
        strokeDasharray={selected ? undefined : `${3 / scale} ${2 / scale}`}
      />
      {selected && (
        <circle cx={H.x} cy={H.y} r={4 / scale} fill="#1d4ed8" />
      )}
    </g>
  );
}
const DoorView = memo(DoorViewImpl);

interface WindowViewProps {
  wall: Wall;
  opening: Opening;
  selected: boolean;
  scale: number;
}

function WindowViewImpl({ wall, opening, selected, scale }: WindowViewProps) {
  const ext = openingExtent(opening, wall);
  const invalid = isOpeningInvalid(opening, wall);
  const normal = unitNormal(wall.start, wall.end);
  const offset = wall.thickness / 4;

  const a0 = pointAt(wall.start, wall.end, ext.tMin);
  const a1 = pointAt(wall.start, wall.end, ext.tMax);

  const line1a = { x: a0.x + normal.x * offset, y: a0.y + normal.y * offset };
  const line1b = { x: a1.x + normal.x * offset, y: a1.y + normal.y * offset };
  const line2a = { x: a0.x - normal.x * offset, y: a0.y - normal.y * offset };
  const line2b = { x: a1.x - normal.x * offset, y: a1.y - normal.y * offset };

  const color = invalid ? '#dc2626' : selected ? '#1d4ed8' : '#1f2937';

  return (
    <g>
      <line x1={line1a.x} y1={line1a.y} x2={line1b.x} y2={line1b.y} stroke={color} strokeWidth={1.5 / scale} />
      <line x1={line2a.x} y1={line2a.y} x2={line2b.x} y2={line2b.y} stroke={color} strokeWidth={1.5 / scale} />
      <line x1={line1a.x} y1={line1a.y} x2={line2a.x} y2={line2a.y} stroke={color} strokeWidth={1.5 / scale} />
      <line x1={line1b.x} y1={line1b.y} x2={line2b.x} y2={line2b.y} stroke={color} strokeWidth={1.5 / scale} />
    </g>
  );
}
const WindowView = memo(WindowViewImpl);

interface OpeningsLayerProps {
  walls: Wall[];
  openings: Opening[];
  selectedIds: Set<string>;
  scale: number;
}

function OpeningsLayerImpl({ walls, openings, selectedIds, scale }: OpeningsLayerProps) {
  const wallById = new Map(walls.map((w) => [w.id, w]));
  return (
    <g>
      {openings.map((o) => {
        const wall = wallById.get(o.wallId);
        if (!wall) return null;
        return o.type === 'door' ? (
          <DoorView key={o.id} wall={wall} opening={o} selected={selectedIds.has(o.id)} scale={scale} />
        ) : (
          <WindowView key={o.id} wall={wall} opening={o} selected={selectedIds.has(o.id)} scale={scale} />
        );
      })}
    </g>
  );
}

export const OpeningsLayer = memo(OpeningsLayerImpl);
