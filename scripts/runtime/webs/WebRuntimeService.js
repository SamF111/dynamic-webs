import {
  createActiveWebSceneContext
} from "../../foundry/webSceneCompatibility.js";

import {
  WebGenerationService
} from "../../simulation/webs/WebGenerationService.js";

import {
  WebRenderService
} from "../../rendering/webs/WebRenderService.js";

import {
  runDeterminismDiagnostic
} from "../../diagnostics/determinismDiagnostics.js";

import {
  getSceneWebThicknessConfiguration,
  normaliseSceneWebThickness
} from "../../config/sceneWebThicknessConfiguration.js";

import {
  applyWebColourProfileToPopulation,
  getWebColourProfile
} from "../../simulation/webs/webColourProfiles.js";

import {
  createWebRuntimeSnapshot,
  createWebRuntimeState
} from "./webRuntimeState.js";

/** Own deterministic web blueprints and their transient local rendering. */
export class WebRuntimeService {
  constructor(
    options = {}
  ) {
    if (
      !options ||
      typeof options !==
        "object" ||
      !options.runtime ||
      typeof options.runtime !==
        "object"
    ) {
      throw new TypeError(
        "Dynamic Webs | WebRuntimeService requires a runtime owner."
      );
    }

    this.runtime =
      options.runtime;

    this.generationService =
      options.generationService instanceof
        WebGenerationService
        ? options.generationService
        : new WebGenerationService();

    this.renderService =
      options.renderService instanceof
        WebRenderService
        ? options.renderService
        : new WebRenderService();

    this.state =
      createWebRuntimeState();
  }

  /** Generate and render webs for the active Scene. */
  generateForActiveScene({
    scene =
      globalThis.canvas?.scene,
    options = {},
    densityId = null,
    categoryDensities = null,
    categoryDensitySources = null,
    colourProfileId = null,
    thicknessMultiplier = null,
    reason = null
  } = {}) {
    const nextGenerationId =
      this.state.generationId +
      1;

    const operationReason =
      normaliseOptionalIdentifier(
        reason
      ) ??
      "generate";

    const operationAt =
      Date.now();

    const context =
      createActiveWebSceneContext(
        scene
      );

    const generated =
      this.generationService.generate(
        context,
        {
          ...options,
          ...(colourProfileId
            ? {
                colourProfileId
              }
            : {})
        }
      );

    const resolvedThicknessMultiplier =
      thicknessMultiplier ===
        null ||
      thicknessMultiplier ===
        undefined
        ? getSceneWebThicknessConfiguration(
            scene
          ).thicknessMultiplier
        : normaliseSceneWebThickness(
            thicknessMultiplier
          );

    try {
      this.renderService.render(
        generated.webs,
        createRenderingConfiguration(
          generated.configuration.rendering,
          resolvedThicknessMultiplier
        )
      );
    } catch (error) {
      this.state =
        createWebRuntimeState({
          generationId:
            this.state.generationId,
          presentationRevision:
            this.state.presentationRevision,
          generationReason:
            this.state.generationReason,
          generatedAt:
            this.state.generatedAt,
          lastOperationReason:
            `${operationReason}-failed`,
          lastOperationAt:
            operationAt
        });

      throw error;
    }

    this.state = {
      active:
        true,
      blueprintSchemaVersion:
        generated.blueprintSchemaVersion,
      sceneId:
        generated.sceneId,
      generationId:
        nextGenerationId,
      presentationRevision:
        this.state.presentationRevision +
        1,
      generationReason:
        operationReason,
      generatedAt:
        operationAt,
      lastOperationReason:
        operationReason,
      lastOperationAt:
        operationAt,
      seed:
        generated.seed,
      categorySeeds:
        generated.categorySeeds,
      densityId:
        normaliseOptionalIdentifier(
          densityId
        ),
      categoryDensities:
        normaliseCategoryDensityMap(
          categoryDensities
        ),
      categoryDensitySources:
        normaliseCategoryDensitySourceMap(
          categoryDensitySources
        ),
      colourProfileId:
        generated.colourProfileId,
      colourProfile:
        generated.colourProfile,
      thicknessMultiplier:
        resolvedThicknessMultiplier,
      sceneGeometry:
        createSceneGeometrySummary(
          context
        ),
      configuration:
        generated.configuration,
      webs:
        generated.webs,
      counts:
        generated.counts
    };

    return this.createDiagnosticSnapshot();
  }

