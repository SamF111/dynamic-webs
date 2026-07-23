import test from "node:test";
import assert from "node:assert/strict";

import {
  TokenSpanWebInteractionController
} from "../scripts/interactions/TokenSpanWebInteractionController.js";

test("GM token movement destroys every intersected intact span web once", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;

  const token = {
    id: "token-a",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    parent: { id: "scene-a" }
  };

  const destroyed = [];
  const service = {
    getState() {
      return {
        active: true,
        sceneId: "scene-a",
        levels: [{ id: "level-0", elevationBand: { bottom: 0, top: 9 } }]
      };
    },
    queryMovementIntersections(request) {
      assert.deepEqual(request.from, { x: 50, y: 50 });
      assert.deepEqual(request.to, { x: 150, y: 50 });
      return Object.freeze([
        Object.freeze({ webId: "span-a" }),
        Object.freeze({ webId: "span-b" })
      ]);
    },
    destroyWebs(webIds, metadata) {
      destroyed.push({ webIds, metadata });
      return Object.freeze({
        changed: true,
        destroyedWebIds: Object.freeze([...webIds]),
        state: Object.freeze({})
      });
    }
  };

  globalThis.game = { user: { id: "gm", isGM: true } };
  globalThis.canvas = {
    dimensions: { size: 100 },
    scene: {
      id: "scene-a",
      grid: { size: 100 },
      tokens: [token]
    },
    tokens: { placeables: [token] }
  };

  try {
    const controller = new TokenSpanWebInteractionController({
      runtime: { getWebRuntimeService: () => service }
    });
    controller.prime(globalThis.canvas.scene);

    token.x = 100;
    const outcome = controller.handleTokenUpdated(token, { x: 100 }, {}, "gm");

    assert.deepEqual(outcome.destroyedWebIds, ["span-a", "span-b"]);
    assert.equal(destroyed.length, 1);
    assert.equal(destroyed[0].metadata.cause, "token-movement");
    assert.equal(destroyed[0].metadata.entityId, "token-a");
  } finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
});
