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
                     rect (axis-aligned + rotated-rectangle hit testing,
                     world<->local rotation-frame conversion), placedSymbol
                     (resolves a fixture's world position from its wall+t,
                     mirroring how openings work; resize-handle positions),
                     hitTest (click/hover hit-testing), grid, format.
                     Unit-tested in geometry/__tests__/.
  lib/symbolCatalog.ts  Pure data: which fixture types exist per layer kind,
                     their labels, footprints, whether they're wall-mounted,
                     and whether they're resizable (furniture only) — the
                     single source the Toolbar's picker, the Symbol tool,
                     and rendering all read from.
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
                     selection handles, furniture resize handles, tool
                     previews). All are `React.memo`'d and receive plain
                     props so unaffected entities skip re-rendering during
                     a drag.
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

interface Layer { id; name; kind: 'architectural' | 'electrical' | 'plumbing' | 'lighting-power-hvac' | 'furniture'; color; visible }
interface PlacedSymbol {
  id; layerId; type: SymbolType;      // 'outlet' | 'sink' | 'bed' | 'sofa' | ...
  rotation: number;                    // degrees
  position: Point;                     // authoritative for free-placed symbols
  wallId?: string; t?: number;         // set instead, for wall-mounted symbols
  width?: number; depth?: number;      // furniture only: overrides the catalog's default footprint
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

Every plan has five fixed layers, seeded by `createDefaultLayers()`:
Architectural (walls/doors/windows/rooms/labels — unchanged from before,
and the only layer that predates this system, so it has no `layerId` of
its own on its entities), Electrical, Plumbing, Lighting/Sockets/AC, and
Furniture. The `LayerBar` (a tab strip under the top bar) switches which layer is
"active" — only the active layer is editable; every other *visible* layer
renders as a dimmed (30% opacity) reference underlay, and the active layer
always renders at full opacity regardless of its own visibility flag (you
need to see what you're editing, even if you'd hidden it while working on
something else).

Switching the active layer contextually swaps the left tool bar
(`Toolbar.tsx`): the Architectural layer shows the original Wall/Door/
Window/Label/Measure tools; the other four each show Select + a **Symbol**
tool (click opens a small flyout picker listing that layer's fixture types
from `symbolCatalogFor()`, e.g. Outlet/Switch/Panel for Electrical). The
three utility layers (Electrical, Plumbing, Lighting/Sockets/AC) additionally
show a **Run** tool (chains points like the wall tool, but — unlike walls,
which materialize a `Wall` per click — accumulates the whole polyline in a
draft and only commits one `Run` entity when you finish with Enter,
double-click, or Escape-to-cancel); Furniture has no Run tool since
furniture doesn't have wiring/piping to trace — `RUN_TYPE_BY_LAYER_KIND` is
a `Partial` map and the Toolbar simply omits the button for any layer kind
missing from it.

Symbols and runs are intentionally generic across every fixture layer rather
than one bespoke type per discipline: a `PlacedSymbol` is just
`{ type, position/rotation, optional wallId+t, optional width/depth }` and a
`Run` is just `{ type, points }`, with `layerId` distinguishing which
discipline (and therefore which color/catalog) they belong to. Wall-mounted
symbol types (outlets, switches, thermostats, wall lights, AC units, counters,
wardrobes) snap to and slide along the nearest wall exactly like doors/
windows do; free-placed types (sinks, toilets, beds, sofas, tables) just
place at the clicked point. Deleting a wall cascades to any symbols mounted
on it, same as it does for openings.

### Furniture (resizable symbols)

Furniture reuses the exact same `PlacedSymbol`/`SymbolsLayer`/Select-tool
machinery built for Phase 2's fixture layers — a bed, a sofa, and an outlet
are all "a rotated footprint, maybe wall-snapped" as far as the data model is
concerned. The one real addition is **per-instance resizing**, since a queen
bed and a king bed shouldn't need separate catalog entries:

- `SymbolCatalogEntry` now carries `width`/`depth` (not a single `size`) plus
  a `resizable` flag, true only for the ten furniture types. `symbolFootprint()`
  resolves a symbol's *actual* footprint — its own `width`/`depth` override if
  set, falling back to the catalog default otherwise.
- Because furniture footprints are often large rectangles (not small
  roughly-square fixtures), `hitTestSymbol` tests the true rotated rectangle
  (`geometry/rect.ts#pointInRotatedRect`) rather than a circular radius —
  otherwise a large bed's generous circular hit-area would swallow clicks
  well outside its actual footprint.
- Selecting a single resizable symbol shows two square handles (right-edge
  and bottom-edge midpoints, at `symbolResizeHandles()`) rendered by
  `SymbolResizeOverlay`. Dragging one projects the cursor into the symbol's
  local (unrotated) frame via `worldToLocal` — the same inverse-rotation math
  `pointInRotatedRect` uses internally — and sets `width` or `depth` to twice
  the local-axis distance from center, snapped to the grid increment like
  other drags. This is a **center-anchored** resize (both edges move
  together; the center stays put), not an anchored-opposite-edge resize —
  simpler to implement correctly, at the cost of not matching the more
  familiar "drag a corner, the opposite corner stays fixed" feel.
- The Properties panel shows editable Width/Depth fields for resizable
  symbols alongside the canvas handles. Getting this right surfaced a small
  pre-existing gap: `NumberField`'s displayed text was seeded once from
  `useState` and never resynced when the same field's underlying value
  changed via a canvas drag (it would show a stale number until the field
  was blurred or the entity was reselected) — fixed with a `useEffect` that
  re-syncs the text from the live value whenever the input isn't currently
  focused, which benefits every numeric field in the panel (wall length
  during an endpoint drag, not just furniture resize).

### Placement Assistant

A deterministic rules/scoring engine, not an AI call — while the Furniture
layer and Select tool are both active, hovering a detected room surfaces a
handful of suggested placements (sofa, TV stand, bed, wardrobe, desk, wall
art, floor lamp), each a dashed ghost with a small "+" badge; hover the badge
for a one-line rationale (a native `<title>` tooltip, same pattern as every
other control), click it to commit as a real `PlacedSymbol` via the existing
`addSymbol` — fully undoable, exactly like a manual placement.

- **`geometry/placementSuggestions.ts`** (pure, unit-tested like the rest of
  `geometry/`) is the whole engine. `roomBoundingWalls()` matches each edge of
  a `detectRooms()` polygon back to the original wall it traces (a room edge
  is always a sub-span of exactly one wall's `[0,1]` range, split at
  T-junctions/crossings same as the wall graph), giving each bounding wall
  segment an inward-pointing normal. From there:
  - **Clearance & traffic flow**: every door gets a conservative rectangular
    exclusion zone (a walkway lane, widened to the door's own width if it
    swings into this room) that candidates are checked against.
  - **Long-wall preference**: sofa/sectional/bed/desk (free-placed, offset
    inward from the wall by half their depth) and TV stand/wardrobe/wall art
    (wall-mounted, sitting flush on the wall line like an outlet) all score
    candidate wall segments by their longest *uninterrupted* clear run — free
    of doors, windows, and anything already placed on that wall.
  - **Focal-point orientation**: `findFocalSegment()` picks the room's main
    window wall (most total window width) or, absent windows, the wall
    opposite the main entry door; sofa/sectional are scored higher for facing
    it, and the TV stand is preferentially placed *on* it.
  - **Lighting-gap awareness**: the floor lamp suggestion checks the
    Lighting layer's already-placed ceiling/wall lights (cross-layer, made
    possible by every layer sharing the same `Plan.symbols`) and favors
    whichever room corner sits farthest from existing light.
  - **Open-wall preference**: wall art scores a segment's longest clear run
    the same way long-wall furniture does, but keyed to a much thinner
    footprint so it doesn't compete for the same real estate.
