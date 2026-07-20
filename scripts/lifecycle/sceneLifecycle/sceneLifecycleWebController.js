import {
  MODULE_ID
} from "../../module/moduleConstants.js";

import {
  reportDiagnostic
} from "../../diagnostics/diagnosticReporter.js";

import {
  getSceneWebDensityConfiguration
} from "../../config/sceneWebDensityConfiguration.js";

import {
  getSceneWebCategoryDensityConfiguration
} from "../../config/sceneWebCategoryDensityConfiguration.js";

import {
  getSceneWebColourConfiguration
} from "../../config/sceneWebColourConfiguration.js";

import {
  getSceneWebThicknessConfiguration
} from "../../config/sceneWebThicknessConfiguration.js";

/** Synchronise generated webs for one active Scene. */
export function synchroniseSceneWebs({
  runtime,
  scene,
  reason
}) {
  const service =
    runtime
      ?.getWebRuntimeService
      ?.();

  if (
    !service ||
    !scene
  ) {
    return null;
  }

  const normalisedReason =
    String(
      reason ??
      "scene-lifecycle"
    );

  try {
    const densityConfiguration =
      getSceneWebDensityConfiguration(
        scene
      );

    const categoryDensityConfiguration =
      getSceneWebCategoryDensityConfiguration(
        scene
      );

    const colourConfiguration =
      getSceneWebColourConfiguration(
        scene
      );

    const thicknessConfiguration =
      getSceneWebThicknessConfiguration(
        scene
      );

    if (
      categoryDensityConfiguration.implementedEnabled !==
        true
    ) {
      service.clear(
        normalisedReason
      );

      return emitStateChanged(
        service.createDiagnosticSnapshot(),
        normalisedReason
      );
    }

    const snapshot =
      service.generateForActiveScene({
        scene,
        options:
          categoryDensityConfiguration.generationOptions,
        densityId:
          densityConfiguration.densityId,
        categoryDensities:
          categoryDensityConfiguration.categoryDensities,
        categoryDensitySources:
          categoryDensityConfiguration.categoryDensitySources,
        colourProfileId:
          colourConfiguration.profileId,
        thicknessMultiplier:
          thicknessConfiguration.thicknessMultiplier,
        reason:
          normalisedReason
      });

    return emitStateChanged(
      snapshot,
      normalisedReason
    );
  } catch (error) {
    reportDiagnostic({
      code:
        "webs.scene-synchronisation-failed",
      severity:
        "warn",
      message:
        "Generated webs could not be synchronised for the active Scene.",
      context: {
        sceneId:
          scene?.id ??
          null,
        reason:
          normalisedReason
      },
      nextAction:
        "Check the Dynamic Webs category densities, colour profile and JSON-backed presets.",
      error
    });

    service.clear(
      `${normalisedReason}-failed`
    );

    return null;
  }
}

/**
 * Apply Scene colour and thickness without regenerating deterministic geometry.
 */
export function synchroniseSceneWebPresentation({
  runtime,
  scene,
  reason
}) {
  const service =
    runtime
      ?.getWebRuntimeService
      ?.();

  if (
    !service ||
    !scene
  ) {
    return null;
  }

  const normalisedReason =
    String(
      reason ??
      "scene-web-presentation-update"
    );

  try {
    const categoryDensityConfiguration =
      getSceneWebCategoryDensityConfiguration(
        scene
      );

    if (
      categoryDensityConfiguration.implementedEnabled !==
        true
    ) {
      service.clear(
        normalisedReason
      );

      return emitStateChanged(
        service.createDiagnosticSnapshot(),
        normalisedReason
      );
    }

    const state =
      service.getState();

    if (
      state.active !==
        true ||
      state.sceneId !==
        scene.id
    ) {
      return synchroniseSceneWebs({
        runtime,
        scene,
        reason:
          normalisedReason
      });
    }

    const colourConfiguration =
      getSceneWebColourConfiguration(
        scene
      );

    const thicknessConfiguration =
      getSceneWebThicknessConfiguration(
        scene
      );

    const snapshot =
      service.refreshPresentation({
        profileId:
          colourConfiguration.profileId,
        thicknessMultiplier:
          thicknessConfiguration.thicknessMultiplier,
        reason:
          normalisedReason
      });

    return emitStateChanged(
      snapshot,
      normalisedReason
    );
  } catch (error) {
    reportDiagnostic({
      code:
        "webs.scene-presentation-synchronisation-failed",
      severity:
        "warn",
      message:
        "The active web colour and thickness could not be applied.",
      context: {
        sceneId:
          scene?.id ??
          null,
        reason:
          normalisedReason
      },
      nextAction:
        "Check the Scene web colour and thickness flags.",
      error
    });

    return null;
  }
}

/** Preserve the v0.2 colour synchronisation entry point. */
export function synchroniseSceneWebColour(
  options
) {
  return synchroniseSceneWebPresentation(
    options
  );
}

function emitStateChanged(
  snapshot,
  reason
) {
  globalThis.Hooks?.callAll?.(
    `${MODULE_ID}.stateChanged`,
    snapshot,
    {
      reason
    }
  );

  return snapshot;
}
