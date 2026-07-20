# Dynamic Webs Roadmap

This roadmap orders future work according to architectural dependencies rather than visible feature appeal.

## Current baseline — v0.2.0

Completed:

- Standalone module skeleton, manifest and bootstrap
- Deterministic wall-corner, wall-span and ground web generation
- Organic radial geometry
- JSON-authored defaults and density presets
- Standalone Scene Configuration tab and Scene flag
- Independent runtime state, PIXI rendering and lifecycle
- Debounced wall rebuilding
- Versioned public API
- Blueprint schema version `2`
- Stable Scene-qualified web identifiers
- Stable web-qualified strand identifiers
- Independent category seed streams
- Deeply immutable web populations and public snapshots
- Comprehensive baseline and determinism diagnostics
- Syntax, import, data-contract, API, lifecycle, rendering and generation regression tests
- Release validation through `npm run validate`
- Full migration of Ambient Critters away from web ownership
- JSON-authored Scene colour profiles
- Visual-only colour refreshes that preserve deterministic geometry and identifiers

Current Scene flags:

```text
flags.dynamic-webs.webDensity
flags.dynamic-webs.webColour
```

Current density values:

- `disabled`
- `sparse`
- `standard`
- `dense`
- `infested`

---

## Milestone 0 — Baseline hardening — complete

**Delivered:** v0.1.0

The extracted implementation has been hardened as the reference foundation for all later milestones.

### Delivered contracts

- Blueprint schema versioning
- Stable Scene-qualified web identifiers
- Stable web-qualified strand identifiers
- Independent deterministic category streams
- Frozen geometry, runtime snapshots and public API surfaces
- Strict JSON data contracts
- Determinism regression tests
- Scene and wall rebuild regression tests
- Density-change regression tests
- Rendering replacement and cleanup tests
- Runtime failure-path tests
- Foundry compatibility-adapter tests
- A comprehensive browser-console diagnostic
- Explicit separation between authored configuration, immutable geometry and future mutable state
- Cross-platform syntax and full regression validation commands

### Diagnostic output

The v0.1 baseline diagnostic reports:

- Module, API, blueprint and diagnostic schema versions
- Active Scene identifier and name
- Density preset
- Generation and category seeds
- Scene rectangle, grid size and structural wall count
- Web counts by category
- Strand counts by role
- Rendered container status
- Lifecycle registration and pending rebuild status
- Identifier uniqueness
- Schema and immutability checks
- Non-destructive determinism hashes
- Comparison against the active runtime population

Run it with:

```javascript
dynamicWebs.api.diagnostics.showBaselineReport();
```

### Identifier contract

Web IDs use:

```text
<web-kind>:<encoded-scene-id>:<encoded-source-key>
```

Strand IDs use:

```text
<web-id>:<encoded-local-strand-id>
```

Consumers must treat identifiers as opaque. Stability is guaranteed for equivalent inputs under the same blueprint schema and seed versions, not across an explicitly documented future migration boundary.

### Exit criteria — met

- Equivalent inputs reproduce equivalent identifiers and geometry.
- Repeated generation does not stack rendering containers.
- Partial render failures clean up transient rendering.
- Public API consumers cannot mutate internal state.
- Unrelated category changes do not reshuffle other category streams.
- Tests establish a stable reference before blueprint schemas evolve.
- `npm run validate` performs syntax and regression validation.

Final live Foundry smoke testing remains a release activity and should be performed on both v13 and v14 whenever a distributable package is prepared.

---

## Milestone 1 — Coloured webs — complete

**Delivered:** v0.2.0

Dynamic Webs now resolves authored Scene colour profiles onto immutable strand blueprints without coupling presentation changes to procedural placement.

### Delivered configuration

- JSON-authored profiles in `data/webs/colours.json`
- Scene flag `flags.dynamic-webs.webColour`
- Scene Configuration colour selector
- Natural white, dusty grey, yellowed, black, blood red, arcane blue and toxic green profiles
- Separate structural, capture and decorative colours
- Profile-owned under-stroke colour and alpha multiplier

