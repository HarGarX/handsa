# Blueprint — 2D Floor Plan Editor

A browser-based 2D floor plan / blueprint editor. Draw walls, doors, windows,
and rooms with real-world (cm) measurements, then save, undo/redo, and
export/import your plan. Single-page app, no backend — everything lives in
`localStorage` plus JSON/PNG file export.

## Running it

Requires Node (this repo pins `24.18.0` via `.nvmrc`) and npm.

```bash
nvm use
npm install
npm run dev       # start the dev server
npm run build     # type-check (tsc -b) + production build
npm test          # run the Vitest geometry test suite (or: npx vitest run)
```

## Architecture overview

```
src/
  types/plan.ts     Plan data model + JSON shape validation (isValidPlanShape)
  geometry/         Pure, framework-free functions — the only place with math.
                     viewport (world<->screen transforms, zoom/pan/fit),
                     snapping (grid + angle snap), segment (projections,
                     lengths, angles), opening (extents, overlap clamping),
                     area (shoelace formula), rooms (planar face detection),
                     endpoints (coincident-endpoint / magnetism lookups),
                     wallShape (wall-rectangle-with-gaps geometry), hitTest
                     (click/hover hit-testing), grid, format.
                     Unit-tested in geometry/__tests__/.
  store/            One Zustand store (usePlanStore). `plan` is the single
                     serializable object (walls/openings/labels + metadata) —
                     everything else (viewport, selection, active tool,
                     transient drag state) lives alongside it but is not
                     part of what gets saved/exported.
  tools/            One module per tool (select, wall, door/window, label,
                     measure), each a small class implementing the shared
                     `Tool` interface (onPointerDown/Move/Up, onKeyDown).
                     Tools read/write the store directly; no tool-specific
                     state or logic leaks into React components.
  render/            Presentational SVG components per entity type
                     (grid, walls, openings, labels, rooms, selection
                     handles, tool previews). All are `React.memo`'d and
                     receive plain props so unaffected entities skip
                     re-rendering during a drag.
  components/        The app shell: Canvas (owns the <svg>, pointer/keyboard
                     wiring, pan/zoom), Toolbar, TopBar, PropertiesPanel,
                     modals, overlays.
  lib/exportImport.tsx  JSON export/import (with shape validation) and PNG
                     export (renders a dedicated static SVG via
                     `react-dom/server`, rasterizes to canvas at 2x).
```

### Coordinate system

All plan geometry is stored in world **centimeters**. A single
`{ offsetX, offsetY, scale }` viewport (`scale` = screen px per cm) maps
world <-> screen via `worldToScreen`/`screenToWorld`. The canvas renders
world content inside one `<g transform="translate(...) scale(...)">`, so
walls/openings/labels are drawn directly in cm and the browser handles the
screen conversion. Anything that must stay a constant *screen* size while
living inside that scaled group (dimension text, selection handles, stroke
widths) divides its target pixel size by `scale` rather than being placed in
a separate coordinate space.

### Data model

```ts
interface Wall { id; start: Point; end: Point; thickness: number }
interface Opening {
  id; wallId; type: 'door' | 'window';
  t: number;      // 0..1 position of the opening's CENTER along the wall
  width: number;
  hinge?: 'start' | 'end'; swing?: 'left' | 'right'; // doors only
}
interface Label { id; position: Point; text: string; fontSize: number }
interface Plan { id; name; walls; openings; labels; createdAt; updatedAt }
```

Openings are children of walls via `wallId` + parametric `t`, so moving a
wall's endpoints automatically carries its openings along, and deleting a
wall deletes its openings. `clampOpeningT` keeps an opening's t inside the
wall's bounds and away from other openings on the same wall as you drag it;
`isOpeningInvalid` flags (in red) an opening that no longer fits because its
wall was shrunk below the opening's width.

### Room detection

`geometry/rooms.ts` builds a planar graph from wall endpoints (merged within
1cm) **and splits walls at T‑junctions** — i.e. where another wall's endpoint
lands mid‑span rather than at a shared corner, which is how most interior
partition walls meet exterior walls. It then traces faces with the standard
"next edge in rotational order" algorithm: every directed edge belongs to
exactly one face, each connected component has exactly one unbounded outer
face (the largest by area) and zero or more bounded interior faces, which are
reported as rooms with their shoelace area. Dangling wall segments
(degree-1 endpoints) contribute a zero-area "spike" to the outer face instead
of creating a phantom room, so open/unclosed wall chains never render a
bogus area label. Recomputation is debounced 150ms off the walls array so
dragging stays smooth.

### Undo/redo & persistence

