# Dynamic Webs procedural asset tools

This folder contains development-only Python tooling for generating original,
deterministic, transparent web-carpet patch assets.

It does not run inside Foundry and does not change corner, span or ground web
generation. Generated patch images are intended for a later lightweight
web-carpet renderer that places, rotates, scales, flips and tints reusable
components inside a Region mask.

## Folder ownership

```text
tools/asset_generation/
    generate_web_patch_assets.py
    build_web_patch_preview.py
    validate_web_patch_assets.py
    web_asset_config.py
    web_patch_geometry.py
    web_patch_renderer.py
    requirements.txt

assets/web-carpet/generated/
    generated lossless WebP files
    manifest.json
    preview-sheet.webp
```

The generated lossless WebP files are expected to be committed with the module. They are
ordinary bundled assets, not GM-created persistent storage.

## Set up on Windows

From the Dynamic Webs module root:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r tools\asset_generation\requirements.txt
```

## Generate the complete patch library

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\generate_web_patch_assets.py --clean --preview
```

Default output:

```text
assets/web-carpet/generated/
```

The default library contains **48 assets**:

- 12 loose local fibre networks
- 10 long support arcs
- 10 dense knots
- 10 edge frays
- 6 very faint sheet fragments

All runtime patch assets are written as **lossless WebP with alpha**. The
preview sheet is also written as lossless WebP. No PNG runtime assets are
generated.

Every image is transparent white/grayscale so Foundry can tint it from the
population colour profile.

## Generate at a different resolution

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\generate_web_patch_assets.py `
  --clean `
  --preview `
  --size 1024 `
  --supersample 4
```

Supported output size:

```text
128–2048 px
```

The default is `512 px` with `4×` supersampling.

## Determinism

Each asset has an isolated random stream derived from:

```text
master seed + asset ID
```

Changing or adding one asset ID does not reshuffle unrelated assets. Version 1.1.0 preserves all original IDs and appends new IDs, so the original 16 pixel files remain reproducible from the unchanged master seed. Re-running
the same generator version, Pillow-compatible rendering path, seed, size and
supersampling settings reproduces the same geometry.

The manifest records a SHA-256 hash for every output file.

To use a different authored variation set:

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\generate_web_patch_assets.py `
  --clean `
  --preview `
  --seed "dynamic-webs:web-carpet-patches:v2"
```

## Validate generated outputs

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\validate_web_patch_assets.py
```

Validation checks:

- Manifest schema
- Unique asset IDs
- Every WebP exists
- Dimensions match the manifest
- SHA-256 hashes match
- Assets contain visible alpha
- Assets retain transparent backgrounds
- Outer borders fade to transparency
- No two generated files are byte-identical

## Preview sheet

The main generator creates a preview when passed `--preview`.

