# Dynamic Webs Public API

This document defines the supported public integration surface for Dynamic Webs.

- **Module ID:** `dynamic-webs`
- **Runtime namespace:** `dynamicWebs`
- **Public API version:** `1`
- **Supported Foundry versions:** v13 and v14

Version 1 is the compatibility baseline. Consumer modules may rely on the methods, namespace names, ownership boundaries and immutable snapshot behaviour documented here. Internal files under `modules/dynamic-webs/scripts/` are not an API and must not be imported by consumers.

## Access and readiness

The same frozen API object is exposed through either entry point:

```javascript
globalThis.dynamicWebs?.api
game.modules.get("dynamic-webs")?.api
```

Check module readiness before issuing runtime-dependent queries:

```javascript
const api = globalThis.dynamicWebs?.api;
const state = api?.getState();

if (!state?.ready) {
  throw new Error("Dynamic Webs is not ready.");
}
```

Methods that operate on generated geometry or transient captures require an active generated Scene. Administrative mutations also enforce their documented GM requirements.

## Compatibility and versioning

`api.version` is the numeric public API version and currently equals `1`.

Within version 1:

- Existing method names, namespace names and established argument meanings are compatibility commitments.
- New optional fields or new frozen result fields may be added without changing the version.
- Existing optional fields retain their defaults unless a future major API version explicitly changes them.
- Consumers must ignore unknown result fields.
- A breaking rename, removal or semantic change requires a new public API version.

The public API version is independent of the module release version, immutable web blueprint schema, diagnostic schema and mutable-state schema.

## General contracts

### Immutable results

Public query results and state snapshots are deeply frozen plain data. They contain no PIXI display objects, internal `Map` or `Set` instances, mutable services or Foundry document references.

Treat all returned values as read-only. Request objects remain owned by the caller; Dynamic Webs normalises the data it needs into its own immutable descriptors.

### Stable identifiers

Complete web, strand, population, perch and capture identifiers must be treated as opaque strings. Do not parse them to infer ownership or geometry.

### Level compatibility

The spatial index contains every generated level, including levels that are not currently rendered. Rendering visibility and physical query compatibility are therefore separate concerns.

Whenever an interaction has a physical level, pass at least one explicit compatibility field supported by that operation:

```javascript
{ levelId: "level-0" }
```

or:

```javascript
{ elevation: 10 }
```

or:

```javascript
{
  elevationBand: {
    bottom: 10,
    top: 19
  }
}
```

A viewed-level change does not regenerate geometry or rebuild the spatial index.

### Consumer ownership

Dynamic Webs owns environmental web geometry, read-only spatial queries, generic interaction evaluation, eligible wall-span mutation and transient captured-web presentation.

A consuming module owns entity-specific policy, including:

- Which entities are evaluated.
- Whether a web hit means capture, slowing, damage or no effect.
- Whether movement breaks a capture or carries it to a new position.
- When an entity escape or deletion removes a capture.
- Any cross-client synchronisation of captured overlays.

## Root API

### `api.getState()`

Returns a frozen top-level readiness snapshot:

```javascript
const state = dynamicWebs.api.getState();
```

Important fields include:

```javascript
{
  moduleId: "dynamic-webs",
  ready: true,
  moduleVersion: "0.7.0",
  webs: { /* runtime diagnostic snapshot */ }
}
```

### `api.getWebs()`

Returns every immutable stored web snapshot in stable identifier order, including currently unrendered levels.

### `api.getWeb(webId)`

Returns one immutable web snapshot, or `null` when the identifier is unknown.

### `api.queryNearby(point, options = {})`

Queries functional strand geometry near one point. The spatial index performs a broad phase followed by precise point-to-polyline distance testing including functional interaction width.

```javascript
const hits = dynamicWebs.api.queryNearby(
  { x: 1200, y: 800 },
  {
    levelId: "level-0",
    maximumDistancePx: 100,
    categories: ["wall-corner", "wall-span", "ground"],
    limit: 50
  }
);
```

Results are stably ordered and contain immutable web/strand metadata and geometry snapshots.

### `api.queryStrands(bounds, options = {})`

Returns functional strands whose indexed bounds overlap one rectangle.

```javascript
const strands = dynamicWebs.api.queryStrands(
  { x: 1000, y: 700, width: 400, height: 300 },
  {
    levelId: "level-0",
    strandRoles: ["capture", "decorative"],
    limit: 50
  }
);
```

### `api.findCompatibleWebs(options = {})`

Finds immutable web snapshots compatible with metadata and optional spatial filters.

```javascript
const webs = dynamicWebs.api.findCompatibleWebs({
  levelId: "level-0",
  categories: ["wall-corner", "wall-span"],
  regionTag: "crypt"
});
```

### `api.findPerches(options = {})`

Finds compatible immutable perch snapshots.

