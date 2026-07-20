# Dynamic Webs

Dynamic Webs is a standalone Foundry Virtual Tabletop module that procedurally generates and renders deterministic spider webs as Scene-owned environmental scenery.

The web subsystem was extracted from Ambient Critters. Dynamic Webs is now the sole owner of web generation, geometry, rendering, Scene configuration, lifecycle and future generic web interactions. Consumer modules integrate through the public API and hooks rather than importing Dynamic Webs internals.

## Project status

- **Module name:** Dynamic Webs
- **Module ID:** `dynamic-webs`
- **Runtime namespace:** `dynamicWebs`
- **Public API version:** `1`
- **Blueprint schema version:** `1`
- **Baseline diagnostic schema version:** `1`
- **Minimum Foundry version:** v13
- **Verified Foundry version:** v14
- **Current version:** `0.1.0`
- **Entry point:** `scripts/dynamic-webs.js`
- **Baseline hardening:** complete

Suggested development location:

```text
D:\FoundryVTT\Data\modules\dynamic-webs
```

## Current functionality

Dynamic Webs generates three web categories.

### Wall-corner webs

Corner webs are generated where compatible structural wall segments form suitable corners.

Current characteristics include:

- Irregular wall anchors
- Curved structural strands
- Partial capture arcs
- Outward-facing gaps
- Optional wall and corner supports
- Loose decorative strands
- Size-dependent detail

### Wall-span webs

Span webs stretch across narrow passages between suitable opposing structural walls.

Current design constraints include:

- Maximum cross-passage distance of approximately `1.5 × Scene grid size`
- Preferred total length of approximately `0.9–1.35 × passage width`
- Total organic web length of approximately `0.8–1.6 grid units`
- Spacing and count limits supplied by the selected density preset

The cross-passage limit is deliberately conservative so span webs appear in narrow corridors rather than across large rooms.

### Ground webs

Ground webs are generated freely inside the active Scene rectangle. They use deterministic irregular radial geometry and do not require wall anchors.

## Scene configuration

Dynamic Webs owns one Scene-level flag:

```text
flags.dynamic-webs.webDensity
```

Supported values are:

- `disabled`
- `sparse`
- `standard`
- `dense`
- `infested`

The Scene Configuration interface contains a standalone **Dynamic Webs** tab with one **Web density** selector.

There is intentionally no:

- Separate enable checkbox
- Editable seed field
- Regenerate button
- Per-Scene geometry editor
- Per-category count input

The default Scene value is authored in:

```text
data/scene-configuration-defaults.json
```

Density presets are authored in:

```text
data/webs/presets.json
```

Shared generation and rendering defaults are authored in:

```text
data/webs/defaults.json
```

Runtime JavaScript consumes validated JSON-authored values rather than duplicating them as constants.

## Deterministic generation contract

Web geometry is deterministic and precomputed during lifecycle rebuilds. It is not recalculated every animation frame.

The Scene seed format for blueprint schema version 1 is:

```text
dynamic-webs:web-generation:v2:<scene-id>
```

Each category receives an independent random stream:

```text
dynamic-webs:web-generation:v2:<scene-id>:wall-corner
dynamic-webs:web-generation:v2:<scene-id>:wall-span
dynamic-webs:web-generation:v2:<scene-id>:ground
```

Equivalent Scene geometry, configuration, module version and blueprint schema should reproduce equivalent web populations across:

- Canvas reloads
- Scene reopening
- Client refreshes
- Repeated generation
- Equivalent lifecycle rebuilds

Changing one category's authored options should not unnecessarily reshuffle unrelated categories.

Determinism is scoped to the current generation and schema contracts. A deliberate future schema or seed-version change may produce new identifiers and geometry and must be documented as a migration boundary.

## Blueprint and identifier contract

Every generated web and strand uses blueprint schema version `1`.

### Stable web identifiers

Web identifiers are Scene-qualified and use this format:

```text
<web-kind>:<encoded-scene-id>:<encoded-source-key>
```

Supported web kinds are:

