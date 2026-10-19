import test from "node:test";
import assert from "node:assert/strict";

import {
  disposeWebMutableStateSocket,
  registerWebMutableStateSocket
} from "../scripts/networking/webMutableStateSocket.js";

function createEnvironment({
  isGM,
  crossingAction = "destroy-web",
  secretDoor = false
}) {
  const previous = {
    Hooks: globalThis.Hooks,
    game: globalThis.game,
    canvas: globalThis.canvas
  };

  const socketHandlers = new Map();
  const hookHandlers = new Map();
  const emitted = [];
  const applied = [];
  const movementQueries = [];
  const destroyed = [];
  const opened = [];
  let hookId = 0;

  const tokenDocument = {
    id: "token-a",
    x: 200,
    y: 0,
    width: 1,
    height: 1,
    elevation: 0,
    parent: {
      id: "scene-a"
    },
    testUserPermission(user, permission) {
      return user?.id === "player-a" &&
        permission === "OWNER";
    }
  };

  const service = {
    getState() {
      return {
        active: true,
        sceneId: "scene-a",
        spanWebBehaviour: {
          crossingAction,
          secretDoor
        },
        levels: [
          {
            id: "level-0",
            elevationBand: {
              bottom: 0,
              top: 9
            }
          }
        ]
      };
    },
    queryMovementIntersections(request) {
      movementQueries.push(request);

      return Object.freeze([
        Object.freeze({
          webId: "span-a"
        })
      ]);
    },
    destroyWebs(webIds, metadata) {
      destroyed.push({
        webIds,
        metadata
      });

      return Object.freeze({
        changed: true,
        destroyedWebIds: Object.freeze([
          ...webIds
        ]),
        state: this.getMutableState()
      });
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
    getMutableState() {
      return Object.freeze({
        sceneId: "scene-a",
        generationId: 2,
        revision: 3,
        destroyedWebIds: Object.freeze(["span-a"])
      });
    },
    applyMutableStateSnapshot(snapshot, options) {
      applied.push({ snapshot, options });
      return true;
    }
  };

  const users = [
    {
      id: "gm-a",
      isGM: true,
      active: true
    },
    {
      id: "player-a",
      isGM: false,
      active: true
    }
  ];

  users.get = id =>
    users.find(
      user =>
        user.id === id
    ) ??
    null;

  globalThis.game = {
    user: {
      id: isGM ? "gm-a" : "player-a",
      isGM
    },
    users,
    socket: {
      on(channel, callback) {
        socketHandlers.set(channel, callback);
      },
      off(channel, callback) {
        if (socketHandlers.get(channel) === callback) socketHandlers.delete(channel);
      },
      emit(channel, message) {
        emitted.push({ channel, message });
      }
    }
  };

  globalThis.canvas = {
    ready: true,
    dimensions: {
      size: 100
    },
    scene: {
      id: "scene-a",
      grid: {
        size: 100
      },
      tokens: [
        tokenDocument
      ]
    },
    tokens: {
      placeables: [
        {
          id: tokenDocument.id,
          document: tokenDocument
        }
      ],
      get(id) {
        return id === tokenDocument.id
          ? this.placeables[0]
          : null;
      }
    }
  };

  globalThis.Hooks = {
    on(event, callback) {
      hookId += 1;
      hookHandlers.set(hookId, { event, callback });
      return hookId;
    },
    off(_event, id) {
      hookHandlers.delete(id);
    }
  };

  return {
    runtime: {
      getWebRuntimeService: () => service
    },
    emitted,
    applied,
    movementQueries,
    destroyed,
    opened,
    tokenDocument,
    socketHandlers,
    hookHandlers,
    getHook(event) {
      return Array.from(hookHandlers.values()).find(entry => entry.event === event)?.callback ?? null;
    },
    restore() {
      disposeWebMutableStateSocket();
      globalThis.Hooks = previous.Hooks;
      globalThis.game = previous.game;
      globalThis.canvas = previous.canvas;
    }
  };
}

test("non-GM clients request and apply the GM mutable-state snapshot", () => {
  const environment = createEnvironment({ isGM: false });

  try {
    assert.equal(registerWebMutableStateSocket(environment.runtime), true);
    assert.equal(registerWebMutableStateSocket(environment.runtime), false);
    assert.equal(environment.emitted.length, 1);
    assert.equal(environment.emitted[0].message.type, "mutable-state-request");
    assert.equal(environment.emitted[0].message.requesterUserId, "player-a");

    const handler = environment.socketHandlers.get("module.dynamic-webs");
    handler({
      type: "mutable-state-snapshot",
      targetUserId: "another-player",
      snapshot: { sceneId: "scene-a", revision: 1, destroyedWebIds: [] }
    });
    assert.equal(environment.applied.length, 0);

    const snapshot = Object.freeze({
      sceneId: "scene-a",
      generationId: 2,
      revision: 3,
      destroyedWebIds: Object.freeze(["span-a"])
    });
    handler({
      type: "mutable-state-snapshot",
      targetUserId: "player-a",
      reason: "state-request",
      snapshot
    });

    assert.equal(environment.applied.length, 1);
    assert.equal(environment.applied[0].snapshot, snapshot);
    assert.equal(environment.applied[0].options.reason, "state-request");
    assert.equal(disposeWebMutableStateSocket(), true);
    assert.equal(environment.socketHandlers.size, 0);
    assert.equal(environment.hookHandlers.size, 0);
  } finally {
    environment.restore();
  }
});

test("the GM broadcasts local mutations and answers targeted state requests", () => {
  const environment = createEnvironment({ isGM: true });

  try {
    assert.equal(registerWebMutableStateSocket(environment.runtime), true);
    assert.equal(environment.emitted.length, 0);

    const mutationHook = environment.getHook("dynamic-webs.mutableStateChanged");
    const snapshot = environment.runtime.getWebRuntimeService().getMutableState();
    mutationHook(snapshot, { reason: "token-movement", remote: false });
    assert.equal(environment.emitted.length, 1);
    assert.equal(environment.emitted[0].message.type, "mutable-state-snapshot");
    assert.equal(environment.emitted[0].message.snapshot, snapshot);

    mutationHook(snapshot, { reason: "remote", remote: true });
    assert.equal(environment.emitted.length, 1);

    const handler = environment.socketHandlers.get("module.dynamic-webs");
    handler({
      type: "mutable-state-request",
      requesterUserId: "player-a",
      sceneId: "scene-a"
    });

    assert.equal(environment.emitted.length, 2);
    assert.equal(environment.emitted[1].message.targetUserId, "player-a");
    assert.deepEqual(environment.emitted[1].message.snapshot.destroyedWebIds, ["span-a"]);
  } finally {
    environment.restore();
  }
});



test("the responsible GM accepts the player's first movement request before its TokenDocument reaches the destination", () => {
  const environment =
    createEnvironment({
      isGM: true
    });

  try {
    assert.equal(
      registerWebMutableStateSocket(
        environment.runtime
      ),
      true
    );

    const handler =
      environment.socketHandlers.get(
        "module.dynamic-webs"
      );

    // Reproduce real cross-client ordering: the socket request reaches the GM
    // while its authoritative TokenDocument still contains the movement origin.
    environment.tokenDocument.x =
      0;

    const movementRequest = {
      type:
        "token-span-movement-request",
      requestId:
        "player-a:token-a:1000:1",
      requesterUserId:
        "player-a",
      sceneId:
        "scene-a",
      tokenId:
        "token-a",
      movementFrom:
        {
          x: 50,
          y: 50
        },
      movementTo:
        {
          x: 250,
          y: 50
        },
      segmentFrom:
        {
          x: 100,
          y: 50
        },
      segmentTo:
        {
          x: 150,
          y: 50
        },
      animate:
        true,
      sentAt:
        Date.now()
    };

    handler(
      movementRequest
    );

    assert.equal(
      environment.movementQueries.length,
      1
    );

    assert.deepEqual(
      environment.movementQueries[0],
      {
        from: {
          x: 100,
          y: 50
        },
        to: {
          x: 150,
          y: 50
        },
        levelId:
          "level-0",
        elevation:
          0,
        collisionRadiusPx:
          50,
        categories: [
          "wall-span"
        ]
      }
    );

    assert.equal(
      environment.destroyed.length,
      1
    );

    assert.deepEqual(
      environment.destroyed[0].webIds,
      [
        "span-a"
      ]
    );

    assert.equal(
      environment.destroyed[0].metadata.cause,
      "token-movement"
    );

    assert.equal(
      environment.destroyed[0].metadata.entityId,
      "token-a"
    );

    assert.equal(
      environment.destroyed[0].metadata.userId,
      "player-a"
    );

    handler(
      movementRequest
    );

    assert.equal(
      environment.movementQueries.length,
      1
    );

    assert.equal(
      environment.destroyed.length,
      1
    );
  } finally {
    environment.restore();
  }
});



test("the responsible GM skips player movement interaction for No Action", () => {
  const environment = createEnvironment({
    isGM: true,
    crossingAction: "none"
  });

  try {
    registerWebMutableStateSocket(environment.runtime);

    const handler = environment.socketHandlers.get("module.dynamic-webs");
    handler({
      type: "token-span-movement-request",
      requestId: "player-a:token-a:no-action:1",
      requesterUserId: "player-a",
      sceneId: "scene-a",
      tokenId: "token-a",
      movementFrom: { x: 50, y: 50 },
      movementTo: { x: 250, y: 50 },
      segmentFrom: { x: 100, y: 50 },
      segmentTo: { x: 150, y: 50 },
      sentAt: Date.now()
    });

    assert.equal(environment.movementQueries.length, 0);
    assert.equal(environment.destroyed.length, 0);
    assert.equal(environment.opened.length, 0);
  } finally {
    environment.restore();
  }
});

test("the responsible GM validates later waypoint segments against the declared movement path", () => {
  const environment = createEnvironment({
    isGM: true
  });

  try {
    registerWebMutableStateSocket(environment.runtime);

    const handler = environment.socketHandlers.get("module.dynamic-webs");

    environment.tokenDocument.x = 0;
    environment.tokenDocument.y = 0;

    handler({
      type: "token-span-movement-request",
      requestId: "player-a:token-a:curved:1",
      requesterUserId: "player-a",
      sceneId: "scene-a",
      tokenId: "token-a",
      movementFrom: { x: 50, y: 50 },
      movementTo: { x: 250, y: 250 },
      movementPath: [
        { x: 50, y: 50 },
        { x: 50, y: 250 },
        { x: 250, y: 250 }
      ],
      segmentFrom: { x: 50, y: 250 },
      segmentTo: { x: 150, y: 250 },
      sentAt: Date.now()
    });

    assert.equal(environment.movementQueries.length, 1);
    assert.deepEqual(
      environment.movementQueries[0].from,
      { x: 50, y: 250 }
    );
    assert.deepEqual(
      environment.movementQueries[0].to,
      { x: 150, y: 250 }
    );
    assert.equal(environment.destroyed.length, 1);
  } finally {
    environment.restore();
  }
});

test("the responsible GM opens generated secret doors instead of destroying web state", () => {
  const environment = createEnvironment({
    isGM: true,
    crossingAction: "open-secret-door",
    secretDoor: true
  });

  try {
    registerWebMutableStateSocket(environment.runtime);

    const handler = environment.socketHandlers.get("module.dynamic-webs");

    environment.tokenDocument.x = 0;

    handler({
      type: "token-span-movement-request",
      requestId: "player-a:token-a:open:1",
      requesterUserId: "player-a",
      sceneId: "scene-a",
      tokenId: "token-a",
      movementFrom: { x: 50, y: 50 },
      movementTo: { x: 250, y: 50 },
      segmentFrom: { x: 100, y: 50 },
      segmentTo: { x: 150, y: 50 },
      sentAt: Date.now()
    });

    assert.equal(environment.movementQueries.length, 1);
    assert.equal(environment.destroyed.length, 0);
    assert.equal(environment.opened.length, 1);
    assert.deepEqual(environment.opened[0].webIds, ["span-a"]);
    assert.equal(environment.opened[0].metadata.entityId, "token-a");
    assert.equal(environment.opened[0].metadata.userId, "player-a");
  } finally {
    environment.restore();
  }
});

test("the GM rejects movement requests whose declared path is unrelated to the authoritative TokenDocument", () => {
  const environment =
    createEnvironment({
      isGM: true
    });

  try {
    registerWebMutableStateSocket(
      environment.runtime
    );

    const handler =
      environment.socketHandlers.get(
        "module.dynamic-webs"
      );

    environment.tokenDocument.y =
      500;

    handler({
      type:
        "token-span-movement-request",
      requestId:
        "player-a:token-a:invalid:1",
      requesterUserId:
        "player-a",
      sceneId:
        "scene-a",
      tokenId:
        "token-a",
      movementFrom:
        {
          x: 50,
          y: 50
        },
      movementTo:
        {
          x: 250,
          y: 50
        },
      segmentFrom:
        {
          x: 100,
          y: 50
        },
      segmentTo:
        {
          x: 150,
          y: 50
        },
      sentAt:
        Date.now()
    });

    assert.equal(
      environment.movementQueries.length,
      0
    );

    assert.equal(
      environment.destroyed.length,
      0
    );
  } finally {
    environment.restore();
  }
});

