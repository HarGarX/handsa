# Blueprint — 2D Floor Plan Editor

A browser-based 2D floor plan / blueprint editor. Draw walls, doors, windows,
and rooms with real-world (cm) measurements on an Architectural layer, then
switch to Electrical, Plumbing, or Lighting/Sockets/AC layers to place
fixtures and circuit/pipe runs against a dimmed reference of the floor plan.
Save, undo/redo, and export/import your plan. Single-page app, no backend —
everything lives in `localStorage` plus JSON/PNG file export.

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
                     lengths, angles, segment-segment intersection), opening
                     (extents, overlap clamping), area (shoelace formula),
                     wallGraph (shared endpoint/T-junction/crossing graph
                     builder), rooms (planar face detection, built on
                     wallGraph), joints (wall-joint fill caps, also built on
                     wallGraph), endpoints (coincident-endpoint / magnetism
                     lookups), wallShape (wall-rectangle-with-gaps geometry),
                     placedSymbol (resolves a fixture's world position from
                     its wall+t, mirroring how openings work), hitTest
                     (click/hover hit-testing), grid, format.
                     Unit-tested in geometry/__tests__/.
  lib/symbolCatalog.ts  Pure data: which fixture types exist per layer kind,
                     their labels, footprints, and whether they're
                     wall-mounted — the single source the Toolbar's picker,
                     the Symbol tool, and rendering all read from.
  store/            One Zustand store (usePlanStore). `plan` is the single
                     serializable object (walls/openings/labels/layers/
                     symbols/runs + metadata) — everything else (viewport,
                     selection, active tool, active layer, transient drag
                     state) lives alongside it but is not part of what gets
                     saved/exported.
  tools/            One module per tool (select, wall, door/window, label,
                     measure, symbol, run), each a small class implementing
                     the shared `Tool` interface (onPointerDown/Move/Up,
                     onKeyDown). Tools read/write the store directly; no
                     tool-specific state or logic leaks into React
                     components.
  render/            Presentational SVG components per entity type
                     (grid, walls, openings, labels, rooms, symbols, runs,
                     selection handles, tool previews). All are
                     `React.memo`'d and receive plain props so unaffected
                     entities skip re-rendering during a drag.
  components/        The app shell: Canvas (owns the <svg>, pointer/keyboard
                     wiring, pan/zoom), LayerBar (switch active layer, toggle
                     visibility), Toolbar (contextual: architectural tools vs.
                     Symbol/Run per non-architectural layer), TopBar,
                     PropertiesPanel, modals, overlays.
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

interface Layer { id; name; kind: 'architectural' | 'electrical' | 'plumbing' | 'lighting-power-hvac'; color; visible }
interface PlacedSymbol {
  id; layerId; type: SymbolType;      // 'outlet' | 'sink' | 'light-ceiling' | ...
  rotation: number;                    // degrees
  position: Point;                     // authoritative for free-placed symbols
  wallId?: string; t?: number;         // set instead, for wall-mounted symbols
}
interface Run { id; layerId; type: 'circuit' | 'supply-pipe' | 'drain-pipe'; points: Point[] }

interface Plan { id; name; walls; openings; labels; layers; symbols; runs; createdAt; updatedAt }
```

Openings are children of walls via `wallId` + parametric `t`, so moving a
wall's endpoints automatically carries its openings along, and deleting a
wall deletes its openings. `clampOpeningT` keeps an opening's t inside the
wall's bounds and away from other openings on the same wall as you drag it;
`isOpeningInvalid` flags (in red) an opening that no longer fits because its
wall was shrunk below the opening's width.

Wall-mounted symbols (outlets, switches, thermostats, wall lights, AC units)
follow the same "position derived from wall + t" pattern as openings —
`geometry/placedSymbol.ts#resolveSymbolPosition` re-derives their point from
the host wall on every read, so they automatically track wall edits. Their
`position` field is only a last-known snapshot, kept for JSON readability and
as a fallback if the host wall is ever missing; it's never treated as
authoritative when `wallId` resolves. Free-placed symbols (sinks, toilets,
ceiling lights, showers) just use `position` directly.

### The wall graph (shared by rooms and joints)

`geometry/wallGraph.ts` builds one planar graph from the wall list and is
reused by both room detection and wall-joint fill. It merges endpoints within
1cm into shared nodes, then splits walls at two kinds of junctions:

- **T-junctions** — another wall's *endpoint* lands in the interior of this
  wall's span (how a partition wall usually meets an exterior wall).
- **Mid-span crossings** — two walls cross where *neither* endpoint sits at
  the crossing point (e.g. two full walls forming a four-way intersection),
  found via bounded segment-segment intersection (`segment.ts`).

### Room detection