### Delivered contracts

- Strict colour-profile schema validation
- Additive blueprint schema version `2` with identifier-preserving visual fields
- Frozen public profile snapshots
- Resolved `colour`, `underColour`, `baseAlpha` and presentation `alpha` on strands
- Renderer consumption of strand-resolved colours
- Visual-only runtime remapping and redraw
- Stable web and strand identifiers across colour changes
- Unchanged points, bounds, perches, support walls, seeds and generation IDs across colour changes
- Diagnostics reporting the active colour profile and presentation revision
- Public Scene colour API and read-only colour-profile API

### Public API

```javascript
dynamicWebs.api.scene.getColour();
await dynamicWebs.api.scene.setColour("blood-red");

dynamicWebs.api.colours.getProfiles();
dynamicWebs.api.colours.getProfile("blood-red");
```

### Exit criteria — met

- Changing colour preserves web geometry and stable identifiers.
- Changing colour does not advance the generation ID.
- Reloading the Scene preserves the selected profile.
- Every strand role resolves its own colour and alpha.
- Repeated colour changes replace rendering rather than stacking containers.
- Colour selection does not contribute to generation seeds or candidate selection.

---

## Milestone 2 — Level-aware web populations

**Target:** v0.3.0

This is the most important architectural milestone.

Each detected level should receive its own full density allocation. Counts must not be divided across the Scene.

### Example

For `dense` on three detected levels, each level independently receives:

- Up to 48 corner webs
- Up to 10 span webs
- 10 ground webs

### Implement

- Foundry v13 level detection through a compatibility adapter
- Foundry v14 native level and elevation detection through a compatibility adapter
- Stable level identifiers
- Wall grouping by level
- Same-level validation for corner supports
- Same-level validation for opposing span walls
- Independent ground-web generation per level
- Density presets applied independently per level
- Immutable level metadata on every web blueprint
- Independent deterministic streams per level and category
- Runtime storage of all level blueprints
- Level-compatible rendering filters
- Visible-subset switching without geometry regeneration
- GM visibility policy
- Level-change diagnostics

### Suggested metadata

```javascript
{
  levelProviderMode: "foundry-v14",
  levelId: "10-20",
  elevationBand: {
    bottom: 10,
    top: 20
  }
}
```

### Suggested seed format

```text
dynamic-webs:web-generation:v3:<scene-id>:<level-id>:<web-kind>
```

### Constraints

- Supporting walls for one web must belong to the same level.
- Changing one level should not reshuffle unrelated levels.
- Switching visible levels should filter rendering, not rebuild geometry.
- Compatibility differences must remain isolated in Foundry adapter files.

### Exit criteria

- Every blueprint has immutable level ownership.
- Multi-level Scenes generate independent populations.
- Player rendering respects the active level.
- GM behaviour follows a documented policy.
- Level switching does not regenerate unchanged geometry.

---

## Milestone 3 — Region-aware webs

**Target:** v0.4.0

Region awareness must remain environmental and critter-agnostic.

### Initial region controls

Support generic tags or behaviours such as:

- `web-allow`
- `web-exclude`
- `web-corner`
- `web-span`
- `web-ground`
- `web-carpet`
- `web-colour:<profile-id>`

### Implement

- Region discovery through Foundry compatibility adapters
- Region level ownership
- Normalised and deduplicated region tags
- Region geometry extraction
- Point-in-region tests
- Segment and bounds compatibility tests
- Allow-only generation
- Exclusion zones
- Category-specific region restrictions
- Region colour overrides
- Optional local density influence
- Optional local spacing influence
- Region identifiers on affected blueprints
- Independent deterministic streams per relevant region
- Diagnostics for matched, ignored and incompatible regions

### Determinism rules

Use separate deterministic streams for:

- Each level
- Each web category
- Each relevant region

A region identifier should contribute to a seed only when that region owns or constrains the generated geometry.

Unrelated region changes must not reshuffle unaffected webs.

### Constraints

