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
  WebCornerAssetTextureService
} from "./WebCornerAssetTextureService.js";

import {
  WebSpanAssetTextureService
} from "./WebSpanAssetTextureService.js";

import {
  WebGroundAssetTextureService
} from "./WebGroundAssetTextureService.js";

import {
  WebCarpetRegionMaskService,
  applyWebCarpetRegionMask,
  destroyWebCarpetRegionMaskResource
} from "./webCarpetRegionMask.js";

import {
  getWebColourProfile
} from "../../simulation/webs/webColourProfiles.js";

import {
  normaliseSceneWebThickness
} from "../../config/sceneWebThicknessConfiguration.js";

const WEB_RENDER_CONTAINER_BANDS =
  Object.freeze({
    CARPET:
      "carpet",

    STRANDS:
      "strands"
  });

/**
 * Ambient Critters' ordinary under-token containers use sortLayer 650. Dynamic
 * Webs resolves the same regular under-token lane, so carpets need a distinct
 * sibling container just beneath it rather than relying on child zIndex.
 *
 * The one-unit offset keeps carpets above the preceding Foundry sort layer,
 * while guaranteeing that under-token critter bodies sort after them. Firefly
 * glows live in the Interface Canvas Group and therefore remain above both.
 */
const WEB_CARPET_PRIMARY_SORT_LAYER_OFFSET =
  -1;

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

    this.cornerTextureService =
      options.cornerTextureService instanceof
        WebCornerAssetTextureService
        ? options.cornerTextureService
        : new WebCornerAssetTextureService();

    this.spanTextureService =
      options.spanTextureService instanceof
        WebSpanAssetTextureService
        ? options.spanTextureService
        : new WebSpanAssetTextureService();

    this.groundTextureService =
      options.groundTextureService instanceof
        WebGroundAssetTextureService
        ? options.groundTextureService
        : new WebGroundAssetTextureService();

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

    this.lastRenderedCornerAssetCount =
      0;

    this.lastRenderedSpanAssetCount =
      0;

    this.lastRenderedGroundAssetCount =
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
      createWebRenderGroups(
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
          renderGroup.band,
          resolveWebContainerName({
            elevation:
              renderGroup.elevation,
            band:
              renderGroup.band,
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
              this.carpetMaskService,
            cornerTextureService:
              this.cornerTextureService,
            spanTextureService:
              this.spanTextureService,
            groundTextureService:
              this.groundTextureService
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
        createSortedUniqueElevations(
          renderGroups.map(
            (
              renderGroup
            ) =>
              renderGroup.elevation
          )
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

    this.lastRenderedCornerAssetCount =
      visibleWebs.filter(
        (
          web
        ) =>
          web?.kind ===
            "wall-corner" &&
          web?.cornerAsset
      ).length;

    this.lastRenderedSpanAssetCount =
      visibleWebs.filter(
        (
          web
        ) =>
          web?.kind ===
            "wall-span" &&
          web?.spanAsset
      ).length;

    this.lastRenderedGroundAssetCount =
      visibleWebs.filter(
        (
          web
        ) =>
          web?.kind ===
            "ground" &&
          web?.groundAsset
      ).length;

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

  clearCornerTextureCache() {
    return this.cornerTextureService.clear();
  }

  clearSpanTextureCache() {
    return this.spanTextureService.clear();
  }

  clearGroundTextureCache() {
    return this.groundTextureService.clear();
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
        ? createSortedUniqueElevations(
            containers.map(
              (
                item
              ) =>
                resolveFiniteElevation(
                  item.elevation,
                  0
                )
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
      containerBands:
        Object.freeze(
          containers.map(
            (
              item
            ) =>
              item.dynamicWebsRenderBand ??
              null
          )
        ),
      containerSortLayers:
        Object.freeze(
          containers.map(
            (
              item
            ) =>
              Number.isFinite(
                Number(
                  item.sortLayer
                )
              )
                ? Number(
                    item.sortLayer
                  )
                : null
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
      renderedCornerAssetCount:
        this.lastRenderedCornerAssetCount,
      renderedSpanAssetCount:
        this.lastRenderedSpanAssetCount,
      renderedGroundAssetCount:
        this.lastRenderedGroundAssetCount,
      carpetMaskCount:
        this.carpetMaskResources.size,
      carpetTextures:
        this.carpetTextureService.createDiagnosticSnapshot(),
      carpetMasks:
        this.carpetMaskService.createDiagnosticSnapshot(),
      cornerTextures:
        this.cornerTextureService.createDiagnosticSnapshot(),
      spanTextures:
        this.spanTextureService.createDiagnosticSnapshot(),
      groundTextures:
        this.groundTextureService.createDiagnosticSnapshot(),
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
  carpetMaskService,
  cornerTextureService,
  spanTextureService,
  groundTextureService
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

  if (
    web?.kind ===
      "wall-corner" &&
    web?.cornerAsset &&
    cornerTextureService
  ) {
    const rendered =
      renderWallCornerAssetGraphic({
        pixi,
        container,
        web,
        configuration,
        thicknessMultiplier:
          webThicknessMultiplier,
        graphicsByWebId,
        cornerTextureService
      });

    if (rendered) {
      return;
    }
  }

  if (
    web?.kind ===
      "wall-span" &&
    web?.spanAsset &&
    spanTextureService
  ) {
    const rendered =
      renderWallSpanAssetGraphic({
        pixi,
        container,
        web,
        configuration,
        thicknessMultiplier:
          webThicknessMultiplier,
        graphicsByWebId,
        spanTextureService
      });

    if (rendered) {
      return;
    }
  }

  if (
    web?.kind ===
      "ground" &&
    web?.groundAsset &&
    groundTextureService
  ) {
    const rendered =
      renderGroundAssetGraphic({
        pixi,
        container,
        web,
        configuration,
        thicknessMultiplier:
          webThicknessMultiplier,
        graphicsByWebId,
        groundTextureService
      });

    if (rendered) {
      return;
    }
  }

  const graphics =
    createProceduralWebGraphics({
      pixi,
      web,
      configuration,
      thicknessMultiplier:
        webThicknessMultiplier
    });

  container.addChild(
    graphics
  );

  graphicsByWebId.set(
    web.id,
    graphics
  );
}

function renderWallCornerAssetGraphic({
  pixi,
  container,
  web,
  configuration,
  thicknessMultiplier,
  graphicsByWebId,
  cornerTextureService
}) {
  const fallback =
    createProceduralWebGraphics({
      pixi,
      web,
      configuration,
      thicknessMultiplier
    });

  fallback.name =
    `${MODULE_ID}.web-corner-fallback.${web.id}`;

  fallback.zIndex =
    0;

  const display =
    new pixi.Container();

  configureWebDisplayObject(
    display
  );

  display.name =
    `${MODULE_ID}.web-corner.${web.id}`;

  display.sortableChildren =
    true;

  display.elevation =
    resolveWebElevation(
      web,
      container.elevation
    );

  display.zIndex =
    -10;

  display.addChild(
    fallback
  );

  // Attach the procedural presentation before attempting any asset work. An
  // unavailable Sprite API, unsupported matrix API, failed texture request, or
  // malformed local asset can therefore never remove the generated corner web.
  container.addChild(
    display
  );

  graphicsByWebId.set(
    web.id,
    display
  );

  if (
    typeof pixi?.Sprite !==
      "function"
  ) {
    display.dynamicWebsCornerAssetSetupState =
      "sprite-api-unavailable";

    return true;
  }

  const profile =
    getWebColourProfile(
      web.colourProfileId
    );

  try {
    const assetDisplay =
      cornerTextureService.createCornerDisplay({
        pixi,
        presentation:
          web.cornerAsset,
        fallbackDisplay:
          fallback,
        tint:
          profile.configuration.captureColour,
        alphaMultiplier:
          profile.configuration.alphaMultiplier,
        thicknessMultiplier
      });

    if (
      assetDisplay
    ) {
      assetDisplay.zIndex =
        1;

      display.addChild(
        assetDisplay
      );

      display.dynamicWebsCornerAssetSetupState =
        "pending-or-loaded";
    } else {
      display.dynamicWebsCornerAssetSetupState =
        "asset-display-unavailable";
    }
  } catch (error) {
    display.dynamicWebsCornerAssetSetupState =
      "setup-failed";

    display.dynamicWebsCornerAssetSetupError =
      Object.freeze({
        name:
          String(
            error?.name ??
            "Error"
          ),
        message:
          String(
            error?.message ??
            error
          )
      });
  }

  return true;
}

function renderWallSpanAssetGraphic({
  pixi,
  container,
  web,
  configuration,
  thicknessMultiplier,
  graphicsByWebId,
  spanTextureService
}) {
  const fallback =
    createProceduralWebGraphics({
      pixi,
      web,
      configuration,
      thicknessMultiplier
    });

  fallback.name =
    `${MODULE_ID}.web-span-fallback.${web.id}`;

  fallback.zIndex =
    0;

  const display =
    new pixi.Container();

  configureWebDisplayObject(
    display
  );

  display.name =
    `${MODULE_ID}.web-span.${web.id}`;

  display.sortableChildren =
    true;

  display.elevation =
    resolveWebElevation(
      web,
      container.elevation
    );

  display.zIndex =
    -10;

  display.addChild(
    fallback
  );

  container.addChild(
    display
  );

  graphicsByWebId.set(
    web.id,
    display
  );

  const profile =
    getWebColourProfile(
      web.colourProfileId
    );

  try {
    const assetDisplay =
      spanTextureService.createSpanDisplay({
        pixi,
        presentation:
          web.spanAsset,
        fallbackDisplay:
          fallback,
        tint:
          profile.configuration.captureColour,
        alphaMultiplier:
          profile.configuration.alphaMultiplier,
        thicknessMultiplier
      });

    if (
      assetDisplay
    ) {
      assetDisplay.zIndex =
        1;

      display.addChild(
        assetDisplay
      );

      display.dynamicWebsSpanAssetSetupState =
        "pending-or-loaded";
    } else {
      display.dynamicWebsSpanAssetSetupState =
        "asset-display-unavailable";
    }
  } catch (error) {
    display.dynamicWebsSpanAssetSetupState =
      "setup-failed";

    display.dynamicWebsSpanAssetSetupError =
      Object.freeze({
        name:
          String(
            error?.name ??
            "Error"
          ),
        message:
          String(
            error?.message ??
            error
          )
      });
  }

  return true;
}

function renderGroundAssetGraphic({
  pixi,
  container,
  web,
  configuration,
  thicknessMultiplier,
  graphicsByWebId,
  groundTextureService
}) {
  const fallback =
    createProceduralWebGraphics({
      pixi,
      web,
      configuration,
      thicknessMultiplier
    });

  fallback.name =
    `${MODULE_ID}.web-ground-fallback.${web.id}`;

  fallback.zIndex =
    0;

  const display =
    new pixi.Container();

  configureWebDisplayObject(
    display
  );

  display.name =
    `${MODULE_ID}.web-ground.${web.id}`;

  display.sortableChildren =
    true;

  display.elevation =
    resolveWebElevation(
      web,
      container.elevation
    );

  display.zIndex =
    -20;

  display.addChild(
    fallback
  );

  container.addChild(
    display
  );

  graphicsByWebId.set(
    web.id,
    display
  );

  if (
    typeof pixi?.Sprite !==
      "function"
  ) {
    display.dynamicWebsGroundAssetSetupState =
      "sprite-api-unavailable";

    return true;
  }

  const profile =
    getWebColourProfile(
      web.colourProfileId
    );

  try {
    const assetDisplay =
      groundTextureService.createGroundDisplay({
        pixi,
        presentation:
          web.groundAsset,
        fallbackDisplay:
          fallback,
        tint:
          profile.configuration.captureColour,
        alphaMultiplier:
          profile.configuration.alphaMultiplier,
        thicknessMultiplier
      });

    if (
      assetDisplay
    ) {
      assetDisplay.zIndex =
        1;

      display.addChild(
        assetDisplay
      );

      display.dynamicWebsGroundAssetSetupState =
        "pending-or-loaded";
    } else {
      display.dynamicWebsGroundAssetSetupState =
        "asset-display-unavailable";
    }
  } catch (error) {
    display.dynamicWebsGroundAssetSetupState =
      "setup-failed";

    display.dynamicWebsGroundAssetSetupError =
      Object.freeze({
        name:
          String(
            error?.name ??
            "Error"
          ),
        message:
          String(
            error?.message ??
            error
          )
      });
  }

  return true;
}

function createProceduralWebGraphics({
  pixi,
  web,
  configuration,
  thicknessMultiplier
}) {
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
      0
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
          thicknessMultiplier,
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
          thicknessMultiplier,
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

  return graphics;
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
  renderBand,
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
    ) +
    (
      renderBand ===
        WEB_RENDER_CONTAINER_BANDS.CARPET
        ? WEB_CARPET_PRIMARY_SORT_LAYER_OFFSET
        : 0
    );

  container.dynamicWebsRenderBand =
    renderBand;

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

function createWebRenderGroups(
  webs
) {
  const groupsByElevationAndBand =
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

    const band =
      resolveWebRenderContainerBand(
        web
      );

    const key =
      `${String(elevation)}:${band}`;

    let group =
      groupsByElevationAndBand.get(
        key
      );

    if (!group) {
      group = {
        elevation,
        band,
        webs:
          []
      };

      groupsByElevationAndBand.set(
        key,
        group
      );
    }

    group.webs.push(
      web
    );
  }

  if (
    groupsByElevationAndBand.size ===
      0
  ) {
    return Object.freeze([
      Object.freeze({
        elevation:
          0,
        band:
          WEB_RENDER_CONTAINER_BANDS.STRANDS,
        webs:
          Object.freeze([])
      })
    ]);
  }

  return Object.freeze(
    Array.from(
      groupsByElevationAndBand.values()
    )
      .sort(
        (
          first,
          second
        ) =>
          first.elevation -
          second.elevation ||
          resolveWebRenderBandOrder(
            first.band
          ) -
          resolveWebRenderBandOrder(
            second.band
          )
      )
      .map(
        (
          group
        ) =>
          Object.freeze({
            elevation:
              group.elevation,
            band:
              group.band,
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
  band,
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
    band,
    `level-${groupIndex}`,
    `elevation-${formatElevationForName(elevation)}`
  ].join(
    "."
  );
}

function resolveWebRenderContainerBand(
  web
) {
  return web?.kind ===
    "web-carpet"
    ? WEB_RENDER_CONTAINER_BANDS.CARPET
    : WEB_RENDER_CONTAINER_BANDS.STRANDS;
}

function resolveWebRenderBandOrder(
  band
) {
  return band ===
    WEB_RENDER_CONTAINER_BANDS.CARPET
    ? 0
    : 1;
}

function createSortedUniqueElevations(
  elevations
) {
  return Array.from(
    new Set(
      (
        Array.isArray(
          elevations
        )
          ? elevations
          : []
      ).map(
        (
          elevation
        ) =>
          resolveFiniteElevation(
            elevation,
            0
          )
      )
    )
  ).sort(
    (
      first,
      second
    ) =>
      first -
      second
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
  return normaliseSceneWebThickness(
    value
  );
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

