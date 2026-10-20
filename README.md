# LaserBoxes

Free parametric laser-cut generators, in the spirit of [boxes.py](https://www.festi.info/boxes.py/). Pick a generator, set the sizes, check the preview, 3D view and fit check, then download SVG or DXF. Runs entirely in the browser, offline.

Not affiliated with boxes.py; no code is shared with it. Free to use, copy and modify under the [MIT License](LICENSE). Cut files are provided as-is: check sizes and do a test cut before cutting good material.

## Using it

1. Open the hosted page, or download this folder and open `index.html` in a browser (double-click it; no server or internet needed).
2. Pick a generator from the list.
3. Edit the values on the left. The preview, warnings and (where available) assembled view and fit check update live.
4. Click **Download SVG** or **Download DXF**.

Output, in real millimetres:

- **Cut**: red `#FF0000` 0.01 mm hairlines (SVG layer `Cut`, DXF layer `CUT`).
- **Engrave areas**: blue `#0000FF` rectangles marking where artwork can go (layer `Engrave areas` / `ENGRAVE`). Place artwork inside them, then delete or disable this layer before cutting.

Settings that apply to every generator (Cutting group):

- **Kerf** is compensated: outlines are pushed out by kerf/2 and holes pulled in by kerf/2, so parts come out at nominal size. Set it to 0 if your software compensates instead.
- **Sheet width / height**: set your bed size. Parts wrap into rows, turn 90° if that's the only way they fit, and spill onto more sheets; pick one sheet or all of them when downloading.
- **Dog-bone bit diameter** (CNC routers): adds round reliefs in inside corners so square tabs fit a round bit's cut.

Buttons: **Print 1:1** prints every part at real size (one per page, with a 50 mm scale bar). **Copy link** copies the page address, which holds every value you changed. Values are also remembered per generator in this browser; **Reset defaults** clears them.

## How to cut

1. **Measure your kerf once.** Open Plate at 50 × 50 mm, no holes, kerf 0. Cut it and measure: kerf = 50 − measured size.
2. **Test a joint first.** Cut a small open box from scrap. Too tight: raise *Joint clearance* by 0.05 mm. Too loose: lower it, or lower the kerf.
3. **Materials.** 3 mm plywood or MDF works for everything. Acrylic: about 0.05–0.1 mm joint clearance, and avoid living hinges.
4. **CNC routers.** Kerf 0, dog-bone diameter = your bit, download DXF, and let your CAM software offset the toolpaths.

## Generators

| Generator | File | What it makes |
|---|---|---|
| Closed box | `generators/closed-box.js` | Six-sided finger-jointed box. |
| Open box | `generators/open-box.js` | Five-sided tray or bin. |
| Box with lid | `generators/lid-box.js` | Open box plus a lift-off lid that slips over it. |
| Sliding-lid box | `generators/sliding-lid-box.js` | Lid slides in from the front along grooves formed by glued-in rails. |
| Hinged-lid box | `generators/hinged-lid-box.js` | Lid pivots on two pins through the side walls; the fit check simulates the swing (opens about 90°). |
| Hinge box | `generators/hinge-box.js` | Lid on knuckle hinges: alternating box/lid leaves on the back with a rod through them (like boxes.py's HingeBox); opens 180°. |
| Integrated-hinge box | `generators/integrated-hinge-box.js` | No extra hinge parts: the lid's back panel has axle tabs that turn in round knobs on the box sides (like boxes.py's IntegratedHingeBox). |
| Divider tray | `generators/divider-tray.js` | Open tray split into a grid of equal compartments; dividers cross-halve and tab into the walls and bottom. |
| Polygon box | `generators/polygon-box.js` | Regular 3–12 sided box: walls tab into a polygon bottom and optional top. |
| Drawer | `generators/drawer.js` | Open box with an overhanging face plate and finger-pull hole. |
| Stackable bin | `generators/stackable-bin.js` | Open-front parts bin with sloped sides and a label lip; cleats underneath lock bins into a stack. |
| Shelf / cubby organizer | `generators/shelf.js` | Open-front grid of cubbies or a small bookshelf, with optional wall-mount holes. |
| Flex box *(experimental)* | `generators/flex-box.js` | Rounded-corner box: one wall strip with living-hinge corners, tabbed into top and bottom plates. |
| Spur gears | `generators/gears.js` | Involute spur gear, or a meshing pair at the right centre distance; the fit check turns them through a tooth pitch. |
| Gravity hook joint cover | `generators/hook-joint.js` | L-shaped top + front cover for a resin printer lid. Front panel fingers lift through slots, slide sideways and drop so a tooth locks them. |
| Plate with mounting holes | `generators/plate.js` | Simple plate with corner holes. Also the template for new generators. |
| Living hinge panel *(experimental)* | `generators/living-hinge.js` | Flat panel with a band of slits so it bends. |

Box sizes are **inside** dimensions unless you tick *Sizes are outside dimensions*. Finger width is a multiple of the material thickness (boxes.py's default is 2). **Joint clearance** leaves a gap on every contact face of finger joints and slots (0 = press fit). Each box page shows an **assembled view** and a **fit check** that samples points through every panel's thickness and confirms each is filled by exactly one part: no gaps, no overlaps, nothing sticking out (run at zero clearance).

"Experimental" generators haven't been test-cut yet.

## Adding a generator

1. Copy `generators/plate.js` to `generators/<name>.js`.
2. Change `id`, `name`, `group` (the heading it's listed under) and `blurb`.
3. Edit `params`, `build`, `validate`, `parts` and (optionally) `annotate`.
4. Add `<script src="generators/<name>.js"></script>` to `index.html`, next to the others.

What a generator provides (`LB.register({...})`):

| Field | Required | Purpose |
|---|---|---|
| `id`, `name`, `group`, `blurb` | yes | Identity and listing. `id` is used in the page address. |
| `experimental` | no | Warning text; also shows an "Experimental" badge. |
| `params` | yes | List of `{id, label, def, step, group, type, pos, min, help}`. `type` is `'int'` or `'bool'` (default: number). `pos: true` means must be > 0; `min` sets a lower limit. The Cutting settings (`p.k`, `p.gap`, `p.sheetW`, `p.sheetH`, `p.dog`, `p.eng`) are added automatically. |
| `build(p)` | yes | Works out derived geometry from the values `p`; returns anything (called `g` below). |
| `validate(p, g)` | no | Returns `{errors, warnings, info}` (lists of text). Errors block the drawing and downloads. |
| `parts(p, g)` | yes | List of parts: `{label, outline, holes, cuts, engrave, place}`. All in mm with **y pointing up**. `outline` is a polygon `[[x,y], ...]`; each hole is a polygon or `{circle: [cx, cy, r]}`; `cuts` are open polylines (e.g. hinge slits, no kerf applied); `engrave` is a list of `[x0, y0, x1, y1]` boxes; `place` (optional) puts the part in 3D for the assembled view and fit check (see `core/joints.js`). Draw nominal sizes; the core applies kerf and dog-bones and lays parts out. |
| `annotate(p, g, placed, fs)` | no | Returns extra SVG (dimensions) for the preview. `placed[i].X(x)` and `.Y(y)` map part *i*'s coordinates onto the preview; `fs` is a good font size. Skipped when a part had to be rotated. |
| `panels` | no | Extra drawings: `[{title, render(p, g), maxWidth}]`, where `render` returns an `<svg>` string. |
| `checks(p, g)` | no | Fit check: returns `[{ok, name, detail}]`. |
| `filename(p)`, `help` | no | Download name and extra help (HTML) for the page. |

Shared helpers on `LB`: `rect`, `clean`, `offset`, `bbox`, `area`, `pathOf`, `dogbone`, `dimH`, `dimV`, `fmt`, `f3`, `esc`. Joint helpers on `LB.joints`: `fingerPanel` (finger-jointed panel, including partly joined edges), `boxParts` / `boxParams` / `boxDims` / `boxValidate` / `boxChecks` / `withCheckParts` (a whole box, used by every box generator), `bumpRect` (tabs and notches), `roundedRect`, `roundCorner` (round a corner, cut a clearance arc, or add a knob), `clipHalf`, `widen`, `gridBox` (divider grid), `hingeCuts` / `hingeParams`, `view3d` / `drawFaces`, `coverage`, `swing3d` (rotate a lid about an axis and find how far it opens). A new box-style generator is usually `boxParts` plus extra holes and parts; see `drawer.js` (smallest), `sliding-lid-box.js` or `divider-tray.js`. Shared CSS classes for drawings are in `core/lb.css` (`cutp`, `cutf`, `solid`, `solidf`, `frame`, `arrow`, `lbl`, `dim`, ...).

## Files

- `index.html`: the page; lists the generator scripts and sets the repo link used for "Report a problem".
- `core/lb.js`: registry, geometry helpers, form, preview, sheet layout, SVG / DXF / print export.
- `core/joints.js`: finger joints, box builder, living hinge, assembled view, fit check.
- `core/lb.css`: styles (light and dark).
- `generators/`: one file per generator.
