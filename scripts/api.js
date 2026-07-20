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
  getPublicSceneWebColour,
  getPublicWebColourProfile,
  getPublicWebColourProfiles,
  setPublicSceneWebColour
} from "./api/colourApi.js";

import {
  getPublicSceneWebThickness,
  setPublicSceneWebThickness
} from "./api/thicknessApi.js";

import {
  getPublicSceneWebCategoryDensities,
  getPublicSceneWebCategoryDensity,
  setPublicSceneWebCategoryDensities,
  setPublicSceneWebCategoryDensity
} from "./api/categoryDensityApi.js";

import {
  getPublicBaselineDiagnosticReport,
  showPublicBaselineDiagnosticReport
} from "./api/diagnosticApi.js";

/** Create the stable public Dynamic Webs API. */
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
          ),

      getColour:
        (
          sceneId = null
        ) =>
          getPublicSceneWebColour(
            sceneId
          ),

      setColour:
        (
          profileId,
          sceneId = null
        ) =>
          setPublicSceneWebColour(
            profileId,
            sceneId
          ),

      getThickness:
        (
          sceneId = null
        ) =>
          getPublicSceneWebThickness(
            sceneId
          ),

      setThickness:
        (
          thicknessMultiplier,
          sceneId = null
        ) =>
          setPublicSceneWebThickness(
            thicknessMultiplier,
            sceneId
          ),

      getCategoryDensities:
        (
          sceneId = null
        ) =>
          getPublicSceneWebCategoryDensities(
            sceneId
          ),

      getCategoryDensity:
        (
          categoryId,
          sceneId = null
        ) =>
          getPublicSceneWebCategoryDensity(
            categoryId,
            sceneId
          ),

      setCategoryDensity:
        (
          categoryId,
          densityId,
          sceneId = null
        ) =>
          setPublicSceneWebCategoryDensity(
            categoryId,
            densityId,
            sceneId
          ),

      setCategoryDensities:
        (
          values,
          sceneId = null
        ) =>
          setPublicSceneWebCategoryDensities(
            values,
            sceneId
          )
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
            "0.2.2",
          webs:
            getPublicWebState(
              runtime
            )
        }),

    webs,
    scene,
    colours,
    diagnostics
  });
}
