# Dynamic Webs Configuration

This guide covers the GM-facing world and Scene controls for Dynamic Webs. For a quick introduction, start with the main [README](../README.md).

## Scene web populations

The **Dynamic Webs** tab in Scene Configuration contains one or more collapsible population cards. Each population is an independent layer of web generation.

A population controls:

- Enabled state
- Target level
- Confine and Exclude Region tags
- Corner, span, ground and carpet density
- Colour profile
- Visible thickness

Multiple populations may target the same floor. This allows combinations such as sparse natural cobwebs across a level and dense red ground webs inside a particular chamber.

No population card is expanded automatically. The nested **Regions**, **Web options** and **Appearance** sections also start collapsed and retain their state while the form remains open. Adding or duplicating a population expands only the newly created outer card.

Each population receives a hidden opaque ID such as:

```text
web-r7Kp2mN4xQ8vT3sL
```

The ID is generated once and does not change when the population is edited or reordered. Duplicating a population creates a fresh ID.

## Density controls

Each web category has an independent density setting:

```text
disabled → sparse → standard → dense → infested
```

The four categories are:

- `wall-corner`
- `wall-span`
- `ground`
- `web-carpet`

The authored initial value for each category is `standard`. World defaults may change what new or previously unconfigured populations receive.

## World defaults

Dynamic Webs uses Foundry's standard **Configure Settings** page. Module settings are grouped under:

- **Generation Defaults** — maximum span width, span vision, secret-door movement blocking and token crossing behaviour
- **Population Defaults** — initial corner, span, ground and carpet densities
- **Appearance Defaults** — initial colour and thickness
- **Level Awareness** — the Foundry v13 level provider selector where applicable
- **Maintenance** — cache clearing, world-wide restoration, generated-wall clean-up and uninstall preparation

Population defaults apply only to newly added populations and Scenes whose population flag has never been configured. Existing population arrays, including an explicit empty array, remain authoritative and are not silently rewritten.

A Scene with a missing population flag resolves one stable implicit population from the current world defaults. Saving Scene Configuration makes that population explicit while preserving its reserved stable ID.

An explicitly saved empty array means that the Scene intentionally generates no webs:

```text
flags.dynamic-webs.webPopulations = []
```

## Region controls

Each population may configure:

- **Confine to Region tags** — accepted strands must remain inside the union of matching same-level Regions.
- **Exclude Region tags** — a complete candidate is rejected when any visible strand touches or enters a matching same-level Region.

Exclude takes precedence over Confine.

Tags are comma- or line-separated, normalised to lower-case slugs and deduplicated. Optional `*` wildcards are supported in population tag fields. A tag cannot be used as both Confine and Exclude within the same population.

Dynamic Webs stores its Region tags at:

```text
flags.dynamic-webs.regionTags
```

It also recognises Ambient Critters Region tags at:

```text
flags.ambient-critters.regionTags
```

This is read-only interoperability. Neither module imports the other's source code.

Adjacent or overlapping Confine Regions form one allowed union. An unassigned gap remains disallowed. Generated strand candidates are accepted or rejected as complete shapes rather than clipped at the boundary.

Web carpets use their matching Confine Region as the ownership boundary. Matching Exclude Regions are subtracted from the displayed carpet mask.

## Level selection

Every population targets exactly one detected level. A population whose saved level is no longer available remains configured but does not generate until a valid level is selected.

Provider behaviour:

- **Foundry v14 and later:** native Scene elevation is used automatically and the provider setting is hidden.
- **Foundry v13 with theripper93's Levels active:** the world setting offers `Base Level only` and `theripper93's Levels`.
- **Foundry v13 without Levels:** the single Base Level option is shown disabled and muted.

Corner and span webs use only structural walls assigned to the population's selected level. Ground webs and Region-owned carpets are also generated only on that level.

## Colour profiles

Authored colour profiles are stored in `data/webs/colours.json`:

- `natural-white`
- `dusty-grey`
- `yellowed`
- `black`
- `blood-red`
- `arcane-blue`
- `toxic-green`

Colour belongs to the population. Changing colour alters presentation without changing web placement or stable identifiers.

## Visible thickness

Each population selects one of four visible thickness levels:

```text
1×, 2×, 3×, 4×
```

Historical fractional values from `0.5×` to `4×` remain readable and are rounded to the nearest discrete level when resolved or saved.

Thickness is presentation-only. It does not alter functional interaction width, bounds, supporting walls, perches, deterministic generation or the spatial index.

## Scene-wide span behaviour

Below the population cards, Scene Configuration contains one collapsed **Span behaviour** section. These settings apply to all wall-spanning webs in the Scene rather than to individual populations.

### Maximum span width

The authored world default is `1.5` Scene grid units. The supported range is `0.35–10` in increments of `0.05`.

Each Scene may either follow the current world default or store its own override.

### Vision

Choose one of:

- **None** — no vision restriction
- **Limited** — limited vision through the web
- **Blocked** — blocked vision

### Movement

Enable **Block movement** to give each intact span a module-owned **closed secret-door** WallDocument. This is the only movement-blocking mode.

Vision and movement are independent. A vision-only span never blocks movement, while a secret-door span retains the selected vision mode.

### Attempted crossing

Choose one of:

- **Open Secret Door** — opens the generated secret-door wall and leaves the web intact. This option requires **Block movement**.
- **Destroy Web** — destroys the intersected whole span. If **Block movement** is enabled, the generated secret door is opened and left in place for later clean-up rather than deleted during token movement. A vision-only generated wall still has to be removed because it has no harmless open state.
- **No Action** — token movement does not alter the span.

The crossing policy controls future token interaction only. Changing it does not restore spans which were already destroyed. Use **Restore Destroyed Span Webs** when restoration is intended.

Explicit whole-span destruction through the public API remains available independently of the Scene's automatic crossing policy. Corner, ground and carpet webs are unaffected by these Scene-wide controls.

## Scene maintenance

The Scene **Span behaviour** section provides:

- **Restore Destroyed Span Webs** — restores all destroyed spans in that Scene.
- **Update Web Walls** — performs a complete active-Scene reconciliation, repairing missing or outdated generated walls and removing duplicates or deferred walls.
- **Delete Web Walls** — removes generated Dynamic Webs WallDocuments without changing populations or destroyed-span state.

## World maintenance

Configure Settings provides:

- **Clear Web Carpet Texture Cache** — clears client-local carpet texture and Region-mask caches and redraws the active visible subset.
- **Restore Destroyed Span Webs in All Scenes** — clears destroyed-span state across the world.
- **Destroy All Lingering Web Walls** — removes destroyed, duplicate or malformed generated walls while retaining valid intact walls.
- **Clear All Webs and Prepare for Uninstall** — after typed confirmation, removes generated walls and Dynamic Webs Region/Scene configuration, sets every Scene to an explicit empty population array, and clears the active local runtime.

## Stored Scene configuration

The authoritative population flag is:

```text
flags.dynamic-webs.webPopulations
```

A stored population resembles:

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
    "web-carpet": "standard"
  },
  colourProfileId: "blood-red",
  thicknessMultiplier: 1
}
```

Destroyed whole-span deviations are stored separately at:

```text
flags.dynamic-webs.mutableState
```

The compact mutable state contains only its schema version, revision and sorted stable destroyed span IDs. Complete generated geometry is never stored in Scene flags.