The store exposes a small transaction API: `updateLive` mutates `plan`
without touching history (used for continuous drag feedback),
`commitTransaction` finalizes the drag by pushing the *pre-drag* snapshot
onto the undo stack (capped at 100), and `commitImmediate` does both in one
call for one-shot edits (property panel fields, delete, add wall/opening/
label). Plans autosave to `localStorage` 1s after the last change and are
indexed under a single key (`floorplan.plans.index`) for the "My Plans"
switcher; each plan's JSON also lives under its own key.

## Known limitations / simplifications

- **Wall joints are butt joints**, not mitered, so acute-angle corners can
  show a small gap/notch — acceptable per the spec, and `wallShape.ts`
  renders each wall as independent rectangle segments so a join fix can be
  layered on without changing the data model (see Roadmap Phase 1).
- **Dragging a wall body** only translates that one wall; it does not drag
  connected neighbors along (dragging an **endpoint handle** does, via
  coincident-endpoint tracking + optional magnetism to other walls). This
  matches the acceptance criteria, which test endpoint-dragging for joint
  propagation.
- **No rubber-band (marquee) multi-select** — only click / shift-click.
- **Label editing** is inline only at creation time; renaming an existing
  label's text/font-size afterwards is done via the Properties panel.
- **PNG export** re-renders a dedicated static SVG (grid off, all wall
  dimensions on, no selection styling) rather than snapshotting the live
  interactive canvas, so it always produces a clean, fully-annotated image
  regardless of current zoom/selection.
- Room detection assumes a roughly axis/angle-clean drawing; extremely
  degenerate or self-overlapping wall geometry isn't guaranteed to produce
  sensible faces.

## Roadmap

Organized by phase — roughly the order that unlocks the most value per unit
of effort, not a hard commitment. "Effort" is relative to what's already in
the codebase, not absolute.

### Phase 1 — Polish the core drawing experience

Small, high-value fixes to the single-layer (architectural) editor before
layering more disciplines on top of it.

