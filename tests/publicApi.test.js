import test from "node:test";
import assert from "node:assert/strict";

import {
  createPublicApi
} from "../scripts/api.js";

function createEnvironment() {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;

  const calls = {
    generate: [],
    clear: [],
    clearCarpetTextureCache: [],
    queryMovementIntersections: [],
    queryEntityWebPosition: [],
    evaluateEntityWebMovement: [],
    showCapturedWeb: [],
    removeCapturedWeb: [],
    clearCapturedWebsByEntity: [],
    clearCapturedWebs: [],
    destroyWebs: [],
    restoreWeb: [],
    resetMutableState: [],
    setFlag: []
  };

  const webSnapshot = Object.freeze({
    active: true,
    sceneId: "scene",
    levelProvider: null,
    levels: Object.freeze([]),
    levelVisibility: null,
    counts: Object.freeze({ byLevel: Object.freeze({}) })
  });

  const service = {
    generateForActiveScene(options) {
      calls.generate.push(options);
      return webSnapshot;
    },

    clear(reason) {
      calls.clear.push(reason);
      return true;
    },

    clearCarpetTextureCache(options) {
      calls.clearCarpetTextureCache.push(options);
      return Object.freeze({
        cleared:
          true,
        state:
          webSnapshot
      });
    },

    createDiagnosticSnapshot() {
      return webSnapshot;
    },

    getWebs() {
      return Object.freeze([
        Object.freeze({
          id: "web-a"
        })
      ]);
    },

    getWeb(webId) {
      return webId === "web-a"
        ? this.getWebs()[0]
        : null;
    },

    queryNearby(point, options) {
      return Object.freeze([
        Object.freeze({
          webId: "web-a",
          strandId: "strand-a",
          point,
          options
        })
      ]);
    },

    queryStrands(bounds, options) {
      return Object.freeze([
        Object.freeze({
          webId: "web-a",
          strandId: "strand-a",
          bounds,
          options
        })
      ]);
    },

    findCompatibleWebs(options) {
      return Object.freeze([
        Object.freeze({
          id: "web-a",
          options
        })
      ]);
    },

    findPerches(options) {
      return Object.freeze([
        Object.freeze({
          webId: "web-a",
          perchId: "hub",
          options
        })
      ]);
    },

    createSpatialDiagnosticSnapshot() {
      return Object.freeze({
        active: true,
        counts: Object.freeze({
          webs: 1,
          strands: 1,
          perches: 1
        })
      });
    },

    queryMovementIntersections(request) {
      calls.queryMovementIntersections.push(request);
      return Object.freeze([
        Object.freeze({
          webId: "web-a",
          strandIds: Object.freeze(["strand-a"])
        })
      ]);
    },

    queryEntityWebPosition(request) {
      calls.queryEntityWebPosition.push(request);
      return Object.freeze({
        entity: Object.freeze({ id: request.entityId }),
        onWeb: true,
        webIds: Object.freeze(["web-a"])
      });
    },

    evaluateEntityWebMovement(request) {
      calls.evaluateEntityWebMovement.push(request);
      return Object.freeze({
        primaryOutcome: "entered-web",
        enteredWebIds: Object.freeze(["web-a"]),
        currentWebIds: Object.freeze(["web-a"])
      });
    },

    showCapturedWeb(request) {
      calls.showCapturedWeb.push(request);
      return Object.freeze({
        captureId: request.captureId ?? "capture:external:entity:entity-a",
        entityId: request.entityId ?? null
      });
    },

    removeCapturedWeb(captureId, options) {
      calls.removeCapturedWeb.push({ captureId, options });
      return true;
    },

    clearCapturedWebsByEntity(entityId, options) {
      calls.clearCapturedWebsByEntity.push({ entityId, options });
      return Object.freeze(["capture:external:entity:entity-a"]);
    },

    clearCapturedWebs(options) {
      calls.clearCapturedWebs.push(options);
      return true;
    },

    getCapturedWeb(captureId) {
      return captureId === "capture-a"
        ? Object.freeze({ captureId: "capture-a" })
        : null;
    },

    getCapturedWebState() {
      return Object.freeze({
        captureCount: 1,
        captures: Object.freeze([Object.freeze({ captureId: "capture-a" })])
      });
    },

    destroyWebs(webIds, options) {
      calls.destroyWebs.push({ webIds, options });
      return Object.freeze({
        changed: true,
        destroyedWebIds: Object.freeze([...webIds]),
        state: Object.freeze({ destroyedWebIds: Object.freeze([...webIds]) })
      });
    },

    restoreWeb(webId, options) {
      calls.restoreWeb.push({ webId, options });
      return Object.freeze({ changed: true, webId, state: Object.freeze({}) });
    },

    resetMutableState(options) {
      calls.resetMutableState.push(options);
      return Object.freeze({ changed: true, state: Object.freeze({ destroyedWebIds: Object.freeze([]) }) });
    },

    getMutableState() {
      return Object.freeze({
        sceneId: "scene",
        revision: 1,
        destroyedWebIds: Object.freeze([])
      });
    }
  };

  const runtime = {
    runtimeOwnerType: "DynamicWebsRuntime",
    ready: true,
    getWebRuntimeService: () => service
  };

  const persistedPopulations = [{
    id: "level-0-blue",
    enabled: true,
    levelId: "base",
    categoryDensities: {
      "wall-corner": "standard",
      "wall-span": "disabled",
      ground: "disabled",
      "web-carpet": "disabled"
    },
    colourProfileId: "arcane-blue",
    thicknessMultiplier: 1.5
  }];

  const scene = {
    id: "scene",

    getFlag(namespace, key) {
      assert.equal(namespace, "dynamic-webs");
      return key === "webPopulations" ? persistedPopulations : undefined;
    },

    async setFlag(namespace, key, value) {
      calls.setFlag.push({ namespace, key, value });
      return this;
    }
  };

  globalThis.canvas = {
    scene
  };

  globalThis.game = {
    release: {
      generation: 13
    },
    version: "13",
    user: {
      id: "gm",
      isGM: true
    },
    settings: {
      get: () => "base"
    },
    modules: {
      get(id) {
        if (id === "levels") return { active: false };
        if (id === "dynamic-webs") return { version: "0.3.1" };
        return null;
      }
    },
    scenes: {
      get: (id) => id === "scene" ? scene : null
    }
  };

  return {
    runtime,
    calls,
    scene,
    persistedPopulations,
    restore() {
      globalThis.game = previousGame;
      globalThis.canvas = previousCanvas;
    }
  };
}

