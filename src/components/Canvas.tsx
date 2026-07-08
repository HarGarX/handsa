import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { screenToWorld } from '../geometry/viewport';
import { toolRegistry } from '../tools/registry';
import type { PointerInfo } from '../tools/types';
import { GridLayer } from '../render/GridLayer';
import { JointsLayer } from '../render/JointsLayer';
import { WallsLayer } from '../render/WallsLayer';
import { OpeningsLayer } from '../render/OpeningsLayer';
import { LabelsLayer } from '../render/LabelsLayer';
import { RoomsLayer } from '../render/RoomsLayer';
import { SymbolsLayer } from '../render/SymbolsLayer';
import { RunsLayer } from '../render/RunsLayer';
import { SelectionOverlay } from '../render/SelectionOverlay';
import { SymbolResizeOverlay } from '../render/SymbolResizeOverlay';
import { ToolPreviewLayer } from '../render/ToolPreviewLayer';
import { LabelEditorOverlay } from './LabelEditorOverlay';
import { ZoomControls } from './ZoomControls';
import { CursorReadout } from './CursorReadout';

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  const plan = usePlanStore((s) => s.plan);
  const viewport = usePlanStore((s) => s.viewport);
  const activeTool = usePlanStore((s) => s.activeTool);
  const activeLayerId = usePlanStore((s) => s.activeLayerId);
  const jointStyle = usePlanStore((s) => s.jointStyle);
  const unitSystem = usePlanStore((s) => s.unitSystem);
  const selection = usePlanStore((s) => s.selection);
  const interaction = usePlanStore((s) => s.interaction);
  const setInteraction = usePlanStore((s) => s.setInteraction);
  const panBy = usePlanStore((s) => s.panBy);
  const zoomAtScreenPoint = usePlanStore((s) => s.zoomAtScreenPoint);
  const zoomToFit = usePlanStore((s) => s.zoomToFit);

  const isPanningRef = useRef(false);
  const lastPanScreenRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);
  const didInitialFit = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (didInitialFit.current) return;
    if (size.width > 0 && size.height > 0) {
      zoomToFit(size.width, size.height);
      didInitialFit.current = true;
    }
  }, [size, zoomToFit]);

  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      toolRegistry[prevToolRef.current].onDeactivate?.();
      prevToolRef.current = activeTool;
    }
  }, [activeTool]);

  const toScreenPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const buildPointerInfo = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): PointerInfo => {
      const screen = toScreenPoint(e.clientX, e.clientY);
      const world = screenToWorld(viewport, screen);
      return { world, screen, shiftKey: e.shiftKey, button: e.button, pointerId: e.pointerId };
    },
    [toScreenPoint, viewport],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const isPanTrigger = e.button === 1 || (e.button === 0 && spaceDownRef.current);
      if (isPanTrigger) {
        e.preventDefault();
        isPanningRef.current = true;
        lastPanScreenRef.current = toScreenPoint(e.clientX, e.clientY);
        setInteraction({ isPanning: true });
        svgRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      const info = buildPointerInfo(e);
      toolRegistry[activeTool].onPointerDown(info);
      svgRef.current?.setPointerCapture(e.pointerId);
    },
    [activeTool, buildPointerInfo, setInteraction, toScreenPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const screen = toScreenPoint(e.clientX, e.clientY);
      const world = screenToWorld(viewport, screen);
      setInteraction({ cursorWorld: world });

      if (isPanningRef.current) {
        const dx = screen.x - lastPanScreenRef.current.x;
        const dy = screen.y - lastPanScreenRef.current.y;
        lastPanScreenRef.current = screen;
        panBy(dx, dy);
        return;
      }
      const info = buildPointerInfo(e);
      toolRegistry[activeTool].onPointerMove(info);
    },
    [activeTool, buildPointerInfo, panBy, setInteraction, toScreenPoint, viewport],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setInteraction({ isPanning: false });
        svgRef.current?.releasePointerCapture(e.pointerId);
        return;
      }
      const info = buildPointerInfo(e);
      toolRegistry[activeTool].onPointerUp(info);
      svgRef.current?.releasePointerCapture(e.pointerId);
    },
    [activeTool, buildPointerInfo, setInteraction],
  );

  const handleDoubleClick = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const info = buildPointerInfo(e as unknown as React.PointerEvent<SVGSVGElement>);
      toolRegistry[activeTool].onDoubleClick?.(info);
    },
    [activeTool, buildPointerInfo],
  );

  // Native wheel listener (non-passive) so we can preventDefault to stop page scroll while zooming.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.pow(1.0015, -e.deltaY);
      zoomAtScreenPoint(screen, factor);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [zoomAtScreenPoint]);

  // Spacebar pan-mode toggling + global keyboard shortcuts.
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.code === 'Space' && !spaceDownRef.current) {
        spaceDownRef.current = true;
        setInteraction({ isSpaceDown: true });
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) usePlanStore.getState().redo();
        else usePlanStore.getState().undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        usePlanStore.getState().redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        usePlanStore.getState().copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        usePlanStore.getState().pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        usePlanStore.getState().duplicateSelection();
        return;
      }

      if (e.key === '?') {
        usePlanStore.getState().setShowShortcutModal(true);
        return;
      }

      if (e.key === 'Escape') {
        const current = usePlanStore.getState().activeTool;
        if (current !== 'select') usePlanStore.getState().setActiveTool('select');
        else usePlanStore.getState().clearSelection();
      }

      const arrowDeltas: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      if (arrowDeltas[e.key] && usePlanStore.getState().activeTool === 'select') {
        e.preventDefault();
        const { snapIncrement, nudgeSelected } = usePlanStore.getState();
        const step = snapIncrement * (e.shiftKey ? 10 : 1);
        const [dirX, dirY] = arrowDeltas[e.key]!;
        nudgeSelected(dirX * step, dirY * step);
        return;
      }

      const toolKeys: Record<string, ReturnType<typeof usePlanStore.getState>['activeTool']> = {
        v: 'select',
        w: 'wall',
        d: 'door',
        n: 'window',
        t: 'label',
        m: 'measure',
      };
      const lower = e.key.toLowerCase();
      if (!mod && toolKeys[lower]) {
        usePlanStore.getState().setActiveTool(toolKeys[lower]);
      }

      toolRegistry[usePlanStore.getState().activeTool].onKeyDown?.(e);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        setInteraction({ isSpaceDown: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setInteraction]);

  const selectedWallIds = useMemo(
    () => new Set(selection.filter((s) => s.type === 'wall').map((s) => s.id)),
    [selection],
  );
  const selectedOpeningIds = useMemo(
    () => new Set(selection.filter((s) => s.type === 'opening').map((s) => s.id)),
    [selection],
  );
  const selectedLabelIds = useMemo(
    () => new Set(selection.filter((s) => s.type === 'label').map((s) => s.id)),
    [selection],
  );
  const selectedSymbolIds = useMemo(
    () => new Set(selection.filter((s) => s.type === 'symbol').map((s) => s.id)),
    [selection],
  );
  const selectedRunIds = useMemo(
    () => new Set(selection.filter((s) => s.type === 'run').map((s) => s.id)),
    [selection],
  );
  const selectedWalls = useMemo(
    () => plan.walls.filter((w) => selectedWallIds.has(w.id)),
    [plan.walls, selectedWallIds],
  );

  const singleSelectedSymbol = useMemo(() => {
    if (selection.length !== 1 || selection[0]!.type !== 'symbol') return null;
    return plan.symbols.find((s) => s.id === selection[0]!.id) ?? null;
  }, [selection, plan.symbols]);

  const isArchitecturalActive = useMemo(() => {
    const layer = plan.layers.find((l) => l.id === activeLayerId);
    return !layer || layer.kind === 'architectural';
  }, [plan.layers, activeLayerId]);

  // A layer being the active one always renders (you need to see what you're
  // editing), independent of its own `visible` flag; that flag only controls
  // whether an *inactive* layer shows up as a dimmed reference underlay.
  const architecturalLayer = plan.layers.find((l) => l.kind === 'architectural');
  const showArchitecture = isArchitecturalActive || (architecturalLayer?.visible ?? true);

  let cursorClass = 'cursor-default';
  if (interaction.isPanning) cursorClass = 'cursor-grabbing';
  else if (interaction.isSpaceDown) cursorClass = 'cursor-grab';
  else if (activeTool !== 'select') cursorClass = 'cursor-crosshair';

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-gray-100">
      <svg
        ref={svgRef}
        data-testid="floorplan-canvas"
        width={size.width}
        height={size.height}
        className={`touch-none select-none ${cursorClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <rect x={0} y={0} width={size.width} height={size.height} fill="#f3f4f6" />
        <GridLayer viewport={viewport} width={size.width} height={size.height} />
        <g transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})`}>
          {showArchitecture && (
            <g opacity={isArchitecturalActive ? 1 : 0.3}>
              <RoomsLayer walls={plan.walls} scale={viewport.scale} unit={unitSystem} />
              <JointsLayer walls={plan.walls} selectedWallIds={selectedWallIds} jointStyle={jointStyle} />
              <WallsLayer
                walls={plan.walls}
                openings={plan.openings}
                selectedIds={selectedWallIds}
                scale={viewport.scale}
                unit={unitSystem}
              />
              <OpeningsLayer walls={plan.walls} openings={plan.openings} selectedIds={selectedOpeningIds} scale={viewport.scale} />
              <LabelsLayer labels={plan.labels} selectedIds={selectedLabelIds} />
            </g>
          )}
          {plan.layers
            .filter((l) => l.kind !== 'architectural' && (l.visible || l.id === activeLayerId))
            .map((l) => (
              <g key={l.id} opacity={l.id === activeLayerId ? 1 : 0.3}>
                <SymbolsLayer
                  symbols={plan.symbols.filter((s) => s.layerId === l.id)}
                  walls={plan.walls}
                  selectedIds={selectedSymbolIds}
                  color={l.color}
                  scale={viewport.scale}
                />
                <RunsLayer
                  runs={plan.runs.filter((r) => r.layerId === l.id)}
                  selectedIds={selectedRunIds}
                  color={l.color}
                  scale={viewport.scale}
                />
              </g>
            ))}
          <SelectionOverlay selectedWalls={selectedWalls} scale={viewport.scale} />
          <SymbolResizeOverlay symbol={singleSelectedSymbol} walls={plan.walls} scale={viewport.scale} />
          <ToolPreviewLayer
            wallDraft={interaction.wallDraft}
            measureDraft={interaction.measureDraft}
            openingGhost={interaction.openingGhost}
            runDraft={interaction.runDraft}
            symbolGhost={interaction.symbolGhost}
            marquee={interaction.marquee}
            walls={plan.walls}
            hoveredEndpoint={interaction.hoveredEndpoint}
            scale={viewport.scale}
            unit={unitSystem}
          />
        </g>
      </svg>
      <LabelEditorOverlay viewport={viewport} />
      <ZoomControls containerWidth={size.width} containerHeight={size.height} />
      <CursorReadout />
    </div>
  );
}
