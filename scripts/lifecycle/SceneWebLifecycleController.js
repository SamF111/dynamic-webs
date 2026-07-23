import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  doesSceneUpdateAffectSpanWebBehaviour,
  doesSceneUpdateAffectWebGeometry,
  doesSceneUpdateAffectWebMutableState,
  doesSceneUpdateAffectWebPopulations
} from "../config/sceneWebFlagPaths.js";

import {
  doesWallUpdateAffectWebs
} from "./sceneLifecycle/sceneLifecycleWallUpdates.js";

import {
  synchroniseSceneWebMutableState,
  synchroniseSceneWebPresentation,
  synchroniseSceneWebVisibility,
  synchroniseSceneWebs
} from "./sceneLifecycle/sceneLifecycleWebController.js";

import {
  doesSceneUpdateAffectViewedWebLevel,
  doesTokenUpdateAffectViewedWebLevel
} from "../foundry/webLevelVisibilityCompatibility.js";

import {
  doesRegionUpdateAffectWebs
} from "../config/regionTagConfiguration.js";

import {
  TokenSpanWebInteractionController
} from "../interactions/TokenSpanWebInteractionController.js";

import {
  isGeneratedSpanWallDocument
} from "../foundry/webSpanWallCompatibility.js";

/**
 * Own Foundry hooks and debounced Scene web regeneration.
 */
