import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanUpLingeringWebWallsAcrossWorld,
  deleteAllGeneratedWebWallsForScene,
  prepareDynamicWebsForUninstall,
  restoreDestroyedSpanWebsAcrossWorld,
  restoreDestroyedSpanWebsForScene
} from "../scripts/maintenance/WebWallMaintenanceService.js";

function createGeneratedWall(id, webId = null) {
  const flags = {
    "dynamic-webs": {
      generatedSpanWall: true,
      ...(webId ? { spanWebId: webId } : {})
    }
  };

  return {
    id,
    flags,
    _source: { flags },
    getFlag(namespace, key) {
      return this.flags?.[namespace]?.[key];
    }
  };
}

function createScene({ id = "scene-a", destroyed = [] } = {}) {
  const ordinaryWall = { id: `${id}-ordinary`, flags: {} };
  const region = {
    id: `${id}-region`,
    flags: {
      "dynamic-webs": {
        regionTags: ["crypt"]
      }
    },
    _source: {
      flags: {
        "dynamic-webs": {
          regionTags: ["crypt"]
        }
      }
    }
  };

  const scene = {
    id,
    name: id,
    flags: {
      "dynamic-webs": {
        webPopulations: [],
        mutableState: {
          schemaVersion: 1,
          revision: 2,
          destroyedWebIds: destroyed
        }
      }
    },
    walls: {
      contents: [ordinaryWall]
    },
    regions: {
      contents: [region]
    },
    deleteCalls: [],
    updateCalls: [],
    setFlagCalls: [],
    regionUpdateCalls: [],
    getFlag(namespace, key) {
      return this.flags?.[namespace]?.[key];
    },
    async setFlag(namespace, key, value) {
      this.flags[namespace] ??= {};
      this.flags[namespace][key] = value;
      this.setFlagCalls.push({ namespace, key, value });
      return this;
    },
    async deleteEmbeddedDocuments(type, ids) {
      assert.equal(type, "Wall");
      this.deleteCalls.push([...ids]);
      this.walls.contents = this.walls.contents.filter(wall => !ids.includes(wall.id));
      return ids;
    },
    async update(data) {
      this.updateCalls.push(data);
      this.flags["dynamic-webs"] ??= {};

      for (const [path, value] of Object.entries(data)) {
        if (path === "flags.dynamic-webs.webPopulations") {
          this.flags["dynamic-webs"].webPopulations = value;
          continue;
        }

        const match = /^flags\.dynamic-webs\.-=(.+)$/u.exec(path);
        if (match) delete this.flags["dynamic-webs"][match[1]];
      }

      return this;
    },
    async updateEmbeddedDocuments(type, updates) {
      assert.equal(type, "Region");
      this.regionUpdateCalls.push(updates);
      for (const update of updates) {
        const target = this.regions.contents.find(entry => entry.id === update._id);
        if (target && Object.hasOwn(update, "flags.-=dynamic-webs")) {
          delete target.flags["dynamic-webs"];
          delete target._source.flags["dynamic-webs"];
        }
      }
      return updates;
    }
  };

  return { scene, ordinaryWall, region };
}

function preserveGlobals() {
  return { game: globalThis.game, canvas: globalThis.canvas };
}

function restoreGlobals(previous) {
  globalThis.game = previous.game;
  globalThis.canvas = previous.canvas;
}

test("world cleanup deletes destroyed, duplicate and malformed generated walls while preserving valid walls", async () => {
  const previous = preserveGlobals();
  const { scene, ordinaryWall } = createScene({ destroyed: ["span-destroyed"] });

  const valid = createGeneratedWall("valid", "span-valid");
  const duplicate = createGeneratedWall("duplicate", "span-valid");
  const destroyed = createGeneratedWall("destroyed", "span-destroyed");
  const malformed = createGeneratedWall("malformed", null);
  scene.walls.contents.push(valid, duplicate, destroyed, malformed);

  const invalidated = [];
  const runtime = {
    getWebRuntimeService() {
      return {
        invalidateSpanWallIndex(sceneId) {
          invalidated.push(sceneId);
        }
      };
    }
  };

  globalThis.game = { user: { isGM: true }, scenes: [scene] };

  try {
    const summary = await cleanUpLingeringWebWallsAcrossWorld({ runtime });

    assert.equal(summary.deletedWallCount, 3);
    assert.equal(summary.destroyedLinkedWallCount, 1);
    assert.equal(summary.duplicateWallCount, 1);
    assert.equal(summary.malformedWallCount, 1);
    assert.deepEqual(scene.walls.contents, [ordinaryWall, valid]);
    assert.deepEqual(invalidated, [scene.id]);
  } finally {
    restoreGlobals(previous);
  }
});

test("scene deletion action removes every generated wall without touching ordinary walls or flags", async () => {
  const previous = preserveGlobals();
  const { scene, ordinaryWall } = createScene();
  scene.walls.contents.push(
    createGeneratedWall("generated-a", "span-a"),
    createGeneratedWall("generated-b", "span-b")
  );
  globalThis.game = { user: { isGM: true } };

  try {
    const result = await deleteAllGeneratedWebWallsForScene(scene);
    assert.equal(result.deletedWallCount, 2);
    assert.deepEqual(scene.walls.contents, [ordinaryWall]);
    assert.ok(scene.flags["dynamic-webs"]);
  } finally {
    restoreGlobals(previous);
  }
});