  /**
   * Re-resolve and redraw web presentation without generating geometry.
   */
  refreshPresentation({
    profileId =
      this.state.colourProfileId,
    thicknessMultiplier =
      this.state.thicknessMultiplier,
    reason =
      "web-presentation-refresh"
  } = {}) {
    if (
      this.state.active !==
        true
    ) {
      return this.createDiagnosticSnapshot();
    }

    const profile =
      getWebColourProfile(
        profileId
      );

    const resolvedThicknessMultiplier =
      normaliseSceneWebThickness(
        thicknessMultiplier
      );

    const operationReason =
      normaliseOptionalIdentifier(
        reason
      ) ??
      "web-presentation-refresh";

    const operationAt =
      Date.now();

    const previousState =
      this.state;

    const webs =
      profile.id ===
        previousState.colourProfileId
        ? previousState.webs
        : applyWebColourProfileToPopulation(
            previousState.webs,
            profile
          );

    try {
      this.renderService.render(
        webs,
        createRenderingConfiguration(
          previousState.configuration.rendering,
          resolvedThicknessMultiplier
        )
      );
    } catch (error) {
      try {
        this.renderService.render(
          previousState.webs,
          createRenderingConfiguration(
            previousState.configuration.rendering,
            previousState.thicknessMultiplier
          )
        );

        this.state = {
          ...previousState,
          lastOperationReason:
            `${operationReason}-failed`,
          lastOperationAt:
            operationAt
        };
      } catch (rollbackError) {
        this.state =
          createWebRuntimeState({
            generationId:
              previousState.generationId,
            presentationRevision:
              previousState.presentationRevision,
            generationReason:
              previousState.generationReason,
            generatedAt:
              previousState.generatedAt,
            lastOperationReason:
              `${operationReason}-rollback-failed`,
            lastOperationAt:
              operationAt
          });

        try {
          Object.defineProperty(
            error,
            "rollbackError",
            {
              value:
                rollbackError,
              configurable:
                true
            }
          );
        } catch (_defineError) {
          // The original render error remains authoritative.
        }
      }

      throw error;
    }

    this.state = {
      ...previousState,
      presentationRevision:
        previousState.presentationRevision +
        1,
      lastOperationReason:
        operationReason,
      lastOperationAt:
        operationAt,
      colourProfileId:
        profile.id,
      colourProfile:
        profile,
      thicknessMultiplier:
        resolvedThicknessMultiplier,
      webs
    };

    return this.createDiagnosticSnapshot();
  }

  /** Preserve the v0.2 colour-refresh entry point as a focused wrapper. */
  refreshColourProfile({
    profileId,
    reason =
      "web-colour-refresh"
  } = {}) {
    return this.refreshPresentation({
      profileId,
      thicknessMultiplier:
        this.state.thicknessMultiplier,
      reason
    });
  }

  /** Apply a thickness-only visual refresh. */
  refreshThickness({
    thicknessMultiplier,
    reason =
      "web-thickness-refresh"
  } = {}) {
    return this.refreshPresentation({
      profileId:
        this.state.colourProfileId,
      thicknessMultiplier,
      reason
    });
  }

  /** Clear all local generated geometry and rendering. */
  clear(
    reason = null
  ) {
    const previousState =
      this.state;

    const wasActive =
      previousState.active ===
        true;

    const clearedRendering =
      this.renderService.clear();

    this.state =
      createWebRuntimeState({
        generationId:
          previousState.generationId,
        presentationRevision:
          previousState.presentationRevision,
        generationReason:
          previousState.generationReason,
        generatedAt:
          previousState.generatedAt,
        lastOperationReason:
          normaliseOptionalIdentifier(
            reason
          ) ??
          "clear",
        lastOperationAt:
          Date.now()
      });

    return wasActive ||
      clearedRendering;
  }

  /** Run a non-destructive deterministic-generation comparison. */
  createDeterminismDiagnostic(
    scene =
      globalThis.canvas?.scene
  ) {
    if (
      this.state.active !==
        true ||
      !this.state.configuration
    ) {
      return Object.freeze({
        executed:
          false,
        deterministic:
          null,
        matchesRuntimeState:
          null,
        reason:
          "No active generated web population is available."
      });
    }

    try {
      const context =
        createActiveWebSceneContext(
          scene
        );

      if (
        context.sceneId !==
          this.state.sceneId
      ) {
        return Object.freeze({
          executed:
            false,
          deterministic:
            null,
          matchesRuntimeState:
            null,
          reason:
            "The active Scene does not match the generated runtime population."
        });
      }

      return runDeterminismDiagnostic({
        generationService:
          this.generationService,
        context,
        configuration: {
          ...this.state.configuration,
          colourProfileId:
            this.state.colourProfileId
        },
        currentWebs:
          this.state.webs
      });
    } catch (error) {
      return Object.freeze({
        executed:
          false,
        deterministic:
          null,
        matchesRuntimeState:
          null,
        reason:
          "The non-destructive determinism check failed.",
        error:
          Object.freeze({
            name:
              String(
                error?.name ??
                "Error"
              ),
            message:
              String(
                error?.message ??
                error
              )
          })
      });
    }
  }

  /** @returns {object} Mutable internal state for runtime ownership only. */
  getState() {
    return this.state;
  }

  /** @returns {Readonly<object>} Public diagnostic snapshot. */
  createDiagnosticSnapshot() {
    return createWebRuntimeSnapshot(
      this.state,
      this.renderService.createDiagnosticSnapshot()
    );
  }

  /** Return runtime telemetry without copying the complete web population. */
  createTelemetrySnapshot() {
    return createWebRuntimeSnapshot(
      this.state,
      this.renderService.createDiagnosticSnapshot(),
      {
        includeWebs:
          false
      }
    );
  }
}

function createRenderingConfiguration(
  rendering,
  thicknessMultiplier
) {
  return Object.freeze({
    ...rendering,
    thicknessMultiplier:
      normaliseSceneWebThickness(
        thicknessMultiplier
      )
  });
}

function createSceneGeometrySummary(
  context
) {
  return Object.freeze({
    gridSize:
      Number(
        context.gridSize
      ),
    sceneRect:
      context.sceneRect,
    structuralWallCount:
      context.wallSegments.length
  });
}

function normaliseCategoryDensityMap(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return Object.freeze({
    ...value
  });
}

function normaliseCategoryDensitySourceMap(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return Object.freeze({
    ...value
  });
}

function normaliseOptionalIdentifier(
  value
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const identifier =
    value.trim();

  return identifier.length >
    0
    ? identifier
    : null;
}
