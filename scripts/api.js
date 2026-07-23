import {
  MODULE_ID,
  PUBLIC_API_VERSION
} from "./module/moduleConstants.js";

import {
  clearPublicWebs,
  clearPublicWebCarpetTextureCache,
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
  findPublicCompatibleWebs,
  findPublicWebPerches,
  getPublicSpatialDiagnostics,
  getPublicWeb,
  getPublicWebs,
  queryPublicNearbyWebGeometry,
  queryPublicWebStrands
} from "./api/spatialApi.js";

import {
  getPublicSceneWebPopulation,
  getPublicSceneWebPopulations,
  setPublicSceneWebPopulations
} from "./api/populationApi.js";

import {
  destroyPublicWebs,
  getPublicWebInteractionState,
  queryPublicWebMovementIntersections,
  resetPublicWebInteractionState,
  restorePublicWeb
} from "./api/interactionApi.js";

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

      clearCarpetTextureCache:
        () =>
          clearPublicWebCarpetTextureCache(
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

  const spatial =
    Object.freeze({
      getDiagnostics:
        () =>
          getPublicSpatialDiagnostics(
            runtime
          )
    });

  const interactions =
    Object.freeze({
      queryMovement:
        (
          request
        ) =>
          queryPublicWebMovementIntersections(
            runtime,
            request
          ),

      destroyWebs:
        (
          webIds,
          options = {}
        ) =>
          destroyPublicWebs(
            runtime,
            webIds,
            options
          ),

      restoreWeb:
        (
          webId,
          options = {}
        ) =>
          restorePublicWeb(
            runtime,
            webId,
            options
          ),

      reset:
        (
          options = {}
        ) =>
          resetPublicWebInteractionState(
            runtime,
            options
          ),

      getState:
        () =>
          getPublicWebInteractionState(
            runtime
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
            "0.7.0",
          webs:
            getPublicWebState(
              runtime
            )
        }),

    getWebs:
      () =>
        getPublicWebs(
          runtime
        ),

    getWeb:
      (webId) =>
        getPublicWeb(
          runtime,
          webId
        ),

    queryNearby:
      (point, options = {}) =>
        queryPublicNearbyWebGeometry(
          runtime,
          point,
          options
        ),

    queryStrands:
      (bounds, options = {}) =>
        queryPublicWebStrands(
          runtime,
          bounds,
          options
        ),

    findCompatibleWebs:
      (options = {}) =>
        findPublicCompatibleWebs(
          runtime,
          options
        ),

    findPerches:
      (options = {}) =>
        findPublicWebPerches(
          runtime,
          options
        ),

    webs,
    scene,
    colours,
    levels,
    spatial,
    interactions,
    diagnostics
  });
}
