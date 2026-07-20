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
  getSceneWebColourConfiguration
} from "../../config/sceneWebColourConfiguration.js";

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

    const colourConfiguration =
      getSceneWebColourConfiguration(
        scene
      );

    if (
      densityConfiguration.enabled !==
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
          densityConfiguration.generationOptions,
        densityId:
          densityConfiguration.densityId,
        colourProfileId:
          colourConfiguration.profileId,
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
        "Check the Dynamic Webs Scene density, colour profile and JSON-backed presets.",
      error
    });

    service.clear(
      `${normalisedReason}-failed`
    );

    return null;
  }
}

/**
 * Apply a Scene colour update without regenerating deterministic geometry.
 */
export function synchroniseSceneWebColour({
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
      "scene-web-colour-update"
    );

  try {
    const densityConfiguration =
      getSceneWebDensityConfiguration(
        scene
      );

    if (
      densityConfiguration.enabled !==
        true
    ) {
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

    const snapshot =
      service.refreshColourProfile({
        profileId:
          colourConfiguration.profileId,
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
        "webs.scene-colour-synchronisation-failed",
      severity:
        "warn",
      message:
        "The active web colour profile could not be applied.",
      context: {
        sceneId:
          scene?.id ??
          null,
        reason:
          normalisedReason
      },
      nextAction:
        "Check the Scene web colour flag and data/webs/colours.json.",
      error
    });

    return null;
  }
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
