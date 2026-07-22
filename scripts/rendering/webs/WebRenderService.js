import {
  MODULE_ID,
  MODULE_TITLE
} from "../../module/moduleConstants.js";

import {
  resolveCanvasParentForWebLayer,
  resolveWebPrimarySortLayer
} from "../../foundry/displayCompatibility.js";

import {
  configureWebDisplayObject,
  drawWebPolyline
} from "./webDrawingCompatibility.js";

import {
  WebCarpetPatchTextureService,
  configureWebCarpetColourFilter
} from "./WebCarpetPatchTextureService.js";

import {
  WebCarpetRegionMaskService,
  applyWebCarpetRegionMask,
  destroyWebCarpetRegionMaskResource
} from "./webCarpetRegionMask.js";

import {
  getWebColourProfile
} from "../../simulation/webs/webColourProfiles.js";

/** Own the transient PIXI representation of generated web blueprints. */
export class WebRenderService {
  constructor(
    options = {}
  ) {
    /**
     * Backwards-compatible reference to the highest visible elevation
     * container. Cumulative level visibility requires several sibling
     * containers so each level can sort independently against Levels tiles.
     */
    this.container =
      null;

    this.containers =
      [];

    this.graphicsByWebId =
      new Map();

    this.carpetTextureService =
      options.carpetTextureService instanceof
        WebCarpetPatchTextureService
        ? options.carpetTextureService
        : new WebCarpetPatchTextureService();

    this.carpetMaskResources =
      new Map();

    this.carpetMaskService =
      options.carpetMaskService instanceof
        WebCarpetRegionMaskService
        ? options.carpetMaskService
        : new WebCarpetRegionMaskService();

    this.lastRenderedCarpetCount =
      0;

    this.lastRenderedCarpetPatchCount =
      0;

    this.renderRevision =
      0;

    this.lastRenderedAt =
      null;

    this.lastClearedAt =
      null;

    this.lastLayerMode =
      null;

    this.lastParentName =
      null;

    this.lastZIndex =
      null;

    this.lastElevation =
      0;

    this.lastElevations =
      Object.freeze([]);

    this.lastContainerCount =
      0;

    this.lastThicknessMultiplier =
      1;

    this.lastThicknessMultipliersByPopulation =
      Object.freeze({});
  }