test("public API and namespaces are frozen and expose only modular Scene configuration", () => {
  const environment = createEnvironment();

  try {
    const api = createPublicApi(environment.runtime);

    assert.equal(api.version, 1);
    assert.equal(Object.isFrozen(api), true);
    assert.equal(Object.isFrozen(api.webs), true);
    assert.equal(Object.isFrozen(api.scene), true);
    assert.equal(Object.isFrozen(api.diagnostics), true);
    assert.equal(Object.isFrozen(api.colours), true);
    assert.equal(Object.isFrozen(api.spatial), true);
    assert.equal(Object.isFrozen(api.interactions), true);
    assert.equal(Object.isFrozen(api.captures), true);
    assert.deepEqual(
      Object.keys(api.scene).sort(),
      ["getPopulation", "getPopulations", "setPopulations"]
    );
    assert.equal(api.getState().webs, environment.runtime
      .getWebRuntimeService()
      .createDiagnosticSnapshot());
  } finally {
    environment.restore();
  }
});

test("public web operations generate persisted modular populations and clear runtime state", () => {
  const environment = createEnvironment();

  try {
    const api = createPublicApi(environment.runtime);
    const generated = api.webs.generate();

    assert.equal(generated.active, true);
    assert.equal(environment.calls.generate.length, 1);
    assert.equal(environment.calls.generate[0].reason, "public-api-generate");
    assert.equal(environment.calls.generate[0].populations.length, 1);
    assert.equal(environment.calls.generate[0].populations[0].id, "level-0-blue");
    assert.equal(environment.calls.generate[0].populations[0].colourProfileId, "arcane-blue");

    const cleared = api.webs.clear();
    assert.equal(cleared.cleared, true);
    assert.deepEqual(environment.calls.clear, ["public-api-clear"]);

    const carpetCleared = api.webs.clearCarpetTextureCache();
    assert.equal(carpetCleared.cleared, true);
    assert.deepEqual(environment.calls.clearCarpetTextureCache, [{
      redraw: true,
      reason: "public-api-clear-carpet-texture-cache"
    }]);
  } finally {
    environment.restore();
  }
});

