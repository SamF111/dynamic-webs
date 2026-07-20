import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  normaliseSceneWebDensity
} from "../config/sceneWebDensityConfiguration.js";

import {
  SCENE_WEB_FLAG_KEYS
} from "../config/sceneWebFlagPaths.js";

import {
  requireCurrentCanvasScene,
  requireCurrentUserIsGM,
  resolveSceneDocument
} from "./foundryAccess.js";

/** Generate and render deterministic local webs on the active Scene. */
export function generatePublicWebs(
  runtime,
  options = {}
) {
  validateRuntime(
    runtime
  );

  requireCurrentUserIsGM();

  return requireWebRuntimeService(
    runtime
  ).generateForActiveScene({
    scene:
      requireCurrentCanvasScene(),
    options,
    reason:
      "public-api-generate"
  });
}

/** Remove all locally generated webs without changing Scene flags. */
export function clearPublicWebs(
  runtime
) {
  validateRuntime(
    runtime
  );

  requireCurrentUserIsGM();

  const service =
    requireWebRuntimeService(
      runtime
    );

  return Object.freeze({
    cleared:
      service.clear(
        "public-api-clear"
      ),
    state:
      service.createDiagnosticSnapshot()
  });
}

/** Return immutable local generated-web diagnostics. */
export function getPublicWebState(
  runtime
) {
  validateRuntime(
    runtime
  );

  return requireWebRuntimeService(
    runtime
  ).createDiagnosticSnapshot();
}

/**
 * Read the persisted density for one Scene.
 *
 * @param {string|null} sceneId - Optional Scene ID.
 * @returns {string} Normalised density ID.
 */
export function getPublicSceneWebDensity(
  sceneId = null
) {
  const scene =
    resolveSceneDocument(
      sceneId
    );

  return normaliseSceneWebDensity(
    scene.getFlag?.(
      MODULE_ID,
      SCENE_WEB_FLAG_KEYS.WEB_DENSITY
    ) ??
    scene.flags?.[
      MODULE_ID
    ]?.[
      SCENE_WEB_FLAG_KEYS.WEB_DENSITY
    ]
  );
}

/**
 * Persist one Scene density through Foundry's flag API.
 *
 * @param {string} densityId - Density ID.
 * @param {string|null} sceneId - Optional Scene ID.
 * @returns {Promise<object>} Updated Scene.
 */
export async function setPublicSceneWebDensity(
  densityId,
  sceneId = null
) {
  requireCurrentUserIsGM();

  const scene =
    resolveSceneDocument(
      sceneId
    );

  if (
    typeof scene.setFlag !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | Scene.setFlag() is unavailable.`
    );
  }

  const validDensityId =
    normaliseSceneWebDensity(
      densityId
    );

  return scene.setFlag(
    MODULE_ID,
    SCENE_WEB_FLAG_KEYS.WEB_DENSITY,
    validDensityId
  );
}

function requireWebRuntimeService(
  runtime
) {
  const service =
    runtime
      ?.getWebRuntimeService
      ?.();

  if (
    !service ||
    typeof service.generateForActiveScene !==
      "function" ||
    typeof service.clear !==
      "function" ||
    typeof service.createDiagnosticSnapshot !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | The generated-web runtime service is unavailable.`
    );
  }

  return service;
}

function validateRuntime(
  runtime
) {
  if (
    !runtime ||
    runtime.runtimeOwnerType !==
      "DynamicWebsRuntime"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A valid Dynamic Webs runtime is required.`
    );
  }
}

