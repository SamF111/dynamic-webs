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
   * @returns {Readonly<object>} Diagnostic snapshot.
   */
  generateForActiveScene({
    scene =
      globalThis.canvas?.scene,
    options = {},
    densityId = null
  } = {}) {
    const nextGenerationId =
      this.state.generationId +
      1;

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
        createWebRuntimeState(
          this.state.generationId
        );

      throw error;
    }

    this.state = {
      active:
        true,
      sceneId:
        generated.sceneId,
      generationId:
        nextGenerationId,
      seed:
        generated.seed,
      densityId:
        normaliseOptionalIdentifier(
          densityId
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
   * @returns {boolean} True when state or rendering existed.
   */
  clear() {
    const generationId =
      this.state.generationId;

    const wasActive =
      this.state.active ===
        true;

    const clearedRendering =
      this.renderService.clear();

    this.state =
      createWebRuntimeState(
        generationId
      );

    return wasActive ||
      clearedRendering;
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
