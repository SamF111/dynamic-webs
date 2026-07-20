import {
  MODULE_ID,
  MODULE_TITLE
} from "../../module/moduleConstants.js";

import {
  resolveCanvasParentForWebLayer
} from "../../foundry/displayCompatibility.js";

import {
  configureWebDisplayObject,
  drawWebPolyline
} from "./webDrawingCompatibility.js";

/** Own the transient PIXI representation of generated web blueprints. */
export class WebRenderService {
  constructor() {
    this.container =
      null;

    this.graphicsByWebId =
      new Map();

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

    this.lastThicknessMultiplier =
      1;
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

    const container =
      new pixi.Container();

    configureWebContainer(
      container,
      configuration
    );

    parent.addChild(
      container
    );

    markParentForSorting(
      parent
    );

    this.container =
      container;

    try {
      for (
        const web of
        Array.isArray(
          webs
        )
          ? webs
          : []
      ) {
        const graphics =
          new pixi.Graphics();

        configureWebDisplayObject(
          graphics
        );

        graphics.name =
          `${MODULE_ID}.web.${web.id}`;

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

        container.addChild(
          graphics
        );

        this.graphicsByWebId.set(
          web.id,
          graphics
        );
      }
    } catch (error) {
      this.clear();

      throw error;
    }

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
          container.zIndex
        )
      )
        ? Number(
            container.zIndex
          )
        : null;

    this.lastThicknessMultiplier =
      thicknessMultiplier;

    return container;
  }

  clear() {
    const container =
      this.container;

    const hadGraphics =
      this.graphicsByWebId.size >
      0;

    this.container =
      null;

    this.graphicsByWebId.clear();

    if (
      !container ||
      container.destroyed ===
        true
    ) {
      if (
        hadGraphics
      ) {
        this.lastClearedAt =
          Date.now();
      }

      return hadGraphics;
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

      markParentForSorting(
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

    this.lastClearedAt =
      Date.now();

    return true;
  }

  createDiagnosticSnapshot() {
    const container =
      this.container;

    const hasContainer =
      Boolean(
        container &&
        container.destroyed !==
          true
      );

    return Object.freeze({
      hasContainer,
      containerDestroyed:
        container?.destroyed ===
          true,
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
      childCount:
        Array.isArray(
          container?.children
        )
          ? container.children.length
          : 0,
      parentName:
        hasContainer
          ? resolveDisplayName(
              container.parent
            )
          : this.lastParentName,
      layerMode:
        this.lastLayerMode,
      zIndex:
        hasContainer &&
        Number.isFinite(
          Number(
            container.zIndex
          )
        )
          ? Number(
              container.zIndex
            )
          : this.lastZIndex,
      thicknessMultiplier:
        this.lastThicknessMultiplier,
      renderRevision:
        this.renderRevision,
      lastRenderedAt:
        this.lastRenderedAt,
      lastClearedAt:
        this.lastClearedAt
    });
  }
}

function configureWebContainer(
  container,
  configuration
) {
  configureWebDisplayObject(
    container
  );

  container.name =
    `${MODULE_ID}.webs`;

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
    0;

  container.sortLayer =
    640;

  container.sort =
    -100;

  container.zIndex =
    Number.isFinite(
      Number(
        configuration?.zIndex
      )
    )
      ? Number(
          configuration.zIndex
        )
      : -100;
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