test("prepare for uninstall removes generated walls and Dynamic Webs Scene and Region flags", async () => {
  const previous = preserveGlobals();
  const first = createScene({ id: "first" });
  const second = createScene({ id: "second" });

  first.scene.walls.contents.push(createGeneratedWall("first-generated", "span-a"));
  second.scene.walls.contents.push(createGeneratedWall("second-generated", "span-b"));

  let clearReason = null;
  const runtime = {
    getWebRuntimeService() {
      return {
        invalidateSpanWallIndex() {},
        clear(reason) {
          clearReason = reason;
          return true;
        }
      };
    }
  };

  globalThis.game = {
    user: { isGM: true },
    scenes: [first.scene, second.scene]
  };

  try {
    const summary = await prepareDynamicWebsForUninstall({ runtime });

    assert.equal(summary.deletedWallCount, 2);
    assert.equal(summary.clearedSceneCount, 2);
    assert.equal(summary.clearedRegionFlagCount, 2);
    assert.deepEqual(first.scene.flags["dynamic-webs"], { webPopulations: [] });
    assert.deepEqual(second.scene.flags["dynamic-webs"], { webPopulations: [] });
    assert.equal(first.region.flags["dynamic-webs"], undefined);
    assert.equal(second.region.flags["dynamic-webs"], undefined);
    assert.equal(clearReason, "prepare-dynamic-webs-for-uninstall");
  } finally {
    restoreGlobals(previous);
  }
});

test("inactive Scene restoration clears destroyed IDs without generating geometry", async () => {
  const previous = preserveGlobals();
  const { scene, ordinaryWall } = createScene({
    id: "inactive",
    destroyed: ["span-a", "span-b"]
  });

  const deferred = createGeneratedWall("deferred", "span-a");
  scene.walls.contents.push(deferred);

  globalThis.game = { user: { isGM: true } };
  globalThis.canvas = { scene: { id: "other-scene" } };

  try {
    const result = await restoreDestroyedSpanWebsForScene(scene);

    assert.equal(result.success, true);
    assert.equal(result.restoredWebCount, 2);
    assert.equal(result.restoredSceneState, true);
    assert.equal(result.activeScene, false);
    assert.equal(result.regeneratedScene, false);
    assert.equal(result.deletedWallCount, 1);
    assert.deepEqual(scene.walls.contents, [ordinaryWall]);
    assert.deepEqual(scene.flags["dynamic-webs"].mutableState, {
      schemaVersion: 1,
      revision: 3,
      destroyedWebIds: []
    });
    assert.equal(scene.setFlagCalls.length, 1);
  } finally {
    restoreGlobals(previous);
  }
});

test("active Scene restoration uses the incremental runtime reset path", async () => {
  const previous = preserveGlobals();
  const { scene } = createScene({
    id: "active",
    destroyed: ["span-a"]
  });

  let mutableState = {
    sceneId: "active",
    generationId: 4,
    revision: 2,
    destroyedWebIds: ["span-a"]
  };

  const calls = [];
  const service = {
    getState() {
      return {
        active: true,
        sceneId: "active"
      };
    },
    getMutableState() {
      return mutableState;
    },
    resetMutableState(metadata) {
      calls.push({ type: "reset", metadata });
      mutableState = {
        ...mutableState,
        revision: 3,
        destroyedWebIds: []
      };
      return { changed: true, state: mutableState };
    },
    async flushMutableStatePersistence() {
      calls.push({ type: "flush-persistence" });
    },
    async flushSpanWallReconciliation() {
      calls.push({ type: "flush-walls" });
      return { createdCount: 1, updatedCount: 0, deferredCount: 0 };
    }
  };

  const runtime = {
    getWebRuntimeService() {
      return service;
    }
  };

  globalThis.game = { user: { isGM: true } };
  globalThis.canvas = { scene };

  try {
    const result = await restoreDestroyedSpanWebsForScene(scene, { runtime });

    assert.equal(result.success, true);
    assert.equal(result.activeScene, true);
    assert.equal(result.restoredWebCount, 1);
    assert.equal(result.createdWallCount, 1);
    assert.equal(result.deletedWallCount, 0);
    assert.deepEqual(calls.map(call => call.type), [
      "reset",
      "flush-persistence",
      "flush-walls"
    ]);
  } finally {
    restoreGlobals(previous);
  }
});

test("world restoration reports restored Scene and web totals", async () => {
  const previous = preserveGlobals();
  const first = createScene({ id: "first", destroyed: ["span-a", "span-b"] });
  const second = createScene({ id: "second", destroyed: [] });

  globalThis.game = {
    user: { isGM: true },
    scenes: [first.scene, second.scene]
  };
  globalThis.canvas = { scene: null };

  try {
    const summary = await restoreDestroyedSpanWebsAcrossWorld();

    assert.equal(summary.sceneCount, 2);
    assert.equal(summary.restoredSceneCount, 1);
    assert.equal(summary.restoredWebCount, 2);
    assert.equal(summary.failedSceneCount, 0);
  } finally {
    restoreGlobals(previous);
  }
});