```javascript
const perches = dynamicWebs.api.findPerches({
  levelId: "level-0",
  point: { x: 1200, y: 800 },
  maximumDistancePx: 250
});
```

## `api.webs`

### `api.webs.getState()`

Returns the current frozen generated-web runtime diagnostic snapshot.

### `api.webs.generate()`

GM-only. Reads the active Scene's persisted modular populations, regenerates deterministic geometry and replaces the active runtime population.

### `api.webs.clear()`

GM-only. Clears local generated geometry, rendering, the spatial index, transient captures and runtime state without rewriting Scene population configuration.

### `api.webs.clearCarpetTextureCache()`

GM-only. Clears the client-local bundled carpet texture request cache and redraws the visible subset without changing immutable geometry or Scene flags.

## `api.scene`

Population mutations replace the complete authoritative Scene population array and are GM-only.

### `api.scene.getPopulations(sceneId = null)`

Returns the resolved frozen population array for the selected Scene or current canvas Scene.

### `api.scene.getPopulation(populationId, sceneId = null)`

Returns one frozen population or `null`.

### `api.scene.setPopulations(populations, sceneId = null)`

Validates and persists the complete population array:

```javascript
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
    colourProfileId: "natural-white",
    thicknessMultiplier: 1
  }
]);
```

An explicit empty array remains an intentional no-web Scene.

## `api.colours`

### `api.colours.getProfiles()`

Returns all authored immutable colour profiles.

### `api.colours.getProfile(profileId)`

Returns one immutable authored profile.

## `api.levels`

### `api.levels.getState()`

Returns a frozen level summary containing the resolved provider, detected levels, current visibility state and counts by level.

This is a presentation/authoring summary. Consumers should still pass explicit compatibility information to physical queries.

## `api.spatial`

### `api.spatial.getDiagnostics()`

Returns frozen spatial-index build and query telemetry.

## `api.interactions`

These methods evaluate genuine functional strands from wall-corner, wall-span and ground webs. Decorative carpet patches do not fabricate functional strand geometry.

### `api.interactions.queryMovement(request)`

Read-only. Queries intact web strands intersected by a swept movement request without emitting generic entity hooks.

```javascript
const hits = dynamicWebs.api.interactions.queryMovement({
  from: { x: 800, y: 500 },
  to: { x: 1000, y: 500 },
  levelId: "level-0",
  collisionRadiusPx: 25,
  categories: ["wall-corner", "wall-span", "ground"]
});
```

### `api.interactions.queryEntityPosition(request)`

Read-only. Answers whether one generic external entity currently overlaps compatible web strands.

```javascript
const result = dynamicWebs.api.interactions.queryEntityPosition({
  sourceModuleId: "ambient-critters",
  entityType: "critter",
  entityId: "firefly-42",
  point: { x: 1030, y: 810 },
  levelId: "level-0",
  radiusPx: 8
});
```

The result includes `onWeb`, matching `webIds` and ordered immutable hit information.

### `api.interactions.evaluateEntityMovement(request)`

Evaluates movement, maintains generic per-entity interaction state and emits generic interaction hooks.

```javascript
const result = dynamicWebs.api.interactions.evaluateEntityMovement({
  sourceModuleId: "ambient-critters",
  entityType: "critter",
  entityId: "firefly-42",
  from: { x: 1000, y: 800 },
  to: { x: 1030, y: 810 },
  levelId: "level-0",
  collisionRadiusPx: 8,
  categories: ["wall-corner", "wall-span", "ground"],
  strandKinds: ["capture", "decorative"]
});
```

The frozen result distinguishes fields such as `enteredWebIds`, `leftWebIds`, `intersectedWebIds`, `currentWebIds`, `primaryOutcome` and ordered `webHits`.

### `api.interactions.getContract()`

Returns the versioned generic interaction contract, including supported outcomes and hook names.

### `api.interactions.destroyWebs(webIds, options = {})`

GM-only. Requests whole-web destruction. Only eligible intact wall-span webs are mutable; corner, ground and carpet webs remain immutable.

When Scene span webs are indestructible, the result reports no change.

### `api.interactions.restoreWeb(webId, options = {})`

GM-only. Restores one previously destroyed compatible wall-span web.

### `api.interactions.reset(options = {})`

GM-only. Clears the current Scene's destroyed-span deviations.

### `api.interactions.getState()`

Returns the frozen mutable whole-span state snapshot.

## `api.captures`

Captured-web overlays are transient client-local presentation. They are not generated Scene geometry, do not enter the spatial index, do not change intact/destroyed web state, are not persisted and are not socket-synchronised by Dynamic Webs.

### `api.captures.show(request)`

Creates or updates one captured-web overlay.

