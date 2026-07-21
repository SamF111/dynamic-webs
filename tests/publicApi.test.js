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

    createDiagnosticSnapshot() {
      return webSnapshot;
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
    await assert.rejects(
      () => api.scene.setPopulations([]),
      /only be performed by a GM/u
    );
  } finally {
    environment.restore();
  }
});
