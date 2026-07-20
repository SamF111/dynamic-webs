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
  createWebRuntimeSnapshot,
  createWebRuntimeState
} from "./webRuntimeState.js";

/**
 * Own deterministic web blueprints and their transient local rendering.
 */
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

  /**
   * Generate and render webs for the active Scene.
   *
   * @param {object} [options={}] - Generation values.
   * @param {object|null} [options.scene=canvas.scene] - Active Scene.
   * @param {object} [options.options={}] - Generation overrides.
   * @param {string|null} [options.densityId=null] - Active density ID.
   * @param {string|null} [options.reason=null] - Generation reason.
   * @returns {Readonly<object>} Diagnostic snapshot.
   */
  generateForActiveScene({
    scene =
      globalThis.canvas?.scene,
    options = {},
    densityId = null,
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
        options
      );

    try {
      this.renderService.render(
        generated.webs,
        generated.configuration.rendering
      );
    } catch (error) {
      this.state =
        createWebRuntimeState({
          generationId:
            this.state.generationId,
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
   * Clear all local generated geometry and rendering.
   *
   * @param {string|null} [reason=null] - Clear reason.
   * @returns {boolean} True when state or rendering existed.
   */
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

  /**
   * Run a non-destructive deterministic-generation comparison.
   *
   * @param {object|null} [scene=canvas.scene] - Scene used for the comparison.
   * @returns {Readonly<object>} Frozen comparison result.
   */
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
        configuration:
          this.state.configuration,
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

  /**
   * Return runtime telemetry without copying the complete web population.
   *
   * @returns {Readonly<object>} Frozen lightweight telemetry.
   */
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
