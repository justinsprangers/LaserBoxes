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
- Preview with the `laserboxes` entry in `C:\Claude\.claude\launch.json` (http://localhost:8797).
- Check the browser console for errors, every generator's thumbnail on the index page, and the fit check at defaults.

## Joint engine (`core/joints.js`)
- Box convention: outer size X × Y × Z, panels drawn at outer size in box coordinates (x right, y front→back, z up). The t × t corner cubes belong to the front and back; every other edge splits an odd number of equal fingers ('F' keeps the 1st, 3rd, ...; its mate 'f' keeps the rest).
- Parts that assemble carry `place` (3D slab + body `env` + group `g`). `coverage` samples each part's thickness and requires every point inside a body to be filled by exactly one part. It must pass at defaults for every box generator; it has been shown to catch wrong finger polarity, a corner claimed twice, a mis-sized panel and a missing divider slot.
- Holes that are meant to be empty (e.g. the drawer's finger hole) need `free: true` or the coverage check counts them as gaps.
- `view3d` only draws axis-aligned flat parts; the flex box has no assembled view for that reason.

## Generators
- Boxes: `closed-box`, `open-box`, `lid-box`, `divider-tray`, `drawer`, `flex-box`.
- `hook-joint`: gravity hook joint cover for a resin printer lid. Design decisions: the front panel is set back by (front wall + clearance) so the slots can be closed; seated, the front panel hangs (tooth height + clearance) below the top panel to give the tooth lift room.
- `plate`: minimal template. `living-hinge`: hinge panel.
- Not built yet (boxes.py has them): sliding-lid box, hinged-lid box, polygon/round boxes, shelves, gears.
