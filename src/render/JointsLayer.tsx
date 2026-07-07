import { memo, useMemo } from 'react';
import type { Wall } from '../types/plan';
import type { JointStyle } from '../store/types';
import { computeWallJoints } from '../geometry/joints';

interface JointsLayerProps {
  walls: Wall[];
  selectedWallIds: Set<string>;
  jointStyle: JointStyle;
}

const WALL_FILL = '#374151';
const WALL_FILL_SELECTED = '#1d4ed8';

// Not debounced like RoomsLayer: joint caps exist specifically to look seamless
// while dragging, and the O(n^2) crossing-pair check is cheap enough (a few
// hundred walls is still well under a millisecond) to recompute every frame.
function JointsLayerImpl({ walls, selectedWallIds, jointStyle }: JointsLayerProps) {
  const joints = useMemo(() => computeWallJoints(walls), [walls]);

  return (
    <g>
      {joints.map((joint) => {
        const selected = joint.wallIds.some((id) => selectedWallIds.has(id));
        const fill = selected ? WALL_FILL_SELECTED : WALL_FILL;
        return jointStyle === 'round' ? (
          <circle key={joint.id} cx={joint.point.x} cy={joint.point.y} r={joint.radius} fill={fill} />
        ) : (
          <rect
            key={joint.id}
            x={joint.point.x - joint.radius}
            y={joint.point.y - joint.radius}
            width={joint.radius * 2}
            height={joint.radius * 2}
            fill={fill}
          />
        );
      })}
    </g>
  );
}

export const JointsLayer = memo(JointsLayerImpl);
