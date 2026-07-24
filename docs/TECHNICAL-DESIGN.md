# Dynamic Webs Technical Design

This document records the implementation contracts behind Dynamic Webs. User-facing controls are documented in [CONFIGURATION.md](CONFIGURATION.md), while external integrations are defined in [PUBLIC-API.md](PUBLIC-API.md).

## Current baseline

- **Module ID:** `dynamic-webs`
- **Runtime namespace:** `dynamicWebs`
- **Current version:** `0.7.0`
- **Public API version:** `1`
- **Blueprint schema version:** `8`
- **Diagnostic schema version:** `1`
- **Mutable-state schema version:** `1`
- **Minimum Foundry version:** v13
- **Verified Foundry version:** v14
- **Entry point:** `scripts/dynamic-webs.js`

## Ownership boundary

Dynamic Webs owns:

- Web generation and immutable geometry
- Rendering and asset presentation
- Modular Scene configuration
- Level and Region compatibility
- Runtime lifecycle and spatial indexing
- Generic web interaction evaluation
- Persistent whole-span destruction
- Generated span-wall reconciliation
- Transient captured-web presentation

It remains entity- and creature-agnostic. Ambient Critters and other consumers integrate through the public API and hooks only and must not import files from `modules/dynamic-webs/scripts/`.

## Generated categories

The generation system currently produces:

- **Wall-corner webs** from compatible same-level structural wall junctions.
- **Wall-span webs** between suitable same-level opposing wall edges.
- **Ground webs** at deterministic open positions inside the Scene rectangle.
- **Web carpets** as deterministic reusable transparent WebP patch recipes owned by matching same-level Confine Regions.

Generated Dynamic Webs span walls are derived documents and are excluded from structural wall collection, preventing recursive web generation.

## Deterministic generation

Geometry is generated during lifecycle rebuilds and never per frame.

The population seed root is:

```text
dynamic-webs:web-generation:v4:<scene-id>:<encoded-population-id>
```

Each population, level and category receives an isolated deterministic stream:

```text
dynamic-webs:web-generation:v4:<scene-id>:<population-id>:<level-id>:wall-corner
dynamic-webs:web-generation:v4:<scene-id>:<population-id>:<level-id>:wall-span
dynamic-webs:web-generation:v4:<scene-id>:<population-id>:<level-id>:ground
```

Changing one population does not reshuffle another population. Changing one category does not reshuffle unrelated categories within the same population.

## Blueprint contract

Every web and strand uses blueprint schema version `8`.

Web identifiers are Scene-, population- and level-qualified:

```text
<web-kind>:<encoded-scene-id>:<encoded-population-id>:<encoded-level-id>:<encoded-source-key>
```

Strand identifiers remain qualified by their web ID:

```text
<web-id>:<encoded-local-strand-id>
```

Complete identifiers are opaque public values and must not be parsed by consumers.

A web blueprint includes stable ownership and geometry data such as:

- `populationId`
- `populationLabel`, currently an internal alias of the opaque population ID
- `thicknessMultiplier`
- `levelProviderMode`
- `levelId`
- immutable `elevationBand`
- `colourProfileId`
- generation seed and source key
- controlling Region IDs and matched tags
- immutable geometry, strands, perches and supporting wall IDs

Immutable geometry is separate from mutable deviations such as destroyed whole spans.

## Region-aware generation

Region acceptance is evaluated against complete generated strand polylines.

Adjacent or overlapping Confine Regions form one allowed union, but an unassigned gap is not accepted. Exclude Regions take precedence. Candidates are rejected rather than clipped so accepted strands retain their deterministic organic shape.

Foundry's native Region point test is authoritative when available. Serialised rectangle, ellipse and polygon records provide compatibility fallbacks.

Web carpets use the matching Confine Region itself as their ownership boundary. Patch centres are accepted through `RegionDocument#testPoint({x, y, elevation})` where available, and the displayed patch container is clipped by a compact vector-derived alpha mask. Matching Exclude shapes are subtracted using `destination-out`.

## Rendering and visibility

Normal generated webs render into transient PIXI containers:

```text
dynamic-webs.webs
dynamic-webs.webs.level-<index>.elevation-<bottom>
```

Single-level rendering retains the stable `dynamic-webs.webs` name. Multi-level rendering uses separate sibling containers so each elevation band sorts correctly against Foundry and Levels tiles.

Each container is stamped with its level elevation and a Primary Canvas sort band that places same-floor webs above tiles and drawings but below tokens.

The runtime stores geometry for every generated level. GMs and players render the active viewed level plus every detected level below it. A viewed-level change replaces only the visible subset and does not regenerate geometry or rebuild the spatial index.

Captured-web effects use separate level-aware under-token and above-token roots. Presentation placement is selected by the capture descriptor's `aboveTokens` flag and does not change capture identity or interaction state.

## Hybrid asset presentation

### Corner webs

Corner webs retain deterministic procedural geometry for queries and interactions while rendering through locally generated transparent-white WebP assets when available.

