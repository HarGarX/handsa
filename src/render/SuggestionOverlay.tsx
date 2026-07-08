import { memo, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Layer, Opening, PlacedSymbol, Point, Wall } from '../types/plan';
import { detectRooms, type Room } from '../geometry/rooms';
import { pointInPolygon } from '../geometry/area';
import { suggestPlacements, type PlacementSuggestion } from '../geometry/placementSuggestions';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePlanStore } from '../store/usePlanStore';
import { symbolCatalogEntry } from '../lib/symbolCatalog';
import { SymbolIcon } from './SymbolsLayer';

const GHOST_COLOR = '#a855f7'; // furniture layer accent

interface SuggestionGhostProps {
  suggestion: PlacementSuggestion;
  scale: number;
  layerId: string;
}

function SuggestionGhostImpl({ suggestion, scale, layerId }: SuggestionGhostProps) {
  function accept(e: React.PointerEvent) {
    e.stopPropagation();
    const symbol: PlacedSymbol = {
      id: uuidv4(),
      layerId,
      type: suggestion.type,
      position: suggestion.position,
      rotation: suggestion.rotation,
      wallId: suggestion.wallId,
      t: suggestion.t,
    };
    usePlanStore.getState().addSymbol(symbol);
  }

  // A full-time rationale label next to every ghost gets unreadable fast once
  // several suggestions are active in a modest-sized room (labels overlap each
  // other and the walls). Instead: the icon is always visible, a small "+"
  // badge marks it as clickable, and the rationale — like every other control
  // this session — surfaces as a native hover tooltip via <title>, which
  // costs zero layout space and never overlaps anything.
  const badgeRadius = 7 / scale;
  const badgeOffset = { x: suggestion.width / 2 - badgeRadius * 0.3, y: -suggestion.depth / 2 + badgeRadius * 0.3 };

  return (
    <g style={{ cursor: 'pointer' }} onPointerDown={accept}>
      <title>{`${symbolCatalogEntry(suggestion.type).label} — ${suggestion.rationale} Click to place it here.`}</title>
      <g
        transform={`translate(${suggestion.position.x} ${suggestion.position.y}) rotate(${suggestion.rotation})`}
        opacity={0.55}
        strokeDasharray={`${5 / scale} ${4 / scale}`}
      >
        <SymbolIcon type={suggestion.type} width={suggestion.width} depth={suggestion.depth} color={GHOST_COLOR} scale={scale} />
        <circle cx={badgeOffset.x} cy={badgeOffset.y} r={badgeRadius} fill={GHOST_COLOR} stroke="white" strokeWidth={1 / scale} />
        <line
          x1={badgeOffset.x - badgeRadius * 0.5}
          y1={badgeOffset.y}
          x2={badgeOffset.x + badgeRadius * 0.5}
          y2={badgeOffset.y}
          stroke="white"
          strokeWidth={1.4 / scale}
        />
        <line
          x1={badgeOffset.x}
          y1={badgeOffset.y - badgeRadius * 0.5}
          x2={badgeOffset.x}
          y2={badgeOffset.y + badgeRadius * 0.5}
          stroke="white"
          strokeWidth={1.4 / scale}
        />
      </g>
    </g>
  );
}
const SuggestionGhost = memo(SuggestionGhostImpl);

// Suggestion ghosts and their rationale labels are offset outward from the
// room's walls, so they can sit just past the strict room polygon boundary.
// Without this grace margin, moving the mouse from "hovering the room" to
// "clicking a suggestion's label" would cross back out of the polygon and
// hide the whole overlay a moment before the click lands — classic
// hover-menu-closes-before-you-can-click-it. Padding the room's own bounding
// box by a generous margin keeps the suggestions (and the room they belong
// to) "stuck" while the cursor is merely reaching for one of them.
const HOVER_GRACE_PADDING_CM = 150;

function withinPaddedBounds(point: Point, room: Room, padding: number): boolean {
  const xs = room.points.map((p) => p.x);
  const ys = room.points.map((p) => p.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

interface SuggestionOverlayProps {
  active: boolean;
  cursorWorld: Point | null;
  walls: Wall[];
  openings: Opening[];
  symbols: PlacedSymbol[];
  layers: Layer[];
  activeLayerId: string;
  scale: number;
}

function SuggestionOverlayImpl({
  active,
  cursorWorld,
  walls,
  openings,
  symbols,
  layers,
  activeLayerId,
  scale,
}: SuggestionOverlayProps) {
  const debouncedWalls = useDebouncedValue(walls, 150);
  const rooms = useMemo(() => detectRooms(debouncedWalls), [debouncedWalls]);

  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !cursorWorld) {
      setHoveredRoomId(null);
      return;
    }
    const direct = rooms.find((r) => pointInPolygon(cursorWorld, r.points));
    if (direct) {
      setHoveredRoomId(direct.id);
      return;
    }
    setHoveredRoomId((prev) => {
      const prevRoom = prev ? rooms.find((r) => r.id === prev) : undefined;
      if (prevRoom && withinPaddedBounds(cursorWorld, prevRoom, HOVER_GRACE_PADDING_CM)) return prev;
      return null;
    });
  }, [active, cursorWorld, rooms]);

  const suggestions = useMemo(() => {
    const room = hoveredRoomId ? rooms.find((r) => r.id === hoveredRoomId) : undefined;
    if (!room) return [];
    return suggestPlacements({ room, walls, openings, symbols, layers });
  }, [hoveredRoomId, rooms, walls, openings, symbols, layers]);

  if (suggestions.length === 0) return null;

  return (
    <g>
      {suggestions.map((s) => (
        <SuggestionGhost key={s.id} suggestion={s} scale={scale} layerId={activeLayerId} />
      ))}
    </g>
  );
}

export const SuggestionOverlay = memo(SuggestionOverlayImpl);
