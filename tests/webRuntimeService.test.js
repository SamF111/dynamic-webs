import test from "node:test";
import assert from "node:assert/strict";

import {
  WebRenderService
} from "../scripts/rendering/webs/WebRenderService.js";

import {
  WebRuntimeService
} from "../scripts/runtime/webs/WebRuntimeService.js";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

import {
  getWebColourProfile
} from "../scripts/simulation/webs/webColourProfiles.js";

function createEnvironment({
  renderFailure =
    null,
  webKind =
    "ground",
  persistedMutableState =
    undefined
} = {}) {
  const previousCanvas =
    globalThis.canvas;

  const previousGame =
    globalThis.game;

  const setFlagCalls =
    [];

  const scene = {
    id:
      "scene",
    flags: {
      "dynamic-webs": {
        ...(persistedMutableState === undefined
          ? {}
          : { mutableState: persistedMutableState })
      }
    },
    getFlag(namespace, key) {
      return this.flags?.[namespace]?.[key];
    },
    async setFlag(namespace, key, value) {
      this.flags[namespace] ??= {};
      this.flags[namespace][key] = value;
      setFlagCalls.push({ namespace, key, value });
      return this;
    }
  };

  globalThis.canvas = {
    ready:
      true,
    scene,
    dimensions: {
      size:
        100,
      sceneRect: {
        x:
          0,
        y:
          0,
        width:
          1000,
        height:
          1000
      }
    },
    walls: {
      placeables:
        []
    }
  };

  globalThis.game = {
    user: {
      id:
        "gm",
      isGM:
        true
    },
    scenes: {
      get(id) {
        return id === scene.id
          ? scene
          : null;
      }
    }
  };

  const webId =
    webKind ===
      "wall-span"
      ? "wall-span:scene:default:base:index-0"
      : "ground:scene:default:base:index-0";

  const web =
    Object.freeze({
      schemaVersion:
        8,
      id:
        webId,
      kind:
        webKind,
      sceneId:
        "scene",
      populationId:
        "default",
      populationLabel:
        "Default Web Population",
      thicknessMultiplier:
        1,
      levelProviderMode:
        "base",
      levelId:
        "base",
      elevationBand:
        Object.freeze({
          bottom:
            null,
          top:
            null
        }),
      seed:
        "seed:ground",
      sourceKey:
        "index-0",
      colourProfileId:
        "natural-white",
      hub:
        Object.freeze({
          x:
            10,
          y:
            10
        }),
      bounds:
        Object.freeze({
          x:
            10,
          y:
            10,
          width:
            10,
          height:
            10,
          right:
            20,
          bottom:
            20
        }),
      strands:
        Object.freeze([
          Object.freeze({
            schemaVersion:
              8,
            id:
              `${webId}:structural-0`,
            localId:
              "structural-0",
            kind:
              "structural",
            points:
              Object.freeze([
                Object.freeze({
                  x:
                    10,
                  y:
                    10
                }),
                Object.freeze({
                  x:
                    20,
                  y:
                    20
                })
              ]),
            baseAlpha:
              0.7,
            alpha:
              0.7,
            colour:
              0xe8edf2,
            underColour:
              0x111827,
            widthPx:
              1.2,
            collisionWidthPx:
              2.25
          })
        ]),
      perches:
        Object.freeze([]),
      supportingWallIds:
        Object.freeze([]),
      regionIds:
        Object.freeze([]),
      regionTags:
        Object.freeze([])
    });

  const generated =
    Object.freeze({
      blueprintSchemaVersion:
        6,
      sceneId:
        "scene",
      seed:
        "seed",
      categorySeeds:
        Object.freeze({
          base:
            Object.freeze({
              corner:
                "seed:base:corner",
              span:
                "seed:base:span",
              ground:
                "seed:base:ground"
            })
        }),
      levelProvider:
        Object.freeze({
          requestedMode:
            "base",
          resolvedMode:
            "base",
          providerAvailable:
            true,
          fallbackUsed:
            false,
          fallbackReason:
            null,
          activeViewedLevelId:
            "base",
          levels:
            Object.freeze([])
        }),
      levels:
        Object.freeze([
          Object.freeze({
            id:
              "base",
            label:
              "Base level",
            providerMode:
              "base",
            elevationBand:
              Object.freeze({
                bottom:
                  null,
                top:
                  null
              }),
            source:
              "base"
          })
        ]),
      colourProfileId:
        "natural-white",
      colourProfile:
        getWebColourProfile(
          "natural-white"
        ),
      configuration:
        Object.freeze({
          rendering:
            Object.freeze({
              layerMode:
                "under-tokens"
            })
        }),
      webs:
        Object.freeze([
          web
        ]),
      counts:
        Object.freeze({
          total:
            1,
          corner:
            0,
          span:
            webKind === "wall-span" ? 1 : 0,
          ground:
            webKind === "ground" ? 1 : 0,
          strands:
            1,
          byWebKind:
            Object.freeze({
              "wall-corner":
                0,
              "wall-span":
                webKind === "wall-span" ? 1 : 0,
              ground:
                webKind === "ground" ? 1 : 0
            }),
          byStrandKind:
            Object.freeze({
              structural:
                1,
              capture:
                0,
              decorative:
                0
            })
        })
    });

  const generationService =
    new WebGenerationService();

  generationService.generate =
    () =>
      generated;

  const renderCalls =
    [];

  const clearCalls =
    [];

  const renderService =
    new WebRenderService();

  renderService.render =
    (
      webs,
      configuration
    ) => {
      renderCalls.push({
        webs,
        configuration
      });

      if (
        renderFailure
      ) {
        throw renderFailure;
      }

      return {};
    };

  renderService.clear =
    () => {
      clearCalls.push(
        true
      );

      return true;
    };

  renderService.createDiagnosticSnapshot =
    () =>
      Object.freeze({
        hasContainer:
          renderCalls.length >
          clearCalls.length,
        renderedWebCount:
          renderCalls.length >
            clearCalls.length
            ? 1
            : 0
      });

  const runtime = {
    runtimeOwnerType:
      "DynamicWebsRuntime"
  };

  const service =
    new WebRuntimeService({
      runtime,
      generationService,
      renderService
    });

  return {
    scene,
    service,
    renderCalls,
    clearCalls,
    setFlagCalls,
    webId,
    restore() {
      globalThis.canvas =
        previousCanvas;
      globalThis.game =
        previousGame;
    }
  };
}