export class SceneWebLifecycleController {
  constructor({
    runtime,
    debounceMs = 200
  }) {
    if (
      !runtime ||
      typeof runtime.getWebRuntimeService !==
        "function"
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | SceneWebLifecycleController requires the Dynamic Webs runtime.`
      );
    }

    this.runtime =
      runtime;

    this.debounceMs =
      Math.max(
        0,
        Number(
          debounceMs
        ) ||
        0
      );

    this.registered =
      false;

    this.hookRegistrations =
      [];

    this.pendingRebuildHandle =
      null;

    this.pendingReason =
      null;

    this.lastRequestedReason =
      null;

    this.lastRequestedAt =
      null;

    this.lastCompletedReason =
      null;

    this.lastCompletedAt =
      null;

    this.synchronisationCount =
      0;

    this.tokenSpanWebInteractionController =
      new TokenSpanWebInteractionController({
        runtime:
          this.runtime
      });
  }

  /**
   * Register all-client Foundry lifecycle hooks.
   *
   * @returns {boolean} True when registered by this call.
   */
  registerHooks() {
    if (
      this.registered
    ) {
      return false;
    }

    const hooks =
      globalThis.Hooks;

    if (
      !hooks ||
      typeof hooks.on !==
        "function"
    ) {
      throw new Error(
        `${MODULE_TITLE} | Foundry Hooks are unavailable.`
      );
    }

    this.#register(
      "canvasReady",
      () =>
        this.handleCanvasReady()
    );

    this.#register(
      "canvasTearDown",
      () =>
        this.handleCanvasTearDown()
    );

    this.#register(
      "updateScene",
      (
        scene,
        changed
      ) =>
        this.handleSceneUpdated(
          scene,
          changed
        )
    );

    this.#register(
      "deleteScene",
      (
        scene
      ) =>
        this.handleSceneDeleted(
          scene
        )
    );

    this.#register(
      "createWall",
      (
        wallDocument
      ) =>
        this.handleWallCreated(
          wallDocument
        )
    );

    this.#register(
      "updateWall",
      (
        wallDocument,
        changed
      ) =>
        this.handleWallUpdated(
          wallDocument,
          changed
        )
    );

    this.#register(
      "deleteWall",
      (
        wallDocument
      ) =>
        this.handleWallDeleted(
          wallDocument
        )
    );

    this.#register(
      "createRegion",
      (regionDocument) => this.handleRegionCreated(regionDocument)
    );

    this.#register(
      "updateRegion",
      (regionDocument, changed) => this.handleRegionUpdated(regionDocument, changed)
    );

    this.#register(
      "deleteRegion",
      (regionDocument) => this.handleRegionDeleted(regionDocument)
    );


    for (
      const event of
      [
        "createLevel",
        "updateLevel",
        "deleteLevel"
      ]
    ) {
      this.#register(
        event,
        (
          levelDocument
        ) =>
          this.handleLevelStructureChanged(
            levelDocument,
            event
          )
      );
    }

    for (
      const event of
      [
        "levelsUIChange",
        "levelsUiChange",
        "levelsChange"
      ]
    ) {
      this.#register(
        event,
        () =>
          this.synchroniseActiveSceneVisibility(
            event
          )
      );
    }

    this.#register(
      "controlToken",
      () =>
        this.synchroniseActiveSceneVisibility(
          "control-token-level-update"
        )
    );

    this.#register(
      "preUpdateToken",
      (
        tokenDocument,
        changed,
        options,
        userId
      ) =>
        this.tokenSpanWebInteractionController.handleTokenPreUpdated(
          tokenDocument,
          changed,
          options,
          userId
        )
    );

    this.#register(
      "updateToken",
      (
        tokenDocument,
        changed,
        options,
        userId
      ) => {
        this.tokenSpanWebInteractionController.handleTokenUpdated(
          tokenDocument,
          changed,
          options,
          userId
        );

        if (
          doesTokenUpdateAffectViewedWebLevel(
            changed
          )
        ) {
          this.synchroniseActiveSceneVisibility(
            "token-level-update"
          );
        }
      }
    );

    this.#register(
      "createToken",
      () =>
        this.tokenSpanWebInteractionController.prime(
          globalThis.canvas?.scene
        )
    );

    this.#register(
      "deleteToken",
      (
        tokenDocument
      ) =>
        this.tokenSpanWebInteractionController.handleTokenDeleted(
          tokenDocument
        )
    );

    this.registered =
      true;

    console.log(
      `${MODULE_ID} | Scene web lifecycle hooks registered.`
    );

    return true;
  }

  /**
   * Remove hook registrations and local transient state.
   */
  dispose() {
    this.clearPendingRebuild();

    const hooks =
      globalThis.Hooks;

    if (
      hooks &&
      typeof hooks.off ===
        "function"
    ) {
      for (
        const registration of
        this.hookRegistrations
      ) {
        hooks.off(
          registration.event,
          registration.id
        );
      }
    }

    this.hookRegistrations =
      [];

    this.registered =
      false;

    this.tokenSpanWebInteractionController.clear();

    this.runtime
      .getWebRuntimeService()
      .clear(
        "lifecycle-dispose"
      );
  }

  /** Synchronise the newly ready active Scene. */
  handleCanvasReady() {
    this.clearPendingRebuild();

    this.synchroniseActiveScene(
      "canvas-ready"
    );
  }

  /** Clear local rendering before the active canvas is destroyed. */
  handleCanvasTearDown() {
    this.clearPendingRebuild();

    this.tokenSpanWebInteractionController.clear();

    this.runtime
      .getWebRuntimeService()
      .clear(
        "canvas-teardown"
      );
  }

  /**
   * Handle active Scene flag or geometry updates.
   *
   * @param {object} scene - Updated Scene.
   * @param {object} changed - Scene differential.
   */
  handleSceneUpdated(
    scene,
    changed
  ) {
    if (
      !this.#isActiveScene(
        scene
      )
    ) {
      return;
    }

    if (
      doesSceneUpdateAffectWebPopulations(
        changed
      )
    ) {
      this.clearPendingRebuild();

      this.synchroniseActiveScene(
        "scene-web-populations-update"
      );

      return;
    }

    if (
      doesSceneUpdateAffectSpanWebBehaviour(
        changed
      )
    ) {
      this.clearPendingRebuild();

      this.synchroniseActiveScene(
        "scene-span-web-behaviour-update"
      );

      return;
    }

    if (
      doesSceneUpdateAffectWebMutableState(
        changed
      )
    ) {
      this.clearPendingRebuild();

      this.synchroniseActiveSceneMutableState(
        "scene-mutable-state-update"
      );

      return;
    }

    if (
      doesSceneUpdateAffectViewedWebLevel(
        changed
      )
    ) {
      this.clearPendingRebuild();

      this.synchroniseActiveSceneVisibility(
        "scene-viewed-level-update"
      );

      return;
    }

    if (
      doesSceneUpdateAffectWebGeometry(
        changed
      )
    ) {
      this.scheduleRebuild(
        "scene-geometry-update"
      );
    }
  }

  /**
   * Clear state when the displayed Scene is deleted.
   *
   * @param {object} scene - Deleted Scene.
   */
  handleSceneDeleted(
    scene
  ) {
    const currentSceneId =
      this.runtime
        .getWebRuntimeService()
        .getState()
        ?.sceneId ??
      globalThis.canvas?.scene?.id ??
      null;

    if (
      !scene?.id ||
      scene.id !==
        currentSceneId
    ) {
      return;
    }

    this.clearPendingRebuild();

    this.runtime
      .getWebRuntimeService()
      .clear(
        "scene-deleted"
      );
  }

  /**
   * Regenerate after a structural wall is created.
   *
   * @param {object} wallDocument - Created WallDocument.
   */
  handleWallCreated(
    wallDocument
  ) {
    if (
      isGeneratedSpanWallDocument(
        wallDocument
      )
    ) {
      return;
    }

    if (
      this.#doesWallBelongToActiveScene(
        wallDocument
      )
    ) {
      this.scheduleRebuild(
        "create-wall"
      );
    }
  }

  /**
   * Regenerate after relevant wall geometry or door classification changes.
   *
   * @param {object} wallDocument - Updated WallDocument.
   * @param {object} changed - Wall differential.
   */
  handleWallUpdated(
    wallDocument,
    changed
  ) {
    if (
      isGeneratedSpanWallDocument(
        wallDocument
      )
    ) {
      return;
    }

    if (
      !this.#doesWallBelongToActiveScene(
        wallDocument
      ) ||
      !doesWallUpdateAffectWebs(
        changed
      )
    ) {
      return;
    }

    this.scheduleRebuild(
      "update-wall"
    );
  }

  /**
   * Regenerate after a structural wall is deleted.
   *
   * @param {object} wallDocument - Deleted WallDocument.
   */
  handleWallDeleted(
    wallDocument
  ) {
    if (
      isGeneratedSpanWallDocument(
        wallDocument
      )
    ) {
      return;
    }

    if (
      this.#doesWallBelongToActiveScene(
        wallDocument
      )
    ) {
      this.scheduleRebuild(
        "delete-wall"
      );
    }
  }

  /** Regenerate when one active-Scene Region is created. */
  handleRegionCreated(regionDocument) {
    if (this.#doesDocumentBelongToActiveScene(regionDocument)) {
      this.scheduleRebuild("create-region");
    }
  }

  /** Regenerate when Region geometry, elevation, or recognised tags change. */
  handleRegionUpdated(regionDocument, changed) {
    if (
      this.#doesDocumentBelongToActiveScene(regionDocument) &&
      doesRegionUpdateAffectWebs(changed)
    ) {
      this.scheduleRebuild("update-region");
    }
  }

  /** Regenerate when one active-Scene Region is deleted. */
  handleRegionDeleted(regionDocument) {
    if (this.#doesDocumentBelongToActiveScene(regionDocument)) {
      this.scheduleRebuild("delete-region");
    }
  }

  /** Regenerate when the active Scene's level structure changes. */
  handleLevelStructureChanged(
    levelDocument,
    event
  ) {
    const parentSceneId =
      levelDocument?.parent?.id ??
      levelDocument?.scene?.id ??
      levelDocument?.parentId ??
      null;

    const activeSceneId =
      globalThis.canvas?.scene?.id ??
      null;

    if (
      !activeSceneId ||
      (
        parentSceneId !==
          null &&
        String(
          parentSceneId
        ) !==
          String(
            activeSceneId
          )
      )
    ) {
      return;
    }

    this.scheduleRebuild(
      String(
        event ??
        "level-structure-update"
      )
    );
  }

  /**
   * Coalesce rapid wall and Scene geometry changes.
   *
   * @param {string} reason - Rebuild reason.
   */
  scheduleRebuild(
    reason
  ) {
    const normalisedReason =
      normaliseReason(
        reason
      );

    this.pendingReason =
      normalisedReason;

    this.lastRequestedReason =
      normalisedReason;

    this.lastRequestedAt =
      Date.now();

    if (
      this.pendingRebuildHandle !==
        null
    ) {
      return;
    }

    if (
      typeof globalThis.setTimeout !==
        "function" ||
      this.debounceMs <=
        0
    ) {
      const immediateReason =
        this.pendingReason;

      this.pendingReason =
        null;

      this.synchroniseActiveScene(
        immediateReason
      );

      return;
    }

    this.pendingRebuildHandle =
      globalThis.setTimeout(
        () => {
          this.pendingRebuildHandle =
            null;

          const pendingReason =
            this.pendingReason ??
            "geometry-update";

          this.pendingReason =
            null;

          this.synchroniseActiveScene(
            pendingReason
          );
        },
        this.debounceMs
      );
  }

  /** Cancel one pending debounced rebuild. */
  clearPendingRebuild() {
    if (
      this.pendingRebuildHandle !==
        null &&
      typeof globalThis.clearTimeout ===
        "function"
    ) {
      globalThis.clearTimeout(
        this.pendingRebuildHandle
      );
    }

    this.pendingRebuildHandle =
      null;

    this.pendingReason =
      null;
  }

  /**
   * Generate or clear webs for the current active Scene.
   *
   * @param {string} reason - Synchronisation reason.
   * @returns {Readonly<object>|null} Web state.
   */
  synchroniseActiveScene(
    reason
  ) {
    const normalisedReason =
      normaliseReason(
        reason
      );

    this.lastRequestedReason =
      normalisedReason;

    this.lastRequestedAt =
      Date.now();

    const scene =
      globalThis.canvas?.scene ??
      null;

    if (
      !scene ||
      globalThis.canvas?.ready !==
        true
    ) {
      return null;
    }

    const snapshot =
      synchroniseSceneWebs({
        runtime:
          this.runtime,
        scene,
        reason:
          normalisedReason
      });

    if (
      snapshot
    ) {
      this.lastCompletedReason =
        normalisedReason;

      this.lastCompletedAt =
        Date.now();

      this.synchronisationCount +=
        1;

      this.tokenSpanWebInteractionController.prime(
        scene
      );
    }

    return snapshot;
  }

  /** Apply active Scene presentation without regenerating geometry. */
  synchroniseActiveScenePresentation(
    reason
  ) {
    const normalisedReason =
      normaliseReason(
        reason
      );

    this.lastRequestedReason =
      normalisedReason;

    this.lastRequestedAt =
      Date.now();

    const scene =
      globalThis.canvas?.scene ??
      null;

    if (
      !scene ||
      globalThis.canvas?.ready !==
        true
    ) {
      return null;
    }

    const snapshot =
      synchroniseSceneWebPresentation({
        runtime:
          this.runtime,
        scene,
        reason:
          normalisedReason
      });

    if (snapshot) {
      this.lastCompletedReason =
        normalisedReason;

      this.lastCompletedAt =
        Date.now();

      this.synchronisationCount +=
        1;
    }

    return snapshot;
  }

  /** Redraw the current level subset without regenerating geometry. */
  synchroniseActiveSceneVisibility(
    reason
  ) {
    const normalisedReason =
      normaliseReason(
        reason
      );

    this.lastRequestedReason =
      normalisedReason;

    this.lastRequestedAt =
      Date.now();

    const scene =
      globalThis.canvas?.scene ??
      null;

    if (
      !scene ||
      globalThis.canvas?.ready !==
        true
    ) {
      return null;
    }

    const snapshot =
      synchroniseSceneWebVisibility({
        runtime:
          this.runtime,
        scene,
        reason:
          normalisedReason
      });

    if (snapshot) {
      this.lastCompletedReason =
        normalisedReason;

      this.lastCompletedAt =
        Date.now();

      this.synchronisationCount +=
        1;
    }

    return snapshot;
  }

  /** Apply persisted destroyed-span state without regenerating geometry. */
  synchroniseActiveSceneMutableState(
    reason
  ) {
    const normalisedReason =
      normaliseReason(
        reason
      );

    this.lastRequestedReason =
      normalisedReason;

    this.lastRequestedAt =
      Date.now();

    const scene =
      globalThis.canvas?.scene ??
      null;

    if (
      !scene ||
      globalThis.canvas?.ready !==
        true
    ) {
      return null;
    }

    const snapshot =
      synchroniseSceneWebMutableState({
        runtime:
          this.runtime,
        scene,
        reason:
          normalisedReason
      });

    if (snapshot) {
      this.lastCompletedReason =
        normalisedReason;

      this.lastCompletedAt =
        Date.now();

      this.synchronisationCount +=
        1;
    }

    return snapshot;
  }

  /** Preserve the v0.2 colour-only lifecycle method as an alias. */
  synchroniseActiveSceneColour(
    reason
  ) {
    return this.synchroniseActiveScenePresentation(
      reason
    );
  }

  /** @returns {Readonly<object>} Lifecycle telemetry without timer handles. */
  createDiagnosticSnapshot() {
    return Object.freeze({
      registered:
        this.registered ===
          true,
      hookRegistrationCount:
        this.hookRegistrations.length,
      debounceMilliseconds:
        this.debounceMs,
      pendingRebuild:
        this.pendingRebuildHandle !==
          null,
      pendingReason:
        this.pendingReason,
      lastRequestedReason:
        this.lastRequestedReason,
      lastRequestedAt:
        this.lastRequestedAt,
      lastCompletedReason:
        this.lastCompletedReason,
      lastCompletedAt:
        this.lastCompletedAt,
      synchronisationCount:
        this.synchronisationCount,
      tokenSpanWebInteractions:
        this.tokenSpanWebInteractionController.createDiagnosticSnapshot()
    });
  }

  #register(
    event,
    callback
  ) {
    const id =
      globalThis.Hooks.on(
        event,
        callback
      );

    this.hookRegistrations.push({
      event,
      id
    });
  }

  #isActiveScene(
    scene
  ) {
    const activeSceneId =
      globalThis.canvas?.scene?.id;

    return Boolean(
      activeSceneId &&
      scene?.id ===
        activeSceneId
    );
  }

  #doesWallBelongToActiveScene(wallDocument) {
    return this.#doesDocumentBelongToActiveScene(wallDocument);
  }

  #doesDocumentBelongToActiveScene(documentLike) {
    const activeSceneId = globalThis.canvas?.scene?.id;
    if (!activeSceneId) return false;

    const document = documentLike?.document ?? documentLike;
    const parentSceneId =
      document?.parent?.id ??
      document?.parentId ??
      document?.scene?.id ??
      document?._source?.parentId ??
      null;

    return parentSceneId === null || parentSceneId === undefined
      ? true
      : String(parentSceneId) === String(activeSceneId);
  }
}

function normaliseReason(
  value
) {
  const text =
    String(
      value ??
      "scene-lifecycle"
    ).trim();

  return text.length >
    0
    ? text
    : "scene-lifecycle";
}