```text
wall-corner
wall-span
ground
```

Examples of category-local source keys include:

- Ground webs: deterministic population index
- Corner webs: sorted supporting wall IDs plus rounded corner coordinates
- Span webs: opposing-wall corridor key plus rounded midpoint coordinates

Identifier components are encoded with `encodeURIComponent()` before being joined. Consumers must treat the complete identifier as opaque rather than parsing it for gameplay logic.

### Stable strand identifiers

Strand identifiers are qualified by their owning web:

```text
<web-id>:<encoded-local-strand-id>
```

Each strand also retains its stable web-local `localId`.

Supported strand roles are:

```text
structural
capture
decorative
```

### Stability guarantees

For equivalent inputs under the same schema and seed versions:

- Web identifiers are unique within the generated Scene population.
- Strand identifiers are unique within the generated Scene population.
- Repeated generation reproduces equivalent identifiers and geometry.
- Category streams remain independent.
- Public geometry is deeply immutable.

Identifiers are not promised to survive a documented blueprint-schema or seed-version migration unchanged.

## Immutable geometry

Generated web blueprints contain plain data only. They include information such as:

- Schema version
- Stable web identifier
- Owning Scene identifier
- Generation seed
- Stable source key
- Web kind
- Hub point
- Bounds
- Immutable strand array
- Optional perches
- Supporting wall identifiers

Strands include:

- Schema version
- Stable global identifier
- Stable local identifier
- Functional role
- Immutable sampled points
- Visual alpha
- Visual width
- Functional collision width

Visual width and interaction width are separate concerns. A thin-looking strand may use a wider interaction tolerance for reliable future intersection testing.

The web population array, every blueprint, every strand, every point array and every point are frozen.

## Rendering

Dynamic Webs renders into its own transient PIXI container:

```text
dynamic-webs.webs
```

Generated webs are local runtime rendering objects, not Foundry embedded documents.

Dynamic Webs does not create:

- Tokens
- Tiles
- Drawings
- Regions
- Measured templates
- Walls
- Other Scene embedded documents

Repeated generation destroys and replaces the current container rather than stacking duplicate containers or graphics. A failed partial render is cleaned up before the error is propagated.

## Lifecycle

Dynamic Webs owns its lifecycle independently of Ambient Critters.

### Canvas ready

On `canvasReady`:

1. Read `flags.dynamic-webs.webDensity`.
2. Clear webs when density is `disabled`.
3. Generate webs when density is active.
4. Render the immutable blueprints.

### Canvas teardown

On `canvasTearDown`:

- Cancel pending rebuilds.
- Destroy the Dynamic Webs PIXI container.
- Clear local blueprint state.
- Clear transient rendering references.

### Scene deletion

When the displayed Scene is deleted:

- Cancel pending rebuilds.
- Clear active Dynamic Webs state.
- Destroy the local render container.

### Scene updates

When the active Scene density changes:

- `disabled` clears current webs.
- An active preset regenerates and renders the Scene.

Relevant Scene geometry changes schedule a rebuild. Unrelated flags belonging to other modules do not rebuild Dynamic Webs.

### Wall lifecycle

Dynamic Webs listens for:

- `createWall`
- `updateWall`
- `deleteWall`

Relevant changes trigger a debounced rebuild, currently using `200 ms`.

Rebuild-triggering changes include:

- Wall creation
- Wall deletion
- Wall coordinate or geometry changes
- Door classification changes where classification affects eligibility

Door walls are currently excluded from structural web generation. Opening or closing an existing door does not regenerate webs.

## Public API

The public namespace is exposed through:

```javascript
globalThis.dynamicWebs
```

It is also available from the Foundry module record:

```javascript
game.modules.get("dynamic-webs")?.api
```

The current API version is `1`.

### Runtime state

```javascript
dynamicWebs.api.getState();
dynamicWebs.api.webs.getState();
```

Returned state is an immutable snapshot. Consumers do not receive direct access to PIXI objects, internal Maps, mutable arrays, generation services or random generators.

### Web operations