`geometry/rooms.ts` traces faces over the wall graph with the standard "next
edge in rotational order" algorithm: every directed edge belongs to exactly
one face, each connected component has exactly one unbounded outer face (the
largest by area) and zero or more bounded interior faces, which are reported
as rooms with their shoelace area. Dangling wall segments (degree-1
endpoints) contribute a zero-area "spike" to the outer face instead of
creating a phantom room, so open/unclosed wall chains never render a bogus
area label. Recomputation is debounced 150ms off the walls array so dragging
stays smooth.

### Wall joints

`geometry/joints.ts` finds every wall-graph node where 2+ walls converge and
emits a fill "cap" (a square or a circle, per the top-bar toggle) centered on
that point, sized to `maxConnectingThickness / 2`. That radius is always
enough to fully cover the joint regardless of the walls' angle: each
connecting wall's rendered rectangle has its end-corners offset purely
perpendicular to that wall at exactly `thickness / 2` from the joint point
(zero longitudinal offset, since it's right at the wall's endpoint), so every
corner is within `radius` of the center — a circle of that radius covers all
of them, and so does an axis-aligned square (each corner's individual x/y
offset is bounded by its straight-line distance from the center). This
covers simple corners, T-junctions, and 4-way crossings uniformly, without
needing per-angle mitering math. Unlike room detection this isn't
debounced — the whole point is to look seamless *while* dragging, and the
O(n²) crossing check is cheap enough (well under a millisecond for a few
hundred walls) to run every frame.

### Layers (multi-discipline overlays)

Every plan has four fixed layers, seeded by `createDefaultLayers()`:
Architectural (walls/doors/windows/rooms/labels — unchanged from before,
and the only layer that predates this system, so it has no `layerId` of
its own on its entities), Electrical, Plumbing, and Lighting/Sockets/AC.
The `LayerBar` (a tab strip under the top bar) switches which layer is
"active" — only the active layer is editable; every other *visible* layer
renders as a dimmed (30% opacity) reference underlay, and the active layer
always renders at full opacity regardless of its own visibility flag (you
need to see what you're editing, even if you'd hidden it while working on
something else).

Switching the active layer contextually swaps the left tool bar
(`Toolbar.tsx`): the Architectural layer shows the original Wall/Door/
Window/Label/Measure tools; the other three each show Select + a **Symbol**
tool (click opens a small flyout picker listing that layer's fixture types
from `symbolCatalogFor()`, e.g. Outlet/Switch/Panel for Electrical) + a
**Run** tool (chains points like the wall tool, but — unlike walls, which
materialize a `Wall` per click — accumulates the whole polyline in a draft
and only commits one `Run` entity when you finish with Enter, double-click,
or Escape-to-cancel).

Symbols and runs are intentionally generic across all three fixture layers
rather than one bespoke type per discipline: a `PlacedSymbol` is just
`{ type, position/rotation, optional wallId+t }` and a `Run` is just
`{ type, points }`, with `layerId` distinguishing which discipline (and
therefore which color/catalog) they belong to. Wall-mounted symbol types
(outlets, switches, thermostats, wall lights, AC units) snap to and slide
along the nearest wall exactly like doors/windows do; free-placed types
(sinks, toilets, showers, ceiling lights) just place at the clicked point.
Deleting a wall cascades to any symbols mounted on it, same as it does for
openings.

### Undo/redo & persistence

The store exposes a small transaction API: `updateLive` mutates `plan`
without touching history (used for continuous drag feedback),
`commitTransaction` finalizes the drag by pushing the *pre-drag* snapshot
onto the undo stack (capped at 100), and `commitImmediate` does both in one
call for one-shot edits (property panel fields, delete, add wall/opening/
label/symbol/run). Plans autosave to `localStorage` 1s after the last
change and are indexed under a single key (`floorplan.plans.index`) for the
"My Plans" switcher; each plan's JSON also lives under its own key.
Toggling a layer's visibility (`setLayerVisibility`) is the one plan-content
mutation that deliberately bypasses undo history — it's a view preference
you're persisting, not a content edit, and it shouldn't cost you a redo step
you actually cared about.

## Known limitations / simplifications

- **Wall joints are filled with a square/round cap** (see "Wall joints"
  above), not a true mitered/filleted edge — visually gap-free at any angle,
  but the two connecting walls' edges aren't actually trimmed to meet at a
  point. `wallShape.ts` still renders each wall as independent rectangle
  segments, so true mitered edges can be layered on later without changing
  the data model (see Roadmap Phase 1).
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
- **The four layers are fixed** — Architectural, Electrical, Plumbing, and
  Lighting/Sockets/AC always exist and can't be renamed, reordered, deleted,
  or added to. Good enough for a single-family home; there's no "Add layer"
  flow yet.
- **The Run tool's type is fixed per layer** (Electrical/Lighting draw
  `circuit`, Plumbing draws `supply-pipe`) — there's no in-tool way to draw
  a `drain-pipe` directly; change a run's type afterwards via the Properties
  panel dropdown instead.
