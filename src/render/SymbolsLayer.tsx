import { memo } from 'react';
import type { PlacedSymbol, SymbolType, Wall } from '../types/plan';
import { resolveSymbolPosition } from '../geometry/placedSymbol';
import { symbolCatalogEntry } from '../lib/symbolCatalog';

const SELECTED_COLOR = '#1d4ed8';

/** Simple, abstract line-art icon per fixture type, centered at the origin, sized to `size` cm. */
export function SymbolIcon({ type, size, color, scale }: { type: SymbolType; size: number; color: string; scale: number }) {
  const strokeWidth = 1.5 / scale;
  const half = size / 2;

  switch (type) {
    case 'outlet':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-half} y={-half * 0.6} width={size} height={size * 0.6} rx={size * 0.15} />
          <line x1={-size * 0.15} y1={-half * 0.3} x2={-size * 0.15} y2={half * 0.3} />
          <line x1={size * 0.15} y1={-half * 0.3} x2={size * 0.15} y2={half * 0.3} />
        </g>
      );
    case 'switch':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-half} y={-half} width={size} height={size} rx={size * 0.1} />
          <line x1={-half * 0.5} y1={half * 0.5} x2={half * 0.5} y2={-half * 0.5} />
        </g>
      );
    case 'panel':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-half} y={-half} width={size} height={size} />
          {[-0.5, -0.17, 0.17, 0.5].map((f) => (
            <line key={f} x1={-half * 0.6} y1={f * size} x2={half * 0.6} y2={f * size} />
          ))}
        </g>
      );
    case 'sink':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-half} y={-half * 0.6} width={size} height={size * 0.6} rx={size * 0.25} />
          <circle cx={0} cy={-half * 0.6} r={size * 0.06} fill={color} />
        </g>
      );
    case 'toilet':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-half * 0.5} y={-half} width={size * 0.5} height={size * 0.35} />
          <ellipse cx={0} cy={half * 0.15} rx={half * 0.55} ry={half * 0.6} />
        </g>
      );
    case 'shower':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-half} y={-half} width={size} height={size} />
          <circle cx={0} cy={0} r={size * 0.08} fill={color} />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={Math.cos(rad) * size * 0.12}
                y1={Math.sin(rad) * size * 0.12}
                x2={Math.cos(rad) * size * 0.32}
                y2={Math.sin(rad) * size * 0.32}
              />
            );
          })}
        </g>
      );
    case 'water-heater':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={half} />
          <circle cx={0} cy={0} r={half * 0.6} />
        </g>
      );
    case 'valve':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={half} />
          <line x1={-half * 0.7} y1={-half * 0.7} x2={half * 0.7} y2={half * 0.7} />
          <line x1={-half * 0.7} y1={half * 0.7} x2={half * 0.7} y2={-half * 0.7} />
        </g>
      );
    case 'light-ceiling':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={half * 0.5} />
          {Array.from({ length: 8 }, (_, i) => (i * 360) / 8).map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={Math.cos(rad) * half * 0.55}
                y1={Math.sin(rad) * half * 0.55}
                x2={Math.cos(rad) * half}
                y2={Math.sin(rad) * half}
              />
            );
          })}
        </g>
      );
    case 'light-wall':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <path d={`M ${-half} 0 A ${half} ${half} 0 0 1 ${half} 0 Z`} />
          {[-45, 0, 45].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={Math.sin(rad) * half * 0.3}
                y1={-Math.cos(rad) * half * 0.3}
                x2={Math.sin(rad) * half * 0.9}
                y2={-Math.cos(rad) * half * 0.9}
              />
            );
          })}
        </g>
      );
    case 'ac-unit':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-half} y={-size * 0.15} width={size} height={size * 0.3} />
          <line x1={-half * 0.6} y1={0} x2={half * 0.6} y2={-size * 0.1} />
          <line x1={-half * 0.2} y1={0} x2={half * 0.6} y2={size * 0.05} />
        </g>
      );
    case 'thermostat':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={half} />
          <circle cx={0} cy={0} r={half * 0.2} fill={color} />
        </g>
      );
    default:
      return <circle cx={0} cy={0} r={half} stroke={color} strokeWidth={strokeWidth} fill="none" />;
  }
}

interface SymbolViewProps {
  symbol: PlacedSymbol;
  walls: Wall[];
  selected: boolean;
  color: string;
  scale: number;
}

function SymbolViewImpl({ symbol, walls, selected, color, scale }: SymbolViewProps) {
  const pos = resolveSymbolPosition(symbol, walls);
  const entry = symbolCatalogEntry(symbol.type);
  return (
    <g transform={`translate(${pos.x} ${pos.y}) rotate(${symbol.rotation})`}>
      <SymbolIcon type={symbol.type} size={entry.size} color={selected ? SELECTED_COLOR : color} scale={scale} />
    </g>
  );
}
const SymbolView = memo(SymbolViewImpl);

interface SymbolsLayerProps {
  symbols: PlacedSymbol[];
  walls: Wall[];
  selectedIds: Set<string>;
  color: string;
  scale: number;
}

function SymbolsLayerImpl({ symbols, walls, selectedIds, color, scale }: SymbolsLayerProps) {
  return (
    <g>
      {symbols.map((s) => (
        <SymbolView key={s.id} symbol={s} walls={walls} selected={selectedIds.has(s.id)} color={color} scale={scale} />
      ))}
    </g>
  );
}

export const SymbolsLayer = memo(SymbolsLayerImpl);