```javascript
dynamicWebs.api.webs.generate();
dynamicWebs.api.webs.generate(options);
dynamicWebs.api.webs.clear();
```

`generate()` and `clear()` are GM-only administrative operations.

Manual generation is intended for diagnostics and development. Normal use should rely on Scene configuration and lifecycle generation.

`clear()` removes local generated geometry and rendering without changing the persisted Scene density flag.

### Scene density

```javascript
dynamicWebs.api.scene.getDensity();
dynamicWebs.api.scene.getDensity(sceneId);

await dynamicWebs.api.scene.setDensity("dense");
await dynamicWebs.api.scene.setDensity("dense", sceneId);
```

Changing density is GM-only and is persisted through `Scene.setFlag()`.

### Baseline diagnostics

```javascript
dynamicWebs.api.diagnostics.getBaselineReport();
dynamicWebs.api.diagnostics.showBaselineReport();
```

`getBaselineReport()` returns a deeply frozen report.

`showBaselineReport()` opens the same report in a large copyable textarea and returns it.

The report includes:

- Module, public API, blueprint and diagnostic schema versions
- Foundry version and generation
- Active Scene, density and geometry summary
- Generation reason, timestamps and category seeds
- Web counts by category
- Strand counts by role
- Render-container status and rendered identifiers
- Lifecycle registration, debounce and pending-rebuild state
- Identifier uniqueness
- Schema and immutability checks
- A non-destructive determinism comparison
- Canonical generation hashes
- Comparison with the active runtime population

The determinism check regenerates plain blueprints twice and does not alter runtime state, rendering, Scene flags or Foundry documents.

## Current hooks

Dynamic Webs currently emits:

```javascript
Hooks.callAll("dynamic-webs.init", namespace);
Hooks.callAll("dynamic-webs.ready", namespace);
Hooks.callAll("dynamic-webs.stateChanged", snapshot, { reason });
Hooks.callAll("dynamic-webs.diagnostic", diagnostic);
```

Hook payloads expose namespace objects, immutable snapshots or structured diagnostics rather than mutable PIXI internals.

Future interaction hooks must remain generic and versioned.

## Architectural boundary

Dynamic Webs is an independent environmental system.

It owns:

- Web generation
- Web geometry
- Web rendering
- Density presets
- Scene configuration
- Wall-change rebuilding
- Canvas lifecycle
- Runtime state
- Diagnostics
- Future level awareness
- Future spatial queries
- Future strand damage
- Future generic web interactions

Dynamic Webs remains unaware of specific creature species and contains no direct logic for spiders, flies, bats, ants or Ambient Critters populations.

Ambient Critters and other modules may integrate through:

```javascript
game.modules.get("dynamic-webs")?.api
```

or:

```javascript
globalThis.dynamicWebs?.api
```

They must not import files from:

```text
modules/dynamic-webs/scripts/...
```

## Immutable geometry and future mutable state

Generated geometry remains immutable. Future interaction state will be stored separately and reconciled through stable identifiers, for example:

```javascript
{
  webId: "<stable-web-id>",
  brokenStrandIds: [
    "<stable-web-qualified-strand-id>"
  ],
  occupiedByEntityIds: [],
  trappedEntityIds: [],
  revision: 3
}
```

This separation supports:

- Stable deterministic geometry
- Broken strands
- Trapped entities
- Spider occupancy
- Network synchronisation
- Optional persistence
- Reconciliation after deterministic regeneration

## Planned generic interaction model

Dynamic Webs may later support generic policies such as:

- `ignore`
- `traverse`
- `avoid`
- `trap`
- `break`

Possible generic outcomes include:

- `NO_INTERACTION`
- `TRAVERSED`
- `TRAPPED`
- `STRAND_BROKEN`
- `WEB_COLLAPSED`
- `PASSAGE_BLOCKED`

Dynamic Webs should calculate geometric outcomes and update generic web state. Consumer modules should decide how their entities react.

See [roadmap.md](roadmap.md) for the dependency-ordered implementation sequence.

## Module structure

