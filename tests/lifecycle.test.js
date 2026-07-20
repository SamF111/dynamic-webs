import test from "node:test";
import assert from "node:assert/strict";

import {
  SceneWebLifecycleController
} from "../scripts/lifecycle/SceneWebLifecycleController.js";

function createEnvironment() {
  const previousHooks =
    globalThis.Hooks;

  const previousCanvas =
    globalThis.canvas;

  const previousSetTimeout =
    globalThis.setTimeout;

  const previousClearTimeout =
    globalThis.clearTimeout;

  const callbacks =
    new Map();

  let hookId =
    0;

  const timeoutCallbacks =
    new Map();

  let timeoutId =
    0;

  const generateCalls =
    [];

  const clearCalls =
    [];

  const service = {
    state: {
      sceneId:
        "scene"
    },

    getState() {
      return this.state;
    },

    generateForActiveScene(
      options
    ) {
      generateCalls.push(
        options
      );

      this.state = {
        sceneId:
          options.scene.id
      };

      return Object.freeze({
        active:
          true,
        sceneId:
          options.scene.id
      });
    },

    clear(
      reason
    ) {
      clearCalls.push(
        reason
      );

      return true;
    },

    createDiagnosticSnapshot() {
      return Object.freeze({
        active:
          false
      });
    }
  };

  const runtime = {
    getWebRuntimeService:
      () =>
        service
  };

  const scene = {
    id:
      "scene",
    getFlag:
      () =>
        "standard"
  };

  globalThis.Hooks = {
    on(
      event,
      callback
    ) {
      hookId +=
        1;

      callbacks.set(
        hookId,
        {
          event,
          callback
        }
      );

      return hookId;
    },

    off(
      _event,
      id
    ) {
      callbacks.delete(
        id
      );
    },

    callAll() {}
  };

  globalThis.canvas = {
    ready:
      true,
    scene
  };

  globalThis.setTimeout =
    (
      callback,
      _delay
    ) => {
      timeoutId +=
        1;

      timeoutCallbacks.set(
        timeoutId,
        callback
      );

      return timeoutId;
    };

  globalThis.clearTimeout =
    (
      id
    ) => {
      timeoutCallbacks.delete(
        id
      );
    };

  return {
    runtime,
    service,
    scene,
    callbacks,
    timeoutCallbacks,
    generateCalls,
    clearCalls,

    runNextTimeout() {
      const [
        entry
      ] =
        timeoutCallbacks.entries();

      if (!entry) {
        return false;
      }

      const [
        id,
        callback
      ] =
        entry;

      timeoutCallbacks.delete(
        id
      );

      callback();

      return true;
    },

    restore() {
      globalThis.Hooks =
        previousHooks;

      globalThis.canvas =
        previousCanvas;

      globalThis.setTimeout =
        previousSetTimeout;

      globalThis.clearTimeout =
        previousClearTimeout;
    }
  };
}

test(
  "lifecycle registration installs seven hooks and dispose removes them",
  () => {
    const environment =
      createEnvironment();

    try {
      const controller =
        new SceneWebLifecycleController({
          runtime:
            environment.runtime,
          debounceMs:
            200
        });

      assert.equal(
        controller.registerHooks(),
        true
      );

      assert.equal(
        controller.registerHooks(),
        false
      );

      assert.equal(
        environment.callbacks.size,
        7
      );

      assert.equal(
        controller.createDiagnosticSnapshot().hookRegistrationCount,
        7
      );

      controller.dispose();

      assert.equal(
        environment.callbacks.size,
        0
      );

      assert.deepEqual(
        environment.clearCalls,
        [
          "lifecycle-dispose"
        ]
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "rapid rebuild requests coalesce and use the latest reason",
  () => {
    const environment =
      createEnvironment();

    try {
      const controller =
        new SceneWebLifecycleController({
          runtime:
            environment.runtime,
          debounceMs:
            200
        });

      controller.scheduleRebuild(
        "create-wall"
      );

      controller.scheduleRebuild(
        "update-wall"
      );

      controller.scheduleRebuild(
        "delete-wall"
      );

      assert.equal(
        environment.timeoutCallbacks.size,
        1
      );

      assert.equal(
        controller.createDiagnosticSnapshot().pendingReason,
        "delete-wall"
      );

      assert.equal(
        environment.generateCalls.length,
        0
      );

      environment.runNextTimeout();

      assert.equal(
        environment.generateCalls.length,
        1
      );

      assert.equal(
        environment.generateCalls[0].reason,
        "delete-wall"
      );

      const snapshot =
        controller.createDiagnosticSnapshot();

      assert.equal(
        snapshot.pendingRebuild,
        false
      );

      assert.equal(
        snapshot.lastCompletedReason,
        "delete-wall"
      );

      assert.equal(
        snapshot.synchronisationCount,
        1
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "canvas teardown cancels pending work and clears rendering",
  () => {
    const environment =
      createEnvironment();

    try {
      const controller =
        new SceneWebLifecycleController({
          runtime:
            environment.runtime,
          debounceMs:
            200
        });

      controller.scheduleRebuild(
        "update-wall"
      );

      assert.equal(
        environment.timeoutCallbacks.size,
        1
      );

      controller.handleCanvasTearDown();

      assert.equal(
        environment.timeoutCallbacks.size,
        0
      );

      assert.deepEqual(
        environment.clearCalls,
        [
          "canvas-teardown"
        ]
      );

      assert.equal(
        controller.createDiagnosticSnapshot().pendingRebuild,
        false
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "Scene updates distinguish density, geometry and unrelated changes",
  () => {
    const environment =
      createEnvironment();

    try {
      const controller =
        new SceneWebLifecycleController({
          runtime:
            environment.runtime,
          debounceMs:
            200
        });

      controller.handleSceneUpdated(
        environment.scene,
        {
          name:
            "Renamed"
        }
      );

      assert.equal(
        environment.generateCalls.length,
        0
      );

      assert.equal(
        environment.timeoutCallbacks.size,
        0
      );

      controller.handleSceneUpdated(
        environment.scene,
        {
          grid: {
            size:
              140
          }
        }
      );

      assert.equal(
        environment.timeoutCallbacks.size,
        1
      );

      controller.handleSceneUpdated(
        environment.scene,
        {
          flags: {
            "dynamic-webs": {
              webDensity:
                "dense"
            }
          }
        }
      );

      assert.equal(
        environment.timeoutCallbacks.size,
        0
      );

      assert.equal(
        environment.generateCalls.length,
        1
      );

      assert.equal(
        environment.generateCalls[0].reason,
        "scene-web-density-update"
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "deleting the active generated Scene clears runtime state",
  () => {
    const environment =
      createEnvironment();

    try {
      const controller =
        new SceneWebLifecycleController({
          runtime:
            environment.runtime
        });

      controller.handleSceneDeleted({
        id:
          "other"
      });

      assert.deepEqual(
        environment.clearCalls,
        []
      );

      controller.handleSceneDeleted({
        id:
          "scene"
      });

      assert.deepEqual(
        environment.clearCalls,
        [
          "scene-deleted"
        ]
      );
    } finally {
      environment.restore();
    }
  }
);
