import {
  createActiveWebSceneContext
} from "../../foundry/webSceneCompatibility.js";

import {
  resolveWebLevelProvider
} from "../../foundry/webLevelProvider.js";

import {
  filterWebsForVisibleLevels,
  resolveVisibleWebLevelIds
} from "../../foundry/webLevelVisibilityCompatibility.js";

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
  createWebLevelVisibilityState
} from "./webLevelVisibilityState.js";

import {
  createWebRuntimeSnapshot,
  createWebRuntimeState
} from "./webRuntimeState.js";

import {
  WebSpatialIndex
} from "../../spatial/WebSpatialIndex.js";

import {
  WebMutableStateService
} from "../../interactions/WebMutableStateService.js";

import {
  WebMovementInteractionService
} from "../../interactions/WebMovementInteractionService.js";

import {
  MODULE_ID
} from "../../module/moduleConstants.js";

/** Own deterministic all-level web blueprints and transient visible rendering. */
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

    this.spatialIndex =
      options.spatialIndex instanceof
        WebSpatialIndex
        ? options.spatialIndex
        : new WebSpatialIndex();

    this.mutableStateService =
      options.mutableStateService instanceof
        WebMutableStateService
        ? options.mutableStateService
        : new WebMutableStateService();

    this.movementInteractionService =
      options.movementInteractionService instanceof
        WebMovementInteractionService
        ? options.movementInteractionService
        : new WebMovementInteractionService({
            webRuntimeService:
              this
          });

    this.state =
      createWebRuntimeState();
  }

  /** Generate all level populations and render the locally visible subset. */
  generateForActiveScene({
    scene =
      globalThis.canvas?.scene,
    options = {},
    populations = null,
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
        Array.isArray(populations)
          ? {
              populations
            }
          : {
              ...options,
              ...(
                colourProfileId
                  ? {
                      colourProfileId
                    }
                  : {}
              )
            }
      );

    const resolvedThicknessMultiplier =
      Array.isArray(populations)
        ? 1
        : thicknessMultiplier ===
            null ||
          thicknessMultiplier ===
            undefined
          ? getSceneWebThicknessConfiguration(
              scene
            ).thicknessMultiplier
          : normaliseSceneWebThickness(
              thicknessMultiplier
            );

    const levelVisibility =
      resolveRuntimeLevelVisibility({
        scene,
        levelProvider:
          generated.levelProvider,
        levels:
          generated.levels
      });

    const nextSpatialIndex =
      new WebSpatialIndex({
        cellSizePx:
          resolveSpatialCellSize(
            context.gridSize
          )
      });

    nextSpatialIndex.rebuild(
      generated.webs,
      {
        sceneId:
          generated.sceneId,
        generationId:
          nextGenerationId
      }
    );

    const previousMutableState =
      this.mutableStateService.createSnapshot();

    const mutableState =
      this.mutableStateService.reconcile({
        sceneId:
          generated.sceneId,
        generationId:
          nextGenerationId,
        webs:
          generated.webs
      });

    nextSpatialIndex.applyDestroyedWebIds(
      mutableState.destroyedWebIds
    );

    const visibleWebs =
      filterIntactWebs(
        filterWebsForVisibleLevels(
          generated.webs,
          levelVisibility.visibleLevelIds
        ),
        this.mutableStateService
      );

    try {
      this.renderService.render(
        visibleWebs,
        createRenderingConfiguration(
          generated.configuration.rendering,
          resolvedThicknessMultiplier
        )
      );
    } catch (error) {
      this.mutableStateService.applySnapshot(
        previousMutableState
      );

      this.spatialIndex.clear();

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

    this.spatialIndex =
      nextSpatialIndex;

    this.state = {
      active:
        true,
      blueprintSchemaVersion:
        generated.blueprintSchemaVersion,
      sceneId:
        generated.sceneId,
      levelProvider:
        generated.levelProvider,
      levels:
        generated.levels,
      levelVisibility,
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
      populations:
        generated.populations ??
        Object.freeze([]),
      regions:
        generated.regions ??
        Object.freeze([]),
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
      mutableState,
      webs:
        generated.webs,
      counts:
        generated.counts
    };

    return this.createDiagnosticSnapshot();
  }

  /** Re-resolve colour/thickness and redraw only the visible level subset. */
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

    const levelVisibility =
      resolveRuntimeLevelVisibility({
        scene:
          globalThis.canvas?.scene,
        levelProvider:
          previousState.levelProvider,
        levels:
          previousState.levels
      });

    const visibleWebs =
      filterIntactWebs(
        filterWebsForVisibleLevels(
          webs,
          levelVisibility.visibleLevelIds
        ),
        this.mutableStateService
      );

    try {
      this.renderService.render(
        visibleWebs,
        createRenderingConfiguration(
          previousState.configuration.rendering,
          resolvedThicknessMultiplier
        )
      );
    } catch (error) {
      this.#restorePreviousRendering({
        previousState,
        operationReason,
        operationAt,
        error
      });

      throw error;
    }

    this.spatialIndex.refreshSnapshots(
      webs
    );

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
      levelVisibility,
      webs
    };

    return this.createDiagnosticSnapshot();
  }

  /** Switch the rendered level subset without regenerating stored geometry. */
  refreshLevelVisibility({
    scene =
      globalThis.canvas?.scene,
    reason =
      "web-level-visibility-refresh"
  } = {}) {
    if (
      this.state.active !==
        true
    ) {
      return this.createDiagnosticSnapshot();
    }

    const previousState =
      this.state;

    const operationReason =
      normaliseOptionalIdentifier(
        reason
      ) ??
      "web-level-visibility-refresh";

    const operationAt =
      Date.now();

    const levelVisibility =
      resolveRuntimeLevelVisibility({
        scene,
        levelProvider:
          previousState.levelProvider,
        levels:
          previousState.levels
      });

    if (
      levelVisibilityEquals(
        previousState.levelVisibility,
        levelVisibility
      )
    ) {
      this.state = {
        ...previousState,
        lastOperationReason:
          operationReason,
        lastOperationAt:
          operationAt,
        levelVisibility
      };

      return this.createDiagnosticSnapshot();
    }

    const visibleWebs =
      filterIntactWebs(
        filterWebsForVisibleLevels(
          previousState.webs,
          levelVisibility.visibleLevelIds
        ),
        this.mutableStateService
      );

    try {
      this.renderService.render(
        visibleWebs,
        createRenderingConfiguration(
          previousState.configuration.rendering,
          previousState.thicknessMultiplier
        )
      );
    } catch (error) {
      this.#restorePreviousRendering({
        previousState,
        operationReason,
        operationAt,
        error
      });

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
      levelVisibility
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

  /**
   * Clear only Dynamic Webs' client-local bundled carpet texture request cache
   * and redraw the current visible subset. Geometry and Scene flags are kept.
   */
  clearCarpetTextureCache({
    redraw =
      true,
    reason =
      "clear-carpet-texture-cache"
  } = {}) {
    const cleared =
      this.renderService.clearCarpetTextureCache();

    const operationReason =
      normaliseOptionalIdentifier(
        reason
      ) ??
      "clear-carpet-texture-cache";

    const operationAt =
      Date.now();

    if (
      redraw ===
        true &&
      this.state.active ===
        true
    ) {
      const visibleWebs =
        filterIntactWebs(
          filterWebsForVisibleLevels(
            this.state.webs,
            this.state.levelVisibility?.visibleLevelIds ??
            []
          ),
          this.mutableStateService
        );

      this.renderService.render(
        visibleWebs,
        createRenderingConfiguration(
          this.state.configuration.rendering,
          this.state.thicknessMultiplier
        )
      );

      this.state = {
        ...this.state,
        presentationRevision:
          this.state.presentationRevision +
          1,
        lastOperationReason:
          operationReason,
        lastOperationAt:
          operationAt
      };
    } else {
      this.state = {
        ...this.state,
        lastOperationReason:
          operationReason,
        lastOperationAt:
          operationAt
      };
    }

    return Object.freeze({
      cleared,
      state:
        this.createDiagnosticSnapshot()
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

    const clearedSpatialIndex =
      this.spatialIndex.clear();

    const clearedMutableState =
      this.mutableStateService.clear();

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
      clearedRendering ||
      clearedSpatialIndex ||
      clearedMutableState;
  }

  /** Return the current immutable session-state snapshot. */
  getMutableState() {
    return this.mutableStateService.createSnapshot();
  }

  /** Query intact span webs intersected by one swept entity movement. */
  queryMovementIntersections(
    request
  ) {
    return this.movementInteractionService.queryMovement(
      request
    );
  }

  /** Destroy intact wall-span webs without changing immutable geometry. */
  destroyWebs(
    webIds,
    metadata = {}
  ) {
    const requestedIds =
      Array.from(
        new Set(
          (
            Array.isArray(
              webIds
            )
              ? webIds
              : [
                  webIds
                ]
          )
            .map(
              (
                value
              ) =>
                String(
                  value ??
                  ""
                ).trim()
            )
            .filter(
              Boolean
            )
        )
      ).sort();

    const eligibleIds =
      requestedIds.filter(
        (
          webId
        ) =>
          this.spatialIndex.getWeb(
            webId
          )?.webKind ===
            "wall-span" ||
          this.spatialIndex.getWeb(
            webId
          )?.kind ===
            "wall-span"
      );

    const previousMutableState =
      this.getMutableState();

    const destroyedWebIds =
      this.mutableStateService.destroyWebs(
        eligibleIds,
        metadata
      );

    if (
      destroyedWebIds.length ===
        0
    ) {
      return Object.freeze({
        changed:
          false,
        destroyedWebIds,
        state:
          this.getMutableState()
      });
    }

    for (
      const webId of
      destroyedWebIds
    ) {
      this.spatialIndex.setWebIntact(
        webId,
        false
      );
    }

    try {
      this.#refreshAfterMutableStateChange(
        metadata?.cause ??
        "destroy-webs"
      );
    } catch (error) {
      this.#rollbackMutableState(
        previousMutableState,
        "destroy-webs-rollback"
      );

      throw error;
    }

    const state =
      this.getMutableState();

    globalThis.Hooks?.callAll?.(
      `${MODULE_ID}.mutableStateChanged`,
      state,
      {
        reason:
          metadata?.cause ??
          "destroy-webs",
        destroyedWebIds,
        remote:
          false
      }
    );

    globalThis.Hooks?.callAll?.(
      `${MODULE_ID}.webDestroyed`,
      Object.freeze({
        webIds:
          destroyedWebIds,
        cause:
          metadata?.cause ??
          "destroy-webs",
        entityId:
          metadata?.entityId ??
          null,
        state
      })
    );

    return Object.freeze({
      changed:
        true,
      destroyedWebIds,
      state
    });
  }

  restoreWeb(
    webId,
    metadata = {}
  ) {
    const previousMutableState =
      this.getMutableState();

    const changed =
      this.mutableStateService.restoreWeb(
        webId,
        metadata
      );

    if (!changed) {
      return Object.freeze({
        changed:
          false,
        webId:
          String(
            webId ??
            ""
          ),
        state:
          this.getMutableState()
      });
    }

    this.spatialIndex.setWebIntact(
      webId,
      true
    );

    try {
      this.#refreshAfterMutableStateChange(
        metadata?.cause ??
        "restore-web"
      );
    } catch (error) {
      this.#rollbackMutableState(
        previousMutableState,
        "restore-web-rollback"
      );

      throw error;
    }

    const state =
      this.getMutableState();

    globalThis.Hooks?.callAll?.(
      `${MODULE_ID}.mutableStateChanged`,
      state,
      {
        reason:
          metadata?.cause ??
          "restore-web",
        remote:
          false
      }
    );

    return Object.freeze({
      changed:
        true,
      webId:
        String(
          webId
        ),
      state
    });
  }

  resetMutableState(
    metadata = {}
  ) {
    const previousMutableState =
      this.getMutableState();

    const changed =
      this.mutableStateService.reset(
        metadata
      );

    if (
      changed
    ) {
      this.spatialIndex.applyDestroyedWebIds(
        []
      );

      try {
        this.#refreshAfterMutableStateChange(
          metadata?.cause ??
          "reset-web-state"
        );
      } catch (error) {
        this.#rollbackMutableState(
          previousMutableState,
          "reset-web-state-rollback"
        );

        throw error;
      }

      globalThis.Hooks?.callAll?.(
        `${MODULE_ID}.mutableStateChanged`,
        this.getMutableState(),
        {
          reason:
            metadata?.cause ??
            "reset-web-state",
          remote:
            false
        }
      );
    }

    return Object.freeze({
      changed,
      state:
        this.getMutableState()
    });
  }

  applyMutableStateSnapshot(
    snapshot,
    {
      reason =
        "remote-web-state"
    } = {}
  ) {
    const previousMutableState =
      this.getMutableState();

    const changed =
      this.mutableStateService.applySnapshot(
        snapshot,
        {
          expectedSceneId:
            this.state.sceneId
        }
      );

    if (!changed) {
      return false;
    }

    const state =
      this.getMutableState();

    this.spatialIndex.applyDestroyedWebIds(
      state.destroyedWebIds
    );

    try {
      this.#refreshAfterMutableStateChange(
        reason
      );
    } catch (error) {
      this.#rollbackMutableState(
        previousMutableState,
        "remote-web-state-rollback"
      );

      throw error;
    }

    return true;
  }

  /** Return all immutable stored web snapshots in stable ID order. */
  getWebs() {
    return this.spatialIndex.getWebs();
  }

  /** Return one immutable stored web snapshot or null. */
  getWeb(webId) {
    return this.spatialIndex.getWeb(
      webId
    );
  }

  /** Query functional strand geometry near one point. */
  queryNearby(point, options = {}) {
    return this.spatialIndex.queryNearby(
      point,
      options
    );
  }

  /** Query strands whose functional bounds overlap one rectangle. */
  queryStrands(bounds, options = {}) {
    return this.spatialIndex.queryStrands(
      bounds,
      options
    );
  }

  /** Find metadata- and spatially-compatible web blueprints. */
  findCompatibleWebs(options = {}) {
    return this.spatialIndex.findCompatibleWebs(
      options
    );
  }

  /** Find compatible immutable perch snapshots. */
  findPerches(options = {}) {
    return this.spatialIndex.findPerches(
      options
    );
  }

  /** Return frozen spatial build and query telemetry. */
  createSpatialDiagnosticSnapshot() {
    return this.spatialIndex.createDiagnosticSnapshot();
  }

  /** Run a non-destructive all-level deterministic-generation comparison. */
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
          scene,
          {
            requestedProviderMode:
              this.state.levelProvider?.requestedMode ??
              null
          }
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
          Array.isArray(this.state.populations) &&
          this.state.populations.length > 0
            ? {
                populations:
                  this.state.populations
              }
            : {
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
      this.renderService.createDiagnosticSnapshot(),
      {
        spatialDiagnostics:
          this.spatialIndex.createDiagnosticSnapshot()
      }
    );
  }

  /** Return runtime telemetry without copying the complete web population. */
  createTelemetrySnapshot() {
    return createWebRuntimeSnapshot(
      this.state,
      this.renderService.createDiagnosticSnapshot(),
      {
        includeWebs:
          false,
        spatialDiagnostics:
          this.spatialIndex.createDiagnosticSnapshot()
      }
    );
  }

  #rollbackMutableState(
    snapshot,
    reason
  ) {
    this.mutableStateService.applySnapshot(
      snapshot
    );

    this.spatialIndex.applyDestroyedWebIds(
      snapshot?.destroyedWebIds ??
      []
    );

    if (
      this.state.active ===
        true
    ) {
      this.#refreshAfterMutableStateChange(
        reason
      );
    }
  }

  #refreshAfterMutableStateChange(
    reason
  ) {
    if (
      this.state.active !==
        true
    ) {
      return;
    }

    const visibleWebs =
      filterIntactWebs(
        filterWebsForVisibleLevels(
          this.state.webs,
          this.state.levelVisibility?.visibleLevelIds ??
          []
        ),
        this.mutableStateService
      );

    this.renderService.render(
      visibleWebs,
      createRenderingConfiguration(
        this.state.configuration.rendering,
        this.state.thicknessMultiplier
      )
    );

    this.state = {
      ...this.state,
      presentationRevision:
        this.state.presentationRevision +
        1,
      lastOperationReason:
        normaliseOptionalIdentifier(
          reason
        ) ??
        "mutable-web-state",
      lastOperationAt:
        Date.now(),
      mutableState:
        this.getMutableState()
    };
  }

  #restorePreviousRendering({
    previousState,
    operationReason,
    operationAt,
    error
  }) {
    try {
      const previousVisibleWebs =
        filterIntactWebs(
          filterWebsForVisibleLevels(
            previousState.webs,
            previousState.levelVisibility?.visibleLevelIds ??
            previousState.levels?.map(
              (
                level
              ) =>
                level.id
            ) ??
            []
          ),
          this.mutableStateService
        );

      this.renderService.render(
        previousVisibleWebs,
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
      this.spatialIndex.clear();

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
  }
}

function filterIntactWebs(
  webs,
  mutableStateService
) {
  return Object.freeze(
    (
      Array.isArray(
        webs
      )
        ? webs
        : []
    ).filter(
      (
        web
      ) =>
        mutableStateService.isWebIntact(
          web?.id
        )
    )
  );
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
  const wallsByLevel =
    {};

  const wallLevelById =
    {};

  let unresolvedWallLevelCount =
    0;

  for (
    const segment of
    context.wallSegments
  ) {
    wallLevelById[
      segment.wallId
    ] =
      segment.levelId;

    wallsByLevel[
      segment.levelId
    ] =
      (
        wallsByLevel[
          segment.levelId
        ] ??
        0
      ) +
      1;

    if (
      segment.levelMetadataResolved !==
        true
    ) {
      unresolvedWallLevelCount +=
        1;
    }
  }

  return Object.freeze({
    gridSize:
      Number(
        context.gridSize
      ),
    sceneRect:
      context.sceneRect,
    structuralWallCount:
      context.wallSegments.length,
    detectedLevelCount:
      context.levels.length,
    wallsByLevel:
      Object.freeze(
        wallsByLevel
      ),
    wallLevelById:
      Object.freeze(
        wallLevelById
      ),
    unresolvedWallLevelCount
  });
}

function resolveRuntimeLevelVisibility({
  scene,
  levelProvider,
  levels
}) {
  const currentProvider =
    resolveWebLevelProvider({
      requestedMode:
        levelProvider?.requestedMode ??
        null,
      scene
    });

  const resolution =
    Object.freeze({
      ...currentProvider,
      levels:
        Array.isArray(
          levels
        ) &&
        levels.length >
          0
          ? levels
          : currentProvider.levels
    });

  const visibility =
    resolveVisibleWebLevelIds({
      scene,
      providerResolution:
        resolution
    });

  return createWebLevelVisibilityState(
    visibility
  );
}

function levelVisibilityEquals(
  first,
  second
) {
  if (
    first?.policy !==
      second?.policy ||
    first?.activeViewedLevelId !==
      second?.activeViewedLevelId
  ) {
    return false;
  }

  const firstIds =
    Array.isArray(
      first?.visibleLevelIds
    )
      ? first.visibleLevelIds
      : [];

  const secondIds =
    Array.isArray(
      second?.visibleLevelIds
    )
      ? second.visibleLevelIds
      : [];

  return firstIds.length ===
    secondIds.length &&
    firstIds.every(
      (
        value,
        index
      ) =>
        value ===
        secondIds[index]
    );
}

function resolveSpatialCellSize(
  gridSize
) {
  const size =
    Number(
      gridSize
    );

  if (
    !Number.isFinite(
      size
    ) ||
    size <=
      0
  ) {
    return 200;
  }

  return Math.max(
    64,
    Math.min(
      512,
      size *
        2
    )
  );
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
