# Dynamic Webs

Dynamic Webs is a standalone Foundry Virtual Tabletop module that procedurally generates deterministic spider webs as Scene-owned environmental scenery.

The module owns web generation, immutable geometry, rendering, modular Scene configuration, level awareness, lifecycle and future generic web interactions. Ambient Critters and other consumers integrate only through the public API and hooks.

## Project status

- **Module ID:** `dynamic-webs`
- **Runtime namespace:** `dynamicWebs`
- **Current version:** `0.5.0`
- **Public API version:** `1`
- **Blueprint schema version:** `5`
- **Diagnostic schema version:** `1`
- **Minimum Foundry version:** v13
- **Verified Foundry version:** v14
- **Entry point:** `scripts/dynamic-webs.js`

## Generated web categories

Dynamic Webs currently generates:

- **Wall-corner webs** from compatible same-level structural wall corners.
- **Wall-span webs** across suitable narrow same-level passages.
- **Ground webs** at deterministic positions inside the Scene rectangle.
- **Web carpets** are reserved as a future category and do not yet generate geometry.

## Modular Scene web populations

Version `0.4.0` builds on the former Scene-wide density, colour and thickness model with explicit modular populations.

The authoritative Scene flag is:

```text
flags.dynamic-webs.webPopulations
```

An empty population array means that the Scene generates no webs. There is no implicit population and no fallback from the former pre-release Scene-wide flags.

Each population independently stores:

```javascript
{
  id: "web-r7Kp2mN4xQ8vT3sL",
  enabled: true,
  levelId: "level-10",
  confineRegionTags: ["crypt", "area-*"],
  excludeRegionTags: ["altar"],
  categoryDensities: {
    "wall-corner": "dense",
    "wall-span": "dense",
    ground: "dense",
    "web-carpet": "disabled"
  },
  colourProfileId: "blood-red",
  thicknessMultiplier: 1.5
}
```

Supported density states are:

```text
disabled → sparse → standard → dense → infested
```

The Dynamic Webs Scene Configuration tab provides collapsible population cards with:

- Enabled state
- Target level
- A nested **Regions** section containing Confine and Exclude tag fields
- A nested **Web options** section containing corner, span, ground and reserved carpet density controls
- A nested **Appearance** section containing web colour and visible thickness
- Duplicate and remove actions

No population card is expanded automatically. The nested Regions, Web options and Appearance sections also start collapsed and retain their state while the rendered form remains open. Adding or duplicating a card expands only the new outer card and collapses the others. Card headings such as `Web Population 1` are presentation-only and are recalculated from card order.

Each population receives a hidden opaque ID such as `web-r7Kp2mN4xQ8vT3sL`. The ID is generated once, persisted with the population and never changes when its level, densities, colour, thickness, order or neighbouring populations change. Duplicating a population creates a fresh ID. Removing a population removes only that ID.

New populations start enabled with every density slider at the middle `standard` state. This default is authored as `webPopulationDensity` in `data/scene-configuration-defaults.json`.

Multiple populations may target the same level. This allows combinations such as sparse blue corner webs and dense red ground webs on one floor.

## Region-aware generation

Each population may independently configure:

- **Confine to Region tags** — generate only when every visible strand segment remains inside the union of same-level Regions matching at least one configured tag.
- **Exclude Region tags** — reject a complete candidate when any visible strand touches or enters a same-level Region matching a configured tag. Exclude takes precedence over Confine.

Tags use the same authoring syntax as Ambient Critters: comma- or line-separated values, lower-case slug normalisation, deduplication, and optional `*` wildcards in population role fields. A tag cannot be reused in both Confine and Exclude for the same population.

Dynamic Webs adds its own Region Configuration tab storing tags at:

```text
flags.dynamic-webs.regionTags
```

For a unified authoring experience, Dynamic Webs also recognises existing tags stored by Ambient Critters at `flags.ambient-critters.regionTags`. This is read-only interoperability; neither module imports the other's source code.

Region acceptance is evaluated against complete generated strand polylines. Adjacent or overlapping Confine Regions form one allowed union, but an unassigned gap is not allowed. Candidates are rejected rather than clipped, so accepted strands retain their deterministic organic geometry. Foundry's native Region point test is authoritative when available; serialised rectangle, ellipse and polygon records are compatibility fallbacks.

Web carpets will require their own boundary-aware area generation in their later milestone.

## Level provider

The world-scoped **Level Awareness Provider** setting matches Ambient Critters' provider interface:

- **Foundry v14 and later:** the provider setting is hidden and native Scene elevation is used automatically.
- **Foundry v13 with theripper93's Levels active:** the setting offers `Base Level only` and `theripper93's Levels`.
- **Foundry v13 without Levels:** the single Base Level choice is disabled and visually muted.

Every population targets exactly one detected level. If its saved level is unavailable, the population remains configured but does not generate until the GM selects a valid level.

Wall-corner and wall-span webs use only walls assigned to the population's selected level. Ground webs are also generated only on that level.

## Colour profiles

Authored profiles are stored in `data/webs/colours.json`:

- `natural-white`
- `dusty-grey`
- `yellowed`
- `black`
- `blood-red`
- `arcane-blue`
- `toxic-green`

Colour is owned by each population. Profiles resolve structural, capture and decorative strand colours, under-stroke colour and alpha multiplier onto immutable strand blueprints.

## Visible thickness

Each population owns a thickness multiplier from `0.5×` to `4×`, using `0.25×` Scene Configuration steps.

Thickness is stored on the immutable web blueprint and applied by the renderer. It does not change strand points, base `widthPx`, functional `collisionWidthPx`, bounds, supports or perches.

## Deterministic generation

Geometry is generated during lifecycle rebuilds, never per frame.

The modular seed root is:

```text
dynamic-webs:web-generation:v4:<scene-id>:<encoded-population-id>
```

Each population and category receives an isolated stream:

```text
dynamic-webs:web-generation:v4:<scene-id>:<population-id>:<level-id>:wall-corner
dynamic-webs:web-generation:v4:<scene-id>:<population-id>:<level-id>:wall-span
dynamic-webs:web-generation:v4:<scene-id>:<population-id>:<level-id>:ground
```

Changing one population does not reshuffle another population. Changing one category does not reshuffle unrelated categories within the same population.

## Blueprint contract

Every web and strand uses blueprint schema version `5`.

Web IDs are Scene-, population- and level-qualified:

```text
<web-kind>:<encoded-scene-id>:<encoded-population-id>:<encoded-level-id>:<encoded-source-key>
```

Every web blueprint includes:

- `populationId`
- `populationLabel`, currently an internal alias of the opaque `populationId`
- `thicknessMultiplier`
- `levelProviderMode`
- `levelId`
- immutable `elevationBand`
- `colourProfileId`
- generation seed and source key
- controlling `regionIds` and matched `regionTags`
- immutable geometry, strands, perches and supporting wall IDs

Strand IDs remain qualified by their web ID:

```text
<web-id>:<encoded-local-strand-id>
```

Consumers must treat all complete identifiers as opaque.

## Rendering and visibility

Dynamic Webs renders into one transient PIXI container per visible elevation band:

```text
dynamic-webs.webs
dynamic-webs.webs.level-<index>.elevation-<bottom>
```

Single-level rendering retains the stable `dynamic-webs.webs` name. When several elevation bands are visible, Dynamic Webs creates separate sibling containers so each floor sorts independently against Foundry and Levels tiles. Generated webs are not embedded Foundry documents. Repeated synchronisation destroys and replaces the complete module-owned container set rather than stacking graphics.

The runtime stores every generated population. GMs and players render the active viewed level plus every detected level below it. A token on elevation `10` can therefore see webs on elevations `10` and `0`, while a token on elevation `0` cannot see elevation `10` webs. Viewed-level changes replace only the visible subset and do not regenerate geometry.

Each transient render container is stamped with its own level's point elevation as well as the Primary Canvas sort band, placing same-floor webs above tiles and drawings but below tokens while preserving correct cross-floor ordering in v13 Levels and v14 native elevation.

The renderer resolves thickness per web, so populations with different multipliers can render together safely.

## Lifecycle

On `canvasReady` Dynamic Webs:

1. Resolves the global level provider.
2. Reads and validates `flags.dynamic-webs.webPopulations`.
3. Resolves the selected level and category presets for each enabled population.
4. Skips populations with unavailable levels or no implemented active category.
5. Generates each population from isolated deterministic streams.
6. Stores all immutable blueprints.
7. Renders the level-compatible subset.

Population-array changes perform one deterministic regeneration. Scene geometry, structural wall, Region geometry/tag/elevation, and level-document changes also regenerate. Viewed-level changes only refresh visibility.

Canvas teardown, Scene deletion and module disposal destroy local rendering and clear transient geometry.

## Spatial index and read-only queries

Version `0.5.0` builds a runtime-only uniform-grid spatial index after each successful deterministic geometry replacement. The index contains all stored web levels, whether or not those levels are currently rendered. Viewed-level changes therefore do not rebuild or discard spatial data, and cumulative downward visibility does not imply cross-level physical compatibility. Consumers should supply an explicit `levelId`, `elevation`, or `elevationBand` whenever level compatibility matters.

Indexed records include:

- Web and functional strand bounds
- Population, level and elevation ownership
- Web category and strand role
- Region identifiers and tags
- Functional `collisionWidthPx` as `interactionWidthPx`
- Immutable perch points
- A provisional `intact: true` field reserved for the later mutable-state milestone

The public read-only API is:

```javascript
dynamicWebs.api.getWebs();
dynamicWebs.api.getWeb(webId);

dynamicWebs.api.queryNearby(
  { x: 1200, y: 800 },
  { levelId: "level-10", maximumDistancePx: 100 }
);

