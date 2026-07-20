# Dynamic Webs Roadmap

This roadmap orders future work according to architectural dependencies rather than visible feature appeal.

## Current baseline — v0.3.1

Completed:

- Standalone module skeleton, manifest and bootstrap
- Deterministic wall-corner, wall-span and ground web generation
- Organic radial geometry
- JSON-authored defaults and density presets
- Standalone Scene Configuration tab and Scene flag
- Independent runtime state, PIXI rendering and lifecycle
- Debounced wall rebuilding
- Versioned public API
- Blueprint schema version `4`
- Stable Scene- and level-qualified web identifiers
- Stable web-qualified strand identifiers
- Independent category seed streams
- Deeply immutable web populations and public snapshots
- Comprehensive baseline and determinism diagnostics
- Syntax, import, data-contract, API, lifecycle, rendering and generation regression tests
- Release validation through `npm run validate`
- Full migration of Ambient Critters away from web ownership
- JSON-authored Scene colour profiles
- Visual-only colour refreshes that preserve deterministic geometry and identifiers
- Scene-owned visible thickness from `0.5×` to `4×`
- Visual-only thickness refreshes that preserve blueprint and collision widths
- Independent corner, span, ground and reserved carpet density sliders
- Backwards-compatible category fallback from `webDensity`
- Category-isolated deterministic regeneration
- World-scoped level-provider setting with automatic, native-v14, levels-v13 and base modes
- Foundry v13 theripper93 Levels compatibility
- Foundry v14 native Scene level compatibility
- Full per-level density allocation and isolated level/category seeds
- Immutable level ownership on blueprint schema version `3`
- All-level runtime storage with level-compatible rendering filters
- Explicit modular web populations with independent level, density, colour and thickness
- Stable population-qualified web identifiers and v4 population seed streams
- Scene Configuration add, duplicate and remove population cards
- Nested collapsed Web options and Appearance sections inside each population card
- Hidden opaque random population IDs that remain stable across edits, deletion of neighbouring populations and reordering
- Presentation-only population numbering with no editable or persisted population name
- New populations defaulting to the middle `standard` density for every category

Current Scene flags:

```text
flags.dynamic-webs.webPopulations
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

### Visibility refinement — complete

**Delivered:** v0.2.1

- Added Scene flag `flags.dynamic-webs.webThickness`.
- Added a numeric Scene Configuration control from `0.5×` to `4×` with `0.25×` steps.
- Added `dynamicWebs.api.scene.getThickness()` and `setThickness()`.
- Thickness changes redraw the existing population without advancing generation identity.
- Base strand `widthPx`, collision widths, points, bounds, perches, supporting walls, seeds and identifiers remain unchanged.
- Silk and under-stroke widths scale together at render time.
- Combined colour and thickness updates are applied through one presentation refresh.
- Diagnostics report the active thickness multiplier.

---

## Milestone 2 — Per-category density controls — complete

**Delivered:** v0.2.2

Dynamic Webs now resolves abundance independently for corner, span, ground and future carpet web categories while preserving the original combined density flag as a backwards-compatible fallback.

### Delivered Scene controls

The standalone Scene Configuration tab contains one labelled discrete slider for each category:

- Corner-web density
- Span-web density
- Ground-web density
- Carpet-web density

Every slider uses the shared ordered JSON-authored states:

```text
disabled → sparse → standard → dense → infested
```

The current state is displayed beside each slider. The carpet slider is persisted now but remains generation-dormant until web carpets are implemented.

### Delivered persistence and migration

Independent Scene flags are:

```text
flags.dynamic-webs.cornerWebDensity
flags.dynamic-webs.spanWebDensity
flags.dynamic-webs.groundWebDensity
flags.dynamic-webs.carpetWebDensity
```

The original flag remains supported:

```text
flags.dynamic-webs.webDensity
```

Migration behaviour is non-destructive:

- Existing Scenes with only `webDensity` resolve every available category from that value.
- The UI reports whether each value is explicit or inherited from the legacy fallback.
- Saving the Scene Configuration form persists all four category-specific values.
- A category set to `disabled` produces no webs of that category without disabling others.
- An active carpet value is stored but cannot keep the current population active by itself.

### Delivered generation contract

- Corner density selects the preset-owned corner maximum count.
- Span density selects maximum count and minimum spacing together.
- Ground density selects the ground-web count.
- Carpet density is absence-safe until carpet-specific coverage presets exist.
- Category changes are generation changes rather than presentation redraws.
- Independent category random streams remain unchanged.
- Changing one category reproduces identical web IDs, strand IDs, points and canonical projections for unrelated categories.
- Changing one category density must preserve unrelated category geometry and identifiers.

### Public API

```javascript
dynamicWebs.api.scene.getCategoryDensities();
dynamicWebs.api.scene.getCategoryDensity("wall-corner");

