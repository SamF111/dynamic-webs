# Dynamic Webs Development Guide

This document collects validation, asset-generation and release-testing guidance. Architecture is documented in [TECHNICAL-DESIGN.md](TECHNICAL-DESIGN.md), and the supported external integration surface is defined in [PUBLIC-API.md](PUBLIC-API.md).

## Baseline versions

- Module version: `0.7.0`
- Public API version: `1`
- Blueprint schema version: `8`
- Diagnostic schema version: `1`
- Mutable-state schema version: `1`
- Foundry minimum: v13
- Foundry verified: v14

These version numbers are independent. A module release does not automatically require a public API or geometry schema change.

## Validation

From the module root:

```bash
npm run validate
```

This runs the JavaScript syntax checks and complete Node regression suite.

Documentation-only edits should also run:

```bash
node --test tests/documentation.test.js
```

Automated validation does not replace live Foundry testing.

## Live smoke testing

Release validation should cover Foundry v13 and v14, including:

- GM world defaults for new populations
- Preservation of existing Scene arrays and explicit `[]`
- Maximum span-width boundaries
- Adding, duplicating, reordering and removing populations
- Different populations on the same and different floors
- Different colours and thicknesses on one floor
- Missing saved levels
- Structural wall creation, movement and deletion
- Region creation, edits, elevation, tags and deletion
- Confine/Exclude combinations and wildcard tags
- Viewed-level switching as GM and player
- Downward visibility without upper-level leakage
- Spatial queries with level, category, Region, distance, role and result limits
- Generic entity position and movement evaluation
- Captured-web show, update, above/below-token placement, level visibility, removal and entity-scoped clearing
- Stored but currently unrendered level queries
- Repeated Scene saves without duplicate rendering
- Swept token movement through intact spans
- Whole-span destruction on connected clients
- Scene and world restoration controls
- Scene reload and server restart with destroyed spans retained
- Obsolete destroyed IDs pruned after geometry changes
- Generated secret-door preservation and deferred clean-up
- Baseline diagnostics and deterministic hashes

## Asset policy

Runtime code must not generate or write image assets.

Authored transparent-white WebP atlases are produced locally through deterministic development-only Python tools and validated through manifests and hashes. Do not add AI-generated image files to the module.

### Span-web assets

Generate and validate the span atlas with:

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\generate_span_web_assets.py --clean --preview
.\.venv\Scripts\python.exe tools\asset_generation\validate_span_web_assets.py
```

### Captured-web assets

Generate and validate captured overlays with:

```powershell
.\.venv\Scripts\python.exe tools\asset_generation\generate_captured_web_assets.py --clean --preview
.\.venv\Scripts\python.exe tools\asset_generation\validate_captured_web_assets.py
```

The captured asset manifest stores IDs, dimensions, hashes, source pivot/radius metadata and recommended alpha ranges.

### Carpet assets

Carpet assets and their manifest live under:

```text
assets/web-carpet/generated/
```

Runtime selects reusable patches and builds client-local Region masks. It must never bake or upload a complete Scene carpet texture.

## Architectural rules

Development must preserve these rules:

1. **Deterministic generation.** Unchanged inputs reproduce unchanged geometry and stable IDs.
2. **No per-frame geometry generation.** Rebuilds belong to lifecycle events, not render tickers.
3. **Immutable geometry.** Mutable destruction and future interaction state remain separate deviations.
4. **Atomic spatial replacement.** Geometry rebuilds replace the complete spatial index only after successful generation.
5. **Visibility is presentation-only.** Viewed-level changes do not regenerate geometry or rebuild the index.
6. **Critter-agnostic ownership.** Dynamic Webs contains no species-specific policy.
7. **Public integration only.** Consumers use `dynamicWebs.api` and documented hooks, never internal imports.
8. **Foundry compatibility adapters.** v13/v14 differences remain isolated in compatibility files.
9. **JSON-authored configuration.** Shared presets and colours remain data-owned where designed.
10. **Frozen public snapshots.** Internal Maps, Sets, services and PIXI objects are never exposed.
11. **Generated walls are derived.** Module-owned span walls are excluded from structural source geometry.
12. **Capture lifecycle belongs to the consumer.** Dynamic Webs presents captures but does not watch arbitrary external entities.

## Documentation ownership

The documentation is split by audience:

- `README.md` — public landing page and feature overview
- `docs/CONFIGURATION.md` — GM-facing settings and Scene authoring
- `docs/PUBLIC-API.md` — stable external integration contract
- `docs/TECHNICAL-DESIGN.md` — internal architecture and data behaviour
- `docs/DEVELOPMENT.md` — validation, assets and release process
- `roadmap.md` — feature-complete status, release work and maintenance policy

Do not move low-level implementation detail back into the landing-page README. New public-facing features should receive a brief plain-language README entry and detailed documentation in the appropriate file.

## Public API compatibility

`PUBLIC_API_VERSION = 1` is the accepted compatibility baseline.

Within version 1:

- Existing namespace and method names remain stable.
- Existing optional fields retain their established defaults.
- New optional request or frozen result fields may be added.
- Consumers must ignore unknown result fields.
- Breaking removals, renames or semantic changes require a new public API version.

The complete contract lives in [PUBLIC-API.md](PUBLIC-API.md).
