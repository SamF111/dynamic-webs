import {
  MODULE_ID
} from "../../module/moduleConstants.js";

import {
  reportDiagnostic
} from "../../diagnostics/diagnosticReporter.js";

import {
  getSceneWebPopulationConfiguration
} from "../../config/sceneWebPopulationConfiguration.js";

/** Synchronise generated webs for one active Scene. */
export function synchroniseSceneWebs({ runtime, scene, reason }) {
  const service = runtime?.getWebRuntimeService?.();
  if (!service || !scene) return null;

  const normalisedReason = String(reason ?? "scene-lifecycle");

  try {
    const populationConfiguration = getSceneWebPopulationConfiguration(scene);

    if (!populationConfiguration.hasActivePopulations) {
      service.clear(normalisedReason);
      return emitStateChanged(service.createDiagnosticSnapshot(), normalisedReason);
    }

    const snapshot = service.generateForActiveScene({
      scene,
      populations: populationConfiguration.activePopulations,
      reason: normalisedReason
    });

    return emitStateChanged(snapshot, normalisedReason);
  } catch (error) {
    reportDiagnostic({
      code: "webs.scene-synchronisation-failed",
      severity: "warn",
      message: "Generated web populations could not be synchronised for the active Scene.",
      context: {
        sceneId: scene?.id ?? null,
        reason: normalisedReason
      },
      nextAction: "Check the modular web-population entries, selected levels, densities, colours and thickness values.",
      error
    });

    service.clear(`${normalisedReason}-failed`);
    return null;
  }
}

/** Population presentation is persisted with the population and regenerates deterministically. */
export function synchroniseSceneWebPresentation(options) {
  return synchroniseSceneWebs(options);
}

/** Refresh only the visible level subset without regenerating geometry. */
export function synchroniseSceneWebVisibility({ runtime, scene, reason }) {
  const service = runtime?.getWebRuntimeService?.();
  if (!service || !scene) return null;

  const normalisedReason = String(reason ?? "scene-web-level-visibility-update");

  try {
    const state = service.getState();
    if (state.active !== true || state.sceneId !== scene.id) {
      return synchroniseSceneWebs({ runtime, scene, reason: normalisedReason });
    }

    return emitStateChanged(
      service.refreshLevelVisibility({ scene, reason: normalisedReason }),
      normalisedReason
    );
  } catch (error) {
    reportDiagnostic({
      code: "webs.scene-level-visibility-synchronisation-failed",
      severity: "warn",
      message: "The visible web level subset could not be refreshed.",
      context: {
        sceneId: scene?.id ?? null,
        reason: normalisedReason
      },
      nextAction: "Check the configured level provider and active viewed level.",
      error
    });
    return null;
  }
}

export function synchroniseSceneWebColour(options) {
  return synchroniseSceneWebs(options);
}

function emitStateChanged(snapshot, reason) {
  globalThis.Hooks?.callAll?.(`${MODULE_ID}.stateChanged`, snapshot, { reason });
  return snapshot;
}
