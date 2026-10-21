# LaserBoxes: session notes

## Status
- 17 generators (boxes, storage, gears, living hinge, hook joint). See the generator list in `CLAUDE.md`.
- Every fit check passes at default values. The box checks also pass with joint clearance turned on.
- **Nothing has been physically cut yet.** `flex-box` and `living-hinge` are marked experimental.

## Next steps
- Test-cut a hinge box first, since both hinge mechanisms depend on clearances the simulation can't fully judge. Then tune the defaults.
- Not built yet: round (cylindrical) boxes, sliding drawer cabinets, gear racks and internal gears.

## Decisions & gotchas
- See `CLAUDE.md` for the geometry conventions, the SVG contract, and the check engines (coverage, swing, gear mesh).
- Values recalculate after a pause in typing, because the integrated-hinge check takes about 1 s.

## Log
- 2026-10-20: Hinge box, integrated-hinge box, polygon box, stackable bin, shelf, gears (a270037)
- 2026-10-20: Joint clearance, sliding and hinged lids, DXF, sheets, print
- 2026-10-20: First version: offline parametric generators (public repo, MIT)