await dynamicWebs.api.scene.setCategoryDensity("wall-span", "dense");
await dynamicWebs.api.scene.setCategoryDensities({
  "wall-corner": "dense",
  "wall-span": "sparse",
  ground: "infested",
  "web-carpet": "disabled"
});
```

Batch mutations use one Scene update when available. Public category identifiers match the web-kind contract.

### Diagnostics and tests

Diagnostics report:

- Resolved density state for every category
- Explicit versus legacy-fallback source for every category
- Generated counts by category
- Category-specific generation reasons through lifecycle telemetry

Regression coverage confirms:

- Legacy Scenes preserve their initial category output.
- Every slider accepts only the five supported states.
- Disabling one category leaves unrelated categories active.
- Unchanged categories retain identical geometry and identifiers.
- Repeated saves replace rather than stack rendering.
- Carpet density remains dormant and absence-safe.

### Exit criteria — met

- Corner, span and ground density are independently selectable through labelled sliders.
- Every implemented category can be disabled independently.
- Existing `webDensity` Scenes migrate without changing initial output.
- Unchanged categories retain deterministic geometry and stable identifiers.
- The data, UI and API contracts include a separate future carpet-density slider.

---

## Milestone 3 — Level-aware web populations — complete

**Delivered:** v0.3.0

Dynamic Webs now generates, stores and diagnoses independent web populations for every detected level.

### Delivered provider policy

The world-scoped **Level Awareness Provider** setting mirrors Ambient Critters' interface and availability rules:

- Foundry v14 and later hide the setting and use native Scene elevation automatically.
- Foundry v13 with theripper93's Levels active offers `Base Level only` and `theripper93's Levels`.
- Foundry v13 without Levels shows one disabled, visually muted `Base Level only` selector.
- Base Level is the default; v13 does not opt into Levels until the GM selects it.
- Provider-specific hint text explains the detected setup.

The internal compatibility contract retains `auto`, `native-v14`, `levels-v13` and `base` for diagnostics and pre-release programmatic compatibility, but only valid user choices are exposed in Game Settings. Unavailable stored values are normalised safely. Foundry v14 never uses Levels as its active provider.

### Delivered generation contract

- Every detected level receives the complete selected corner, span and ground allocation.
- Counts are not divided between levels.

For the current `dense` presets, every detected level can independently receive:

- Up to 48 corner webs
- Up to 10 span webs
- 10 ground webs
- Structural walls are grouped by level before corner or span candidate discovery.
- Supporting walls for a web must belong to the web's level.
- Ground populations are generated independently for each level.
- Editing one level leaves unrelated level projections unchanged.
- Blueprint schema version `3` adds immutable `levelProviderMode`, `levelId` and `elevationBand`.
- Web IDs now include the stable level identifier.
- Seed version `v3` isolates every level/category pair.

```text
dynamic-webs:web-generation:v3:<scene-id>:<encoded-level-id>:<web-kind>
```

### Delivered runtime and visibility

- The runtime stores all generated level blueprints.
- GMs and players see only the active viewed level.
- Viewed-level switching redraws the subset without advancing generation identity.
- Foundry v14 level-document changes and v13 Levels view changes are lifecycle-aware.
- Global provider changes regenerate the active Scene once.

### Diagnostics and tests

Diagnostics report requested/resolved provider modes, availability, fallbacks, levels, elevation bands, walls by level, visible level IDs, stored/rendered counts and cross-level support violations.

Regression coverage includes world settings, v13/v14 providers, per-level allocation, same-level support, level-isolated determinism and visibility-only redraws.

### Exit criteria — met

- Every blueprint has immutable level ownership.
- Multi-level Scenes generate independent full populations.
- GM and player rendering both respect the viewed level.
- Webs assigned to inactive elevation bands remain hidden without discarding stored geometry.
- Level switching does not regenerate unchanged geometry.


---

## Milestone 3.1 — Modular web populations — complete

**Delivered:** v0.3.1

Dynamic Webs now stores an explicit array of independently configured web populations. Each population owns its target level, four category-density states, colour profile and visible thickness. Empty arrays generate no webs, and the former pre-release Scene-wide flags are not used as a fallback.

Opaque population IDs participate in blueprint IDs and v4 deterministic seeds, allowing multiple populations to occupy the same level without collisions. IDs are generated once, hidden from the UI and preserved across all population edits. Scene Configuration provides presentation-only numbered collapsed cards with add, duplicate and remove operations. Each card contains separately collapsible Web options and Appearance sections, both closed by default. New populations start at the middle `standard` density. Population changes regenerate once, while viewed-level changes remain visibility-only.

### Exit criteria — met

- Level 0 can use a different colour and density from level 10.
- Multiple populations can coexist on one level.
- No population card expands automatically.
- Empty population arrays produce no webs.
- Unavailable saved levels are reported and skipped safely.
- Counts and deterministic hashes are available by population.

---

## Milestone 4 — Region-aware webs

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

## Milestone 5 — Spatial index and read-only query API

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

## Milestone 6 — Web carpets

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

## Milestone 7 — Mutable web state

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

## Milestone 8 — Optional web barriers

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

## Milestone 9 — Tokens destroying webs

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

## Milestone 10 — Persistence and network state

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

## Milestone 11 — Generic trapping and occupancy

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

## Milestone 12 — Ambient Critters adapter and release hardening

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
3. Per-category density controls — complete in v0.2.2
4. Level-aware web populations — complete in v0.3.0
5. Modular web populations — complete in v0.3.1
6. Region-aware webs
7. Spatial index and read-only query API
8. Web carpets
9. Mutable web state
10. Optional web barriers
11. Tokens destroying webs
12. Persistence and network state
13. Generic trapping and occupancy
14. Ambient Critters adapter and release hardening

## Critical dependency chain

```text
Baseline stability
    ↓
Per-category density controls
    ↓
Level awareness
    ↓
Modular web populations
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

Per-category density controls precede level awareness so each level can receive independently resolved corner, span, ground and future carpet allocations from the outset.

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