- Rotation math for a free-placed, wall-hugging item is derived directly from
  its wall segment's inward normal `n`: `rotationDeg = atan2(-n.x, n.y) *
  180/π` places the item's local **-y edge** ("back") against the wall and
  local **+y edge** ("front") facing the room — consistent with how the
  existing furniture icons are drawn (e.g. the sofa's back cushions sit at
  local `-y`).
- Obstacle/clearance checks are deliberately conservative approximations, not
  exact geometry (a candidate's half-diagonal inflates the exclusion zone; a
  circle-circle test approximates furniture-vs-furniture overlap) — the right
  tradeoff for suggestions the user reviews and can decline, not a hard
  constraint a wrong answer could get stuck behind.
- **`render/SuggestionOverlay.tsx`** hosts a *sticky* hover state: a
  suggestion's own ghost/badge sits outside the room's strict polygon just
  often enough (offset out from the wall) that a naive "cursor inside the
  polygon" test would hide the whole overlay the instant the user moved
  toward a badge to click it — the classic hover-menu-closes-before-you-can-
  click-it problem. Fixed by keeping the previously-hovered room "stuck" as
  long as the cursor stays within its bounding box padded by a generous
  150cm, only actually clearing once the cursor leaves that padded zone or a
  *different* room is entered directly.
- Two decor `SymbolType`s that didn't exist before this feature — `tv-stand`
  and `wall-art` (plus `floor-lamp`, free-placed) — were added to the
  Furniture catalog specifically so the assistant would have something to
  suggest beyond the Phase 3 furniture set; they're placeable manually via
  the Symbol tool too, like any other furniture type.

### Editing conveniences (units, scale, marquee, nudge, copy/paste)

- **Display units** (`unitSystem`, a store-level view preference like snap
  settings, not part of `Plan`): metric shows meters/m² as before; imperial
  shows feet-inches (`formatLengthFtIn`) for canvas dimension text and
  square feet for room areas. Editable length fields (wall length, opening
  width) convert through `cmToFieldValue`/`fieldValueToCm` to a single
  decimal-feet number for imperial — simpler than a compound feet+inches
  input widget, at the cost of not matching the feet-inches *display* format
  exactly. Wall thickness and label font size stay in cm regardless of the
  toggle: they're small building-material/text-size values that don't map
  to "nice" feet numbers the way a wall length does.
- **PNG export drawing scale** (`exportScaleDenominator`, 1:50/1:100/1:200/
  custom): unlike the live canvas (always true-to-life), the exported image's
  pixel dimensions are derived from the plan's real-world extent times a
  px-per-cm ratio calibrated to the chosen scale — smaller ratio (1:50) =
  bigger, more detailed image; larger ratio (1:200) = smaller image, same as
  real architectural scale conventions. This is deliberately *not* a
  physical-print-DPI calculation (see the comment on `BASE_PX_PER_CM_AT_1_100`
  in `exportImport.tsx`) since the output is a PNG for on-screen viewing, not
  a calibrated paper size; Phase 5's PDF export is where that distinction
  will actually matter. Output is clamped to 4000px on a side so a huge plan
  at a fine scale can't hang the browser.
- **Rubber-band (marquee) multi-select**: dragging on empty canvas with the
  Select tool starts a marquee (`geometry/rect.ts#pointInRect`, "any point
  inside" rather than "fully enclosed," so a wall just needs one endpoint in
  the box). Scoped to whichever layer is active, same as click-select: walls/
  openings/labels on the Architectural tab, symbols/runs on the others.
  Shift+drag reuses the existing shift-click *toggle* semantics rather than
  a separate "always add" mode, for consistency with the rest of the tool.
