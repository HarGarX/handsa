import { memo } from 'react';
import type { PlacedSymbol, SymbolType, Wall } from '../types/plan';
import { resolveSymbolPosition } from '../geometry/placedSymbol';
import { symbolFootprint } from '../lib/symbolCatalog';

const SELECTED_COLOR = '#1d4ed8';

/** Simple, abstract line-art icon per fixture type, centered at the origin, sized to `width` x `depth` cm. */
export function SymbolIcon({
  type,
  width,
  depth,
  color,
  scale,
}: {
  type: SymbolType;
  width: number;
  depth: number;
  color: string;
  scale: number;
}) {
  const strokeWidth = 1.5 / scale;
  const halfW = width / 2;
  const halfH = depth / 2;

  switch (type) {
    case 'outlet':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} rx={Math.min(halfW, halfH) * 0.3} />
          <line x1={-width * 0.15} y1={-halfH * 0.5} x2={-width * 0.15} y2={halfH * 0.5} />
          <line x1={width * 0.15} y1={-halfH * 0.5} x2={width * 0.15} y2={halfH * 0.5} />
        </g>
      );
    case 'switch':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} rx={Math.min(halfW, halfH) * 0.15} />
          <line x1={-halfW * 0.5} y1={halfH * 0.5} x2={halfW * 0.5} y2={-halfH * 0.5} />
        </g>
      );
    case 'panel':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          {[-0.5, -0.17, 0.17, 0.5].map((f) => (
            <line key={f} x1={-halfW * 0.6} y1={f * depth} x2={halfW * 0.6} y2={f * depth} />
          ))}
        </g>
      );
    case 'sink':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} rx={Math.min(halfW, halfH) * 0.4} />
          <circle cx={0} cy={-halfH * 0.5} r={Math.min(width, depth) * 0.06} fill={color} />
        </g>
      );
    case 'toilet':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW * 0.7} y={-halfH} width={width * 0.7} height={depth * 0.35} />
          <ellipse cx={0} cy={halfH * 0.15} rx={halfW * 0.8} ry={halfH * 0.6} />
        </g>
      );
    case 'shower':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <circle cx={0} cy={0} r={Math.min(width, depth) * 0.08} fill={color} />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={Math.cos(rad) * halfW * 0.25}
                y1={Math.sin(rad) * halfH * 0.25}
                x2={Math.cos(rad) * halfW * 0.7}
                y2={Math.sin(rad) * halfH * 0.7}
              />
            );
          })}
        </g>
      );
    case 'water-heater':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={halfW} />
          <circle cx={0} cy={0} r={halfW * 0.6} />
        </g>
      );
    case 'valve':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={halfW} />
          <line x1={-halfW * 0.7} y1={-halfH * 0.7} x2={halfW * 0.7} y2={halfH * 0.7} />
          <line x1={-halfW * 0.7} y1={halfH * 0.7} x2={halfW * 0.7} y2={-halfH * 0.7} />
        </g>
      );
    case 'light-ceiling':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={halfW * 0.5} />
          {Array.from({ length: 8 }, (_, i) => (i * 360) / 8).map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={Math.cos(rad) * halfW * 0.55}
                y1={Math.sin(rad) * halfH * 0.55}
                x2={Math.cos(rad) * halfW}
                y2={Math.sin(rad) * halfH}
              />
            );
          })}
        </g>
      );
    case 'light-wall':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <path d={`M ${-halfW} 0 A ${halfW} ${halfH} 0 0 1 ${halfW} 0 Z`} />
          {[-45, 0, 45].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={Math.sin(rad) * halfW * 0.3}
                y1={-Math.cos(rad) * halfH * 0.3}
                x2={Math.sin(rad) * halfW * 0.9}
                y2={-Math.cos(rad) * halfH * 0.9}
              />
            );
          })}
        </g>
      );
    case 'ac-unit':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <line x1={-halfW * 0.6} y1={0} x2={halfW * 0.6} y2={-halfH * 0.3} />
          <line x1={-halfW * 0.2} y1={0} x2={halfW * 0.6} y2={halfH * 0.15} />
        </g>
      );
    case 'thermostat':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={halfW} />
          <circle cx={0} cy={0} r={halfW * 0.2} fill={color} />
        </g>
      );
    case 'bed':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <rect x={-halfW + width * 0.08} y={-halfH + depth * 0.06} width={width * 0.32} height={depth * 0.16} />
          <rect x={halfW - width * 0.4} y={-halfH + depth * 0.06} width={width * 0.32} height={depth * 0.16} />
          <line x1={-halfW} y1={-halfH + depth * 0.3} x2={halfW} y2={-halfH + depth * 0.3} />
        </g>
      );
    case 'sofa':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} rx={Math.min(width, depth) * 0.08} />
          <rect x={-halfW + width * 0.06} y={-halfH + depth * 0.08} width={width * 0.88} height={depth * 0.28} />
          <rect x={-halfW} y={-halfH} width={width * 0.12} height={depth} />
          <rect x={halfW - width * 0.12} y={-halfH} width={width * 0.12} height={depth} />
        </g>
      );
    case 'sectional':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} rx={Math.min(width, depth) * 0.05} />
          <line x1={halfW - depth * 0.6} y1={-halfH} x2={halfW} y2={-halfH + depth * 0.6} />
          <rect x={-halfW + width * 0.05} y={-halfH + depth * 0.08} width={width * 0.5} height={depth * 0.25} />
        </g>
      );
    case 'dining-table':
      return <rect x={-halfW} y={-halfH} width={width} height={depth} rx={4} stroke={color} strokeWidth={strokeWidth} fill="none" />;
    case 'dining-table-round':
      return <circle cx={0} cy={0} r={halfW} stroke={color} strokeWidth={strokeWidth} fill="none" />;
    case 'chair':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH * 0.3} width={width} height={depth * 0.65} />
          <path d={`M ${-halfW} ${-halfH * 0.3} A ${halfW} ${halfH * 0.7} 0 0 1 ${halfW} ${-halfH * 0.3}`} />
        </g>
      );
    case 'counter':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <line x1={-halfW} y1={-halfH + depth * 0.25} x2={halfW} y2={-halfH + depth * 0.25} />
        </g>
      );
    case 'island':
      return <rect x={-halfW} y={-halfH} width={width} height={depth} stroke={color} strokeWidth={strokeWidth} fill="none" />;
    case 'wardrobe':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <line x1={0} y1={-halfH} x2={0} y2={halfH} />
          <line x1={0} y1={-halfH} x2={-halfW * 0.6} y2={-halfH * 0.3} />
          <line x1={0} y1={-halfH} x2={halfW * 0.6} y2={-halfH * 0.3} />
        </g>
      );
    case 'desk':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <rect x={-width * 0.15} y={-halfH + depth * 0.12} width={width * 0.3} height={depth * 0.3} />
        </g>
      );
    case 'tv-stand':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <rect x={-halfW * 0.85} y={-halfH * 0.5} width={width * 0.7} height={depth * 0.28} />
        </g>
      );
    case 'floor-lamp':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <circle cx={0} cy={0} r={halfW * 0.15} fill={color} />
          <path d={`M ${-halfW * 0.6} ${-halfH * 0.6} L ${halfW * 0.6} ${-halfH * 0.6} L ${halfW * 0.85} ${halfH * 0.7} L ${-halfW * 0.85} ${halfH * 0.7} Z`} />
        </g>
      );
    case 'wall-art':
      return (
        <g stroke={color} strokeWidth={strokeWidth} fill="none">
          <rect x={-halfW} y={-halfH} width={width} height={depth} />
          <line x1={-halfW * 0.6} y1={0} x2={halfW * 0.2} y2={0} />
          <line x1={-halfW * 0.2} y1={-halfH * 0.6} x2={halfW * 0.6} y2={halfH * 0.6} />
        </g>
      );
    default:
      return <circle cx={0} cy={0} r={Math.min(halfW, halfH)} stroke={color} strokeWidth={strokeWidth} fill="none" />;
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
  const { width, depth } = symbolFootprint(symbol);
  return (
    <g transform={`translate(${pos.x} ${pos.y}) rotate(${symbol.rotation})`}>
      <SymbolIcon type={symbol.type} width={width} depth={depth} color={selected ? SELECTED_COLOR : color} scale={scale} />
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