dynamicWebs.api.queryStrands(
  { x: 1000, y: 700, width: 400, height: 300 },
  { strandRoles: ["capture", "decorative"], limit: 50 }
);

dynamicWebs.api.findCompatibleWebs({
  levelId: "level-10",
  categories: ["wall-corner", "wall-span"],
  regionTag: "crypt"
});

dynamicWebs.api.findPerches({
  levelId: "level-10",
  maximumDistancePx: 250,
  point: { x: 1200, y: 800 }
});

dynamicWebs.api.spatial.getDiagnostics();
```

Shared filters support level IDs, population IDs, web categories, Region IDs or tags, elevation points or bands, strand roles, minimum functional interaction width, maximum distance and a bounded result limit. Results use stable distance-and-identifier ordering and are deeply frozen plain snapshots. No PIXI objects, internal Maps, Sets or mutable service references are exposed.

`queryNearby()` performs a uniform-grid broad-phase followed by a precise point-to-polyline distance check that includes the strand's functional interaction width. `queryStrands()` returns strands whose functional broad-phase bounds overlap the supplied rectangle. Presentation-only colour or thickness remapping refreshes indexed snapshots without rebuilding cells; visible-level changes leave both geometry and query snapshots unchanged.

## Public API

The API is available through:

```javascript
globalThis.dynamicWebs.api
game.modules.get("dynamic-webs")?.api
```

### Population configuration

```javascript
dynamicWebs.api.scene.getPopulations();
dynamicWebs.api.scene.getPopulation("web-r7Kp2mN4xQ8vT3sL");

await dynamicWebs.api.scene.setPopulations([
  {
    id: "web-r7Kp2mN4xQ8vT3sL",
    enabled: true,
    levelId: "level-0",
    confineRegionTags: ["crypt"],
    excludeRegionTags: ["altar"],
    categoryDensities: {
      "wall-corner": "standard",
      "wall-span": "standard",
      ground: "disabled",
      "web-carpet": "disabled"
    },
    colourProfileId: "arcane-blue",
    thicknessMultiplier: 1
  }
]);
```

Population mutations are GM-only and replace the complete Scene population array in one flag update.

### Runtime and administrative operations

```javascript
dynamicWebs.api.getState();
dynamicWebs.api.getWebs();
dynamicWebs.api.getWeb(webId);
dynamicWebs.api.queryNearby(point, options);
dynamicWebs.api.queryStrands(bounds, options);
dynamicWebs.api.findCompatibleWebs(options);
dynamicWebs.api.findPerches(options);

dynamicWebs.api.webs.getState();
dynamicWebs.api.webs.generate();
dynamicWebs.api.webs.clear();
dynamicWebs.api.levels.getState();
dynamicWebs.api.spatial.getDiagnostics();
```

`generate()` and `clear()` are GM-only. Normal operation should use Scene Configuration and lifecycle synchronisation.

### Colour profile lookup

```javascript
dynamicWebs.api.colours.getProfiles();
dynamicWebs.api.colours.getProfile("blood-red");
```

All public snapshots are frozen and contain no PIXI references or mutable internal collections.

## Diagnostics

Run:

```javascript
dynamicWebs.api.diagnostics.showBaselineReport();
```

The copyable report includes:

- Module, API, blueprint and diagnostic schema versions
- Requested and resolved level provider
- Detected levels and wall counts by level
- Configured and active modular populations
- Unavailable population IDs
- Population seeds and category seeds
- Web and strand counts by population, level and category
- Population colours, thickness multipliers, and Region restrictions
- Rendered versus stored counts
- Spatial-index revision, cell size, indexed counts and query candidate/result telemetry
- Identifier uniqueness
- Same-level wall-support checks
- Population and Region ownership and immutability checks
- Non-destructive determinism hashes

## Architectural boundary

Dynamic Webs remains critter-agnostic. It owns environmental web geometry and generic state only. Ambient Critters must use the public API and hooks and must never import files from `modules/dynamic-webs/scripts/...`.

Web carpets, mutable strand state, barriers, token destruction, persistence, trapping and occupancy must build on stable population-qualified identifiers.

## Validation

From the module root:

```bash
npm run validate
```

This runs JavaScript syntax checks and the complete Node regression suite.

Automated validation must be followed by live Foundry smoke tests in v13 and v14, including:

- Adding, duplicating and removing populations
- Different populations on different levels
- Different colours and thicknesses on the same level
- Empty population arrays
- Missing saved levels
- Wall creation, movement and deletion
- Region creation, geometry edits, elevation changes, tag changes and deletion
- Confine/Exclude combinations, wildcard tags, missing tags and same-level filtering
- Viewed-level switching as both GM and player, confirming that the active level and every lower level are rendered while upper levels remain hidden
- Spatial queries with explicit level, category, Region, distance, strand-role and result-limit filters
- Querying a stored but currently unrendered level without changing visibility or generation identity
- Repeated Scene saves without duplicate rendering
- Baseline diagnostics and deterministic hashes
