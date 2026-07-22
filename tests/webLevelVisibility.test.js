import test from "node:test";
import assert from "node:assert/strict";

import {
  filterWebsForVisibleLevels,
  resolveVisibleWebLevelIds
} from "../scripts/foundry/webLevelVisibilityCompatibility.js";

import {
  WebRuntimeService
} from "../scripts/runtime/webs/WebRuntimeService.js";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

import {
  WebRenderService
} from "../scripts/rendering/webs/WebRenderService.js";

import {
  getWebColourProfile
} from "../scripts/simulation/webs/webColourProfiles.js";

const LEVELS =
  Object.freeze([
    createLevel(
      "lower",
      0,
      9
    ),
    createLevel(
      "upper",
      10,
      19
    )
  ]);

test(
  "GM and player visibility include the active viewed level and every lower level",
  () => {
    const resolution = {
      levels:
        LEVELS,
      activeViewedLevelId:
        "upper"
    };

    const gm =
      resolveVisibleWebLevelIds({
        providerResolution:
          resolution,
        user: {
          isGM:
            true
        }
      });

    const player =
      resolveVisibleWebLevelIds({
        providerResolution:
          resolution,
        user: {
          isGM:
            false
        }
      });

    assert.equal(
      gm.policy,
      "active-viewed-and-lower-levels"
    );

    assert.equal(
      player.policy,
      "active-viewed-and-lower-levels"
    );

    assert.deepEqual(
      gm.visibleLevelIds,
      [
        "lower",
        "upper"
      ]
    );

    assert.deepEqual(
      player.visibleLevelIds,
      gm.visibleLevelIds
    );

    assert.deepEqual(
      filterWebsForVisibleLevels(
        [
          {
            id:
              "a",
            levelId:
              "lower"
          },
          {
            id:
              "b",
            levelId:
              "upper"
          }
        ],
        gm.visibleLevelIds
      ).map(
        (
          web
        ) =>
          web.id
      ),
      [
        "a",
        "b"
      ]
    );
  }
);

test(
  "visibility falls back to the first detected level when the viewed level is stale",
  () => {
    const visibility =
      resolveVisibleWebLevelIds({
        providerResolution: {
          levels:
            LEVELS,
          activeViewedLevelId:
            "missing"
        }
      });

    assert.equal(
      visibility.activeViewedLevelId,
      "lower"
    );

    assert.deepEqual(
      visibility.visibleLevelIds,
      [
        "lower"
      ]
    );
  }
);


test(
  "cumulative visibility follows elevation order rather than provider array order",
  () => {
    const lower =
      createLevel(
        "lower",
        0,
        9
      );

    const middle =
      createLevel(
        "middle",
        10,
        19
      );

    const upper =
      createLevel(
        "upper",
        20,
        29
      );

    const visibility =
      resolveVisibleWebLevelIds({
        providerResolution: {
          levels: [
            upper,
            lower,
            middle
          ],
          activeViewedLevelId:
            "middle"
        }
      });

    assert.equal(
      visibility.activeViewedLevelId,
      "middle"
    );

    assert.deepEqual(
      visibility.visibleLevelIds,
      [
        "lower",
        "middle"
      ]
    );

    assert.equal(
      visibility.visibleLevelIds.includes(
        "upper"
      ),
      false
    );
  }
);

