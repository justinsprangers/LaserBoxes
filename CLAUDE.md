# CLAUDE.md: LaserBoxes

Offline, boxes.py-style collection of parametric laser-cut SVG generators. Built to grow: each generator is one file in `generators/`. User-facing docs and the generator interface are in [README.md](README.md); keep it current when the interface or generator list changes.

## Rules
- **No build step, no dependencies, works from `file://`.** Plain `<script>` files only: no ES modules, `fetch`, or CDN libraries. Each generator wraps itself in an IIFE and calls `LB.register`.
- Geometry is in mm, **y up**, at nominal size. Never apply kerf inside a generator; `core/lb.js` offsets outlines by +kerf/2 and holes by −kerf/2.
- SVG output contract: width/height in mm plus a matching viewBox; cut = `#ff0000` at 0.01 stroke on layer `Cut`; engrave areas = `#0000ff` on layer `Engrave areas`. Don't change this without asking.
- New generator: copy `generators/plate.js`, add its `<script>` line to `index.html`, and add a row to the README table.
- Joint generators should include a `checks` fit simulation (see `hook-joint.js`) and test that it passes at the defaults and fails when the geometry is deliberately broken.
- `offset` uses mitred corners and assumes simple polygons without features thinner than the kerf; `clean` the outline first so there are no collinear points.

## Testing
- Preview by serving this folder (e.g. `python -m http.server 8797`), or the `laserboxes` launch entry if your workspace has one.
- Check the browser console for errors, every generator's thumbnail on the index page, and the fit check at defaults.

## Joint engine (`core/joints.js`)
- Box convention: outer size X × Y × Z, panels drawn at outer size in box coordinates (x right, y front→back, z up). The t × t corner cubes belong to the front and back; every other edge splits an odd number of equal fingers ('F' keeps the 1st, 3rd, ...; its mate 'f' keeps the rest).
- Parts that assemble carry `place` (3D slab + body `env` + group `g`). `coverage` samples each part's thickness and requires every point inside a body to be filled by exactly one part. It must pass at defaults for every box generator; it has been shown to catch wrong finger polarity, a corner claimed twice, a mis-sized panel and a missing divider slot.
- Holes that are meant to be empty (e.g. the drawer's finger hole) need `free: true` or the coverage check counts them as gaps.
- `view3d` only draws axis-aligned flat parts; the flex box has no assembled view for that reason.

- Joint clearance (`play`) narrows kept fingers and widens slots. Coverage can't check clearance geometry (it's gaps by design), so box generators wrap `build` in `withCheckParts` and check `g.checkParts` (zero clearance).
- Partly joined edges (shorter front/back walls) use span lists in `fingerPanel`; `boxParts` exposes them as `h: {front, back}` and `omit: ['back']`.

## Core features to keep working
- Layout: rows, 90° rotation only when it's the only way a part fits, extra sheets past the sheet height. `annotate` is skipped when anything is rotated (its X/Y map one axis each).
- Dog-bones are applied after kerf, in layout; DXF is R12 POLYLINE/CIRCLE in mm; Print 1:1 opens a pop-up window.

## Public repo
- This folder is its own **public** git repo (MIT). Never add personal data, keys, or files from the private `C:\Claude` repo. The issue/source link is set in `index.html` (`LB.start({repo})`).

## Generators
- Boxes: `closed-box`, `open-box`, `lid-box`, `sliding-lid-box`, `hinged-lid-box`, `divider-tray`, `drawer`, `flex-box`.
- `hinged-lid-box`: pivot r = t + pin/2 + 1.5 in from the back and down from the top; side corners rounded about the pivot and the back wall lowered to the pivot height, so the lid opens ~90° and rests on the back wall (swing simulated in the fit check). Leaves an r-tall gap at the back when closed.
- `sliding-lid-box`: lid runs between glued-in low and top rails; front wall stops at the lid underside.
- `flex-box` and `living-hinge` are marked experimental until test-cut.
- `hook-joint`: gravity hook joint cover for a resin printer lid. Design decisions: the front panel is set back by (front wall + clearance) so the slots can be closed; seated, the front panel hangs (tooth height + clearance) below the top panel to give the tooth lift room.
- `plate`: minimal template. `living-hinge`: hinge panel.
- Not built yet (boxes.py has them): polygon/round boxes, shelves, gears.
