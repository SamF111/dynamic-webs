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
