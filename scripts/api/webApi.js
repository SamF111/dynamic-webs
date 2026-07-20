import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getSceneWebPopulationConfiguration
} from "../config/sceneWebPopulationConfiguration.js";

import {
  requireCurrentCanvasScene,
  requireCurrentUserIsGM
} from "./foundryAccess.js";

/** Generate and render the active Scene's persisted modular web populations. */
export function generatePublicWebs(runtime) {
  validateRuntime(runtime);
  requireCurrentUserIsGM();

  const scene = requireCurrentCanvasScene();
  const populationConfiguration = getSceneWebPopulationConfiguration(scene);

  return requireWebRuntimeService(runtime).generateForActiveScene({
    scene,
    populations: populationConfiguration.activePopulations,
    reason: "public-api-generate"
  });
}

/** Remove all locally generated webs without changing Scene flags. */
export function clearPublicWebs(runtime) {
  validateRuntime(runtime);
  requireCurrentUserIsGM();

  const service = requireWebRuntimeService(runtime);

  return Object.freeze({
    cleared: service.clear("public-api-clear"),
    state: service.createDiagnosticSnapshot()
  });
}

/** Return immutable local generated-web diagnostics. */
export function getPublicWebState(runtime) {
  validateRuntime(runtime);
  return requireWebRuntimeService(runtime).createDiagnosticSnapshot();
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