- A web and its controlling region must be level-compatible.
- Region overlap precedence must be explicit and testable.
- Region tags must not encode critter behaviour.
- Colour overrides must not alter geometry identifiers.

### Exit criteria

- Allow and exclude regions behave predictably.
- Category-specific restrictions work independently.
- Region colour overrides resolve deterministically.
- Unrelated region edits do not reshuffle unaffected populations.

---

## Milestone 4 — Spatial index and read-only query API

**Target:** v0.5.0

Implement the spatial foundation before high-volume carpets or token destruction.

### Internal spatial index

Use a spatial hash, uniform grid or equivalent broad-phase structure containing:

- Web bounds
- Strand bounds
- Level ownership
- Web category
- Region ownership
- Strand role
- Functional interaction width
- Intact or broken state when mutable state exists

Avoid full Scene-wide strand scans for every query.

### Public API

Expose frozen snapshots through:

```javascript
dynamicWebs.api.getWebs();
dynamicWebs.api.getWeb(webId);

dynamicWebs.api.queryNearby(point, options);
dynamicWebs.api.queryStrands(bounds, options);
dynamicWebs.api.findCompatibleWebs(options);
dynamicWebs.api.findPerches(options);
```

### Query filters

Support filters such as:

- Level identifier
- Elevation band
- Web category
- Region identifier or tag
- Maximum distance
- Strand role
- Intact-only
- Functional interaction width
- Result limit

### Implement

- Index construction after generation
- Index clearing on teardown
- Index rebuilding after blueprint replacement
- Immutable query results
- Stable result ordering
- Query diagnostics
- Performance tests for dense and infested Scenes

### Exit criteria

- Queries avoid scanning every strand.
- Results are immutable.
- Results are level-compatible.
- Query ordering is stable.
- The API is sufficient for future Ambient Critters integration without exposing internals.

---

## Milestone 5 — Web carpets

**Target:** v0.6.0

Web carpets are area-based web formations and should follow region boundaries.

Introduce a new category:

```text
web-carpet
```

### Generation model

Web carpets should:

- Prefer explicitly tagged regions
- Cover a configurable proportion of a region
- Follow region boundaries
- Remain confined to one level
- Contain irregular holes
- Use sparse and uneven edges
- Form connected but non-uniform meshes
- Include occasional dense knots
- Include occasional loose strands
- Avoid a regular grid or repeated texture appearance

### Preset model

Use coverage-style configuration rather than a simple count:

```json
{
  "carpetWebs": {
    "maximumRegions": 3,
    "targetCoverage": 0.45,
    "minimumPatchGridUnits": 1.5,
    "maximumPatchGridUnits": 6,
    "strandSpacingGridUnits": 0.18
  }
}
```

### Implement

- Carpet-specific JSON defaults and contracts
- Region-owned carpet generation
- Boundary-aware clipping
- Deterministic holes and density variation
- Stable carpet patch identifiers
- Stable strand identifiers
- Spatial indexing
- Rendering culling
- Rendering batching or equivalent optimisation
- Colour-profile support
- Per-level visibility filtering
- Carpet diagnostics

### Constraints

- Carpets must not be implemented as a static repeated texture.
- Carpet density must not cause per-frame geometry generation.
- Region and level awareness are prerequisites.
- Rendering and indexing must handle substantially larger strand counts.

### Exit criteria

- Carpets follow region boundaries.
- Carpets remain visually organic.
- Dense carpets remain performant.
- Equivalent inputs reproduce equivalent carpet geometry.

---

## Milestone 6 — Mutable web state

**Target:** v0.7.0

Mutable interaction state must remain separate from immutable blueprints.

### Suggested state model

```javascript
{
  webId: "<stable-web-id>",
  brokenStrandIds: [
    "<stable-web-qualified-strand-id>"
  ],
  occupiedByEntityIds: [],
  trappedEntityIds: [],
  revision: 1
}
```

### Implement

