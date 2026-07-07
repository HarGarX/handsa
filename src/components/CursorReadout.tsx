import { usePlanStore } from '../store/usePlanStore';

export function CursorReadout() {
  const cursorWorld = usePlanStore((s) => s.interaction.cursorWorld);

  if (!cursorWorld) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs tabular-nums text-gray-500 shadow-sm">
      x: {(cursorWorld.x / 100).toFixed(2)} m, y: {(cursorWorld.y / 100).toFixed(2)} m
    </div>
  );
}
