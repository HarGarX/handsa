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

- **Wall joints are butt joints**, not mitered — acceptable per the spec,
  and `wallShape.ts` renders each wall as independent rectangle segments so
  mitering could be added later without changing the data model.
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

- Furniture / fixture library (draggable symbols with their own footprints).
- Multi-floor support (floor switcher, stacked plans, cross-floor alignment).
- 3D extrusion preview (Three.js) driven directly by the existing wall/
  opening data model.
- PDF export with a title block (scale, north arrow, plan name/date).
- Mitered wall corners.
- Rubber-band multi-select and bulk property edits.
