import { memo } from 'react';
import type { PlacedSymbol, Wall } from '../types/plan';
import { resolveSymbolPosition, symbolResizeHandles } from '../geometry/placedSymbol';
import { symbolCatalogEntry, symbolFootprint } from '../lib/symbolCatalog';

interface SymbolResizeOverlayProps {
  symbol: PlacedSymbol | null;
  walls: Wall[];
  scale: number;
}

function SymbolResizeOverlayImpl({ symbol, walls, scale }: SymbolResizeOverlayProps) {
  if (!symbol) return null;
  const entry = symbolCatalogEntry(symbol.type);
  if (!entry.resizable) return null;

  const center = resolveSymbolPosition(symbol, walls);
  const { width, depth } = symbolFootprint(symbol);
  const { widthHandle, depthHandle } = symbolResizeHandles(center, symbol.rotation, width, depth);
  const half = 5 / scale;

  return (
    <g>
      <rect
        x={widthHandle.x - half}
        y={widthHandle.y - half}
        width={half * 2}
        height={half * 2}
        fill="#ffffff"
        stroke="#1d4ed8"
        strokeWidth={1.5 / scale}
      />
      <rect
        x={depthHandle.x - half}
        y={depthHandle.y - half}
        width={half * 2}
        height={half * 2}
        fill="#ffffff"
        stroke="#1d4ed8"
        strokeWidth={1.5 / scale}
      />
    </g>
  );
}

export const SymbolResizeOverlay = memo(SymbolResizeOverlayImpl);
