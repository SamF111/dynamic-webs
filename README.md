# Dynamic Webs

Dynamic Webs is a standalone Foundry Virtual Tabletop module for procedurally generating and rendering deterministic spider webs as Scene-owned environmental scenery.

It was extracted from the former web subsystem in Ambient Critters. Dynamic Webs is now the sole owner of web generation, geometry, rendering, Scene configuration, lifecycle and future generic web interactions.

## Project status

- **Module name:** Dynamic Webs
- **Module ID:** `dynamic-webs`
- **Runtime namespace:** `dynamicWebs`
- **Minimum Foundry version:** v13
- **Verified Foundry version:** v14
- **Current version:** 0.1.0
- **Entry point:** `scripts/dynamic-webs.js`

Suggested development location:

```text
D:\FoundryVTT\Data\modules\dynamic-webs
```

## Current functionality

Dynamic Webs currently generates three web categories.

### Wall-corner webs

Corner webs are generated where compatible wall segments form suitable corners.

Current characteristics include:

- Irregular anchors
- Curved structural strands
- Partial capture arcs
- Outward-facing gaps
- Wall support strands
- Loose decorative strands
- Size-dependent detail

### Wall-span webs

Span webs stretch across narrow passages between suitable opposing walls.

Current design constraints include:

- Maximum cross-passage distance of approximately `1.5 × Scene grid size`
- Preferred span length of approximately `0.9–1.35 × passage width`
- Total organic web length of approximately `0.8–1.6 grid units`

The cross-passage limit is deliberately conservative so span webs appear in narrow corridors rather than across large rooms.

### Ground webs

Ground webs are generated freely across the Scene.

They use the same general organic radial visual language as supported webs but do not require wall anchors.

## Scene configuration

Dynamic Webs owns one Scene-level flag:

```text
flags.dynamic-webs.webDensity
```

Supported values:

- `disabled`
- `sparse`
- `standard`
- `dense`
- `infested`

The Scene Configuration interface contains a standalone Dynamic Webs tab with one Web density selector.

There is intentionally no:

- Separate enable checkbox
- Editable seed field
- Regenerate button
- Per-Scene geometry editor
- Per-category count input

Density presets are authored in:

```text
data/webs/presets.json
```

Shared generation and rendering defaults are authored in:

```text
data/webs/defaults.json
```

Runtime JavaScript should consume these JSON-authored values rather than duplicate them as constants.

## Deterministic generation

Web geometry is deterministic and precomputed.

The current Scene seed format is:

```text
dynamic-webs:web-generation:v2:<scene-id>
```

Equivalent Scene configuration and wall geometry should reproduce equivalent web populations across:

- Canvas reloads
- Scene reopening
- Client refreshes
- Repeated generation
- Equivalent lifecycle rebuilds

Each web category should use an independent deterministic random stream so changes to one category do not unnecessarily reshuffle unrelated categories.

Geometry is generated during lifecycle rebuilds and stored as immutable blueprints. It must not be recalculated every animation frame.

## Geometry model

Each web contains deterministic strand data such as:

- Stable web and strand identifiers
- Points or curved segments
- Visual width
- Visual alpha
- Functional role
- Resolved visual properties

Current strand roles are conceptually:

- `structural`
- `capture`
- `decorative`

Visual width and functional interaction width are separate concerns. A thin-looking strand may use a wider interaction tolerance for reliable collision or intersection testing.

## Rendering

Dynamic Webs renders into its own transient PIXI container:

```text
dynamic-webs.webs
```

Generated webs are runtime rendering objects, not Foundry embedded documents.

Dynamic Webs does not create:

- Tokens
- Tiles
- Drawings
- Regions
- Measured templates
- Walls
- Other Scene embedded documents

Repeated generation replaces the current container contents rather than stacking duplicate containers or graphics.

## Lifecycle

Dynamic Webs owns its lifecycle independently of Ambient Critters.

### Canvas ready

On `canvasReady`:

1. Read `flags.dynamic-webs.webDensity`.
2. Clear webs when density is `disabled`.
3. Generate webs when density is active.
4. Render the generated immutable blueprints.

### Canvas teardown

On `canvasTearDown`:

- Cancel pending rebuilds.
- Destroy the Dynamic Webs PIXI container.
- Clear local blueprint state.
- Clear transient rendering references.

### Scene deletion

When the displayed Scene is deleted:

- Clear active Dynamic Webs state.
- Destroy the local render container.

### Scene update

When the active Scene density changes:

- `disabled` clears the current webs.
- An active preset regenerates and renders the Scene.

Unrelated flags belonging to other modules must not rebuild Dynamic Webs.

## Wall lifecycle

Dynamic Webs listens for:

- `createWall`
- `updateWall`
- `deleteWall`

Relevant changes trigger a debounced rebuild, currently targeting approximately 200 ms.

Rebuild-triggering changes include:

- Wall creation
- Wall deletion
- Wall coordinate changes
- Wall geometry changes
- Wall eligibility changes
- Door classification changes where classification affects eligibility

Opening or closing a door should not regenerate webs unless door state becomes part of the explicit eligibility rules.

Dynamic Webs must not depend on Ambient Critters wall services.

## Public API

The public namespace is exposed through:

```javascript
globalThis.dynamicWebs
```

It is also available from the Foundry module record:

```javascript
game.modules.get("dynamic-webs")?.api
```

