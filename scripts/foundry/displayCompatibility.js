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
 * Resolve a PrimaryCanvasGroup sort layer for one web render mode.
 * Foundry v13 and v14 both publish TILES=500, DRAWINGS=600 and TOKENS=700;
 * runtime values are preferred so later compatible releases remain adaptable.
 */
export function resolveWebPrimarySortLayer(
  layerMode
) {
  const layers = resolvePrimaryCanvasSortLayers();

  switch (layerMode) {
    case WEB_RENDER_LAYER_MODES.UNDER_TILES:
      return midpoint(layers.SCENE, layers.TILES);

    case WEB_RENDER_LAYER_MODES.ABOVE_TILES:
      return midpoint(layers.TILES, layers.DRAWINGS);

    case WEB_RENDER_LAYER_MODES.UNDER_TOKENS:
      return midpoint(layers.DRAWINGS, layers.TOKENS);

    case WEB_RENDER_LAYER_MODES.ABOVE_TOKENS:
      return midpoint(layers.TOKENS, layers.WEATHER);

    default:
      return midpoint(layers.DRAWINGS, layers.TOKENS);
  }
}

function resolvePrimaryCanvasSortLayers() {
  const candidates = [
    globalThis.foundry?.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS,
    globalThis.PrimaryCanvasGroup?.SORT_LAYERS,
    globalThis.CONFIG?.Canvas?.groups?.primary?.groupClass?.SORT_LAYERS,
    globalThis.canvas?.primary?.constructor?.SORT_LAYERS
  ];

  for (const candidate of candidates) {
    if (candidate && Number.isFinite(Number(candidate.TILES)) &&
        Number.isFinite(Number(candidate.TOKENS))) {
      return {
        SCENE: finiteOr(candidate.SCENE, 0),
        TILES: finiteOr(candidate.TILES, 500),
        DRAWINGS: finiteOr(candidate.DRAWINGS, midpoint(candidate.TILES, candidate.TOKENS)),
        TOKENS: finiteOr(candidate.TOKENS, 700),
        WEATHER: finiteOr(candidate.WEATHER, 1000)
      };
    }
  }

  return { SCENE: 0, TILES: 500, DRAWINGS: 600, TOKENS: 700, WEATHER: 1000 };
}

function midpoint(first, second) {
  return (Number(first) + Number(second)) / 2;
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

