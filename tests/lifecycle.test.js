import test from "node:test";
import assert from "node:assert/strict";

import {
  SceneWebLifecycleController
} from "../scripts/lifecycle/SceneWebLifecycleController.js";

function createPopulation(overrides = {}) {
  return {
    id: "level-0-blue",
    label: "Level 0 blue",
    enabled: true,
    levelId: "base",
    categoryDensities: {
      "wall-corner": "standard",
      "wall-span": "standard",
      ground: "disabled",
      "web-carpet": "disabled"
    },
    colourProfileId: "arcane-blue",
    thicknessMultiplier: 1,
    ...overrides
  };
}

function createEnvironment() {
  const previous = {
    Hooks: globalThis.Hooks,
    canvas: globalThis.canvas,
    game: globalThis.game,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
  };

  const callbacks = new Map();
  const timeoutCallbacks = new Map();
  const generateCalls = [];
  const clearCalls = [];
  const visibilityCalls = [];
  let hookId = 0;
  let timeoutId = 0;
  let populations = [createPopulation()];

  const service = {
    state: { active: true, sceneId: "scene" },
    getState() { return this.state; },
    generateForActiveScene(options) {
      generateCalls.push(options);
      this.state = { active: true, sceneId: options.scene.id };
      return Object.freeze({ active: true, sceneId: options.scene.id });
    },
    refreshLevelVisibility(options) {
      visibilityCalls.push(options);
      return Object.freeze({ active: true, sceneId: "scene" });
    },
    clear(reason) {
      clearCalls.push(reason);
      this.state = { active: false, sceneId: null };
      return true;
    },
    createDiagnosticSnapshot() {
      return Object.freeze({ active: this.state.active });
    }
  };

  const runtime = {
    getWebRuntimeService: () => service
  };

  const scene = {
    id: "scene",
    getFlag(_namespace, key) {
      if (key === "webPopulations") return populations;
      return undefined;
    }
  };

  globalThis.game = {
    release: { generation: 13 },
    version: "13",
    user: { isGM: true },
    modules: { get: () => ({ active: false }) },
    settings: { get: () => "base" }
  };

  globalThis.canvas = { ready: true, scene };
  globalThis.Hooks = {
    on(event, callback) {
      hookId += 1;
      callbacks.set(hookId, { event, callback });
      return hookId;
    },
    off(_event, id) { callbacks.delete(id); },
    callAll() {}
  };
  globalThis.setTimeout = (callback) => {
    timeoutId += 1;
    timeoutCallbacks.set(timeoutId, callback);
    return timeoutId;
  };
  globalThis.clearTimeout = (id) => timeoutCallbacks.delete(id);

  return {
    runtime,
    service,
    scene,
    callbacks,
    timeoutCallbacks,
    generateCalls,
    clearCalls,
    visibilityCalls,
    setPopulations(value) { populations = value; },
    runNextTimeout() {
      const entry = timeoutCallbacks.entries().next().value;
      if (!entry) return false;
      timeoutCallbacks.delete(entry[0]);
      entry[1]();
      return true;
    },
    restore() {
      Object.assign(globalThis, previous);
    }
  };
}

test("lifecycle registration installs level-aware hooks and dispose removes them", () => {
  const environment = createEnvironment();
  try {
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime, debounceMs: 200 });
    assert.equal(controller.registerHooks(), true);
    assert.equal(controller.registerHooks(), false);
    assert.equal(environment.callbacks.size, 21);
    assert.equal(
      Array.from(environment.callbacks.values()).some(
        registration => registration.event === "preUpdateToken"
      ),
      true
    );
    controller.dispose();
    assert.equal(environment.callbacks.size, 0);
    assert.deepEqual(environment.clearCalls, ["lifecycle-dispose"]);
  } finally { environment.restore(); }
});