- **Arrow-key nudge**: moves the current selection by one snap increment
  (×10 with Shift). Only applies to entities with a free-standing position —
  walls, labels, runs, and free-placed symbols — not openings or wall-mounted
  symbols, which are parametric (a `t` along their wall) and have no
  independent position to nudge.
- **Copy / paste / duplicate** (Ctrl/Cmd+C/V/D): an in-memory clipboard, not
  the OS clipboard (no permissions prompt, and it round-trips the exact
  entity shapes rather than serializing through a text format). Copying a
  wall brings its openings and any wall-mounted symbols along, remapped to
  the new wall's id on paste; paste/duplicate offsets everything by 20cm so
  it never lands exactly on top of the original.

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

### Run drafts never get silently discarded

Walls commit a real `Wall` to the plan on every click of the chain, so
there's nothing to lose if you switch tools mid-wall. Runs (circuit/pipe
polylines) don't work that way — a `Run` used to only get created when the
chain was *explicitly* finished (Enter, double-click, or clicking the last
point again), which meant the in-progress polyline you saw on screen was
purely a transient preview. If you switched tools or layers instead of
finishing the chain — the natural thing to do once you're done routing a
pipe — that preview, and every point you'd placed, was thrown away with no
warning. From the outside this looked like "drawing a plumbing/electrical
run does nothing."

