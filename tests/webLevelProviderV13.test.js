import test from "node:test";
import assert from "node:assert/strict";

import {
  LevelsV13WebLevelProvider
} from "../scripts/foundry/webLevelProviderV13Levels.js";

import {
  WEB_LEVEL_PROVIDER_MODES
} from "../scripts/simulation/webs/webLevelContract.js";

test(
  "Foundry v13 Levels provider resolves Scene ranges, wall-height metadata and active range",
  () => {
    const scene = {
      getFlag(
        namespace,
        key
      ) {
        assert.equal(
          namespace,
          "levels"
        );
        assert.equal(
          key,
          "sceneLevels"
        );

        return [
          [
            0,
            9,
            "Lower"
          ],
          [
            10,
            19,
            "Upper"
          ]
        ];
      }
    };

    const provider =
      new LevelsV13WebLevelProvider({
        game: {
          release: {
            generation:
              13
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
          }
        },
        canvas: {
          scene
        },
        levelsApi: {
          UI: {
            range: [
              10,
              19
            ]
          }
        }
      });

    assert.equal(
      provider.isAvailable(),
      true
    );

    const levels =
      provider.resolveLevels(
        scene
      );

    assert.equal(
      levels.length,
      2
    );

    const metadata =
      provider.resolveWallLevelMetadata(
        {
          flags: {
            "wall-height": {
              bottom:
                10,
              top:
                19
            }
          }
        },
        levels
      );

    assert.equal(
      metadata.levelProviderMode,
      WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
    );

    assert.equal(
      metadata.levelId,
      levels[1].id
    );

    assert.equal(
      provider.resolveActiveViewedLevel(
        scene,
        levels
      ),
      levels[1].id
    );
  }
);

test(
  "Foundry v13 Levels provider prefers one controlled token's elevation over a stale UI range",
  () => {
    const scene = {
      getFlag() {
        return [
          [
            0,
            9,
            "Lower"
          ],
          [
            10,
            19,
            "Upper"
          ]
        ];
      }
    };

    const controlledToken = {
      controlled:
        true,
      document: {
        elevation:
          10
      }
    };

    const provider =
      new LevelsV13WebLevelProvider({
        game: {
          release: {
            generation:
              13
          },
          modules: {
            get() {
              return {
                active:
                  true
              };
            }
          }
        },
        canvas: {
          scene,
          tokens: {
            controlled: [
              controlledToken
            ],
            placeables: [
              controlledToken
            ]
          }
        },
        levelsApi: {
          UI: {
            range: [
              0,
              9
            ]
          }
        }
      });

    const levels =
      provider.resolveLevels(
        scene
      );

    assert.equal(
      provider.resolveActiveViewedLevel(
        scene,
        levels
      ),
      levels[1].id
    );

    controlledToken.document.elevation =
      0;

    assert.equal(
      provider.resolveActiveViewedLevel(
        scene,
        levels
      ),
      levels[0].id
    );
  }
);

test(
  "Foundry v13 Levels provider falls back to the API range for controlled tokens on different levels",
  () => {
    const scene = {
      getFlag() {
        return [
          [
            0,
            9,
            "Lower"
          ],
          [
            10,
            19,
            "Upper"
          ]
        ];
      }
    };

    const provider =
      new LevelsV13WebLevelProvider({
        game: {
          release: {
            generation:
              13
          },
          modules: {
            get() {
              return {
                active:
                  true
              };
            }
          }
        },
        canvas: {
          scene,
          tokens: {
            controlled: [
              {
                document: {
                  elevation:
                    0
                }
              },
              {
                document: {
                  elevation:
                    10
                }
              }
            ]
          }
        },
        levelsApi: {
          UI: {
            range: [
              10,
              19
            ]
          }
        }
      });

    const levels =
      provider.resolveLevels(
        scene
      );

    assert.equal(
      provider.resolveActiveViewedLevel(
        scene,
        levels
      ),
      levels[1].id
    );
  }
);
