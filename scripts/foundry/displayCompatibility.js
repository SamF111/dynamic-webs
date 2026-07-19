// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\foundry\displayCompatibility.js

import {
  MODULE_TITLE,
  WEB_RENDER_LAYER_MODES
} from "../module/moduleConstants.js";

/**
 * Resolve the best canvas parent for one web render-layer mode.
 *
 * @param {string} layerMode - Render-layer mode.
 * @returns {object|null} PIXI-compatible parent.
 */
export function resolveCanvasParentForWebLayer(
  layerMode
) {
  const currentCanvas =
    globalThis.canvas;

  switch (layerMode) {
    case WEB_RENDER_LAYER_MODES.UNDER_TILES:
      return firstDisplayContainer(
        currentCanvas?.background,
        currentCanvas?.primary
      );

    case WEB_RENDER_LAYER_MODES.ABOVE_TILES:
    case WEB_RENDER_LAYER_MODES.UNDER_TOKENS:
    case WEB_RENDER_LAYER_MODES.ABOVE_TOKENS:
      return firstDisplayContainer(
        currentCanvas?.primary
      );

    case WEB_RENDER_LAYER_MODES.EFFECTS:
      return firstDisplayContainer(
        currentCanvas?.effects,
        currentCanvas?.primary
      );

    default:
      return firstDisplayContainer(
        currentCanvas?.primary
      );
  }
}

/**
 * Determine whether the active canvas can host generated webs.
 *
 * @returns {boolean} True when the active Scene and canvas parent are ready.
 */
export function isWebCanvasUsable() {
  return Boolean(
    globalThis.canvas?.ready &&
    globalThis.canvas?.scene &&
    resolveCanvasParentForWebLayer(
      WEB_RENDER_LAYER_MODES.UNDER_TOKENS
    )
  );
}

function firstDisplayContainer(
  ...candidates
) {
  for (
    const candidate of
    candidates
  ) {
    if (
      candidate &&
      typeof candidate ===
        "object" &&
      typeof candidate.addChild ===
        "function"
    ) {
      return candidate;
    }
  }

  return null;
}

/**
 * Assert that PIXI rendering is available.
 *
 * @returns {object} PIXI namespace.
 */
export function requirePixi() {
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