- A dedicated mutable-state service
- Broken-strand tracking
- Stable state revisions
- State reset operations
- State clearing operations
- State reconciliation after deterministic regeneration
- Renderer filtering for broken strands
- Spatial-index filtering for broken strands
- Immutable state snapshots
- Authority checks for mutation operations
- Generic state-change hooks
- Local-only state initially unless persistence is required for testing

### Proposed API

```javascript
dynamicWebs.api.breakStrand(webId, strandId, options);
dynamicWebs.api.restoreStrand(webId, strandId, options);
dynamicWebs.api.resetWeb(webId);
dynamicWebs.api.resetAllWebs();
```

### Proposed hooks

```javascript
Hooks.callAll("dynamicWebs.stateChanged", payload);
Hooks.callAll("dynamicWebs.strandBroken", payload);
```

### Constraints

- Breaking a strand must not alter its immutable source blueprint.
- State must reconcile against stable web and strand identifiers.
- The renderer should update affected webs without regenerating the Scene.

### Exit criteria

- Individual strands can be broken and restored.
- Broken strands are excluded from rendering and spatial queries.
- Regeneration preserves compatible mutable state.
- Invalid state references are detected and reported.

---

## Milestone 7 — Optional web barriers

**Target:** v0.8.0

Allow generated webs to optionally participate in Foundry wall behaviour. This feature must remain opt-in and separate from visual rendering, immutable geometry and ordinary authored Scene walls.

### Scene policy

Support a Scene-level barrier mode such as:

- `none`
- `vision`
- `movement`
- `vision-and-movement`

The default must be `none`. Changing barrier mode should synchronise barrier behaviour from the existing immutable web population without reshuffling or regenerating web geometry.

Example JSON-authored configuration:

```json
{
  "webBarriers": {
    "mode": "none",
    "strandRoles": [
      "structural"
    ],
    "intactOnly": true
  }
}
```

### Implement

- A dedicated barrier service separate from generation and rendering
- Stable barrier identifiers derived from stable web and strand identifiers
- Vision-only barriers
- Movement-only barriers
- Combined vision and movement barriers
- Configurable strand roles eligible to create barriers
- Level-compatible barrier creation and filtering
- Barrier reconciliation after deterministic regeneration
- Barrier reconciliation after strand breakage or restoration
- Cleanup on Scene change, canvas teardown and module disable
- GM-authoritative creation when embedded Foundry WallDocuments are used
- Diagnostics reporting authored structural walls and generated web barriers separately
- Foundry v13 and v14 compatibility adapters

The implementation may use flagged embedded WallDocuments or a compatibility-layer synthetic barrier representation, but consumers and generation code must observe the same ownership and feedback-prevention contracts.

### Feedback-prevention contract

Dynamic Webs barriers must never become source walls for further web generation. Otherwise one generated web could create barriers that create more webs, causing recursive population growth.

When embedded WallDocuments are used:

- Every module-owned barrier must carry an explicit ownership flag such as `flags.dynamic-webs.generatedWebBarrier`.
- Structural wall collection must exclude module-owned barriers before corner or span candidate detection.
- Module-owned barriers must not contribute to generation seeds, structural wall counts, candidate counts or `supportingWallIds`.
- `createWall`, `updateWall` and `deleteWall` lifecycle handlers must ignore module-owned barriers.
- Barrier synchronisation must not schedule a web-generation rebuild.
- Cleanup must remove only explicitly flagged Dynamic Webs barriers and never authored walls.
- Reload and reconciliation must replace or reuse barriers by stable identifier rather than duplicating them.

Equivalent safeguards are required if the implementation uses synthetic barriers rather than embedded WallDocuments.

### Constraints

- Enabling or disabling barriers must not alter web placement, geometry or identifiers.
- Vision and movement restriction must be independently selectable.
- Broken strands must stop contributing barriers when `intactOnly` is enabled.
- Level-incompatible tokens and vision sources must not interact with a web barrier.
- Generated barriers must remain distinguishable from authored Scene walls in diagnostics and cleanup.
- Barrier creation and deletion must be idempotent across repeated lifecycle synchronisations.

### Regression tests

