import { Eye, EyeOff } from 'lucide-react';
import { usePlanStore } from '../store/usePlanStore';

export function LayerBar() {
  const layers = usePlanStore((s) => s.plan.layers);
  const activeLayerId = usePlanStore((s) => s.activeLayerId);
  const setActiveLayer = usePlanStore((s) => s.setActiveLayer);
  const setLayerVisibility = usePlanStore((s) => s.setLayerVisibility);

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-3">
      {layers.map((layer) => {
        const active = layer.id === activeLayerId;
        return (
          <div
            key={layer.id}
            className={`flex items-center gap-1.5 rounded-md py-1 pl-2.5 pr-1.5 text-sm transition-colors ${
              active ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveLayer(layer.id)}
              className="flex items-center gap-1.5"
              title={`Switch to ${layer.name} — its tools appear in the left toolbar and its content becomes editable`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
              {layer.name}
            </button>
            <button
              type="button"
              title={
                layer.visible
                  ? 'Hide this layer when it isn\'t active (it still shows normally while you\'re working on it)'
                  : 'Show this layer as a dimmed reference underlay when a different layer is active'
              }
              onClick={() => setLayerVisibility(layer.id, !layer.visible)}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
            >
              {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