test("public Scene population operations return frozen snapshots and replace the complete flag", async () => {
  const environment = createEnvironment();

  try {
    const api = createPublicApi(environment.runtime);
    const populations = api.scene.getPopulations();

    assert.equal(populations.length, 1);
    assert.equal(populations[0].id, "level-0-blue");
    assert.equal(Object.isFrozen(populations), true);
    assert.equal(Object.isFrozen(populations[0]), true);
    assert.equal(Object.isFrozen(populations[0].categoryDensities), true);
    assert.equal(Object.prototype.hasOwnProperty.call(populations[0], "label"), false);
    assert.deepEqual(api.scene.getPopulation("level-0-blue"), populations[0]);
    assert.equal(api.scene.getPopulation("missing"), null);

    await api.scene.setPopulations([{
      id: "level-10-red",
      enabled: true,
      levelId: "base",
      confineRegionTags: ["Crypt", "crypt-*"],
      excludeRegionTags: ["altar"],
      categoryDensities: {
        "wall-corner": "dense",
        "wall-span": "dense",
        ground: "dense",
        "web-carpet": "disabled"
      },
      colourProfileId: "blood-red",
      thicknessMultiplier: "2"
    }]);

    assert.deepEqual(environment.calls.setFlag, [{
      namespace: "dynamic-webs",
      key: "webPopulations",
      value: [{
        id: "level-10-red",
        enabled: true,
        levelId: "base",
        confineRegionTags: ["crypt", "crypt-*"],
        excludeRegionTags: ["altar"],
        categoryDensities: {
          "wall-corner": "dense",
          "wall-span": "dense",
          ground: "dense",
          "web-carpet": "disabled"
        },
        colourProfileId: "blood-red",
        thicknessMultiplier: 2
      }]
    }]);

    await assert.rejects(
      () => api.scene.setPopulations([{
        id: "invalid",
        levelId: "base",
        categoryDensities: {
          ground: "impossible"
        }
      }]),
      /Unsupported Scene web density/u
    );
  } finally {
    environment.restore();
  }
});

test("public spatial operations expose immutable read-only query results", () => {
  const environment = createEnvironment();

  try {
    const api = createPublicApi(environment.runtime);

    assert.deepEqual(api.getWebs().map((web) => web.id), ["web-a"]);
    assert.equal(api.getWeb("web-a").id, "web-a");
    assert.equal(api.getWeb("missing"), null);
    assert.equal(
      api.queryNearby({ x: 10, y: 20 }, { levelId: "base" })[0].strandId,
      "strand-a"
    );
    assert.equal(
      api.queryStrands({ x: 0, y: 0, width: 50, height: 50 })[0].webId,
      "web-a"
    );
    assert.equal(api.findCompatibleWebs({ category: "ground" })[0].id, "web-a");
    assert.equal(api.findPerches({ levelId: "base" })[0].perchId, "hub");
    assert.equal(api.spatial.getDiagnostics().counts.strands, 1);
    assert.equal(Object.isFrozen(api.getWebs()), true);
  } finally {
    environment.restore();
  }
});