Test that:

- Web hashes and identifiers are identical with barriers disabled and enabled.
- Repeated barrier synchronisation does not duplicate WallDocuments or synthetic barriers.
- Generated barriers are excluded from wall-corner and wall-span candidate detection.
- Generated barrier hook events do not schedule recursive rebuilds.
- Repeated reload and rebuild cycles do not increase the generated web population.
- Vision-only, movement-only and combined modes map to the intended Foundry restrictions.
- Broken and restored strands update their barriers without regenerating unrelated geometry.

### Exit criteria

- A Scene can independently select no barriers, vision barriers, movement barriers or both.
- Barrier state follows the current immutable geometry and mutable strand state.
- Module-owned barriers never generate additional webs.
- Repeated synchronisation produces no duplicate barriers or recursive web growth.
- Authored Scene walls remain untouched.
- Foundry v13 and v14 behaviour is verified.

---

## Milestone 8 — Tokens destroying webs

**Target:** v0.9.0

Token destruction should be built on the spatial index and mutable-state API.

### Detection model

Use the token’s swept movement path rather than checking only its final position.

Processing sequence:

1. Determine the token’s previous and new position.
2. Build swept movement bounds.
3. Query nearby compatible strands.
4. Filter candidates by level and elevation.
5. Perform precise segment or curve intersection tests.
6. Apply a generic interaction policy.
7. Break eligible strands through the mutable-state API.
8. Emit generic hooks and outcomes.

### Initial policy options

Support Scene-level behaviour such as:

- Ignore tokens
- Break on movement
- Break only above a minimum token size
- Break only above a minimum movement distance
- Break only selected strand roles
- Preserve structural strands
- Collapse a web when structural integrity falls below a threshold
- Separate ordinary movement and teleport behaviour

### Generic outcomes

- `NO_INTERACTION`
- `TRAVERSED`
- `STRAND_BROKEN`
- `WEB_COLLAPSED`
- `PASSAGE_BLOCKED`

### Authority and synchronisation rules

- The GM should be authoritative for mutations.
- Non-GM clients may request a mutation but must not independently commit persistent state.
- Drag previews must not mutate webs.
- Duplicate movement updates must not repeatedly break the same strand.
- Undoing token movement must not automatically restore webs.
- Teleport interaction must follow an explicit policy.
- Hidden token behaviour must be defined.
- Paused-game behaviour must be defined.

### Proposed hook

```javascript
Hooks.callAll("dynamicWebs.entityIntersectedStrand", payload);
```

### Exit criteria

- Ordinary token movement can break intersected strands.
- Level-incompatible tokens cannot affect webs.
- Drag previews do not mutate state.
- Duplicate updates are idempotent.
- Mutation authority is consistent across clients.

---

## Milestone 9 — Persistence and network state

**Target:** v0.10.0

Once local destruction is reliable, make mutable state survive reloads and synchronise across clients.

### Implement

- Scene-owned persistent mutable state
- Compact persistence containing only deterministic geometry deviations
- Socket transport
- GM-authoritative mutation handling
- Revision checking
- Conflict handling
- State pruning for missing web or strand identifiers
- Schema versioning
- Migration support
- Reset damaged webs operation
- Optional regeneration policy
- Multi-client diagnostics

### Persistence principle

Do not persist complete generated geometry.

Persist only deviations such as:

```javascript
{
  schemaVersion: 1,
  webs: {
    "<stable-web-id>": {
      brokenStrandIds: [
        "<stable-web-qualified-strand-id-a>",
        "<stable-web-qualified-strand-id-b>"
      ],
      revision: 3
    }
  }
}
```

### Exit criteria

- Broken strands survive reloads.
- All clients converge on the GM-authoritative state.
- Stale or conflicting revisions are handled predictably.
- Invalid references are pruned safely.
- Persistence remains compact.

---

## Milestone 10 — Generic trapping and occupancy

**Target:** v0.11.0 or later

Extend mutable state beyond strand damage.

### Implement

