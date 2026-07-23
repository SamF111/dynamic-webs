import test from "node:test";
import assert from "node:assert/strict";

import {
  disposeWebMutableStateSocket,
  registerWebMutableStateSocket
} from "../scripts/networking/webMutableStateSocket.js";

function createEnvironment({ isGM }) {
  const previous = {
    Hooks: globalThis.Hooks,
    game: globalThis.game,
    canvas: globalThis.canvas
  };

  const socketHandlers = new Map();
  const hookHandlers = new Map();
  const emitted = [];
  const applied = [];
  let hookId = 0;

  const service = {
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

  globalThis.game = {
    user: {
      id: isGM ? "gm-a" : "player-a",
      isGM
    },
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
    scene: { id: "scene-a" }
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
