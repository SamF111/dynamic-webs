import test from "node:test";
import assert from "node:assert/strict";

import {
  WebSpanWallService
} from "../scripts/runtime/webs/WebSpanWallService.js";

function createWeb(
  id = "span-a"
) {
  return {
    id,
    kind:
      "wall-span",
    levelProviderMode:
      "base",
    levelId:
      "base",
    elevationBand: {
      bottom:
        null,
      top:
        null
    },
    spanAsset: {
      target: {
        firstWallStart: {
          x:
            0,
          y:
            0
        },
        firstWallEnd: {
          x:
            0,
          y:
            100
        },
        secondWallStart: {
          x:
            100,
          y:
            0
        },
        secondWallEnd: {
          x:
            100,
          y:
            100
        }
      }
    }
  };
}

function createScene() {
  let sequence =
    0;

  const scene = {
    id:
      "scene-a",
    walls: {
      contents:
        []
    },
    async createEmbeddedDocuments(
      type,
      entries
    ) {
      assert.equal(
        type,
        "Wall"
      );

      for (
        const entry of entries
      ) {
        sequence +=
          1;
        this.walls.contents.push(
          createWallDocument(
            `wall-${sequence}`,
            entry
          )
        );
      }

      return entries;
    },
    async updateEmbeddedDocuments(
      type,
      entries
    ) {
      assert.equal(
        type,
        "Wall"
      );

      for (
        const entry of entries
      ) {
        const index =
          this.walls.contents.findIndex(
            wall =>
              wall.id ===
              entry._id
          );

        assert.notEqual(
          index,
          -1
        );

        this.walls.contents[
          index
        ] =
          createWallDocument(
            entry._id,
            {
              ...this.walls.contents[
                index
              ]._source,
              ...entry
            }
          );
      }

      return entries;
    },
    async deleteEmbeddedDocuments(
      type,
      ids
    ) {
      assert.equal(
        type,
        "Wall"
      );

      this.walls.contents =
        this.walls.contents.filter(
          wall =>
            !ids.includes(
              wall.id
            )
        );

      return ids;
    }
  };

  return scene;
}

function createWallDocument(
  id,
  data
) {
  return {
    id,
    ...data,
    _source: {
      ...data
    },
    getFlag(
      namespace,
      key
    ) {
      return this.flags?.[
        namespace
      ]?.[
        key
      ];
    }
  };
}

test(
  "span wall reconciliation creates, updates and removes one wall per intact span",
  async () => {
    const previousGame =
      globalThis.game;

    globalThis.game = {
      user: {
        isGM:
          true
      }
    };

    try {
      const scene =
        createScene();
      const service =
        new WebSpanWallService();

      service.requestReconciliation({
        scene,
        webs: [
          createWeb()
        ],
        behaviour: {
          visionMode:
            "limited",
          secretDoor:
            false,
          destructible:
            true
        }
      });

      let diagnostics =
        await service.flush();

      assert.equal(
        scene.walls.contents.length,
        1
      );
      assert.equal(
        diagnostics.createdCount,
        1
      );
      assert.equal(
        scene.walls.contents[0].move,
        0
      );
      assert.equal(
        scene.walls.contents[0].sight,
        10
      );

      service.requestReconciliation({
        scene,
        webs: [
          createWeb()
        ],
        behaviour: {
          visionMode:
            "blocked",
          secretDoor:
            true,
          destructible:
            true
        }
      });

      diagnostics =
        await service.flush();

      assert.equal(
        diagnostics.updatedCount,
        1
      );
      assert.equal(
        scene.walls.contents[0].door,
        2
      );
      assert.equal(
        scene.walls.contents[0].move,
        20
      );
      assert.equal(
        scene.walls.contents[0].sight,
        20
      );

      service.requestReconciliation({
        scene,
        webs: [
          createWeb()
        ],
        destroyedWebIds: [
          "span-a"
        ],
        behaviour: {
          visionMode:
            "blocked",
          secretDoor:
            true,
          destructible:
            true
        }
      });

      diagnostics =
        await service.flush();

      assert.equal(
        diagnostics.deletedCount,
        1
      );
      assert.equal(
        scene.walls.contents.length,
        0
      );
    } finally {
      globalThis.game =
        previousGame;
    }
  }
);

test(
  "non-GM clients never mutate generated span walls",
  async () => {
    const previousGame =
      globalThis.game;

    globalThis.game = {
      user: {
        isGM:
          false
      }
    };

    try {
      const scene =
        createScene();
      const service =
        new WebSpanWallService();

      service.requestReconciliation({
        scene,
        webs: [
          createWeb()
        ],
        behaviour: {
          visionMode:
            "limited",
          secretDoor:
            false
        }
      });

      const diagnostics =
        await service.flush();

      assert.equal(
        diagnostics.authoritative,
        false
      );
      assert.equal(
        scene.walls.contents.length,
        0
      );
    } finally {
      globalThis.game =
        previousGame;
    }
  }
);

test("reconciliation preserves a GM-opened generated secret door", async () => {
  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };

  try {
    const scene = createScene();
    const service = new WebSpanWallService();
    const request = {
      scene,
      webs: [createWeb()],
      behaviour: {
        visionMode: "limited",
        secretDoor: true,
        destructible: true
      }
    };

    service.requestReconciliation(request);
    await service.flush();
    assert.equal(scene.walls.contents[0].ds, 0);

    scene.walls.contents[0].ds = 1;
    scene.walls.contents[0]._source.ds = 1;

    service.requestReconciliation({
      ...request,
      reason: "repeat-after-gm-open"
    });
    const diagnostics = await service.flush();

    assert.equal(scene.walls.contents[0].ds, 1);
    assert.equal(diagnostics.updatedCount, 0);
  } finally {
    globalThis.game = previousGame;
  }
});