- Occupancy points
- Entity occupancy references
- Trapped entity references
- Release operations
- Removal operations
- Capture-strand classification
- Generic trap thresholds
- Perch discovery
- State hooks
- Optional persistence
- Spatial-query filters for occupied or available web locations

### Constraints

- Dynamic Webs must remain entity-agnostic.
- It may report geometry outcomes but must not decide creature motivation or AI.
- Consumer modules must assign species-specific policies.

### Exit criteria

- Generic entities can occupy or become trapped in webs.
- Consumers can query available perches and compatible webs.
- Occupancy and trapping remain synchronised and immutable through the public API.

---

## Milestone 11 — Ambient Critters adapter and release hardening

**Target:** v1.0.0

Complete the public integration boundary and prepare the module for release.

### Dynamic Webs work

- Stabilise API names and return schemas
- Stabilise hook names and payload schemas
- Publish API documentation
- Publish integration examples
- Preserve absence-safe optional integration
- Document compatibility policy
- Document data schemas
- Add migration tests
- Add performance benchmarks
- Add diagnostic commands

### Ambient Critters adapter

The optional Ambient Critters integration should:

- Detect Dynamic Webs through its public module API
- Read immutable web snapshots
- Query compatible webs and perches
- Allow selected critters to prefer or require web habitat
- Fall back safely when Dynamic Webs is absent
- Never import Dynamic Webs internal files
- Never control Dynamic Webs generation, rendering, configuration or lifecycle

Possible Ambient Critters habitat configuration:

```javascript
{
  webHabitat: {
    mode: "prefer",
    allowedWebKinds: [
      "wall-corner",
      "wall-span"
    ]
  }
}
```

Possible modes:

- `none`
- `prefer`
- `require`

### Release testing

Test:

- Foundry v13
- Foundry v14
- Single-level Scenes
- Multi-level Scenes
- Region overlap
- Coloured webs
- Sparse through infested density
- Carpet-heavy Scenes
- Vision-only web barriers
- Movement-only web barriers
- Combined vision and movement web barriers
- Barrier feedback-loop prevention
- Token destruction
- Multi-client state
- Scene reloads
- Canvas teardown
- Wall edits
- Module disable and re-enable
- Dynamic Webs without Ambient Critters
- Ambient Critters without Dynamic Webs
- Both modules enabled

### Exit criteria

- Dynamic Webs operates independently.
- Public integration requires no internal imports.
- Performance remains acceptable under the heaviest supported presets.
- APIs and hooks are documented and versioned.
- v13 and v14 behaviour is verified.

---

# Recommended implementation order

1. Baseline hardening — complete in v0.1.0
2. Coloured webs — complete in v0.2.0
3. Level-aware web populations
4. Region-aware webs
5. Spatial index and read-only query API
6. Web carpets
7. Mutable web state
8. Optional web barriers
9. Tokens destroying webs
10. Persistence and network state
11. Generic trapping and occupancy
12. Ambient Critters adapter and release hardening

## Critical dependency chain

```text
Baseline stability
    ↓
Level awareness
    ↓
Region awareness
    ↓
Spatial indexing
    ↓
Web carpets
    ↓
Mutable strand state
    ↓
Optional web barriers
    ↓
Token destruction
    ↓
Persistence and synchronisation
    ↓
Trapping and occupancy
```

Coloured webs sit near the beginning because they are mostly independent and establish the visual-property model later reused by region overrides and web carpets.

## Architecture rules throughout the roadmap

Every milestone must preserve these rules:

- Deterministic generation
- No per-frame geometry generation
- Immutable geometry
- Separate mutable interaction state
- Stable web and strand identifiers
- Critter-agnostic Dynamic Webs internals
- Public API and hook integration only
- No dependency on Ambient Critters
- Foundry v13 and v14 compatibility adapters
- JSON ownership of authored configuration
- Focused services and classes rather than god files
- Frozen snapshots rather than mutable internal objects
- Module-owned web barriers must never be eligible source walls for generation
- Generated barrier lifecycle events must not trigger recursive web rebuilds
