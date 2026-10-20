# LaserBoxes

Offline parametric laser-cut generators, in the spirit of [boxes.py](https://www.festi.info/boxes.py/). Pick a generator, set the sizes, check the preview, download an SVG.

Not affiliated with boxes.py; no code is shared with it. Free to use, copy and modify under the [MIT License](LICENSE). Cut files are provided as-is: check sizes and do a test cut before cutting good material.

## Using it

1. Open the hosted page, or download this folder and open `index.html` in a browser (double-click it; no server or internet needed).
2. Pick a generator from the list.
3. Edit the values on the left. The preview, warnings and (where available) fit check update live.
4. Click **Download SVG**.

The SVG is one sheet in real millimetres:

- **Cut** layer: red `#FF0000` hairlines, 0.01 mm.
- **Engrave areas** layer: blue `#0000FF` rectangles marking where artwork can go. Place your artwork inside them, then delete or disable this layer before cutting.

**Kerf** (in the Cutting group) is already compensated: outlines are pushed out by kerf/2 and holes pulled in by kerf/2, so parts come out at nominal size. Set it to 0 if your laser software compensates instead.

Your values are remembered per generator in this browser. The page address also holds any values you changed, so you can bookmark a setup. **Reset defaults** clears them.

## Generators

| Generator | File | What it makes |
|---|---|---|
| Closed box | `generators/closed-box.js` | Six-sided finger-jointed box. |
| Open box | `generators/open-box.js` | Five-sided tray or bin. |
| Box with lid | `generators/lid-box.js` | Open box plus a lift-off lid that slips over it (clearance setting). |
| Divider tray | `generators/divider-tray.js` | Open tray split into a grid of equal compartments; dividers cross-halve and tab into the walls and bottom. |
| Drawer | `generators/drawer.js` | Open box with an overhanging face plate and finger-pull hole. |
| Flex box | `generators/flex-box.js` | Rounded-corner box: one wall strip with living-hinge corners, tabbed into top and bottom plates. |
| Gravity hook joint cover | `generators/hook-joint.js` | L-shaped top + front cover for a resin printer lid. Front panel fingers lift through slots, slide sideways and drop so a tooth locks them. Includes an assembly sketch, joint detail and a simulated fit check. |
| Plate with mounting holes | `generators/plate.js` | Simple plate with corner holes. Also the template for new generators. |
| Living hinge panel | `generators/living-hinge.js` | Flat panel with a band of slits so it bends. |

Box generators sizes are **inside** dimensions unless you tick *Sizes are outside dimensions*. Finger width is a multiple of the material thickness (boxes.py's default is 2). Each box page shows an **assembled view** and a **fit check** that samples points through every panel's thickness and confirms each one is filled by exactly one part: no gaps, no overlaps, nothing sticking out.

**Sheet width** (Cutting group) wraps parts onto new rows; set it to your laser bed width. 0 picks a roughly square layout.

## Adding a generator

1. Copy `generators/plate.js` to `generators/<name>.js`.
2. Change `id`, `name`, `group` (the heading it's listed under) and `blurb`.
3. Edit `params`, `build`, `validate`, `parts` and (optionally) `annotate`.
4. Add `<script src="generators/<name>.js"></script>` to `index.html`, next to the others.

What a generator provides (`LB.register({...})`):

| Field | Required | Purpose |
|---|---|---|
| `id`, `name`, `group`, `blurb` | yes | Identity and listing. `id` is used in the page address. |
| `params` | yes | List of `{id, label, def, step, group, type, pos, min, help}`. `type` is `'int'` or `'bool'` (default: number). `pos: true` means must be > 0; `min` sets a lower limit. Kerf, part gap and the engrave toggle (`p.k`, `p.gap`, `p.eng`) are added automatically. |
| `build(p)` | yes | Works out derived geometry from the values `p`; returns anything (called `g` below). |
| `validate(p, g)` | no | Returns `{errors, warnings, info}` (lists of text). Errors block the drawing and download. |
| `parts(p, g)` | yes | List of parts: `{label, outline, holes, cuts, engrave, place}`. All in mm with **y pointing up**. `outline` is a polygon `[[x,y], ...]`; each hole is a polygon or `{circle: [cx, cy, r]}`; `cuts` are open polylines (e.g. hinge slits, no kerf applied); `engrave` is a list of `[x0, y0, x1, y1]` boxes; `place` (optional) puts the part in 3D for the assembled view and fit check (see `core/joints.js`). Draw nominal sizes; the core applies kerf and lays parts out in rows. |
| `annotate(p, g, placed, fs)` | no | Returns extra SVG (dimensions) for the preview. `placed[i].X(x)` and `.Y(y)` map part *i*'s coordinates onto the sheet; `fs` is a good font size. |
| `panels` | no | Extra drawings: `[{title, render(p, g), maxWidth}]`, where `render` returns an `<svg>` string. |
| `checks(p, g)` | no | Fit check: returns `[{ok, name, detail}]`. |
| `filename(p)`, `help` | no | Download name and extra help (HTML) for the page. |

Shared helpers on `LB`: `rect`, `clean`, `offset`, `bbox`, `area`, `pathOf`, `dimH`, `dimV`, `fmt`, `f3`, `esc`. Joint helpers on `LB.joints`: `fingerPanel` (finger-jointed panel), `boxParts` / `boxParams` / `boxDims` / `boxValidate` / `boxChecks` (a whole box, used by every box generator), `bumpRect` (tabs and notches), `roundedRect`, `hingeCuts` / `hingeParams`, `view3d`, `coverage`. A new box-style generator is usually `boxParts` plus extra holes and parts; see `drawer.js` (smallest) or `divider-tray.js`. Shared CSS classes for drawings are in `core/lb.css` (`cutp`, `cutf`, `solid`, `solidf`, `frame`, `arrow`, `lbl`, `dim`, ...).

## Files

- `index.html`: the page; lists the generator scripts.
- `core/lb.js`: registry, geometry helpers, form, preview, SVG export.
- `core/joints.js`: finger joints, box builder, living hinge, assembled view, fit check.
- `core/lb.css`: styles (light and dark).
- `generators/`: one file per generator.
