# Dynamic Webs roadmap

Dynamic Webs is **feature complete for its intended standalone scope**.

The module now does what it was created to do: generate configurable, deterministic spider webs that make Foundry Scenes feel more lived in, while also providing optional span behaviour and a stable integration surface for other modules.

There is no scheduled post-release feature roadmap. Completed implementation history belongs in release notes and the changelog rather than in a growing list of finished milestones.

## Feature-complete scope

Dynamic Webs includes:

- Wall-corner, wall-span, ground and web-carpet generation
- Multiple independent Scene populations
- Density, colour, thickness, floor and Region controls
- Foundry v13 Levels support and Foundry v14 native elevation support
- Deterministic procedural WebP presentation assets
- Scene-wide span vision, secret-door movement and destructibility options
- Persistent whole-span destruction and restoration
- Generated-wall reconciliation and maintenance controls
- Immutable spatial queries and generic entity interaction checks
- Client-local captured-web presentation above or below tokens
- Stable public API version 1
- Diagnostics, automated validation and procedural asset-generation tooling

## Release work

Remaining work before the first public release is release engineering rather than feature development:

- Complete final Foundry v13 and v14 smoke testing
- Verify installation from the published manifest and module archive
- Confirm multi-client span destruction and restoration
- Review dense and carpet-heavy Scene performance
- Finalise screenshots, release notes and package publication

## Maintenance policy

After release, development will focus on:

- Bug fixes
- Foundry compatibility
- Performance and stability
- Documentation
- Safe migrations when stored schemas must change
- Maintaining the public API version 1 contract

New functionality should be added only when actual play or a real external integration demonstrates a missing generic capability.

## Scope boundary

Dynamic Webs remains creature-agnostic.

It can report where webs are, evaluate movement against them, destroy eligible spans and present captured-web visuals. It does not decide whether a particular creature is trapped, escapes, ignores a web or carries an overlay when it moves.

Ambient Critters and other consumers own those rules and integrate through the public API and hooks. Their adapters belong in the consuming module rather than in Dynamic Webs.

## Future ideas

There are no committed future feature milestones.

Possible ideas may be tracked as individual issues when there is a concrete use case, but they are not promises or part of the release scope. Feature history should remain in the changelog and GitHub releases rather than being restored to this roadmap.
