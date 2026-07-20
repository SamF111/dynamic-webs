import {
  MODULE_ID,
  PUBLIC_API_VERSION
} from "./module/moduleConstants.js";

import {
  clearPublicWebs,
  generatePublicWebs,
  getPublicWebState
} from "./api/webApi.js";

import {
  getPublicWebColourProfile,
  getPublicWebColourProfiles
} from "./api/colourApi.js";

import {
  getPublicBaselineDiagnosticReport,
  showPublicBaselineDiagnosticReport
} from "./api/diagnosticApi.js";


import {
  getPublicSceneWebPopulation,
  getPublicSceneWebPopulations,
  setPublicSceneWebPopulations
} from "./api/populationApi.js";

/** Create the stable public Dynamic Webs API. */
export function createPublicApi(
  runtime
) {
  const webs =
    Object.freeze({
      generate:
        () =>
          generatePublicWebs(
            runtime
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
      getPopulations:
        (sceneId = null) =>
          getPublicSceneWebPopulations(sceneId),

      getPopulation:
        (populationId, sceneId = null) =>
          getPublicSceneWebPopulation(populationId, sceneId),

      setPopulations:
        (populations, sceneId = null) =>
          setPublicSceneWebPopulations(populations, sceneId)
    });

  const colours =
    Object.freeze({
      getProfiles:
        () =>
          getPublicWebColourProfiles(),

      getProfile:
        (
          profileId
        ) =>
          getPublicWebColourProfile(
            profileId
          )
    });

  const levels =
    Object.freeze({
      getState:
        () => {
          const state =
            getPublicWebState(
              runtime
            );

          return Object.freeze({
            provider:
              state.levelProvider,
            levels:
              state.levels,
            visibility:
              state.levelVisibility,
            countsByLevel:
              state.counts?.byLevel ??
              null
          });
        }
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
            "0.3.1",
          webs:
            getPublicWebState(
              runtime
            )
        }),

    webs,
    scene,
    colours,
    levels,
    diagnostics
  });
}