```javascript
const capture = dynamicWebs.api.captures.show({
  sourceModuleId: "ambient-critters",
  entityType: "critter",
  entityId: "firefly-42",
  webId: "<source-web-id>",
  point: { x: 1030, y: 810 },
  radiusPx: 22,
  levelId: "level-0",
  aboveTokens: true
});
```

Supported presentation fields include:

```javascript
{
  captureId: "optional-explicit-id",
  selectionKey: "optional-stable-asset-selection-key",
  variant: 1,
  rotation: 0,
  alpha: 1,
  tint: 0xe8edf2,
  colourProfileId: "natural-white",
  elevation: 0,
  elevationBand: { bottom: 0, top: 9 },
  aboveTokens: false
}
```

`aboveTokens` is a strict optional boolean:

- Omitted on a new capture: defaults to `false` and renders below tokens.
- `false`: renders through the level-aware under-token capture container.
- `true`: renders through the level-aware above-token capture container.
- Omitted when updating an existing capture: preserves its previous placement.
- Supplied when updating: moves the same capture between layers without creating a duplicate.

When `captureId` is omitted, the combination of `sourceModuleId`, `entityType` and `entityId` produces a stable default capture identity for upsert behaviour. Anonymous captures receive a generated identity.

The returned frozen descriptor contains the resolved identity, entity metadata, position, size, level/elevation ownership, `aboveTokens`, asset presentation and creation/update timestamps.

Dynamic Webs does **not** bind the descriptor to a live token or other document. Moving or deleting the external entity does not automatically move or remove the overlay. The consumer must either call `show()` again with the same identity to reposition it, or remove it when its own capture lifecycle ends.

### `api.captures.get(captureId)`

Returns one frozen capture descriptor or `null`.

### `api.captures.getState()`

Returns a frozen client-local capture diagnostic snapshot, including capture count, visible capture count, visible levels, containers, texture-loader telemetry and the latest mutation.

### `api.captures.remove(captureId, options = {})`

Removes one capture. Returns `true` when a capture existed.

### `api.captures.clearByEntity(entityId, options = {})`

Removes captures associated with one entity. Optional `sourceModuleId` and `entityType` filters prevent unrelated consumers sharing the same entity identifier from clearing each other's overlays.

```javascript
dynamicWebs.api.captures.clearByEntity("firefly-42", {
  sourceModuleId: "ambient-critters",
  entityType: "critter"
});
```

### `api.captures.clear(options = {})`

Clears every local capture. Dynamic Webs also clears captures when its Scene/runtime context is cleared.

## `api.diagnostics`

### `api.diagnostics.getBaselineReport()`

Returns the comprehensive frozen baseline diagnostic report.

### `api.diagnostics.showBaselineReport()`

Displays the same report in a copyable Foundry textarea.

## Hooks

Generic entity interaction hooks:

```text
dynamic-webs.entityWebInteraction
dynamic-webs.entityOnWeb
dynamic-webs.entityEnteredWeb
dynamic-webs.entityLeftWeb
dynamic-webs.entityIntersectedWeb
```

Captured-web presentation hooks:

```text
dynamic-webs.captureShown
dynamic-webs.captureRemoved
dynamic-webs.capturesCleared
```

Hook payloads are immutable public snapshots. Consumers must not assume that hooks imply persistence or network replication.

## Recommended integration pattern

```javascript
const api = globalThis.dynamicWebs?.api;

if (!api?.getState()?.ready) return;

const interaction = api.interactions.evaluateEntityMovement({
  sourceModuleId: "my-module",
  entityType: "creature",
  entityId: creature.id,
  from: previousPoint,
  to: nextPoint,
  levelId: creature.levelId,
  collisionRadiusPx: creature.radiusPx
});

if (interaction.enteredWebIds.length > 0 && shouldCapture(creature, interaction)) {
  api.captures.show({
    sourceModuleId: "my-module",
    entityType: "creature",
    entityId: creature.id,
    webId: interaction.enteredWebIds[0],
    point: nextPoint,
    radiusPx: creature.radiusPx * 1.5,
    levelId: creature.levelId,
    aboveTokens: true
  });
}

function clearCreatureCapture(creatureId) {
  api.captures.clearByEntity(creatureId, {
    sourceModuleId: "my-module",
    entityType: "creature"
  });
}
```

The consumer decides when `clearCreatureCapture()` runs—for example on escape, ordinary movement, entity deletion or module teardown.

## Deliberately unsupported dependencies

Version 1 does not expose or guarantee:

- Internal service instances.
- PIXI containers, sprites, textures or graphics.
- Internal spatial-index cells, Maps or Sets.
- Imports from Dynamic Webs source files.
- Automatic token/critter capture policy.
- Automatic following or deletion of externally owned entities.
- Capture persistence or Dynamic Webs-owned capture socket replication.
- Mutable corner, ground or carpet webs.

Requests for a genuinely generic missing capability should extend this public API rather than encouraging consumers to import internals.