  render(
    webs,
    configuration
  ) {
    this.clear();

    const pixi =
      requirePixi();

    const layerMode =
      configuration?.layerMode ??
      "under-tokens";

    const thicknessMultiplier =
      resolveThicknessMultiplier(
        configuration?.thicknessMultiplier
      );

    const parent =
      resolveCanvasParentForWebLayer(
        layerMode
      );

    if (!parent) {
      throw new Error(
        `${MODULE_TITLE} | The canvas parent for generated webs is unavailable.`
      );
    }

    const visibleWebs =
      Array.isArray(
        webs
      )
        ? webs
        : [];

    const renderGroups =
      createElevationRenderGroups(
        visibleWebs
      );

    this.containers =
      [];

    try {
      for (
        const [
          groupIndex,
          renderGroup
        ] of renderGroups.entries()
      ) {
        const container =
          new pixi.Container();

        configureWebContainer(
          container,
          configuration,
          layerMode,
          renderGroup.elevation,
          resolveWebContainerName({
            elevation:
              renderGroup.elevation,
            groupIndex,
            groupCount:
              renderGroups.length
          })
        );

        parent.addChild(
          container
        );

        this.containers.push(
          container
        );

        this.container =
          container;

        for (
          const web of
          renderGroup.webs
        ) {
          renderWebGraphic({
            pixi,
            container,
            web,
            configuration,
            thicknessMultiplier,
            graphicsByWebId:
              this.graphicsByWebId,
            carpetTextureService:
              this.carpetTextureService,
            carpetMaskResources:
              this.carpetMaskResources,
            carpetMaskService:
              this.carpetMaskService
          });
        }
      }

      markParentForSorting(
        parent
      );
    } catch (error) {
      this.clear();

      throw error;
    }

    this.lastThicknessMultipliersByPopulation =
      Object.freeze(
        Object.fromEntries(
          visibleWebs.map(
            (
              web
            ) => [
              web.populationId ??
                "default",
              resolveThicknessMultiplier(
                web?.thicknessMultiplier ??
                thicknessMultiplier
              )
            ]
          )
        )
      );

    this.renderRevision +=
      1;

    this.lastRenderedAt =
      Date.now();

    this.lastLayerMode =
      layerMode;

    this.lastParentName =
      resolveDisplayName(
        parent
      );

    this.lastZIndex =
      Number.isFinite(
        Number(
          this.container?.zIndex
        )
      )
        ? Number(
            this.container.zIndex
          )
        : null;

    this.lastElevation =
      resolveFiniteElevation(
        this.container?.elevation,
        renderGroups.at(
          -1
        )?.elevation ??
        0
      );

    this.lastElevations =
      Object.freeze(
        renderGroups.map(
          (
            renderGroup
          ) =>
            renderGroup.elevation
        )
      );

    this.lastContainerCount =
      this.containers.length;

    this.lastThicknessMultiplier =
      thicknessMultiplier;

    this.lastRenderedCarpetCount =
      visibleWebs.filter(
        (
          web
        ) =>
          web?.kind ===
            "web-carpet"
      ).length;

    this.lastRenderedCarpetPatchCount =
      visibleWebs.reduce(
        (
          total,
          web
        ) =>
          total +
          (
            web?.kind ===
              "web-carpet" &&
            Array.isArray(
              web?.carpet?.patches
            )
              ? web.carpet.patches.length
              : 0
          ),
        0
      );

    return this.container;
  }

  clear() {
    for (
      const resource of
      this.carpetMaskResources.values()
    ) {
      destroyWebCarpetRegionMaskResource(
        resource
      );
    }

    this.carpetMaskResources.clear();

    const containers =
      collectActiveContainers(
        this.containers,
        this.container
      );

    const hadContainers =
      containers.length >
      0;

    const hadGraphics =
      this.graphicsByWebId.size >
      0;

    this.container =
      null;

    this.containers =
      [];

    this.graphicsByWebId.clear();

    const parentsToSort =
      new Set();

    for (
      const container of
      containers
    ) {
      if (
        !container ||
        container.destroyed ===
          true
      ) {
        continue;
      }

      if (
        container.parent &&
        typeof container.parent.removeChild ===
          "function"
      ) {
        const parent =
          container.parent;

        parent.removeChild(
          container
        );

        parentsToSort.add(
          parent
        );
      }

      if (
        typeof container.destroy ===
          "function"
      ) {
        try {
          container.destroy({
            children:
              true
          });
        } catch (_error) {
          container.destroy();
        }
      }
    }

    for (
      const parent of
      parentsToSort
    ) {
      markParentForSorting(
        parent
      );
    }

    if (
      hadContainers ||
      hadGraphics
    ) {
      this.lastClearedAt =
        Date.now();
    }

    return hadContainers ||
      hadGraphics;
  }

  clearCarpetTextureCache() {
    const clearedTextures =
      this.carpetTextureService.clear();

    const clearedMasks =
      this.carpetMaskService.clear();

    return clearedTextures ||
      clearedMasks;
  }

