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
    this.container = null;
    this.graphicsByWebId = new Map();
  }

  render(webs, configuration) {
    this.clear();

    const pixi = requirePixi();
    const layerMode = configuration?.layerMode ?? "under-tokens";
    const parent = resolveCanvasParentForWebLayer(layerMode);

    if (!parent) {
      throw new Error(
        `${MODULE_TITLE} | The canvas parent for generated webs is unavailable.`
      );
    }

    const container = new pixi.Container();
    configureWebContainer(container, configuration);
    parent.addChild(container);
    markParentForSorting(parent);

    for (const web of Array.isArray(webs) ? webs : []) {
      const graphics = new pixi.Graphics();
      configureWebDisplayObject(graphics);
      graphics.name = `${MODULE_ID}.web.${web.id}`;
      graphics.zIndex = web.kind === "ground" ? -20 : -10;

      for (const strand of web.strands) {
        drawWebPolyline(
          graphics,
          strand.points,
          {
            width:
              strand.widthPx + configuration.underWidthAdditionPx,
            colour:
              configuration.underColour,
            alpha:
              strand.alpha * configuration.underAlphaMultiplier
          }
        );

        drawWebPolyline(
          graphics,
          strand.points,
          {
            width:
              strand.widthPx,
            colour:
              configuration.silkColour,
            alpha:
              strand.alpha
          }
        );
      }

      container.addChild(graphics);
      this.graphicsByWebId.set(web.id, graphics);
    }

    this.container = container;
    return container;
  }

  clear() {
    const container = this.container;
    this.container = null;
    this.graphicsByWebId.clear();

    if (!container || container.destroyed === true) return false;

    if (container.parent && typeof container.parent.removeChild === "function") {
      const parent = container.parent;
      parent.removeChild(container);
      markParentForSorting(parent);
    }

    if (typeof container.destroy === "function") {
      try {
        container.destroy({ children: true });
      } catch (_error) {
        container.destroy();
      }
    }

    return true;
  }

  createDiagnosticSnapshot() {
    return Object.freeze({
      hasContainer:
        Boolean(this.container && this.container.destroyed !== true),
      renderedWebCount:
        this.graphicsByWebId.size,
      containerName:
        this.container?.name ?? null
    });
  }
}

function configureWebContainer(container, configuration) {
  configureWebDisplayObject(container);
  container.name = `${MODULE_ID}.webs`;
  if ("label" in container) container.label = container.name;
  container.sortableChildren = true;
  container.elevation = 0;
  container.sortLayer = 640;
  container.sort = -100;
  container.zIndex = Number.isFinite(Number(configuration?.zIndex))
    ? Number(configuration.zIndex)
    : -100;
}

function markParentForSorting(parent) {
  if (!parent) return;
  if ("sortableChildren" in parent) parent.sortableChildren = true;
  if ("sortDirty" in parent) parent.sortDirty = true;
  if ("renderDirty" in parent) parent.renderDirty = true;
  if (typeof parent.sortChildren === "function") parent.sortChildren();
}

function requirePixi() {
  const pixi = globalThis.PIXI;
  if (
    !pixi ||
    typeof pixi.Container !== "function" ||
    typeof pixi.Graphics !== "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | PIXI.Container and PIXI.Graphics are required to render generated webs.`
    );
  }
  return pixi;
}

