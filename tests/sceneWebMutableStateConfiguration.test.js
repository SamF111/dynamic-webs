import test from "node:test";
import assert from "node:assert/strict";

import {
  createSceneWebMutableStateFlagValue,
  getSceneWebMutableStateConfiguration,
  normaliseSceneWebMutableState,
  persistSceneWebMutableState
} from "../scripts/config/sceneWebMutableStateConfiguration.js";

import {
  doesSceneUpdateAffectWebMutableState
} from "../scripts/config/sceneWebFlagPaths.js";

test("Scene mutable state normalises compact sorted destroyed-span IDs", () => {
  const state = normaliseSceneWebMutableState({
    schemaVersion: 1,
    revision: 7,
    destroyedWebIds: ["span-b", "span-a", "span-b"]
  });

  assert.deepEqual(state, {
    schemaVersion: 1,
    revision: 7,
    destroyedWebIds: ["span-a", "span-b"]
  });
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.destroyedWebIds), true);
});

test("missing and invalid Scene mutable flags are absence-safe", () => {
  const missing = getSceneWebMutableStateConfiguration({ flags: {} });
  assert.equal(missing.valid, true);
  assert.equal(missing.source, "missing");
  assert.deepEqual(missing.destroyedWebIds, []);

  const invalid = getSceneWebMutableStateConfiguration({
    flags: {
      "dynamic-webs": {
        mutableState: {
          schemaVersion: 99,
          revision: 2,
          destroyedWebIds: ["span-a"]
        }
      }
    }
  });

  assert.equal(invalid.valid, false);
  assert.equal(invalid.source, "invalid-scene-flag");
  assert.deepEqual(invalid.destroyedWebIds, []);
  assert.match(invalid.error.message, /Unsupported Scene mutable web-state schema/u);
});

test("Scene mutable state persists only schema, revision and stable IDs", async () => {
  const calls = [];
  const scene = {
    async setFlag(namespace, key, value) {
      calls.push({ namespace, key, value });
      return this;
    }
  };

  const value = await persistSceneWebMutableState(scene, {
    schemaVersion: 1,
    sceneId: "scene-a",
    generationId: 8,
    revision: 4,
    destroyedWebIds: ["span-b", "span-a"],
    lastMutation: { action: "destroy" }
  });

  assert.deepEqual(value, {
    schemaVersion: 1,
    revision: 4,
    destroyedWebIds: ["span-a", "span-b"]
  });
  assert.deepEqual(calls, [{
    namespace: "dynamic-webs",
    key: "mutableState",
    value
  }]);

  assert.deepEqual(
    createSceneWebMutableStateFlagValue({
      revision: 5,
      destroyedWebIds: ["span-c"]
    }),
    {
      schemaVersion: 1,
      revision: 5,
      destroyedWebIds: ["span-c"]
    }
  );
});

test("mutable-state Scene update paths are detected independently", () => {
  assert.equal(doesSceneUpdateAffectWebMutableState({
    flags: {
      "dynamic-webs": {
        mutableState: {
          revision: 2
        }
      }
    }
  }), true);

  assert.equal(doesSceneUpdateAffectWebMutableState({
    "flags.dynamic-webs.mutableState.destroyedWebIds": ["span-a"]
  }), true);

  assert.equal(doesSceneUpdateAffectWebMutableState({
    flags: {
      "dynamic-webs": {
        webPopulations: []
      }
    }
  }), false);
});