  createDiagnosticSnapshot() {
    const containers =
      collectActiveContainers(
        this.containers,
        this.container
      ).filter(
        (
          container
        ) =>
          container.destroyed !==
            true
      );

    const container =
      containers.at(
        -1
      ) ??
      null;

    const hasContainer =
      containers.length >
      0;

    const elevations =
      hasContainer
        ? containers.map(
            (
              item
            ) =>
              resolveFiniteElevation(
                item.elevation,
                0
              )
          )
        : Array.from(
            this.lastElevations
          );

    return Object.freeze({
      hasContainer,
      containerDestroyed:
        this.container?.destroyed ===
          true,
      containerCount:
        hasContainer
          ? containers.length
          : 0,
      lastContainerCount:
        this.lastContainerCount,
      renderedWebCount:
        this.graphicsByWebId.size,
      renderedWebIds:
        Object.freeze(
          Array.from(
            this.graphicsByWebId.keys()
          )
        ),
      containerName:
        container?.name ??
        null,
      containerNames:
        Object.freeze(
          containers.map(
            (
              item
            ) =>
              item.name ??
              null
          )
        ),
      childCount:
        containers.reduce(
          (
            total,
            item
          ) =>
            total +
            (
              Array.isArray(
                item.children
              )
                ? item.children.length
                : 0
            ),
          0
        ),
      parentName:
        hasContainer
          ? resolveDisplayName(
              containers[0].parent
            )
          : this.lastParentName,
      layerMode:
        this.lastLayerMode,
      zIndex:
        hasContainer &&
        Number.isFinite(
          Number(
            container?.zIndex
          )
        )
          ? Number(
              container.zIndex
            )
          : this.lastZIndex,
      elevation:
        hasContainer
          ? resolveFiniteElevation(
              container?.elevation,
              this.lastElevation
            )
          : this.lastElevation,
      elevations:
        Object.freeze(
          elevations
        ),
      thicknessMultiplier:
        this.lastThicknessMultiplier,
      thicknessMultipliersByPopulation:
        this.lastThicknessMultipliersByPopulation,
      renderedCarpetCount:
        this.lastRenderedCarpetCount,
      renderedCarpetPatchCount:
        this.lastRenderedCarpetPatchCount,
      carpetMaskCount:
        this.carpetMaskResources.size,
      carpetTextures:
        this.carpetTextureService.createDiagnosticSnapshot(),
      carpetMasks:
        this.carpetMaskService.createDiagnosticSnapshot(),
      renderRevision:
        this.renderRevision,
      lastRenderedAt:
        this.lastRenderedAt,
      lastClearedAt:
        this.lastClearedAt
    });
  }
}

function renderWebGraphic({
  pixi,
  container,
  web,
  configuration,
  thicknessMultiplier,
  graphicsByWebId,
  carpetTextureService,
  carpetMaskResources,
  carpetMaskService
}) {
  if (
    web?.kind ===
      "web-carpet"
  ) {
    renderWebCarpetPatchGraphic({
      pixi,
      container,
      web,
      carpetTextureService,
      carpetMaskResources,
      carpetMaskService,
      graphicsByWebId,
      thicknessMultiplier:
        resolveThicknessMultiplier(
          web?.thicknessMultiplier ??
          thicknessMultiplier
        )
    });

    return;
  }

  const webThicknessMultiplier =
    resolveThicknessMultiplier(
      web?.thicknessMultiplier ??
      thicknessMultiplier
    );

  const graphics =
    new pixi.Graphics();

  configureWebDisplayObject(
    graphics
  );

  graphics.name =
    `${MODULE_ID}.web.${web.id}`;

  graphics.elevation =
    resolveWebElevation(
      web,
      container.elevation
    );

  graphics.zIndex =
    web.kind ===
      "ground"
      ? -20
      : -10;

  for (
    const strand of
    web.strands
  ) {
    drawWebPolyline(
      graphics,
      strand.points,
      {
        width:
          (
            strand.widthPx +
            configuration.underWidthAdditionPx
          ) *
          webThicknessMultiplier,
        colour:
          resolveStrandColour(
            strand.underColour,
            configuration?.underColour,
            0x111827
          ),
        alpha:
          strand.alpha *
          configuration.underAlphaMultiplier
      }
    );

    drawWebPolyline(
      graphics,
      strand.points,
      {
        width:
          strand.widthPx *
          webThicknessMultiplier,
        colour:
          resolveStrandColour(
            strand.colour,
            configuration?.silkColour,
            0xe8edf2
          ),
        alpha:
          strand.alpha
      }
    );
  }

  container.addChild(
    graphics
  );

  graphicsByWebId.set(
    web.id,
    graphics
  );
}

