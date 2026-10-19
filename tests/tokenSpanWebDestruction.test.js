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


test("Foundry v13 animated updates use the captured destination on the first pass", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;

  const tokenDocument = {
    id: "token-v13-animated",
    x: 3640,
    y: 1820,
    _source: {
      x: 3640,
      y: 1820,
      width: 1,
      height: 1,
      elevation: 0
    },
    width: 1,
    height: 1,
    elevation: 0,
    parent: { id: "scene-a" }
  };

  const tokenPlaceable = {
    id: tokenDocument.id,
    document: tokenDocument,
    position: { x: 3640, y: 1820 },
    w: 140,
    h: 140
  };

  const movementQueries = [];
  const destroyed = [];

  const service = {
    getState() {
      return {
        active: true,
        sceneId: "scene-a",
        levels: [
          {
            id: "base",
            elevationBand: {
              bottom: Number.NEGATIVE_INFINITY,
              top: Number.POSITIVE_INFINITY
            }
          }
        ]
      };
    },
    queryMovementIntersections(request) {
      movementQueries.push(request);

      return Object.freeze([
        Object.freeze({
          webId: "span-v13-first-pass"
        })
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

  globalThis.game = {
    user: {
      id: "gm",
      isGM: true
    }
  };

  globalThis.canvas = {
    dimensions: { size: 140 },
    scene: {
      id: "scene-a",
      grid: { size: 140 },
      tokens: [tokenDocument]
    },
    tokens: {
      placeables: [tokenPlaceable],
      get(id) {
        return id === tokenPlaceable.id
          ? tokenPlaceable
          : null;
      }
    }
  };

  try {
    const controller =
      new TokenSpanWebInteractionController({
        runtime: {
          getWebRuntimeService: () => service
        }
      });

    controller.prime(
      globalThis.canvas.scene
    );

    const captured =
      controller.handleTokenPreUpdated(
        tokenDocument,
        { y: 1400 },
        {},
        "gm"
      );

    assert.deepEqual(
      captured.from.centre,
      { x: 3710, y: 1890 }
    );

    assert.deepEqual(
      captured.to.centre,
      { x: 3710, y: 1470 }
    );

    /**
     * Reproduce Foundry v13 during an animated update: public document getters
     * and the rendered placeable remain at the origin while _source and the
     * update differential already hold the destination.
     */
    tokenDocument.y = 1820;
    tokenDocument._source.y = 1400;

    const outcome =
      controller.handleTokenUpdated(
        tokenDocument,
        { y: 1400 },
        { teleport: false },
        "gm"
      );

    assert.equal(
      movementQueries.length,
      1
    );

    assert.deepEqual(
      movementQueries[0].from,
      { x: 3710, y: 1890 }
    );

    assert.deepEqual(
      movementQueries[0].to,
      { x: 3710, y: 1470 }
    );

    assert.deepEqual(
      outcome.destroyedWebIds,
      ["span-v13-first-pass"]
    );

    assert.equal(
      destroyed.length,
      1
    );

    assert.equal(
      controller.createDiagnosticSnapshot().processedMovementCount,
      1
    );
  } finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
});


test("the complete captured path destroys a span on the first pass before rendered animation advances", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;

  const tokenDocument = {
    id: "token-pass-through",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    parent: { id: "scene-a" }
  };

  const tokenPlaceable = {
    id: tokenDocument.id,
    document: tokenDocument,
    position: { x: 0, y: 0 },
    w: 100,
    h: 100
  };

  let tickerCallback = null;
  let tickerRemoveCount = 0;
  const movementQueries = [];
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
      movementQueries.push(request);

      const crossedWeb =
        request.from.x < 120 &&
        request.to.x >= 120;

      return crossedWeb
        ? Object.freeze([
            Object.freeze({ webId: "span-pass-through" })
          ])
        : Object.freeze([]);
    },
    destroyWebs(webIds, metadata) {
      destroyed.push({ webIds, metadata });

      return Object.freeze({
        changed: webIds.length > 0,
        destroyedWebIds: Object.freeze([...webIds]),
        state: Object.freeze({})
      });
    }
  };

  globalThis.game = {
    user: { id: "gm", isGM: true }
  };

  globalThis.canvas = {
    dimensions: { size: 100 },
    scene: {
      id: "scene-a",
      grid: { size: 100 },
      tokens: [tokenDocument]
    },
    tokens: {
      placeables: [tokenPlaceable],
      get(id) {
        return id === tokenPlaceable.id
          ? tokenPlaceable
          : null;
      }
    },
    app: {
      ticker: {
        add(callback) {
          tickerCallback = callback;
        },
        remove(callback) {
          assert.equal(callback, tickerCallback);
          tickerRemoveCount += 1;
        }
      }
    }
  };

  try {
    const controller = new TokenSpanWebInteractionController({
      runtime: { getWebRuntimeService: () => service }
    });

    controller.prime(globalThis.canvas.scene);

    const captured = controller.handleTokenPreUpdated(
      tokenDocument,
      { x: 200 },
      { animate: true },
      "gm"
    );

    assert.deepEqual(captured.from.centre, { x: 50, y: 50 });
    assert.deepEqual(captured.to.centre, { x: 250, y: 50 });

    tokenDocument.x = 200;
    controller.handleTokenUpdated(
      tokenDocument,
      { x: 200 },
      { animate: true },
      "gm"
    );

    assert.equal(destroyed.length, 1);
    assert.deepEqual(destroyed[0].webIds, ["span-pass-through"]);
    assert.equal(destroyed[0].metadata.cause, "token-movement");
    assert.equal(destroyed[0].metadata.entityId, tokenDocument.id);
    assert.equal(movementQueries.length, 1);
    assert.equal(typeof tickerCallback, "function");
    assert.equal(
      controller.createDiagnosticSnapshot().visualMovementTrackerCount,
      1
    );

    tokenPlaceable.position.x = 100;
    tickerCallback();

    assert.equal(destroyed.length, 1);

    tokenPlaceable.position.x = 200;
    tickerCallback();

    assert.equal(destroyed.length, 1);
    assert.equal(movementQueries.length, 3);
    assert.equal(
      controller.createDiagnosticSnapshot().visualMovementTrackerCount,
      0
    );
    assert.equal(tickerRemoveCount, 1);
  } finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
});