test("rapid structural rebuild requests coalesce and retain modular populations", () => {
  const environment = createEnvironment();
  try {
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime, debounceMs: 200 });
    controller.scheduleRebuild("create-wall");
    controller.scheduleRebuild("update-wall");
    controller.scheduleRebuild("delete-wall");
    assert.equal(environment.timeoutCallbacks.size, 1);
    assert.equal(controller.createDiagnosticSnapshot().pendingReason, "delete-wall");
    environment.runNextTimeout();
    assert.equal(environment.generateCalls.length, 1);
    assert.equal(environment.generateCalls[0].reason, "delete-wall");
    assert.equal(environment.generateCalls[0].populations[0].id, "level-0-blue");
  } finally { environment.restore(); }
});

test("canvas teardown cancels pending work and clears rendering", () => {
  const environment = createEnvironment();
  try {
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime, debounceMs: 200 });
    controller.scheduleRebuild("update-wall");
    controller.handleCanvasTearDown();
    assert.equal(environment.timeoutCallbacks.size, 0);
    assert.deepEqual(environment.clearCalls, ["canvas-teardown"]);
  } finally { environment.restore(); }
});

test("Scene population updates regenerate once while unrelated updates are ignored", () => {
  const environment = createEnvironment();
  try {
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime, debounceMs: 200 });
    controller.handleSceneUpdated(environment.scene, { name: "Renamed" });
    assert.equal(environment.generateCalls.length, 0);

    controller.handleSceneUpdated(environment.scene, { grid: { size: 140 } });
    assert.equal(environment.timeoutCallbacks.size, 1);

    environment.setPopulations([
      createPopulation({ colourProfileId: "blood-red", thicknessMultiplier: 2 }),
      createPopulation({ id: "level-10-red", label: "Level 10 red", levelId: "base" })
    ]);
    controller.handleSceneUpdated(environment.scene, {
      flags: { "dynamic-webs": { webPopulations: [] } }
    });

    assert.equal(environment.timeoutCallbacks.size, 0);
    assert.equal(environment.generateCalls.length, 1);
    assert.equal(environment.generateCalls[0].reason, "scene-web-populations-update");
    assert.equal(environment.generateCalls[0].populations.length, 2);
    assert.equal(environment.generateCalls[0].populations[0].colourProfileId, "blood-red");
    assert.equal(environment.generateCalls[0].populations[0].thicknessMultiplier, 2);
  } finally { environment.restore(); }
});

test("an empty modular population array clears webs", () => {
  const environment = createEnvironment();
  try {
    environment.setPopulations([]);
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime });
    controller.handleCanvasReady();
    assert.equal(environment.generateCalls.length, 0);
    assert.deepEqual(environment.clearCalls, ["canvas-ready"]);
  } finally { environment.restore(); }
});

test("viewed-level changes redraw visibility without regenerating populations", () => {
  const environment = createEnvironment();
  try {
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime });
    controller.handleSceneUpdated(environment.scene, { viewedLevelId: "level-10" });
    assert.equal(environment.generateCalls.length, 0);
    assert.equal(environment.visibilityCalls.length, 1);
    assert.equal(environment.visibilityCalls[0].reason, "scene-viewed-level-update");
  } finally { environment.restore(); }
});

test("deleting the active generated Scene clears runtime state", () => {
  const environment = createEnvironment();
  try {
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime });
    controller.handleSceneDeleted({ id: "other" });
    assert.deepEqual(environment.clearCalls, []);
    controller.handleSceneDeleted({ id: "scene" });
    assert.deepEqual(environment.clearCalls, ["scene-deleted"]);
  } finally { environment.restore(); }
});


test("Region geometry and tag changes schedule deterministic rebuilds", () => {
  const environment = createEnvironment();
  try {
    const controller = new SceneWebLifecycleController({ runtime: environment.runtime, debounceMs: 200 });
    const region = { parent: { id: "scene" } };
    controller.handleRegionUpdated(region, { name: "Renamed" });
    assert.equal(environment.timeoutCallbacks.size, 0);
    controller.handleRegionUpdated(region, { shapes: [{ x: 0, y: 0, width: 10, height: 10 }] });
    assert.equal(environment.timeoutCallbacks.size, 1);
    assert.equal(controller.createDiagnosticSnapshot().pendingReason, "update-region");
  } finally { environment.restore(); }
});