test(
  "runtime generation records provenance, geometry and rendering telemetry",
  () => {
    const environment =
      createEnvironment();

    try {
      const snapshot =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          densityId:
            "dense",
          categoryDensities:
            Object.freeze({
              "wall-corner":
                "dense",
              "wall-span":
                "sparse",
              ground:
                "standard",
              "web-carpet":
                "disabled"
            }),
          categoryDensitySources:
            Object.freeze({
              "wall-corner":
                "explicit",
              "wall-span":
                "explicit",
              ground:
                "legacy-fallback",
              "web-carpet":
                "explicit"
            }),
          reason:
            "runtime-test"
        });

      assert.equal(
        snapshot.active,
        true
      );

      assert.equal(
        snapshot.generationId,
        1
      );

      assert.equal(
        snapshot.generationReason,
        "runtime-test"
      );

      assert.equal(
        snapshot.densityId,
        "dense"
      );

      assert.equal(
        snapshot.categoryDensities["wall-span"],
        "sparse"
      );

      assert.equal(
        snapshot.categoryDensitySources.ground,
        "legacy-fallback"
      );

      assert.equal(
        snapshot.colourProfileId,
        "natural-white"
      );

      assert.equal(
        snapshot.presentationRevision,
        1
      );

      assert.equal(
        snapshot.thicknessMultiplier,
        1
      );

      assert.equal(
        snapshot.sceneGeometry.gridSize,
        100
      );

      assert.equal(
        snapshot.sceneGeometry.structuralWallCount,
        0
      );

      assert.equal(
        snapshot.rendering.renderedWebCount,
        1
      );

      assert.equal(
        environment.renderCalls.length,
        1
      );

      assert.equal(
        Object.isFrozen(
          snapshot
        ),
        true
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime rendering failure leaves no active generated population",
  () => {
    const environment =
      createEnvironment({
        renderFailure:
          new Error(
            "render failed"
          )
      });

    try {
      assert.throws(
        () =>
          environment.service.generateForActiveScene({
            scene:
              environment.scene,
            reason:
              "runtime-test"
          }),
        /render failed/u
      );

      const state =
        environment.service.getState();

      assert.equal(
        state.active,
        false
      );

      assert.equal(
        state.generationId,
        0
      );

      assert.equal(
        state.lastOperationReason,
        "runtime-test-failed"
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime clear preserves generation revision while removing active geometry",
  () => {
    const environment =
      createEnvironment();

    try {
      environment.service.generateForActiveScene({
        scene:
          environment.scene,
        reason:
          "runtime-test"
      });

      assert.equal(
        environment.service.clear(
          "manual-clear"
        ),
        true
      );

      const snapshot =
        environment.service.createDiagnosticSnapshot();

      assert.equal(
        snapshot.active,
        false
      );

      assert.equal(
        snapshot.generationId,
        1
      );

      assert.equal(
        snapshot.generationReason,
        "runtime-test"
      );

      assert.equal(
        snapshot.lastOperationReason,
        "manual-clear"
      );

      assert.equal(
        snapshot.webs.length,
        0
      );
    } finally {
      environment.restore();
    }
  }
);



test(
  "runtime colour refresh preserves geometry generation identity and redraws presentation",
  () => {
    const environment =
      createEnvironment();

    try {
      const before =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          densityId:
            "dense",
          reason:
            "runtime-test"
        });

      const beforeWeb =
        environment.service.getState().webs[0];

      const beforePoints =
        beforeWeb.strands[0].points;

      const after =
        environment.service.refreshColourProfile({
          profileId:
            "blood-red",
          reason:
            "scene-web-colour-update"
        });

      const afterWeb =
        environment.service.getState().webs[0];

      assert.equal(
        after.generationId,
        before.generationId
      );

      assert.equal(
        after.generatedAt,
        before.generatedAt
      );

      assert.equal(
        after.presentationRevision,
        before.presentationRevision +
          1
      );

      assert.equal(
        after.colourProfileId,
        "blood-red"
      );

      assert.equal(
        afterWeb.id,
        beforeWeb.id
      );

      assert.equal(
        afterWeb.hub,
        beforeWeb.hub
      );

      assert.equal(
        afterWeb.strands[0].points,
        beforePoints
      );

      assert.equal(
        afterWeb.strands[0].colour,
        0x9f2424
      );

      assert.equal(
        environment.renderCalls.length,
        2
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime thickness refresh preserves geometry, identifiers and collision width",
  () => {
    const environment =
      createEnvironment();

    try {
      const before =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          densityId:
            "dense",
          reason:
            "runtime-test"
        });

      const beforeWeb =
        environment.service.getState().webs[0];

      const beforeStrand =
        beforeWeb.strands[0];

      const after =
        environment.service.refreshThickness({
          thicknessMultiplier:
            3,
          reason:
            "scene-web-thickness-update"
        });

      const afterWeb =
        environment.service.getState().webs[0];

      assert.equal(
        after.generationId,
        before.generationId
      );

      assert.equal(
        after.generatedAt,
        before.generatedAt
      );

      assert.equal(
        after.presentationRevision,
        before.presentationRevision +
          1
      );

      assert.equal(
        after.thicknessMultiplier,
        3
      );

      assert.equal(
        afterWeb,
        beforeWeb
      );

      assert.equal(
        afterWeb.strands[0],
        beforeStrand
      );

      assert.equal(
        afterWeb.strands[0].widthPx,
        1.2
      );

      assert.equal(
        afterWeb.strands[0].collisionWidthPx,
        2.25
      );

      assert.equal(
        environment.renderCalls.at(-1).configuration.thicknessMultiplier,
        3
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "combined colour and thickness refresh applies one presentation revision",
  () => {
    const environment =
      createEnvironment();

    try {
      const before =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          reason:
            "runtime-test"
        });

      const after =
        environment.service.refreshPresentation({
          profileId:
            "blood-red",
          thicknessMultiplier:
            2,
          reason:
            "scene-web-presentation-update"
        });

      assert.equal(
        after.presentationRevision,
        before.presentationRevision +
          1
      );

      assert.equal(
        after.colourProfileId,
        "blood-red"
      );

      assert.equal(
        after.thicknessMultiplier,
        2
      );

      assert.equal(
        environment.renderCalls.at(-1).configuration.thicknessMultiplier,
        2
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "failed colour redraw restores the previous rendered profile and runtime state",
  () => {
    const environment =
      createEnvironment();

    try {
      environment.service.generateForActiveScene({
        scene:
          environment.scene,
        reason:
          "runtime-test"
      });

      const stableRender =
        environment.service.renderService.render.bind(
          environment.service.renderService
        );

      environment.service.renderService.render =
        (
          webs,
          configuration
        ) => {
          if (
            webs[0]?.colourProfileId ===
              "blood-red"
          ) {
            throw new Error(
              "colour redraw failed"
            );
          }

          return stableRender(
            webs,
            configuration
          );
        };

      assert.throws(
        () =>
          environment.service.refreshColourProfile({
            profileId:
              "blood-red",
            reason:
              "scene-web-colour-update"
          }),
        /colour redraw failed/u
      );

      const snapshot =
        environment.service.createDiagnosticSnapshot();

      assert.equal(
        snapshot.active,
        true
      );

      assert.equal(
        snapshot.generationId,
        1
      );

      assert.equal(
        snapshot.colourProfileId,
        "natural-white"
      );

      assert.equal(
        snapshot.lastOperationReason,
        "scene-web-colour-update-failed"
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime builds, queries, preserves, and clears the spatial index with geometry lifecycle",
  () => {
    const environment = createEnvironment();

    try {
      const generated = environment.service.generateForActiveScene({
        scene: environment.scene,
        reason: "runtime-spatial-test"
      });

      assert.equal(generated.spatial.active, true);
      assert.equal(generated.spatial.counts.webs, 1);
      assert.equal(generated.spatial.counts.strands, 1);
      assert.equal(generated.spatial.generationId, generated.generationId);
      assert.equal(environment.service.getWebs()[0].id, "ground:scene:default:base:index-0");
      assert.equal(
        environment.service.queryNearby({ x: 15, y: 15 }, {
          maximumDistancePx: 10,
          levelId: "base"
        })[0].strandId,
        "ground:scene:default:base:index-0:structural-0"
      );

      const beforePresentation = environment.service.createSpatialDiagnosticSnapshot();

      environment.service.refreshColourProfile({
        profileId: "blood-red",
        reason: "runtime-spatial-colour-test"
      });

      const afterPresentation = environment.service.createSpatialDiagnosticSnapshot();
      assert.equal(afterPresentation.revision, beforePresentation.revision);
      assert.equal(afterPresentation.snapshotRevision, beforePresentation.snapshotRevision + 1);
      assert.equal(environment.service.getWeb("ground:scene:default:base:index-0").colourProfileId, "blood-red");

      environment.service.clear("runtime-spatial-clear");
      const cleared = environment.service.createSpatialDiagnosticSnapshot();
      assert.equal(cleared.active, false);
      assert.equal(cleared.counts.webs, 0);
      assert.deepEqual(environment.service.getWebs(), []);
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime carpet-cache clearing redraws presentation without replacing geometry or spatial state",
  () => {
    const environment = createEnvironment();

    try {
      environment.service.generateForActiveScene({
        scene: environment.scene,
        reason: "runtime-carpet-cache-test"
      });

      const beforeState = environment.service.getState();
      const beforeSpatial = environment.service.createSpatialDiagnosticSnapshot();
      const beforeRenderCount = environment.renderCalls.length;
      let clearCount = 0;

      environment.service.renderService.clearCarpetTextureCache = () => {
        clearCount += 1;
        return true;
      };

      const result = environment.service.clearCarpetTextureCache({
        redraw: true,
        reason: "test-clear-carpet-cache"
      });
      const afterState = environment.service.getState();
      const afterSpatial = environment.service.createSpatialDiagnosticSnapshot();

      assert.equal(result.cleared, true);
      assert.equal(clearCount, 1);
      assert.equal(environment.renderCalls.length, beforeRenderCount + 1);
      assert.equal(afterState.generationId, beforeState.generationId);
      assert.equal(afterState.webs, beforeState.webs);
      assert.equal(afterState.presentationRevision, beforeState.presentationRevision + 1);
      assert.equal(afterState.lastOperationReason, "test-clear-carpet-cache");
      assert.equal(afterSpatial.revision, beforeSpatial.revision);
      assert.equal(afterSpatial.snapshotRevision, beforeSpatial.snapshotRevision);
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime loads, persists and reloads Scene-owned destroyed span state",
  async () => {
    const spanId =
      "wall-span:scene:default:base:index-0";

    const environment =
      createEnvironment({
        webKind:
          "wall-span",
        persistedMutableState: {
          schemaVersion:
            1,
          revision:
            4,
          destroyedWebIds:
            [
              spanId
            ]
        }
      });

    try {
      const generated =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          reason:
            "runtime-persistence-load"
        });

      assert.deepEqual(
        generated.mutableState.destroyedWebIds,
        [
          spanId
        ]
      );

      assert.equal(
        environment.renderCalls.at(-1).webs.length,
        0
      );

      const reset =
        environment.service.resetMutableState({
          cause:
            "test-reset"
        });

      assert.equal(
        reset.changed,
        true
      );

      await environment.service.flushMutableStatePersistence();

      assert.deepEqual(
        environment.setFlagCalls.at(-1),
        {
          namespace:
            "dynamic-webs",
          key:
            "mutableState",
          value: {
            schemaVersion:
              1,
            revision:
              5,
            destroyedWebIds:
              []
          }
        }
      );

      const destroyed =
        environment.service.destroyWebs(
          [
            spanId
          ],
          {
            cause:
              "test-destroy"
          }
        );

      assert.deepEqual(
        destroyed.destroyedWebIds,
        [
          spanId
        ]
      );

      await environment.service.flushMutableStatePersistence();

      assert.deepEqual(
        environment.scene.flags["dynamic-webs"].mutableState,
        {
          schemaVersion:
            1,
          revision:
            6,
          destroyedWebIds:
            [
              spanId
            ]
        }
      );

      environment.service.clear(
        "persistence-reload"
      );

      const reloaded =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          reason:
            "runtime-persistence-reload"
        });

      assert.deepEqual(
        reloaded.mutableState.destroyedWebIds,
        [
          spanId
        ]
      );

      assert.equal(
        reloaded.mutableStatePersistence.lastPersistedRevision,
        6
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime prunes stale persisted span IDs and repairs the Scene flag",
  async () => {
    const environment =
      createEnvironment({
        webKind:
          "wall-span",
        persistedMutableState: {
          schemaVersion:
            1,
          revision:
            9,
          destroyedWebIds:
            [
              "missing-span"
            ]
        }
      });

    try {
      const generated =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          reason:
            "runtime-persistence-prune"
        });

      assert.deepEqual(
        generated.mutableState.destroyedWebIds,
        []
      );

      assert.equal(
        generated.mutableState.revision,
        10
      );

      assert.deepEqual(
        generated.mutableState.lastReconciliation.prunedWebIds,
        [
          "missing-span"
        ]
      );

      await environment.service.flushMutableStatePersistence();

      assert.deepEqual(
        environment.scene.flags["dynamic-webs"].mutableState,
        {
          schemaVersion:
            1,
          revision:
            10,
          destroyedWebIds:
            []
        }
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "failed mutable-state redraw rolls back revision, intact state and persistence",
  () => {
    const environment =
      createEnvironment({
        webKind:
          "wall-span"
      });

    try {
      environment.service.generateForActiveScene({
        scene:
          environment.scene,
        reason:
          "runtime-mutable-rollback"
      });

      environment.service.renderService.render =
        () => {
          throw new Error(
            "mutable redraw failed"
          );
        };

      assert.throws(
        () =>
          environment.service.destroyWebs(
            [
              environment.webId
            ],
            {
              cause:
                "test-mutable-failure"
            }
          ),
        /mutable redraw failed/u
      );

      assert.equal(
        environment.service.getMutableState().revision,
        0
      );

      assert.deepEqual(
        environment.service.getMutableState().destroyedWebIds,
        []
      );

      assert.equal(
        environment.service.getWeb(environment.webId).intact,
        true
      );

      assert.equal(
        environment.setFlagCalls.length,
        0
      );
    } finally {
      environment.restore();
    }
  }
);