test("the initiating player submits the first pass-through movement to the GM", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;

  const tokenDocument = {
    id: "token-player-pass",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    parent: { id: "scene-a" }
  };

  const emitted = [];
  const movementQueries = [];

  const service = {
    getState() {
      return {
        active: true,
        sceneId: "scene-a",
        levels: [
          {
            id: "level-0",
            elevationBand: { bottom: 0, top: 9 }
          }
        ]
      };
    },
    queryMovementIntersections(request) {
      movementQueries.push(request);

      return Object.freeze([
        Object.freeze({
          webId: "span-first-pass"
        })
      ]);
    },
    destroyWebs() {
      throw new Error("A player client must not mutate web state directly.");
    }
  };

  globalThis.game = {
    user: {
      id: "player-a",
      isGM: false
    },
    socket: {
      emit(channel, message) {
        emitted.push({
          channel,
          message
        });
      }
    }
  };

  globalThis.canvas = {
    dimensions: { size: 100 },
    scene: {
      id: "scene-a",
      grid: { size: 100 },
      tokens: [tokenDocument]
    },
    tokens: {
      placeables: [tokenDocument]
    }
  };

  try {
    const controller =
      new TokenSpanWebInteractionController({
        runtime: {
          getWebRuntimeService: () => service
        }
      });

    controller.prime(
      globalThis.canvas.scene
    );

    const captured =
      controller.handleTokenPreUpdated(
        tokenDocument,
        { x: 200 },
        { animate: true },
        "player-a"
      );

    assert.deepEqual(
      captured.from.centre,
      { x: 50, y: 50 }
    );

    assert.deepEqual(
      captured.to.centre,
      { x: 250, y: 50 }
    );

    tokenDocument.x = 200;

    const outcome =
      controller.handleTokenUpdated(
        tokenDocument,
        { x: 200 },
        { animate: true },
        "player-a"
      );

    assert.equal(
      outcome.requestSubmitted,
      true
    );

    assert.equal(
      movementQueries.length,
      1
    );

    assert.equal(
      emitted.length,
      1
    );

    assert.equal(
      emitted[0].channel,
      "module.dynamic-webs"
    );

    assert.equal(
      emitted[0].message.type,
      "token-span-movement-request"
    );

    assert.equal(
      emitted[0].message.requesterUserId,
      "player-a"
    );

    assert.equal(
      emitted[0].message.tokenId,
      tokenDocument.id
    );

    assert.deepEqual(
      emitted[0].message.movementFrom,
      { x: 50, y: 50 }
    );

    assert.deepEqual(
      emitted[0].message.movementTo,
      { x: 250, y: 50 }
    );

    assert.deepEqual(
      emitted[0].message.segmentFrom,
      { x: 50, y: 50 }
    );

    assert.deepEqual(
      emitted[0].message.segmentTo,
      { x: 250, y: 50 }
    );

    const diagnostics =
      controller.createDiagnosticSnapshot();

    assert.equal(
      diagnostics.processedMovementCount,
      1
    );

    assert.equal(
      diagnostics.submittedMovementRequestCount,
      1
    );

    assert.equal(
      diagnostics.destroyedWebCount,
      0
    );
  } finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
});


