



# Dynamic Webs

![Foundry Version](https://img.shields.io/badge/Foundry-v13%20%7C%20v14-informational)
![Public API](https://img.shields.io/badge/Public%20API-v1-blue)
![Latest Release](https://img.shields.io/github/v/release/SamF111/dynamic-webs?label=release)
![Latest Downloads](https://img.shields.io/github/downloads/SamF111/dynamic-webs/latest/dynamic-webs.zip?label=latest%20downloads)

**Dynamic Webs** fills Foundry Virtual Tabletop scenes with procedurally generated spider webs.

Add a few dusty cobwebs to an abandoned room, stretch thick sheets across narrow passages, cover a spider nest in web carpet, or turn an entire dungeon floor into an infestation. Webs are generated from the shape and configuration of the Scene, remain consistent between sessions, and can be used as scenery or as part of play.

https://github.com/user-attachments/assets/f60c0b25-cd5a-46a0-81de-a3e9aa05067c

## Why I made it

I built Dynamic Webs for my own game because I wanted scenes to feel more lived-in. I had a large spider battle in the works as GM, and drawing or placing every web by hand was not how I wanted to spend my preparation time.

The web system originally lived inside another module I am working on. As it gained its own generation, Scene controls, Regions, floors, interactions and destructible passage webs, it became clear that it had grown into a module of its own. I split it out, kept it independent, and decided to share it for other GMs who want the same sort of environmental detail.

## What it adds

Dynamic Webs can:

- Generate webs automatically from your Scene rather than requiring manual placement.
- Build separate web populations with their own density, colour, thickness, Regions and floor.
- Place natural-looking webs in wall corners, across passages, on open ground and throughout tagged areas.
- Keep the same web layout when a Scene is reopened or regenerated with unchanged settings.
- Support multi-floor Scenes in Foundry v14 and v13 with the Levels module.
- Let wall-spanning webs limit vision, block movement through secret doors, or break when tokens push through them.
- Expose a public API for other modules without coupling Dynamic Webs to a particular creature or game system.

## Web types

### Corner webs

Webs form around suitable wall corners and junctions. They work well for old rooms, caves, ruins, attics and places that have been left undisturbed.

### Passage webs

Wall-spanning webs stretch across suitable narrow gaps. They can remain purely decorative, interfere with vision, act as closed secret doors, or be made destructible.

### Ground webs

Loose radial webs appear across open parts of the Scene, adding scattered silk and nesting areas away from walls.

### Web carpets

Tagged Regions can be filled with broad patches of tangled web. These are intended for spider dens, egg chambers, overgrown tunnels and other heavily infested spaces.

## Getting started

1. Enable **Dynamic Webs** in your world.
2. Open a Scene's configuration and select the **Dynamic Webs** tab.
3. Add or edit a web population.
4. Choose the densities for corner, span, ground and carpet webs.
5. Select a colour, thickness and target floor.
6. Optionally use Region tags to confine or exclude the population.
7. Use the Scene-wide **Span behaviour** section when passage webs should affect vision, movement or destruction.

A single population is enough for most Scenes. Multiple populations let you combine effects, such as pale sparse cobwebs around a whole floor with dense red webs restricted to a ritual chamber.

## Shape the infestation

Each population has independent controls for:

- **Density:** disabled, sparse, standard, dense or infested.
- **Web categories:** corner, span, ground and carpet.
- **Colour:** from natural white and dusty grey to blood red, arcane blue or toxic green.
- **Thickness:** four visible levels from subtle fibres to heavy strands.
- **Floor:** one detected level per population.
- **Regions:** confine webs to matching tags or exclude them from protected areas.

World settings provide defaults for new or previously unconfigured Scene populations. Existing Scene choices are not silently overwritten.

## Webs can be scenery or part of play

Wall-spanning webs have optional Scene-wide behaviour:

- Vision can be unaffected, limited or blocked.
- Movement blocking can be represented by a closed Foundry secret door.
- Span webs can be destructible or indestructible.

When destructible span webs are crossed by a token, the whole span can tear away and remain destroyed after the Scene is reopened. Corner, ground and carpet webs remain environmental scenery.

## Regions and floors

Use **Confine** tags to keep webs inside places such as `crypt`, `cave` or `spider-nest`. Use **Exclude** tags for paths, altars, bridges or other areas that should remain clear.

Each population belongs to one detected floor. Dynamic Webs supports Foundry v14's native elevation model and theripper93's Levels in Foundry v13. Visible webs follow the viewed floor while lower floors remain visible where appropriate.

## Consistent without being static

Dynamic Webs uses deterministic generation. Unchanged Scene geometry and configuration reproduce the same webs, so a room does not randomly rearrange itself every time it is opened.

Change the walls, Regions, population settings or span reach and the affected web layout is rebuilt. Simply switching the viewed floor changes only what is shown.

## Integration with other modules

Dynamic Webs is intentionally creature-agnostic. It knows where the webs are and can report when an entity reaches or crosses them, but it does not decide whether a spider ignores a web, a fly becomes trapped, or a construct tears through it.

Other modules can use the stable version-1 public API for spatial queries, generic movement checks, whole-span destruction and transient captured-web visuals. Dynamic Webs does not require Ambient Critters, and consumers must not import its internal source files.

See the [Public API documentation](docs/PUBLIC-API.md) for the complete integration contract.

## Compatibility

- **Foundry VTT:** minimum v13, verified v14
- **Game systems:** system-independent
- **Foundry v13 floors:** optional support through theripper93's Levels
- **Foundry v14 floors:** native Scene elevation support
- **Current module version:** `0.7.0`
- **Public API version:** `1`

## Documentation

- [Configuration guide](docs/CONFIGURATION.md) — populations, Regions, floors, appearance, span behaviour and maintenance.
- [Public API](docs/PUBLIC-API.md) — supported integration methods, hooks and compatibility commitments.
- [Technical design](docs/TECHNICAL-DESIGN.md) — deterministic geometry, rendering, spatial indexing, assets and mutable span state.
- [Development guide](docs/DEVELOPMENT.md) — validation, asset tooling, live testing and architectural rules.
- [Roadmap](roadmap.md) — feature-complete status, release work and maintenance policy.

## AI assistance disclosure

This project uses ChatGPT as a development assistant for architecture, JavaScript drafting, debugging, tests and documentation. The module is reviewed, tested and integrated manually by the author. Generated visual assets are produced locally through deterministic project tooling rather than supplied by ChatGPT.
