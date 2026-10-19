<!-- D:/FoundryVTT/Data/modules/dynamic-webs/docs/V1-RELEASE.md -->
<!-- Purpose: Describe the v1 release notice, optional integration and compatible diagnostic optimization. -->
# Dynamic Webs 1.0

Dynamic Webs remains a standalone module. Ambient Critters is an optional companion, never a required dependency. Existing APIs, macros and diagnostic observers retain their signatures, result shapes and immutable snapshots.

Each GM receives one private introduction per world on first loading this release. It explains the optional Ambient Critters integration and links to its project. The receipt is stored on the User document as flags.dynamic-webs.v1CompanionNotice, so changing browser or deleting chat history does not repeat the notice. A failed send is retried on a later load. A failed receipt save can recover from the existing private message. Players receive no introduction and no delivery flag. The notice does not block module startup.

The settings page links to Ambient Critters only when it is absent from Foundry's installed module collection. An installed but inactive companion is not advertised as missing. Ambient Critters reciprocates with a Dynamic Webs link. Neither module imports code or assets from the other to render these links.

Movement diagnostics now freeze their query-owned objects directly. Each callback still receives a fresh, deeply frozen snapshot with ordinary object prototypes and the same fields. Observer failures remain isolated and nested queries are safe. This reduces opt-in profiling overhead; normal gameplay does not create these diagnostics.

Version and release asset URLs target 1.0.0. Release assets must be published separately before those URLs can deliver an update. The Ambient Critters project URL must be publicly accessible before release.
