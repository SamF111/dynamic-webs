// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\module\moduleConstants.js

export const MODULE_ID =
  "dynamic-webs";

export const MODULE_TITLE =
  "Dynamic Webs";

export const RUNTIME_KEY =
  "dynamicWebs";

export const PUBLIC_API_VERSION =
  1;

/**
 * Generic Foundry canvas placement modes supported by generated webs.
 */
export const WEB_RENDER_LAYER_MODES =
  Object.freeze({
    UNDER_TILES:
      "under-tiles",

    ABOVE_TILES:
      "above-tiles",

    UNDER_TOKENS:
      "under-tokens",

    ABOVE_TOKENS:
      "above-tokens",

    EFFECTS:
      "effects"
  });

export const DEFAULT_WEB_RENDER_LAYER_MODE =
  WEB_RENDER_LAYER_MODES.UNDER_TOKENS;
