import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  DEFAULT_SCENE_WEB_DENSITY
} from "./sceneConfigurationDefaults.js";

import {
  readRawSceneWebConfiguration
} from "./sceneWebFlagReading.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "./sceneWebFlagPaths.js";

import {
  DISABLED_WEB_DENSITY_ID,
  WEB_DENSITY_ORDER,
  getWebDensityPreset,
  isSupportedWebDensityId
} from "../simulation/webs/webDensityPresets.js";

if (
  !isSupportedWebDensityId(
    DEFAULT_SCENE_WEB_DENSITY
  )
) {
  throw new Error(
    `${MODULE_TITLE} | JSON-backed default web density "${DEFAULT_SCENE_WEB_DENSITY}" is unsupported.`
  );
}

/**
 * Normalise one persisted Scene web-density identifier.
 *
 * @param {unknown} value - Candidate density identifier.
 * @returns {string} Supported density identifier.
 */
export function normaliseSceneWebDensity(
  value
) {
  const candidate =
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
      ? DEFAULT_SCENE_WEB_DENSITY
      : value;

  if (
    typeof candidate !==
      "string"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_DENSITY} must be a string.`
    );
  }

  const densityId =
    candidate.trim();

  if (
    !isSupportedWebDensityId(
      densityId
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported Scene web density "${densityId}". Supported densities: ${WEB_DENSITY_ORDER.join(", ")}.`
    );
  }

  return densityId;
}

/**
 * Resolve one Scene's standalone web-density configuration.
 *
 * @param {object} scene - Scene document or Scene-like object.
 * @returns {Readonly<object>} Immutable density resolution.
 */
export function getSceneWebDensityConfiguration(
  scene
) {
  if (
    !scene ||
    typeof scene !==
      "object" ||
    Array.isArray(
      scene
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A Scene document is required to read web density.`
    );
  }

  const rawConfiguration =
    readRawSceneWebConfiguration(
      scene
    );

  const densityId =
    normaliseSceneWebDensity(
      rawConfiguration[
        SCENE_WEB_FLAG_KEYS.WEB_DENSITY
      ]
    );

  const preset =
    getWebDensityPreset(
      densityId
    );

  return Object.freeze({
    densityId,
    enabled:
      densityId !==
        DISABLED_WEB_DENSITY_ID,
    preset,
    generationOptions:
      preset?.configuration ??
      null
  });
}