function renderWebCarpetPatchGraphic({
  pixi,
  container,
  web,
  carpetTextureService,
  carpetMaskResources,
  carpetMaskService,
  graphicsByWebId,
  thicknessMultiplier
}) {
  const carpet =
    web?.carpet;

  if (
    !carpet ||
    !Array.isArray(
      carpet.patches
    ) ||
    carpet.patches.length ===
      0
  ) {
    return;
  }

  const profile =
    getWebColourProfile(
      web.colourProfileId
    );

  const display =
    new pixi.Container();

  configureWebDisplayObject(
    display
  );

  display.name =
    `${MODULE_ID}.web-carpet.${web.id}`;

  display.elevation =
    resolveWebElevation(
      web,
      container.elevation
    );

  display.zIndex =
    -25;

  const patchContainer =
    new pixi.Container();

  configureWebDisplayObject(
    patchContainer
  );

  patchContainer.name =
    `${display.name}.patches`;

  const decorativeColour =
    profile.configuration.decorativeColour;

  const colourFilterApplied =
    configureWebCarpetColourFilter({
      pixi,
      displayObject:
        patchContainer,
      tint:
        decorativeColour
    });

  const maskResource =
    carpetMaskService.createMaskSprite({
      pixi,
      carpet
    });

  configureWebDisplayObject(
    maskResource.sprite
  );

  maskResource.sprite.name =
    `${display.name}.mask`;

  maskResource.sprite.elevation =
    display.elevation;

  maskResource.sprite.zIndex =
    display.zIndex;

  display.addChild(
    patchContainer
  );

  container.addChild(
    maskResource.sprite
  );

  container.addChild(
    display
  );

  applyWebCarpetRegionMask({
    target:
      display,
    resource:
      maskResource
  });

  for (
    const descriptor of
    carpet.patches
  ) {
    patchContainer.addChild(
      carpetTextureService.createPatchSprite({
        pixi,
        descriptor,
        tint:
          colourFilterApplied
            ? 0xffffff
            : decorativeColour,
        alphaMultiplier:
          profile.configuration.alphaMultiplier,
        thicknessMultiplier
      })
    );
  }

  carpetMaskResources.set(
    web.id,
    maskResource
  );

  graphicsByWebId.set(
    web.id,
    display
  );
}

function configureWebContainer(
  container,
  configuration,
  layerMode,
  renderElevation,
  name
) {
  configureWebDisplayObject(
    container
  );

  container.name =
    name;

  if (
    "label" in
    container
  ) {
    container.label =
      container.name;
  }

  container.sortableChildren =
    true;

  container.elevation =
    resolveFiniteElevation(
      renderElevation,
      0
    );

  container.sortLayer =
    resolveWebPrimarySortLayer(
      layerMode
    );

  container.sort =
    0;

  container.zIndex =
    Number.isFinite(
      Number(
        configuration?.zIndex
      )
    )
      ? Number(
          configuration.zIndex
        )
      : 0;
}

function createElevationRenderGroups(
  webs
) {
  const groupsByElevation =
    new Map();

  for (
    const web of
    Array.isArray(
      webs
    )
      ? webs
      : []
  ) {
    const elevation =
      resolveWebElevation(
        web,
        0
      );

    const key =
      String(
        elevation
      );

    let group =
      groupsByElevation.get(
        key
      );

    if (!group) {
      group = {
        elevation,
        webs:
          []
      };

      groupsByElevation.set(
        key,
        group
      );
    }

    group.webs.push(
      web
    );
  }

  if (
    groupsByElevation.size ===
      0
  ) {
    return Object.freeze([
      Object.freeze({
        elevation:
          0,
        webs:
          Object.freeze([])
      })
    ]);
  }

  return Object.freeze(
    Array.from(
      groupsByElevation.values()
    )
      .sort(
        (
          first,
          second
        ) =>
          first.elevation -
          second.elevation
      )
      .map(
        (
          group
        ) =>
          Object.freeze({
            elevation:
              group.elevation,
            webs:
              Object.freeze(
                group.webs
              )
          })
      )
  );
}

