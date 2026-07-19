import {
  MODULE_ID
} from "../../module/moduleConstants.js";

import {
  reportDiagnostic
} from "../../diagnostics/diagnosticReporter.js";

import {
  getSceneWebDensityConfiguration
} from "../../config/sceneWebDensityConfiguration.js";

/**
 * Synchronise generated webs for one active Scene.
 *
 * @param {object} options - Synchronisation values.
 * @param {object|null} options.runtime - Dynamic Webs runtime.
 * @param {object|null} options.scene - Active Scene.
 * @param {string} options.reason - Diagnostic reason.
 * @returns {Readonly<object>|null} Web diagnostics or null.
 */
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

  try {
    const configuration =
      getSceneWebDensityConfiguration(
        scene
      );

    if (
      configuration.enabled !==
        true
    ) {
      service.clear();

      const snapshot =
        service.createDiagnosticSnapshot();

      globalThis.Hooks?.callAll?.(
        `${MODULE_ID}.stateChanged`,
        snapshot,
        {
          reason:
            String(
              reason ??
              "scene-lifecycle"
            )
        }
      );

      return snapshot;
    }

    const snapshot =
      service.generateForActiveScene({
        scene,
        options:
          configuration.generationOptions,
        densityId:
          configuration.densityId
      });

    globalThis.Hooks?.callAll?.(
      `${MODULE_ID}.stateChanged`,
      snapshot,
      {
        reason:
          String(
            reason ??
            "scene-lifecycle"
          )
      }
    );

    return snapshot;
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
          String(
            reason ??
            "scene-lifecycle"
          )
      },
      nextAction:
        "Check the Dynamic Webs Scene density and JSON-backed density presets.",
      error
    });

    service.clear();

    return null;
  }
}
