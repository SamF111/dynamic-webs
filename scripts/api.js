import {
  MODULE_ID,
  PUBLIC_API_VERSION
} from "./module/moduleConstants.js";

import {
  clearPublicWebs,
  generatePublicWebs,
  getPublicSceneWebDensity,
  getPublicWebState,
  setPublicSceneWebDensity
} from "./api/webApi.js";

import {
  getPublicBaselineDiagnosticReport,
  showPublicBaselineDiagnosticReport
} from "./api/diagnosticApi.js";

/**
 * Create the stable public Dynamic Webs API.
 *
 * @param {object} runtime - Initialised runtime.
 * @returns {Readonly<object>} Frozen public API.
 */
export function createPublicApi(
  runtime
) {
  const webs =
    Object.freeze({
      generate:
        (
          options = {}
        ) =>
          generatePublicWebs(
            runtime,
            options
          ),

      clear:
        () =>
          clearPublicWebs(
            runtime
          ),

      getState:
        () =>
          getPublicWebState(
            runtime
          )
    });

  const scene =
    Object.freeze({
      getDensity:
        (
          sceneId = null
        ) =>
          getPublicSceneWebDensity(
            sceneId
          ),

      setDensity:
        (
          densityId,
          sceneId = null
        ) =>
          setPublicSceneWebDensity(
            densityId,
            sceneId
          )
    });

  const diagnostics =
    Object.freeze({
      getBaselineReport:
        () =>
          getPublicBaselineDiagnosticReport(
            runtime
          ),

      showBaselineReport:
        () =>
          showPublicBaselineDiagnosticReport(
            runtime
          )
    });

  return Object.freeze({
    version:
      PUBLIC_API_VERSION,

    getState:
      () =>
        Object.freeze({
          moduleId:
            MODULE_ID,
          ready:
            runtime.ready ===
              true,
          moduleVersion:
            globalThis.game
              ?.modules
              ?.get?.(
                MODULE_ID
              )
              ?.version ??
            "0.1.0",
          webs:
            getPublicWebState(
              runtime
            )
        }),

    webs,
    scene,
    diagnostics
  });
}