The fix is `finalizePendingRunDraft` in `usePlanStore.ts`: any store action
that resets `interaction` (`setActiveTool`, `setActiveLayer`, `newPlan`,
`duplicatePlan`, `switchPlan`, `deletePlan`, `importPlan`) now first checks
for a live `runDraft` with at least two points and, if found, commits it as
a real `Run` before doing anything else. A single click (one point, no
real path yet) is still discarded, since there's nothing meaningful to
save. This makes "switch tools once you're done" and "press Enter to
finish" equally safe ways to end a run.

As a second, purely visual layer of defense, `DraftHint.tsx` shows a small
floating reminder above the canvas any time a Wall or Run chain is
in-progress (e.g. *"Click to add a point · Enter or double-click to finish
· Esc to cancel (finished points are saved automatically even if you
switch tools)"*), so the behavior is discoverable instead of being an
invisible safety net.

While auditing this, the Furniture layer's toolbar turned out to be
showing a Run tool button it should never have had — `RUN_TYPE_BY_LAYER_KIND`
has no entry for `furniture` (there's no such thing as a "furniture run"),
but `Toolbar.tsx` rendered the button unconditionally for every
non-architectural layer instead of gating on that lookup. Fixed by only
rendering the button when `RUN_TYPE_BY_LAYER_KIND[activeLayer.kind]`
resolves to something.

### Tooltips

Every interactive control — toolbar tools, layer tabs, snap/units/scale
settings, properties panel fields, the plans modal — now has a `title`
attribute explaining what it does and, where the behavior isn't obvious
from the label alone, how to use it (e.g. the Symbol tool's tooltip
explains you click it once to open the fixture picker and again on the
canvas to place one; the wall-mounted vs. free-placed distinction is
called out per fixture type). These surface as native browser tooltips on
hover.

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
- **Label editing** is inline only at creation time; renaming an existing
  label's text/font-size afterwards is done via the Properties panel.
- **PNG export** re-renders a dedicated static SVG (grid off, all wall
  dimensions on, no selection styling) rather than snapshotting the live
  interactive canvas, so it always produces a clean, fully-annotated image
  regardless of current zoom/selection.
- Room detection assumes a roughly axis/angle-clean drawing; extremely
  degenerate or self-overlapping wall geometry isn't guaranteed to produce
  sensible faces.
- **The five layers are fixed** — Architectural, Electrical, Plumbing,
  Lighting/Sockets/AC, and Furniture always exist and can't be renamed,
  reordered, deleted, or added to. Good enough for a single-family home;
  there's no "Add layer" flow yet.
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
- **Imperial editable fields use decimal feet, not feet+inches** — e.g. a
  wall length shows as "23.62" (ft) to edit, even though the same length
  displays as `23' 7"` on the canvas. A compound feet+inches input widget
  would match the display format exactly; decimal feet was the pragmatic
  choice to keep it a single numeric `<input>`.
- **Marquee-select uses "any point inside," not "fully enclosed"** — a wall
  is selected if either endpoint is in the drag box, even if the rest of the
  wall extends outside it. More forgiving for a rough drag; CAD tools that
  distinguish left-to-right ("fully enclosed") vs. right-to-left ("crossing")
  drags offer more precision, but add a mode most users don't reach for.
- **Copy/paste is in-memory only**, not the OS clipboard — paste only works
  within the same browser tab/session, not across tabs or after a reload.
  Trades that off for a simpler, permission-free implementation and copying
  the exact entity shapes instead of round-tripping through a text format.
- **Furniture resize is center-anchored**, not opposite-edge-anchored —
  dragging the width handle grows/shrinks both left and right edges evenly
  around the center, rather than keeping one edge fixed like most design
  tools. Simpler math, different feel; see "Furniture" above.
- **No compound furniture pieces** — a dining table and its chairs are
  placed as separate symbols the user arranges themselves, not a single
  "table + 4 chairs" preset. Keeps the data model simple at the cost of a
  few extra clicks for a common arrangement.
- **Placement Assistant suggestions use approximate, conservative collision
  checks** — clearance zones and furniture-overlap tests use inflated
  bounding circles/rectangles rather than exact polygon intersection, so an
  occasional technically-fine spot near a zone's edge gets ruled out. The
  right tradeoff for suggestions the user reviews and can decline, not a hard
  constraint a wrong answer could get permanently stuck behind.
- **The assistant suggests at most one placement per furniture type per
  room** — accepting a suggested sofa won't offer a second sofa spot on
  re-hover; placing further sofas (or anything else) manually via the Symbol
  tool is unaffected.
- **Dining tables, chairs, and kitchen islands aren't suggested** — every v1
  suggestion type is wall-hugging, and these are usually centered in a room
  instead, which needs a different placement rule (see Roadmap Phase 4).

## Roadmap

Organized by phase — roughly the order that unlocks the most value per unit
of effort, not a hard commitment. "Effort" is relative to what's already in
the codebase, not absolute.

### Phase 1 — Polish the core drawing experience

✅ **Shipped**, except the one deliberately-deferred sub-item noted below. See
"Wall joints" and "Editing conveniences" above for how each piece works.

- **Wall joint fill (square or round)**, so joints stop showing gaps/notches.
  - ✅ Join caps: `geometry/joints.ts` finds every wall-graph node where 2+
    walls converge and draws a filled cap sized to `maxConnectingThickness /
    2`, always enough to cover the gap at any angle. Covers simple corners,
    T-junctions, and 4-way crossings uniformly.
  - *Still open — true mitered/filleted geometry:* extend or trim each
    wall's offset edges to meet exactly at the joint, rather than filling
    with a cap. Sharper for two-wall bends at odd angles, but doesn't
    generalize as cleanly to T/X junctions, so it'd be a refinement layered
    on top of the caps rather than a replacement. Purely a rendering
    upgrade — the caps already ship correct, gap-free joints — so this is
    the one remaining "nice to have," not a blocker for anything else.
- ✅ **Unit system + drawing scale setting** — a display unit toggle
  (metric ⟷ imperial) purely for input/display formatting, and a separate
  PNG export drawing scale (1:50/1:100/1:200/custom) that only affects
  export sizing, not the live canvas.
- ✅ **Rubber-band (marquee) multi-select** — drag on empty canvas to
  box-select, scoped to the active layer.
- ✅ **Arrow-key nudge** for the current selection (snap increment per
  press, ×10 with Shift).
- ✅ **Copy / paste / duplicate** for the current selection (walls carry
  their openings and wall-mounted symbols along).

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

✅ **Shipped.** See "Furniture (resizable symbols)" above for how it works.
Recap:

- Same "2D, abstracted, measurement-first" philosophy as the door/window
  symbols — simple top-down line-art (a bed with pillows, an L-notch for a
  sectional, a circle for a round table), not photorealistic, so clearances
  and layout are easy to read without the platform pretending to show what
  the room actually looks like.
- A `'furniture'` `LayerKind` + fifth default layer, with a ten-type catalog
  (bed, sofa, sectional, dining table, round table, chair, counter, island,
  wardrobe, desk) reusing the exact same `PlacedSymbol`/`SymbolsLayer`/
  Select-tool/Properties-panel machinery built for Phase 2 — confirming that
  design bet paid off, since furniture needed zero new entity types.
- **Resize via edge handles** — the one genuine addition: optional
  `width`/`depth` overrides on `PlacedSymbol`, a true rotated-rectangle hit
  test (large furniture footprints made the old circular hit-radius a poor
  approximation), and two drag handles for center-anchored resizing.
- Everything else — drag-place, 15° rotation snap (via wall-mounted
  auto-alignment), wall-snap for wall-hugging pieces (wardrobes, counters),
  copy/paste, undo/redo, JSON/PNG export — fell out of the existing Symbol
  infrastructure for free, as designed.

Deliberately deferred (see "Known limitations" above): opposite-edge-anchored
resize (shipped center-anchored instead) and compound furniture presets
(a table+chairs group placed as one item).

### Phase 4 — Placement Assistant (furniture & decor suggestions)

✅ **Shipped (v1 rule set).** See "Placement Assistant" above for how it
works. Deliberately a **deterministic rules/scoring engine over the existing
geometry**, not an AI call: it fits the "no backend, everything local and
instant" shape of the rest of the app, gives explainable rationale for free
(a rule fired, not a model's guess), and needed no new infrastructure beyond
two small additions — every other input (room polygon, bounding walls,
door/window positions *and swing arcs*, already-placed symbols on any layer)
already existed on `Plan`. An LLM-backed "describe the vibe you want" mode
could layer on top of this *later* as an optional enhancement once there's an
appetite for a backend — see the share-link stretch idea below for the same
tradeoff — but the rule engine had to exist first regardless, since it's what
an AI mode would ultimately be steering.

What shipped, mapped to the original v1 rule set:

- ✅ *Clearance & traffic flow* — every door in a room gets a conservative
  rectangular exclusion zone (walkway lane, widened to the door's own width
  when it swings inward) that every candidate is checked against.
- ✅ *Long-wall preference* — sofa/sectional/bed/desk (free-placed) and TV
  stand/wardrobe/wall art (wall-mounted) all score candidate walls by their
  longest uninterrupted clear run.
- ✅ *Focal-point orientation* — seating faces the room's main window wall,
  or the wall opposite the main entry if there are no windows; the TV stand
  is preferentially placed on that same focal wall.
- ✅ *Lighting-gap awareness* — the floor lamp suggestion checks the
  Lighting layer's already-placed ceiling/wall lights and favors whichever
  room corner sits farthest from existing light.
- ✅ *Open-wall preference for wall art* — scores a wall segment's longest
  clear run the same way, keyed to a much thinner footprint.
- Two new decor `SymbolType`s — `tv-stand` and `wall-art` (wall-mounted) plus
  `floor-lamp` (free-placed) — were added to the Furniture catalog so the
  assistant would have something to suggest beyond the Phase 3 furniture set;
  all three are placeable manually via the Symbol tool too.
- A real UX bug surfaced and got fixed during this phase, not deferred: a
  suggestion's ghost/badge sits just outside the room's strict polygon often
  enough (offset out from the wall) that hovering toward it to click would
  cross back out of the polygon and hide the whole overlay a moment before
  the click landed — classic hover-menu-closes-before-you-can-click-it. Fixed
  with a sticky hover zone (see "Placement Assistant" above).

Deliberately deferred, matching the original scope call:

- **Room-type awareness** — without knowing a room is "a bedroom" vs. "a
  living room," suggestions stay generic (the same rules apply everywhere)
  rather than being tailored per room type. Explicit room-type tagging — the
  "Room metadata" stretch idea below — would sharpen this once it exists.
- **Dining table / chair / island suggestions** — these are usually centered
  in a room rather than wall-hugging, which is a different placement rule
  than the long-wall one every v1 type uses; left for a follow-up rule rather
  than bolted onto the existing engine as a mismatched special case.
- Symmetric/paired composition rules (e.g. matching nightstands), an
  AI-backed natural-language mode, and anything needing a room-type field
  that doesn't exist yet.

### Phase 5 — Professional export & multi-floor/3D

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
- **Room metadata** (name/type, flooring material) feeding into schedules,
  future 3D material assignment, and sharper Placement Assistant rules
  (Phase 4) once a room's declared type can steer which furniture it
  suggests.
- **Read-only share link** for a plan snapshot — would need *some* backend
  or a static-hosting trick (e.g. a shareable self-contained HTML export),
  since the app is currently 100% local-storage; worth scoping separately
  since it's the one item here that breaks the "no backend" constraint.
- **Broader automated test coverage** — the geometry module is unit-tested;
  the tool interaction layer (drag flows, clamping, undo/redo) is currently
  only verified manually/via ad-hoc Playwright scripts. A small Playwright
  suite covering the acceptance-test script would catch interaction
  regressions that pure unit tests can't.
