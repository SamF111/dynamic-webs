# Dynamic Webs

Dynamic Webs is a standalone Foundry Virtual Tabletop module that procedurally generates deterministic spider webs as Scene-owned environmental scenery.

The module owns web generation, immutable geometry, rendering, modular Scene configuration, level awareness, lifecycle and future generic web interactions. Ambient Critters and other consumers integrate only through the public API and hooks.

## Project status

- **Module ID:** `dynamic-webs`
- **Runtime namespace:** `dynamicWebs`
- **Current version:** `0.3.1`
- **Public API version:** `1`
- **Blueprint schema version:** `4`
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

Version `0.3.1` replaces the former Scene-wide density, colour and thickness model with explicit modular populations.

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
- A nested **Web options** section containing corner, span, ground and reserved carpet density controls
- A nested **Appearance** section containing web colour and visible thickness
- Duplicate and remove actions

No population card is expanded automatically. The nested Web options and Appearance sections also start collapsed and retain their state while the rendered form remains open. Adding or duplicating a card expands only the new outer card and collapses the others. Card headings such as `Web Population 1` are presentation-only and are recalculated from card order.

Each population receives a hidden opaque ID such as `web-r7Kp2mN4xQ8vT3sL`. The ID is generated once, persisted with the population and never changes when its level, densities, colour, thickness, order or neighbouring populations change. Duplicating a population creates a fresh ID. Removing a population removes only that ID.

New populations start enabled with every density slider at the middle `standard` state. This default is authored as `webPopulationDensity` in `data/scene-configuration-defaults.json`.

Multiple populations may target the same level. This allows combinations such as sparse blue corner webs and dense red ground webs on one floor.

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

Every web and strand uses blueprint schema version `4`.

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
- immutable geometry, strands, perches and supporting wall IDs

Strand IDs remain qualified by their web ID:

```text
<web-id>:<encoded-local-strand-id>
```

Consumers must treat all complete identifiers as opaque.

## Rendering and visibility

Dynamic Webs renders into one transient PIXI container:

```text
dynamic-webs.webs
```

Generated webs are not embedded Foundry documents. Repeated synchronisation destroys and replaces the current container rather than stacking graphics.

The runtime stores every generated population. Rendering follows the currently viewed level for both GMs and players, so webs assigned to other elevation bands remain hidden. Viewed-level changes replace only the visible subset and do not regenerate geometry.

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

Population-array changes perform one deterministic regeneration. Scene geometry, structural wall and level-document changes also regenerate. Viewed-level changes only refresh visibility.

Canvas teardown, Scene deletion and module disposal destroy local rendering and clear transient geometry.

## Public API

The API is available through:

```javascript
globalThis.dynamicWebs.api
game.modules.get("dynamic-webs")?.api
```

### Population configuration

```javascript
dynamicWebs.api.scene.getPopulations();
dynamicWebs.api.scene.getPopulation("level-10-red-webs");

await dynamicWebs.api.scene.setPopulations([
  {
    id: "web-r7Kp2mN4xQ8vT3sL",
    enabled: true,
    levelId: "level-0",
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
dynamicWebs.api.webs.getState();
dynamicWebs.api.webs.generate();
dynamicWebs.api.webs.clear();
dynamicWebs.api.levels.getState();
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
- Population colours and thickness multipliers
- Rendered versus stored counts
- Identifier uniqueness
- Same-level wall-support checks
- Population ownership and immutability checks
- Non-destructive determinism hashes

## Architectural boundary

Dynamic Webs remains critter-agnostic. It owns environmental web geometry and generic state only. Ambient Critters must use the public API and hooks and must never import files from `modules/dynamic-webs/scripts/...`.

Future region restrictions, spatial queries, web carpets, mutable strand state, barriers, token destruction, persistence, trapping and occupancy must build on stable population-qualified identifiers.

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
- Viewed-level switching as both GM and player, confirming that only the active level is rendered
- Repeated Scene saves without duplicate rendering
- Baseline diagnostics and deterministic hashes