- **Wall joint fill (square or round), so joints stop showing gaps/notches.**
  Two tiers, cheapest first:
  - *v1 — join caps:* at every node where 2+ walls meet, draw a filled cap
    (a square sized to the max connecting thickness, or a circle/rounded-rect
    of the same size) centered on the joint. This is a few dozen lines against
    the existing `rooms.ts` graph-building code (it already merges endpoints
    within tolerance and finds T-junctions) — reuse that graph to find every
    node with degree ≥ 2, and render a cap shape per node. Covers T-junctions
    and 4-way crossings for free, not just simple corners. A "Square" /
    "Round" toggle in the top bar controls the cap shape and (for round) a
    corner-radius setting.
  - *v2 — true mitered/filleted geometry:* extend or trim each wall's offset
    edges to meet exactly at the joint (SVG `stroke-linejoin: miter` or
    `round`, computed manually since we don't use stroke-based rendering).
    Sharper and more "correct" for two-wall bends at odd angles, but doesn't
    generalize as cleanly to T/X junctions, so it's a refinement on top of
    v1's caps rather than a replacement — use mitered edges where exactly 2
    walls meet, fall back to a cap where 3+ meet.
- **Unit system + drawing scale setting.** Two related but distinct controls:
  - A **display unit toggle** (metric cm/m ⟷ imperial in/ft) purely for
    input/display formatting — `Plan` keeps storing centimeters internally
    (no data model change), only `geometry/format.ts` gets a second set of
    formatters and the numeric property fields parse/format in the active
    unit.
  - A **print/drawing scale** (1:50, 1:100, 1:200, custom) that only affects
    PNG/PDF export sizing and the exported title block's scale annotation —
    doesn't touch the live canvas, which always shows a true-to-life scale
    bar.
- **Rubber-band (marquee) multi-select** — drag on empty canvas to
  box-select; extends the existing `SelectionEntry[]` selection model, no
  data model change.
- **Arrow-key nudge** for the current selection (grid increment per press,
  ×10 with Shift) — precision editing without the mouse.
- **Copy / paste / duplicate** for the current selection (walls carry their
  openings along; labels and openings duplicate directly).
- **Mitered wall corners** — folded into the join-fill work above.

### Phase 2 — Multi-discipline layers (electrical, plumbing, lighting/HVAC)

The biggest structural addition: today there's one implicit "architectural"
layer (walls/doors/windows/rooms/labels). The plan is to generalize that into
a small **layer system**, closer to how real MEP (Mechanical / Electrical /
Plumbing) drawing sets work — one base floor plan, several overlays that
each focus on one trade:

- **Architectural** (existing, always present) — walls, doors, windows,
  rooms, labels, dimensions.
- **Electrical** — circuit/conduit runs and a panel symbol.
- **Plumbing** — supply/drain pipe runs and fixtures (sink, toilet, shower,
  water heater).
- **Lighting, sockets & AC** — the point fixtures that sit at the *ends* of
  the electrical/plumbing runs and are what most homeowners actually care
  about placing: ceiling/wall lights, switches, power outlets, AC/HVAC units,
  thermostats.

Sketch of the data model change (additive, doesn't touch `Wall`/`Opening`):

```ts
interface Layer {
  id: string;
  name: string;
  kind: 'architectural' | 'electrical' | 'plumbing' | 'lighting-power-hvac' | 'custom';
  visible: boolean;
  locked: boolean;
  color: string; // accent color used for this layer's symbols/runs
}

interface Symbol {          // a point-placed fixture on a given layer
  id: string;
  layerId: string;
  type: string;             // 'outlet' | 'switch' | 'light-ceiling' | 'sink' | 'ac-unit' | ...
  position: Point;
  rotation: number;          // degrees
  wallId?: string;           // optional: snapped to a wall, like Opening.t
  t?: number;
}

interface Run {              // a line-based item on a given layer
  id: string;
  layerId: string;
  type: string;              // 'circuit' | 'supply-pipe' | 'drain-pipe' | ...
  points: Point[];
}
```

UI concept: a layer switcher (tabs or a dropdown near the tool bar). The
active layer renders in full color and is the only one editable; inactive
layers render as a dimmed/ghosted "underlay" of walls only, for reference —
exactly how a real electrician's drawing shows the walls lightly and the
circuits boldly. Each layer gets its own simple symbol set and, later, an
auto-generated schedule/legend (e.g. a fixture count table) — useful for
quantity take-offs, not just visuals.

This is a genuine v2 of the app, not a small patch — plan for it as its own
milestone once Phase 1 lands.

### Phase 3 — Furniture & symbol library

Same "2D, abstracted, measurement-first" philosophy as the door/window
symbols already in the app — **not** photorealistic or skeuomorphic. A
piece of furniture should read as a simple, standard top-down line-art
shape (a rectangle with a diagonal for a bed, an L for a sectional, a circle
for a round table) with an accurate footprint and a label, so the user can
check clearances and layout at a glance without the platform trying to
"look like" the room. This mirrors how real architectural symbol libraries
work, and keeps the rendering code simple (more SVG shape presets, no image
assets, no asset licensing to worry about).

- A small built-in catalog of common footprints (bed sizes, sofa/sectional,
  dining table + chairs, kitchen counter/island, wardrobe, desk) — each just
  a `{ width, depth, shapeId }`, rendered by the same kind of pure-function
  shape generator used for doors/windows.
  A generic `Furniture` entity (position, rotation, width, depth, shapeId,
  optional label) — same shape as `Symbol` above, so it's likely this and
  the layer-system symbols end up sharing one underlying entity type rather
  than being two parallel concepts.
- Drag-place + rotate (15° snap like walls) + resize via corner handles.
- Optional "snap to wall" for wall-hugging furniture (wardrobes, counters).

### Phase 4 — Professional export & multi-floor/3D

- **PDF export with a title block** (plan name, date, drawing scale, north
  arrow), reusing the existing static-SVG export path.
- **Per-layer schedules** (door/window schedule, fixture counts) as a simple
  table appended to the export.
- **Multi-floor support** — a floor switcher, stacked plans, and an optional
  ghosted "floor below" reference for aligning stairs/plumbing stacks across
  floors.
- **Wall/room height attributes** (`Wall.height`, `Room.ceilingHeight`) —
  needed groundwork for the next item, and useful on their own for area/
  volume stats.
- **3D extrusion preview (Three.js)** — walls extrude to their height,
  openings become real cutouts, driven directly off the existing data model
  plus the new height attributes.

### Further out / stretch ideas

- **Smart alignment guides** (Figma-style: snap to other elements' edges/
  centers, not just the fixed grid) — complements, doesn't replace, grid
  snapping.
- **Grouping** — select multiple entities and save/reuse them as a block
  (e.g. a "bathroom suite" preset combining fixtures + a partition wall).
- **Wall types/materials** (load-bearing vs. partition, exterior vs.
  interior) with distinct hatch/fill styles — mostly a rendering + one new
  `Wall.kind` field.
- **Room metadata** (name/type, flooring material) feeding into schedules
  and future 3D material assignment.
- **Read-only share link** for a plan snapshot — would need *some* backend
  or a static-hosting trick (e.g. a shareable self-contained HTML export),
  since the app is currently 100% local-storage; worth scoping separately
  since it's the one item here that breaks the "no backend" constraint.
- **Broader automated test coverage** — the geometry module is unit-tested;
  the tool interaction layer (drag flows, clamping, undo/redo) is currently
  only verified manually/via ad-hoc Playwright scripts. A small Playwright
  suite covering the acceptance-test script would catch interaction
  regressions that pure unit tests can't.