Twelve angle families from 5–150 degrees provide deterministic variants. Each asset is affinely fitted from its authored pivot and edge anchors onto the generated wall corner. Missing or failed assets leave the procedural fallback visible.

### Wall-span webs

Wall-span webs retain complete deterministic procedural geometry while rendering through one of eight distributed-sheet WebP variants when available.

Each asset has four authored wall-support anchors. Runtime fits them to the two generated wall edges with a two-triangle textured mesh, supporting parallel, converging, diverging and moderately skewed passages. Missing mesh or texture support leaves the procedural fallback visible.

### Captured-web overlays

Eight transparent-white local-entanglement assets provide client-local transient presentation for captured webs. Selection is deterministic from the consumer capture key. Runtime transforms use the actual loaded texture dimensions and keep the procedural fallback visible until a finite, bounded asset display is ready.

Captured overlays are not Scene geometry, are not indexed, are not persisted and do not mutate whole-span state.

## Web carpets

Web carpets use deterministic reusable transparent WebP patches rather than baking a complete per-Scene texture.

The generated manifest under `assets/web-carpet/generated/` describes transparent lossless WebP assets covering loose networks, support arcs, dense knots, edge frays and faint sheet fragments.

Each immutable patch recipe stores:

- Stable patch ID
- Asset ID and module path
- World-space centre
- Width and height
- Rotation
- Horizontal and vertical flips
- Alpha

The Region mask long edge defaults to `512 px` and is independent of source WebP resolution. Mask and texture requests are cached client-locally.

Carpet blueprints do not fabricate a dense interaction mesh. Their Region bounds remain discoverable through the web index, while strand queries return only genuine corner, span and ground strands.

## Spatial index

After each successful geometry replacement, the runtime builds a uniform-grid spatial index containing all stored levels, whether rendered or hidden.

Indexed records include:

- Web and functional strand bounds
- Population, level and elevation ownership
- Category and strand role
- Region IDs and tags
- Functional `collisionWidthPx` as `interactionWidthPx`
- Immutable perch points
- A live `intact` field for mutable whole-span state

Queries return deeply frozen plain snapshots in stable distance-and-identifier order. They expose no PIXI references or mutable internal collections.

`queryNearby()` performs a uniform-grid broad phase followed by precise point-to-polyline distance testing including functional width. `queryStrands()` returns strands whose functional broad-phase bounds overlap a rectangle.

Presentation-only colour or thickness changes refresh indexed snapshots without rebuilding cells. Visibility-only changes leave geometry and the index unchanged. A geometry rebuild atomically replaces the index.

## Whole-span destruction and generated walls

Only wall-span webs are destructible through token movement or the public mutation API. Corner, ground and carpet webs remain immutable.

A committed token movement uses its swept centre path and collision radius. Dynamic Webs queries intact wall-span strands, performs precise capsule-to-polyline checks and destroys each intersected whole span. Drag previews do not mutate state.

Destroyed IDs are stored separately from immutable geometry:

```javascript
flags["dynamic-webs"].mutableState = {
  schemaVersion: 1,
  revision: 7,
  destroyedWebIds: ["<stable-wall-span-web-id>"]
};
```

Compatible IDs survive deterministic regeneration, canvas teardown, Scene reopening and server restart. Missing IDs are pruned after regeneration.

Generated span walls carry explicit Dynamic Webs ownership flags. Reconciliation creates, updates or removes one wall per intact span and preserves a GM-opened secret door's open state.

Vision-only walls and closed generated secret doors are removed immediately when their span is destroyed. An already-open generated secret door may remain as a harmless deferred-cleanup WallDocument to avoid an expensive perception rebuild during token movement; later reconciliation or maintenance removes it.

The GM is authoritative for mutations. Compact Scene state is serialised, broadcast over `module.dynamic-webs`, and also converges through normal `updateScene` propagation.

## Lifecycle

On `canvasReady`, Dynamic Webs:

1. Resolves the level provider.
2. Reads and validates Scene populations.
3. Resolves level, category, Region, colour and thickness configuration.
4. Generates deterministic immutable blueprints for every active population.
5. Builds a replacement spatial index.
6. Reconciles persisted destroyed-span IDs.
7. Loads bundled assets as required.
8. Renders only intact level-compatible webs.
9. Reconciles generated span walls.

Population, structural wall, Region geometry/tag/elevation and level-document changes regenerate affected geometry. Viewed-level changes refresh only visibility.

Canvas teardown, Scene deletion and module disposal destroy local rendering and clear transient geometry and captures. Scene-owned destroyed-span state remains persisted.

## Diagnostics

The baseline diagnostic report includes:

- Module, API, blueprint, diagnostic and mutable-state schema versions
- Requested and resolved level provider
- Detected levels and wall counts
- Configured and active populations
- Generation and category seeds
- Web and strand counts by population, level and category
- Colours, thickness and Region restrictions
- Rendered versus stored counts
- Spatial-index telemetry
- Identifier uniqueness and ownership checks
- Mutable-state and persistence telemetry
- Token span-interaction lifecycle data
- Non-destructive determinism hashes

Run it through:

```javascript
dynamicWebs.api.diagnostics.showBaselineReport();
```