test("No Action span policy skips token movement queries and mutations", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;

  const token = {
    id: "token-indestructible",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    parent: { id: "scene-a" }
  };

  let queryCount = 0;
  let destroyCount = 0;

  const service = {
    getState() {
      return {
        active: true,
        sceneId: "scene-a",
        spanWebBehaviour: {
          crossingAction: "none",
          secretDoor: false
        },
        levels: [{ id: "base", elevationBand: { bottom: -Infinity, top: Infinity } }]
      };
    },
    queryMovementIntersections() {
      queryCount += 1;
      return [{ webId: "span-a" }];
    },
    destroyWebs() {
      destroyCount += 1;
      return { changed: true, destroyedWebIds: ["span-a"], state: {} };
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

    assert.equal(controller.handleTokenUpdated(token, { x: 100 }, {}, "gm"), null);
    assert.equal(queryCount, 0);
    assert.equal(destroyCount, 0);
  } finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
});


test("attempted crossing opens a generated secret door during preUpdate without destroying the web", () => {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;

  const tokenDocument = {
    id: "token-open-door",
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    parent: { id: "scene-a" }
  };

  const movementQueries = [];
  const opened = [];
  let destroyCount = 0;

  const service = {
    getState() {
      return {
        active: true,
        sceneId: "scene-a",
        spanWebBehaviour: {
          crossingAction: "open-secret-door",
          secretDoor: true
        },
        levels: [
          {
            id: "level-0",
            elevationBand: { bottom: 0, top: 9 }
          }
        ]
      };
    },
    queryMovementIntersections(request) {
      movementQueries.push(request);

      return Object.freeze([
        Object.freeze({
          webId: "span-door"
        })
      ]);
    },
    openSpanSecretDoors(webIds, metadata) {
      opened.push({
        webIds,
        metadata
      });

      return Object.freeze({
        changed: true,
        requestedWebIds: Object.freeze([
          ...webIds
        ])
      });
    },
    destroyWebs() {
      destroyCount += 1;
      throw new Error("Open Secret Door must not destroy mutable web state.");
    }
  };

  globalThis.game = {
    user: {
      id: "gm",
      isGM: true
    }
  };

  globalThis.canvas = {
    dimensions: { size: 100 },
    scene: {
      id: "scene-a",
      grid: { size: 100 },
      tokens: [tokenDocument]
    },
    tokens: {
      placeables: [tokenDocument]
    }
  };

  try {
    const controller =
      new TokenSpanWebInteractionController({
        runtime: {
          getWebRuntimeService: () => service
        }
      });

    controller.prime(
      globalThis.canvas.scene
    );

    const outcome =
      controller.handleTokenPreMoved(
        tokenDocument,
        {
          id:
            "movement-open-door",
          origin: {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            elevation: 0,
            level: "level-0"
          },
          destination: {
            x: 200,
            y: 0,
            width: 1,
            height: 1,
            elevation: 0,
            level: "level-0"
          },
          pending: {
            waypoints: [
              {
                x: 200,
                y: 0,
                width: 1,
                height: 1,
                elevation: 0,
                level: "level-0"
              }
            ]
          }
        },
        { animate: true }
      );

    assert.deepEqual(
      outcome.from,
      { x: 50, y: 50 }
    );

    assert.deepEqual(
      outcome.to,
      { x: 250, y: 50 }
    );

    assert.equal(
      movementQueries.length,
      1
    );

    assert.equal(
      opened.length,
      1
    );

    controller.handleTokenPreUpdated(
      tokenDocument,
      { x: 200 },
      { animate: true },
      "gm"
    );

    assert.equal(
      movementQueries.length,
      1
    );

    assert.equal(
      opened.length,
      1
    );

    assert.deepEqual(
      opened[0].webIds,
      ["span-door"]
    );

    assert.equal(
      opened[0].metadata.entityId,
      tokenDocument.id
    );

    assert.equal(
      destroyCount,
      0
    );

    const diagnostics =
      controller.createDiagnosticSnapshot();

    assert.equal(
      diagnostics.openedDoorRequestCount,
      1
    );

    assert.equal(
      diagnostics.destroyedWebCount,
      0
    );

    assert.deepEqual(
      diagnostics.lastOutcome.openedWebIds,
      ["span-door"]
    );
  } finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
});