test("public interaction API exposes generic movement queries and GM-only whole-web mutations", () => {
  const environment = createEnvironment();

  try {
    const api = createPublicApi(environment.runtime);
    const request = {
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      levelId: "base",
      collisionRadiusPx: 25
    };

    assert.equal(api.interactions.queryMovement(request)[0].webId, "web-a");
    assert.deepEqual(environment.calls.queryMovementIntersections, [request]);

    const position = api.interactions.queryEntityPosition({
      entityId: "entity-a",
      point: { x: 10, y: 20 },
      levelId: "base"
    });
    assert.equal(position.onWeb, true);
    assert.deepEqual(position.webIds, ["web-a"]);

    const evaluated = api.interactions.evaluateEntityMovement({
      entityId: "entity-a",
      from: { x: 0, y: 0 },
      to: { x: 10, y: 20 },
      levelId: "base"
    });
    assert.equal(evaluated.primaryOutcome, "entered-web");
    assert.equal(api.interactions.getContract().schemaVersion, 1);

    const destroyed = api.interactions.destroyWebs(["web-a"], {
      cause: "test-entity",
      entityId: "entity-a"
    });
    assert.deepEqual(destroyed.destroyedWebIds, ["web-a"]);
    assert.equal(environment.calls.destroyWebs[0].options.cause, "test-entity");
    assert.equal(environment.calls.destroyWebs[0].options.entityId, "entity-a");
    assert.equal(environment.calls.destroyWebs[0].options.userId, "gm");

    assert.equal(api.interactions.restoreWeb("web-a").changed, true);
    assert.equal(environment.calls.restoreWeb[0].webId, "web-a");
    assert.equal(api.interactions.reset().changed, true);
    assert.equal(environment.calls.resetMutableState.length, 1);
    assert.equal(api.interactions.getState().sceneId, "scene");
    assert.equal(Object.isFrozen(api.interactions.getState()), true);
  } finally {
    environment.restore();
  }
});

test("public captured-web API exposes transient show, remove and clear operations", () => {
  const environment = createEnvironment();

  try {
    const api = createPublicApi(environment.runtime);
    const shown = api.captures.show({
      entityId: "entity-a",
      point: { x: 100, y: 120 },
      radiusPx: 30,
      levelId: "base",
      aboveTokens: true
    });

    assert.equal(shown.entityId, "entity-a");
    assert.equal(environment.calls.showCapturedWeb.length, 1);
    assert.equal(environment.calls.showCapturedWeb[0].aboveTokens, true);
    assert.equal(api.captures.get("capture-a").captureId, "capture-a");
    assert.equal(api.captures.getState().captureCount, 1);
    assert.equal(api.captures.remove("capture-a"), true);
    assert.deepEqual(api.captures.clearByEntity("entity-a"), ["capture:external:entity:entity-a"]);
    assert.equal(api.captures.clear(), true);
    assert.equal(Object.isFrozen(api.captures.getState()), true);
  } finally {
    environment.restore();
  }
});

test("public colour operations expose frozen authored profiles", () => {
  const environment = createEnvironment();

  try {
    const api = createPublicApi(environment.runtime);
    const profiles = api.colours.getProfiles();

    assert.equal(Object.isFrozen(profiles), true);
    assert.equal(api.colours.getProfile("blood-red").label, "Blood Red");
  } finally {
    environment.restore();
  }
});

test("GM-only modular operations reject non-GM callers", async () => {
  const environment = createEnvironment();

  try {
    globalThis.game.user.isGM = false;
    const api = createPublicApi(environment.runtime);

    assert.throws(() => api.webs.generate(), /only be performed by a GM/u);
    assert.throws(() => api.webs.clear(), /only be performed by a GM/u);
    assert.throws(() => api.interactions.destroyWebs(["web-a"]), /only be performed by a GM/u);
    assert.throws(() => api.interactions.restoreWeb("web-a"), /only be performed by a GM/u);
    assert.throws(() => api.interactions.reset(), /only be performed by a GM/u);
    assert.equal(api.interactions.queryMovement({ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }).length, 1);
    await assert.rejects(
      () => api.scene.setPopulations([]),
      /only be performed by a GM/u
    );
  } finally {
    environment.restore();
  }
});