Current operations include:

```javascript
dynamicWebs.api.getState();

dynamicWebs.api.webs.getState();
dynamicWebs.api.webs.generate();
dynamicWebs.api.webs.clear();

dynamicWebs.api.scene.getDensity();
await dynamicWebs.api.scene.setDensity("dense");
```

Normal users should rely on Scene configuration and automatic lifecycle generation. Manual generation remains useful for diagnostics and development.

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
- Future level awareness
- Future spatial queries
- Future strand damage
- Future generic web interactions

Dynamic Webs must remain unaware of specific creature species and must not contain direct logic for spiders, flies, bats, ants or Ambient Critters populations.

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

## Immutable geometry and mutable state

Generated web geometry is immutable.

Future interaction state must be stored separately, for example:

```javascript
{
  webId: "wall-corner-12",
  brokenStrandIds: [
    "strand-4",
    "strand-8"
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
- Reconciliation against stable web and strand identifiers

## Planned generic interaction model

Dynamic Webs should support generic interaction policies such as:

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

Dynamic Webs should calculate geometry intersections and update web state. Consumer modules should decide how their entities react to those outcomes.

## Future feature scope

Planned feature areas include:

- Coloured webs
- Level-aware web populations
- Region-aware web generation and behaviour
- Read-only spatial queries
- Web carpets
- Mutable strand damage
- Tokens destroying webs
- Persistent and synchronised web state
- Generic occupancy and trapping
- Optional Ambient Critters integration through the public API

See [roadmap.md](roadmap.md) for the recommended implementation sequence.

## Proposed future API

The public API should eventually expose immutable query results:

```javascript
dynamicWebs.api.getState();
dynamicWebs.api.getWebs();
dynamicWebs.api.getWeb(webId);

dynamicWebs.api.queryNearby(point, options);
dynamicWebs.api.queryStrands(bounds, options);
dynamicWebs.api.findCompatibleWebs(options);
dynamicWebs.api.findPerches(options);

dynamicWebs.api.breakStrand(webId, strandId, options);
dynamicWebs.api.restoreStrand(webId, strandId, options);
dynamicWebs.api.resetWeb(webId);
```

Consumers must never receive direct mutable access to:

- PIXI containers
- PIXI Graphics objects
- Internal Maps
- Mutable strand arrays
- Internal generation services
- Internal random generators

## Proposed hooks

Future hooks should remain generic:

```javascript
Hooks.callAll("dynamicWebs.ready", api);
Hooks.callAll("dynamicWebs.stateChanged", payload);
Hooks.callAll("dynamicWebs.webGenerated", payload);
Hooks.callAll("dynamicWebs.strandBroken", payload);
Hooks.callAll("dynamicWebs.entityIntersectedStrand", payload);
```

Hook payloads should contain stable identifiers and immutable snapshots rather than mutable rendering objects.

## Module structure

The module currently follows this general structure:

```text
dynamic-webs/
├── module.json
├── package.json
├── data/
│   └── webs/
│       ├── defaults.json
│       └── presets.json
├── scripts/
│   ├── dynamic-webs.js
│   ├── api.js
│   ├── api/
│   ├── config/
│   ├── data/
│   ├── foundry/
│   ├── lifecycle/
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
└── tests/
```

The initial extraction intentionally mirrored the previously working implementation. Behavioural equivalence took priority over redesign.

## Design constraints

Development must preserve the following rules:

1. **Preserve deterministic generation.**  
   Unchanged inputs must not randomly reshuffle the Scene.

2. **Do not generate geometry per frame.**  
   Generation belongs to lifecycle rebuilds, not rendering tickers.

3. **Separate immutable geometry from mutable state.**  
   Breaking a strand must not rewrite its source blueprint.

4. **Keep Dynamic Webs critter-agnostic.**  
   Creature-specific policy belongs in consumer modules.

5. **Avoid god files.**  
   Use focused services and classes for generation, rendering, runtime state, configuration, wall lifecycle, level awareness, spatial queries and interactions.

6. **Maintain Foundry v13 and v14 compatibility.**  
   Version differences belong in dedicated compatibility adapters.

7. **Keep authored data in JSON.**  
   Density values, colour profiles and rendering defaults should not drift into duplicated JavaScript constants.

## Development workflow

Feature work follows this process:

1. A feature request is supplied with the current module relationship map.
2. The relationship map is reviewed.
3. One explicit list of required files is returned for inspection.
4. The requested files are supplied.
5. A downloadable zip is produced containing real replacement files with correct relative paths.
6. The replacement files are installed.
7. A browser-console diagnostic or test command is provided when appropriate.

Ambient Critters may be inspected as a reference implementation, but Dynamic Webs must independently implement equivalent behaviour. It must not depend on Ambient Critters internals.

## Testing expectations

Every substantial change should preserve or add coverage for:

- JSON parsing and data contracts
- JavaScript syntax
- Module imports
- Bootstrap construction
- Scene configuration integration
- Deterministic generation
- Stable web and strand identifiers
- Rendering replacement without stacking
- Canvas lifecycle
- Scene lifecycle
- Wall rebuild debouncing
- Foundry v13 compatibility
- Foundry v14 compatibility
- Public API snapshots
- Multi-level behaviour when implemented
- Region overlap behaviour when implemented
- Multi-client mutation behaviour when implemented