function resolveWebContainerName({
  elevation,
  groupIndex,
  groupCount
}) {
  if (
    groupCount ===
      1
  ) {
    return `${MODULE_ID}.webs`;
  }

  return [
    `${MODULE_ID}.webs`,
    `level-${groupIndex}`,
    `elevation-${formatElevationForName(elevation)}`
  ].join(
    "."
  );
}

function formatElevationForName(
  elevation
) {
  return String(
    resolveFiniteElevation(
      elevation,
      0
    )
  )
    .replace(
      /^-/u,
      "negative-"
    )
    .replace(
      /\./gu,
      "-"
    );
}

function collectActiveContainers(
  containers,
  fallbackContainer
) {
  const uniqueContainers = [];
  const seen =
    new Set();

  for (
    const container of
    [
      ...(
        Array.isArray(
          containers
        )
          ? containers
          : []
      ),
      fallbackContainer
    ]
  ) {
    if (
      !container ||
      seen.has(
        container
      )
    ) {
      continue;
    }

    seen.add(
      container
    );

    uniqueContainers.push(
      container
    );
  }

  return uniqueContainers;
}

function markParentForSorting(
  parent
) {
  if (!parent) {
    return;
  }

  if (
    "sortableChildren" in
    parent
  ) {
    parent.sortableChildren =
      true;
  }

  if (
    "sortDirty" in
    parent
  ) {
    parent.sortDirty =
      true;
  }

  if (
    "renderDirty" in
    parent
  ) {
    parent.renderDirty =
      true;
  }

  if (
    typeof parent.sortChildren ===
      "function"
  ) {
    parent.sortChildren();
  }
}

function resolveDisplayName(
  displayObject
) {
  if (!displayObject) {
    return null;
  }

  const value =
    displayObject.name ??
    displayObject.label ??
    displayObject.constructor?.name ??
    null;

  return value ===
    null
    ? null
    : String(
        value
      );
}

function resolveWebElevation(
  web,
  fallback = 0
) {
  return resolveFiniteElevation(
    web?.elevationBand?.bottom,
    resolveFiniteElevation(
      web?.elevation,
      fallback
    )
  );
}

function resolveFiniteElevation(
  value,
  fallback = 0
) {
  const numericValue =
    Number(
      value
    );

  if (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(
      numericValue
    )
  ) {
    return numericValue;
  }

  const numericFallback =
    Number(
      fallback
    );

  return Number.isFinite(
    numericFallback
  )
    ? numericFallback
    : 0;
}

function resolveThicknessMultiplier(
  value
) {
  const numericValue =
    Number(
      value
    );

  return Number.isFinite(
    numericValue
  ) &&
    numericValue >
      0
    ? numericValue
    : 1;
}

function resolveStrandColour(
  strandColour,
  legacyConfigurationColour,
  fallback
) {
  for (
    const value of
    [
      strandColour,
      legacyConfigurationColour,
      fallback
    ]
  ) {
    const numericValue =
      Number(
        value
      );

    if (
      Number.isInteger(
        numericValue
      ) &&
      numericValue >=
        0 &&
      numericValue <=
        0xffffff
    ) {
      return numericValue;
    }
  }

  return fallback;
}

function requirePixi() {
  const pixi =
    globalThis.PIXI;

  if (
    !pixi ||
    typeof pixi.Container !==
      "function" ||
    typeof pixi.Graphics !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | PIXI.Container and PIXI.Graphics are required to render generated webs.`
    );
  }

  return pixi;
}