It can also be rebuilt independently:

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\build_web_patch_preview.py
```

The checkerboard preview is for development only. Foundry should load the
individual transparent lossless WebP patches through `manifest.json`.

## Editing the library

Use `web_asset_config.py` to:

- Add or remove variants
- Change runtime selection weights
- Change recommended scale ranges
- Change recommended alpha ranges

Use `web_patch_renderer.py` to change visual composition.

Keep these constraints:

- No rectangular opaque background
- No continuous hard border
- White/grayscale fibres only
- Large transparent areas for overlap
- Local asymmetric formations rather than complete fitted carpets
- Fine fibres plus a few stronger structural lines
- Deterministic output
- No external or AI-generated source artwork

## Intended runtime contract

A later Foundry renderer should treat the manifest as an authored atlas:

```javascript
{
  id: "loose-network-01",
  category: "loose-network",
  modulePath:
    "modules/dynamic-webs/assets/web-carpet/generated/loose-network-01.webp",
  recommendedScale: [0.65, 1.35],
  recommendedAlpha: [0.48, 0.9],
  allowRotation: true,
  allowFlipX: true,
  allowFlipY: true,
  tintable: true
}
```

The Scene seed should select deterministic patch descriptors. Region geometry
should clip the final patch container. It should not stretch one complete
rectangular texture to fit an arbitrary Region.

## Corner-web angle-family assets

Corner webs use a separate deterministic asset library because their two wall
anchors need controlled affine fitting rather than unrestricted patch rotation.
The authored catalog contains twelve canonical angles:

```text
5, 10, 15, 25, 35, 45, 60, 75, 90, 110, 135 and 150 degrees
```

Each family contains six variants. Dynamic Webs chooses the nearest compatible
family without consuming the procedural geometry random stream, then maps the
asset's pivot and two authored anchors onto the generated corner and wall
anchors. For example, a 17-degree corner selects a 15-degree asset and applies
a small affine correction while independently fitting both wall lengths.

Generator 1.3 uses a **distributed sheet** topology. It does not create a hub,
radial spokes, capture rings, or a mandatory knot. Instead it builds each web
from wall supports, mismatched cross-corner scaffolds, a sparse local mesh,
staggered corner tethers, and a few loose threads. Intersections are therefore
distributed throughout the sheet rather than converging at one repeated point
away from the corner.

Generate the assets locally from the repository root:

```powershell
python tools/asset_generation/generate_corner_web_assets.py --clean --preview
python tools/asset_generation/validate_corner_web_assets.py
```

Outputs are written to:

```text
assets/web-corner/generated/
```

Corner fibres are intentionally authored thicker than their final Scene width.
A 512 px source anchor is commonly fitted to only 50-115 px in Foundry, so
hairline source strokes become nearly invisible after affine reduction. Width
multipliers and validation thresholds live in `web_corner_asset_config.py`;
change those central values rather than adding blur or duplicate runtime sprites.

Visibility validation uses the full authored thresholds for corner families at
20 degrees and above. Below 20 degrees it applies a modest angle-aware factor
because an acute wedge naturally occupies less of the square 512 px canvas.
This prevents valid 5-degree sheets from failing solely because of transparent
space while retaining an explicit minimum for mean alpha and strong-pixel
coverage. Fibre opacity itself is not reduced or excused by the adjustment.

The JavaScript renderer deliberately retains the procedural corner geometry as
a fallback. Until the local WebP loads successfully, the old line rendering
remains visible. Generated WebPs and preview sheets are local build outputs and
are not included in assistant-provided replacement archives.

## Wall-span four-anchor assets

Wall-span webs use a separate deterministic library of eight distributed-sheet
variants. Each source WebP exposes four authored support anchors:

```text
firstWallStart   firstWallEnd
secondWallStart  secondWallEnd
```

Runtime maps this source quadrilateral onto the exact two generated wall edges
with two textured triangles. The target edges do not need to be parallel, so
parallel, narrowing, widening and moderately skewed cave passages can share the
same asset library without flattening the procedural wall geometry.

Generate and validate the span library locally:

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\generate_span_web_assets.py --clean --preview
.\.venv\Scripts\python.exe tools\asset_generation\validate_span_web_assets.py
```

Outputs are written to:

```text
assets/web-span/generated/
```

The JavaScript renderer keeps procedural span strands authoritative for spatial
queries and destruction. The WebP is presentation only and remains behind a
procedural fallback until its texture and mesh are available. Generated span
WebPs and preview sheets are local build outputs and are not included in
assistant-provided replacement archives.

### Span asset visibility refinement

Span generator 1.2 deliberately authors stronger source fibres than generator
1.1. Span WebPs are commonly reduced from 512 px to roughly one grid square
when fitted to a passage, so source-space hairlines and partial-alpha links can
become too faint even when the runtime thickness underlay is set to `4×`.

Generator 1.2 therefore:

- increases crisp structural, cross-link and wall-support widths;
- raises core alpha while retaining weaker loose threads;
- reduces source blur so the crisp mesh remains readable after down-scaling;
- requires full runtime presentation alpha for span assets; and
- raises validator visibility floors so a faint library cannot pass again.

Regenerate and validate after applying this source update:

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\generate_span_web_assets.py --clean --preview
.\.venv\Scripts\python.exe tools\asset_generation\validate_span_web_assets.py
```
