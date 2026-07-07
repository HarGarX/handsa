import { memo } from 'react';
import type { Run, RunType } from '../types/plan';

const SELECTED_COLOR = '#1d4ed8';

function strokeStyleFor(type: RunType, scale: number): { width: number; dash?: string } {
  switch (type) {
    case 'circuit':
      return { width: 2 / scale, dash: `${5 / scale} ${3 / scale}` };
    case 'supply-pipe':
      return { width: 2.5 / scale };
    case 'drain-pipe':
      return { width: 3.5 / scale, dash: `${1 / scale} ${3 / scale}` };
    default:
      return { width: 2 / scale };
  }
}

interface RunViewProps {
  run: Run;
  selected: boolean;
  color: string;
  scale: number;
}

function RunViewImpl({ run, selected, color, scale }: RunViewProps) {
  const style = strokeStyleFor(run.type, scale);
  return (
    <g>
      <polyline
        points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={selected ? SELECTED_COLOR : color}
        strokeWidth={style.width}
        strokeDasharray={style.dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {run.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2 / scale} fill={selected ? SELECTED_COLOR : color} />
      ))}
    </g>
  );
}
const RunView = memo(RunViewImpl);

interface RunsLayerProps {
  runs: Run[];
  selectedIds: Set<string>;
  color: string;
  scale: number;
}

function RunsLayerImpl({ runs, selectedIds, color, scale }: RunsLayerProps) {
  return (
    <g>
      {runs.map((r) => (
        <RunView key={r.id} run={r} selected={selectedIds.has(r.id)} color={color} scale={scale} />
      ))}
    </g>
  );
}

export const RunsLayer = memo(RunsLayerImpl);