```text
dynamic-webs/
├── module.json
├── package.json
├── README.md
├── roadmap.md
├── data/
│   ├── scene-configuration-defaults.json
│   └── webs/
│       ├── defaults.json
│       └── presets.json
├── scripts/
│   ├── dynamic-webs.js
│   ├── api.js
│   ├── api/
│   ├── config/
│   ├── data/
│   ├── diagnostics/
│   ├── foundry/
│   ├── lifecycle/
│   ├── module/
│   ├── rendering/
│   │   └── webs/
│   ├── runtime/
│   │   └── webs/
│   ├── simulation/
│   │   └── webs/
│   ├── ui/
│   └── util/
├── templates/
│   └── ui/
│       └── scene-config.hbs
├── tests/
└── tools/
    └── check-syntax.mjs
```

## Validation

Use Node.js from the module root.

Run the complete release validation:

```bash
npm run validate
```

This performs:

```bash
npm run check:syntax
npm run test:v01
```

Individual commands are also available:

```bash
npm test
npm run test:v01
npm run check:syntax
```

The v0.1 regression suite covers:

- JSON parsing and strict data contracts
- JavaScript syntax
- Module imports and entrypoint registration
- Manifest and package alignment
- Scene configuration and flag paths
- Deterministic category generation
- Stable web and strand identifiers
- Blueprint integrity and deep immutability
- Rendering replacement and cleanup
- Runtime generation and failure handling
- Canvas and Scene lifecycle
- Debounced wall rebuilds
- Foundry geometry compatibility adapters
- Public API immutability and GM permissions
- Baseline diagnostic and determinism reporting
- Documentation and release-contract drift

## Live Foundry release verification

Automated validation does not replace a final Foundry smoke test.

For each supported Foundry generation:

1. Install the current module files.
2. Enable Dynamic Webs.
3. Open a Scene with structural walls.
4. Test `disabled`, `sparse`, `standard`, `dense` and `infested`.
5. Reload the canvas and reopen the Scene.
6. Create, move and delete a wall.
7. Confirm repeated generation replaces rather than stacks rendering.
8. Run:

```javascript
dynamicWebs.api.diagnostics.showBaselineReport();
```

The report should show:

- `runtimeReady: true`
- Matching generated and rendered web counts
- No duplicate web or strand identifiers
- All schema checks true
- All immutability checks true
- No pending lifecycle rebuild after the debounce settles
- `deterministic: true`
- `matchesRuntimeState: true`

Complete this smoke test on both Foundry v13 and v14 before publishing a release package.

## Design constraints

Development must preserve these rules:

1. **Preserve deterministic generation.**  
   Unchanged inputs must not randomly reshuffle the Scene.

2. **Do not generate geometry per frame.**  
   Generation belongs to lifecycle rebuilds, not rendering tickers.

3. **Separate immutable geometry from mutable state.**  
   Breaking a strand must not rewrite its source blueprint.

4. **Keep Dynamic Webs critter-agnostic.**  
   Creature-specific policy belongs in consumer modules.

5. **Avoid god files.**  
   Use focused services and classes for generation, rendering, runtime state, configuration, wall lifecycle, compatibility, spatial queries and interactions.

6. **Maintain Foundry v13 and v14 compatibility.**  
   Version differences belong in dedicated compatibility adapters.

7. **Keep authored data in JSON.**  
   Density values, visual profiles and rendering defaults must not drift into duplicated JavaScript constants.

8. **Expose frozen public data.**  
   Public APIs and hooks must not leak mutable internal state or rendering objects.

## Development workflow

Feature work follows this process:

1. Supply a feature request with the current module relationship map.
2. Review the map and return one explicit file list.
3. Supply the requested files.
4. Inspect only supplied source.
5. Produce a ZIP containing real replacement files at their correct relative paths.
6. Install the replacement files.
7. Run the relevant automated and browser-console checks.

Ambient Critters may be inspected as a reference implementation, but Dynamic Webs must independently implement equivalent behaviour and must not depend on Ambient Critters internals.
