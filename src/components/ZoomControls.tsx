import { ZoomIn, ZoomOut, Scan } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';
import { computeScaleBar } from '../geometry/format';

interface ZoomControlsProps {
  containerWidth: number;
  containerHeight: number;
}

export function ZoomControls({ containerWidth, containerHeight }: ZoomControlsProps) {
  const viewport = usePlanStore((s) => s.viewport);
  const zoomAtScreenPoint = usePlanStore((s) => s.zoomAtScreenPoint);
  const zoomToFit = usePlanStore((s) => s.zoomToFit);

  const center = { x: containerWidth / 2, y: containerHeight / 2 };
  const scaleBar = computeScaleBar(viewport.scale);

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1.5 py-1 shadow-sm">
        <button
          type="button"
          title="Zoom out"
          onClick={() => zoomAtScreenPoint(center, 1 / 1.25)}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
        >
          <ZoomOut size={15} />
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-gray-500">
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          type="button"
          title="Zoom in"
          onClick={() => zoomAtScreenPoint(center, 1.25)}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
        >
          <ZoomIn size={15} />
        </button>
        <div className="mx-0.5 h-5 w-px bg-gray-200" />
        <button
          type="button"
          title="Zoom to fit"
          onClick={() => zoomToFit(containerWidth, containerHeight)}
          className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
        >
          <Scan size={15} />
        </button>
      </div>
      <div className="pointer-events-auto flex flex-col items-start gap-0.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm">
        <div className="border-b-2 border-l-2 border-r-2 border-gray-500" style={{ width: scaleBar.pixelWidth, height: 6 }} />
        <span className="text-[10px] text-gray-500">{scaleBar.label}</span>
      </div>
    </div>
  );
}
