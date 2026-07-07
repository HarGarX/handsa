import { memo } from 'react';
import type { Label } from '../types/plan';

interface LabelViewProps {
  label: Label;
  selected: boolean;
}

function LabelViewImpl({ label, selected }: LabelViewProps) {
  return (
    <text
      x={label.position.x}
      y={label.position.y}
      fontSize={label.fontSize}
      fill={selected ? '#1d4ed8' : '#111827'}
      textAnchor="start"
      dominantBaseline="hanging"
      style={{ userSelect: 'none' }}
    >
      {label.text}
    </text>
  );
}
const LabelView = memo(LabelViewImpl);

interface LabelsLayerProps {
  labels: Label[];
  selectedIds: Set<string>;
}

function LabelsLayerImpl({ labels, selectedIds }: LabelsLayerProps) {
  return (
    <g>
      {labels.map((label) => (
        <LabelView key={label.id} label={label} selected={selectedIds.has(label.id)} />
      ))}
    </g>
  );
}

export const LabelsLayer = memo(LabelsLayerImpl);