test(
  "runtime level switching redraws the subset without advancing generation identity",
  () => {
    const previousGame =
      globalThis.game;

    const previousCanvas =
      globalThis.canvas;

    const scene = {
      id:
        "scene",
      _view:
        "lower",
      levels: {
        contents:
          LEVELS.map(
            (
              level
            ) => ({
              id:
                level.id,
              name:
                level.label,
              documentName:
                "Level",
              elevation:
                level.elevationBand
            })
          )
      }
    };

    globalThis.game = {
      release: {
        generation:
          14
      },
      user: {
        isGM:
          false
      },
      modules: {
        get() {
          return null;
        }
      },
      settings: {
        get() {
          return "native-v14";
        }
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

    const generationService =
      new WebGenerationService();

    generationService.generate =
      () =>
        createGeneratedPopulation();

    const renderService =
      new WebRenderService();

    const renderCalls =
      [];

    renderService.render =
      (
        webs
      ) => {
        renderCalls.push(
          webs.map(
            (
              web
            ) =>
              web.id
          )
        );
        return {};
      };

    renderService.clear =
      () =>
        true;

    renderService.createDiagnosticSnapshot =
      () =>
        Object.freeze({
          renderedWebIds:
            Object.freeze(
              renderCalls.at(
                -1
              ) ??
              []
            )
        });

    const service =
      new WebRuntimeService({
        runtime: {},
        generationService,
        renderService
      });

    try {
      const generated =
        service.generateForActiveScene({
          scene,
          options: {},
          thicknessMultiplier:
            1
        });

      assert.equal(
        generated.generationId,
        1
      );

      assert.deepEqual(
        renderCalls[0],
        [
          "ground:scene:lower:index-0"
        ]
      );

      scene._view =
        "upper";

      const refreshed =
        service.refreshLevelVisibility({
          scene,
          reason:
            "test-view-change"
        });

      assert.equal(
        refreshed.generationId,
        1
      );

      assert.equal(
        refreshed.presentationRevision,
        generated.presentationRevision +
          1
      );

      assert.deepEqual(
        renderCalls[1],
        [
          "ground:scene:lower:index-0",
          "ground:scene:upper:index-0"
        ]
      );

      assert.deepEqual(
        refreshed.webs.map(
          (
            web
          ) =>
            web.id
        ),
        [
          "ground:scene:lower:index-0",
          "ground:scene:upper:index-0"
        ]
      );
    } finally {
      globalThis.game =
        previousGame;
      globalThis.canvas =
        previousCanvas;
    }
  }
);

function createGeneratedPopulation() {
  const webs =
    Object.freeze([
      createWeb(
        "lower",
        0,
        9
      ),
      createWeb(
        "upper",
        10,
        19
      )
    ]);

  return Object.freeze({
    blueprintSchemaVersion:
      6,
    sceneId:
      "scene",
    seed:
      "dynamic-webs:web-generation:v3:scene",
    categorySeeds:
      Object.freeze({}),
    levelProvider:
      Object.freeze({
        requestedMode:
          "native-v14",
        resolvedMode:
          "native-v14",
        providerAvailable:
          true,
        nativeAvailable:
          true,
        levelsAvailable:
          false,
        fallbackUsed:
          false,
        fallbackReason:
          null,
        activeViewedLevelId:
          "lower",
        levels:
          LEVELS
      }),
    levels:
      LEVELS,
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
    webs,
    counts:
      Object.freeze({
        total:
          2,
        corner:
          0,
        span:
          0,
        ground:
          2,
        strands:
          0,
        byWebKind:
          Object.freeze({
            "wall-corner":
              0,
            "wall-span":
              0,
            ground:
              2
          }),
        byStrandKind:
          Object.freeze({
            structural:
              0,
            capture:
              0,
            decorative:
              0
          }),
        byLevel:
          Object.freeze({})
      })
  });
}

function createLevel(
  id,
  bottom,
  top
) {
  return Object.freeze({
    id,
    label:
      id,
    providerMode:
      "native-v14",
    elevationBand:
      Object.freeze({
        bottom,
        top
      }),
    source:
      "test"
  });
}

function createWeb(
  levelId,
  bottom,
  top
) {
  return Object.freeze({
    schemaVersion:
      5,
    id:
      `ground:scene:${levelId}:index-0`,
    kind:
      "ground",
    sceneId:
      "scene",
    levelProviderMode:
      "native-v14",
    levelId,
    elevationBand:
      Object.freeze({
        bottom,
        top
      }),
    seed:
      `seed:${levelId}:ground`,
    sourceKey:
      "index-0",
    colourProfileId:
      "natural-white",
    hub:
      Object.freeze({
        x:
          0,
        y:
          0
      }),
    bounds:
      Object.freeze({
        x:
          0,
        y:
          0,
        width:
          0,
        height:
          0,
        right:
          0,
        bottom:
          0
      }),
    strands:
      Object.freeze([]),
    perches:
      Object.freeze([]),
    supportingWallIds:
      Object.freeze([]),
    regionIds:
      Object.freeze([]),
    regionTags:
      Object.freeze([])
  });
}

test(
  "v13 runtime visibility follows controlled-token elevation before the Levels UI range",
  () => {
    const previousGame =
      globalThis.game;

    const previousCanvas =
      globalThis.canvas;

    const previousConfig =
      globalThis.CONFIG;

    const controlledToken = {
      controlled:
        true,
      document: {
        elevation:
          10
      }
    };

    const scene = {
      id:
        "scene",
      getFlag(
        namespace,
        key
      ) {
        if (
          namespace ===
            "levels" &&
          key ===
            "sceneLevels"
        ) {
          return [
            [
              0,
              9,
              "Lower",
              "lower"
            ],
            [
              10,
              19,
              "Upper",
              "upper"
            ]
          ];
        }

        return undefined;
      }
    };

    globalThis.CONFIG = {
      Levels: {
        UI: {
          range: [
            0,
            9
          ]
        }
      }
    };

    globalThis.game = {
      release: {
        generation:
          13
      },
      version:
        "13",
      user: {
        isGM:
          true
      },
      modules: {
        get(
          id
        ) {
          return id ===
            "levels"
            ? {
                active:
                  true
              }
            : null;
        }
      },
      settings: {
        get() {
          return "levels-v13";
        }
      }
    };

    globalThis.canvas = {
      ready:
        true,
      scene,
      tokens: {
        controlled: [
          controlledToken
        ],
        placeables: [
          controlledToken
        ]
      },
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

    const generationService =
      new WebGenerationService();

    generationService.generate =
      () => {
        const generated =
          createGeneratedPopulation();

        return Object.freeze({
          ...generated,
          levelProvider:
            Object.freeze({
              ...generated.levelProvider,
              requestedMode:
                "levels-v13",
              resolvedMode:
                "levels-v13",
              nativeAvailable:
                false,
              levelsAvailable:
                true
            })
        });
      };

    const renderService =
      new WebRenderService();

    const renderCalls =
      [];

    renderService.render =
      (
        webs
      ) => {
        renderCalls.push(
          webs.map(
            (
              web
            ) =>
              web.id
          )
        );

        return {};
      };

    renderService.clear =
      () =>
        true;

    renderService.createDiagnosticSnapshot =
      () =>
        Object.freeze({
          renderedWebIds:
            Object.freeze(
              renderCalls.at(
                -1
              ) ??
              []
            )
        });

    const service =
      new WebRuntimeService({
        runtime: {},
        generationService,
        renderService
      });

    try {
      service.generateForActiveScene({
        scene,
        options: {},
        thicknessMultiplier:
          1
      });

      assert.deepEqual(
        renderCalls[0],
        [
          "ground:scene:lower:index-0",
          "ground:scene:upper:index-0"
        ]
      );

      controlledToken.document.elevation =
        0;

      service.refreshLevelVisibility({
        scene,
        reason:
          "test-controlled-token-level-change"
      });

      assert.deepEqual(
        renderCalls[1],
        [
          "ground:scene:lower:index-0"
        ]
      );
    } finally {
      globalThis.game =
        previousGame;
      globalThis.canvas =
        previousCanvas;
      globalThis.CONFIG =
        previousConfig;
    }
  }
);
