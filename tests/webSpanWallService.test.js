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

  const calls = {
    create:
      [],
    update:
      [],
    delete:
      []
  };

  const scene = {
    _calls:
      calls,
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

      calls.create.push(
        entries.map(
          entry => ({
            ...entry
          })
        )
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

      calls.update.push(
        entries.map(
          entry => ({
            ...entry
          })
        )
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

      calls.delete.push([
        ...ids
      ]);

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


test(
  "direct span-wall mutations touch only the requested generated wall",
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

      const first =
        createWeb(
          "span-a"
        );

      const second =
        createWeb(
          "span-b"
        );

      service.requestReconciliation({
        scene,
        webs:
          [
            first,
            second
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

      await service.flush();

      assert.equal(
        scene.walls.contents.length,
        2
      );

      const secondWallBefore =
        scene.walls.contents.find(
          wall =>
            wall.getFlag(
              "dynamic-webs",
              "spanWebId"
            ) ===
              "span-b"
        );

      const fullCreateCallCount =
        scene._calls.create.length;

      service.requestWebRemoval({
        scene,
        webIds:
          [
            "span-a"
          ],
        reason:
          "test-direct-remove"
      });

      let diagnostics =
        await service.flush();

      assert.equal(
        diagnostics.lastOperationType,
        "remove"
      );

      assert.equal(
        diagnostics.deletedCount,
        1
      );

      assert.equal(
        scene._calls.delete.at(
          -1
        ).length,
        1
      );

      assert.equal(
        scene.walls.contents.length,
        1
      );

      assert.equal(
        scene.walls.contents[0],
        secondWallBefore
      );

      service.requestWebRestoration({
        scene,
        webs:
          [
            first
          ],
        behaviour: {
          visionMode:
            "blocked",
          secretDoor:
            true,
          destructible:
            true
        },
        reason:
          "test-direct-restore"
      });

      diagnostics =
        await service.flush();

      assert.equal(
        diagnostics.lastOperationType,
        "restore"
      );

      assert.equal(
        diagnostics.createdCount,
        1
      );

      assert.equal(
        scene._calls.create.length,
        fullCreateCallCount +
          1
      );

      assert.equal(
        scene._calls.create.at(
          -1
        ).length,
        1
      );

      assert.equal(
        scene.walls.contents.length,
        2
      );

      assert.equal(
        scene.walls.contents.includes(
          secondWallBefore
        ),
        true
      );
    } finally {
      globalThis.game =
        previousGame;
    }
  }
);

test(
  "destroying a span defers deletion of an already-open generated secret door",
  async () => {
    const previousGame = globalThis.game;
    globalThis.game = { user: { isGM: true } };

    try {
      const scene = createScene();
      const service = new WebSpanWallService();
      const web = createWeb("span-open");
      const behaviour = {
        visionMode: "blocked",
        secretDoor: true,
        destructible: true
      };

      service.requestReconciliation({
        scene,
        webs: [web],
        behaviour
      });
      await service.flush();

      scene.walls.contents[0].ds = 1;
      scene.walls.contents[0]._source.ds = 1;

      const deleteCallsBefore = scene._calls.delete.length;

      service.requestWebRemoval({
        scene,
        webIds: [web.id],
        reason: "token-movement"
      });

      let diagnostics = await service.flush();

      assert.equal(scene._calls.delete.length, deleteCallsBefore);
      assert.equal(scene.walls.contents.length, 1);
      assert.equal(diagnostics.deletedCount, 0);
      assert.equal(diagnostics.deferredCount, 1);
      assert.deepEqual(diagnostics.deferredWallIds, [scene.walls.contents[0].id]);

      service.requestReconciliation({
        scene,
        webs: [web],
        destroyedWebIds: [web.id],
        behaviour,
        reason: "manual-cleanup"
      });

      diagnostics = await service.flush();

      assert.equal(scene.walls.contents.length, 0);
      assert.equal(diagnostics.deletedCount, 1);
      assert.equal(diagnostics.deferredCount, 0);
    } finally {
      globalThis.game = previousGame;
    }
  }
);

test(
  "restoring a span closes a deferred open secret door",
  async () => {
    const previousGame = globalThis.game;
    globalThis.game = { user: { isGM: true } };

    try {
      const scene = createScene();
      const service = new WebSpanWallService();
      const web = createWeb("span-restored");
      const behaviour = {
        visionMode: "blocked",
        secretDoor: true,
        destructible: true
      };

      service.requestReconciliation({ scene, webs: [web], behaviour });
      await service.flush();

      scene.walls.contents[0].ds = 1;
      scene.walls.contents[0]._source.ds = 1;

      service.requestWebRemoval({ scene, webIds: [web.id] });
      await service.flush();
      assert.equal(scene.walls.contents[0].ds, 1);

      service.requestWebRestoration({
        scene,
        webs: [web],
        behaviour,
        reason: "restore-span"
      });

      const diagnostics = await service.flush();

      assert.equal(scene.walls.contents.length, 1);
      assert.equal(scene.walls.contents[0].ds, 0);
      assert.equal(diagnostics.updatedCount, 1);
      assert.equal(diagnostics.createdCount, 0);
    } finally {
      globalThis.game = previousGame;
    }
  }
);