- **No overlap avoidance between symbols** — unlike door/window openings on
  the same wall (which are actively clamped apart), multiple symbols can be
  placed on top of each other. Real electrical/plumbing fixtures usually
  aren't crammed together, so this hasn't mattered in practice yet.
- **No point-level editing of a run's polyline** after it's drawn — Select
  lets you translate or delete the whole run, but not drag an individual
  vertex.

## Roadmap

Organized by phase — roughly the order that unlocks the most value per unit
of effort, not a hard commitment. "Effort" is relative to what's already in
the codebase, not absolute.

### Phase 1 — Polish the core drawing experience

Small, high-value fixes to the single-layer (architectural) editor before
layering more disciplines on top of it.

- **Wall joint fill (square or round), so joints stop showing gaps/notches.**
  Two tiers:
  - ✅ *v1 — join caps (shipped):* `geometry/joints.ts` finds every wall-graph
    node where 2+ walls converge and draws a filled cap (square or circle,
    toggled in the top bar) sized to `maxConnectingThickness / 2`, which is
    always enough to cover the gap at any angle (see "Wall joints" above).
    Covers simple corners, T-junctions, and 4-way crossings uniformly.
  - *v2 — true mitered/filleted geometry (not yet built):* extend or trim
    each wall's offset edges to meet exactly at the joint (SVG
    `stroke-linejoin: miter` or `round`, computed manually since we don't use
    stroke-based rendering). Sharper and more "correct" for two-wall bends at
    odd angles, but doesn't generalize as cleanly to T/X junctions, so it'd
    be a refinement layered on top of v1's caps rather than a replacement —
    mitered edges where exactly 2 walls meet, fall back to a cap where 3+
    meet. Purely a rendering upgrade; v1 already ships correct, gap-free
    joints, so this is a "nice to have," not a blocker for anything else.
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

✅ **Shipped.** See the "Layers" section above for how it works and the data
model section for the `Layer`/`PlacedSymbol`/`Run` shapes. Recap of what
landed:

- Four fixed layers (Architectural, Electrical, Plumbing, Lighting/Sockets/
  AC), switchable via the `LayerBar` tab strip, each with a per-layer
  visibility toggle and accent color.
- A contextual left tool bar: Architectural keeps the original Wall/Door/
  Window/Label/Measure tools; the other three swap in a **Symbol** tool
  (flyout picker of that layer's fixture catalog) and a **Run** tool
  (chain-drawn circuit/pipe polylines).
- Generic `PlacedSymbol` (wall-mounted or free-placed, per fixture type) and
  `Run` entities shared across all three fixture layers rather than one
  bespoke type per discipline.
- Inactive-but-visible layers render dimmed (30% opacity) underneath the
  active layer, which always renders at full opacity — matching how a real
  MEP drawing set shows the walls lightly and the active trade boldly.
- Full Select-tool support (hit-test, drag/slide, delete, Properties panel
  editing) and PNG/JSON export/import for the new entities.

Deliberately deferred (see "Known limitations" above for the specifics):
custom/renamable/addable layers (the four are fixed for now), per-layer
fixture schedules/legends (e.g. an auto-generated outlet count table — real
value for quantity take-offs, but a distinct feature from placing the
fixtures), and drain-pipe as a first-class Run-tool option rather than a
post-hoc Properties panel edit.

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

Phase 2 already resolved the "is this a separate entity type?" question
that used to sit here: `PlacedSymbol` (`type` + `rotation` + `position` or
`wallId`/`t`) is generic enough that furniture is just more entries in
`lib/symbolCatalog.ts` under a new `'furniture'` layer kind — a bed, a sofa,
and an outlet are all "a rotated footprint, maybe wall-snapped" as far as
the data model and `SymbolsLayer`/`resolveSymbolPosition` are concerned.
Concretely, what Phase 3 actually adds on top of the existing machinery:

- A `'furniture'` `LayerKind` + a fifth default layer, and a furniture
  catalog entry per common footprint (bed sizes, sofa/sectional, dining
  table + chairs, kitchen counter/island, wardrobe, desk) — each a
  `{ type, label, wallMounted, size }` like today's electrical/plumbing
  entries, plus a new `SymbolIcon` case per shape.
- **Resize via corner handles** — today's symbols have a fixed footprint
  per type; furniture is the first case that needs per-instance width/depth
  (a "queen bed" and a "king bed" shouldn't need separate catalog entries).
  This is the one real data model addition: an optional `width`/`depth`
  override on `PlacedSymbol` alongside its catalog default.
- Everything else — drag-place, 15° rotation snap, wall-snap for
  wall-hugging pieces (wardrobes, counters), Select-tool integration,
  Properties panel editing — falls out of the existing Symbol
  infrastructure for free.

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
