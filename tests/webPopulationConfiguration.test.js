import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultSceneWebPopulation,
  getSceneWebPopulationConfiguration,
  normaliseSceneWebPopulations
} from "../scripts/config/sceneWebPopulationConfiguration.js";

import {
  createWebPopulationId,
  createUniqueWebPopulationId
} from "../scripts/config/sceneWebPopulationIds.js";

function withBaseEnvironment(callback) {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;
  globalThis.game = {
    release: { generation: 13 },
    version: "13",
    modules: { get: () => ({ active: false }) },
    settings: { get: () => "base" },
    user: { isGM: true }
  };
  globalThis.canvas = { scene: null };
  try { return callback(); }
  finally {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  }
}

test("empty modular configuration produces no implicit population", () => withBaseEnvironment(() => {
  const scene = { id: "scene", getFlag: () => undefined };
  const configuration = getSceneWebPopulationConfiguration(scene);
  assert.deepEqual(configuration.populations, []);
  assert.equal(configuration.hasActivePopulations, false);
  assert.equal(Object.isFrozen(configuration.populations), true);
}));

test("population configuration normalises independent level, density, colour and thickness", () => withBaseEnvironment(() => {
  const scene = {
    id: "scene",
    getFlag(_namespace, key) {
      if (key !== "webPopulations") return undefined;
      return [{
        id: "blue-walls",
        enabled: true,
        levelId: "base",
        categoryDensities: {
          "wall-corner": "dense",
          "wall-span": "sparse",
          ground: "disabled",
          "web-carpet": "infested"
        },
        colourProfileId: "arcane-blue",
        thicknessMultiplier: "1.75"
      }];
    }
  };

  const configuration = getSceneWebPopulationConfiguration(scene);
  const population = configuration.populations[0];
  assert.equal(population.id, "blue-walls");
  assert.equal(population.levelId, "base");
  assert.equal(population.categoryDensities["wall-corner"], "dense");
  assert.equal(population.categoryDensities["wall-span"], "sparse");
  assert.equal(population.categoryDensities.ground, "disabled");
  assert.equal(population.categoryDensities["web-carpet"], "infested");
  assert.equal(Object.prototype.hasOwnProperty.call(population, "label"), false);
  assert.equal(population.colourProfileId, "arcane-blue");
  assert.equal(population.thicknessMultiplier, 1.75);
  assert.equal(population.generationActive, true);
  assert.equal(population.generationOptions.cornerWebs.maximumCount, 48);
  assert.equal(population.generationOptions.groundWebs.enabled, false);
}));

test("duplicate persisted population IDs are rejected rather than silently destabilised", () => {
  assert.throws(
    () => normaliseSceneWebPopulations([
      { id: "webs", levelId: "base", categoryDensities: {} },
      { id: "webs", levelId: "base", categoryDensities: {} }
    ], { levels: [{ id: "base" }] }),
    /Duplicate web-population ID/u
  );
});

test("programmatic writes create fresh IDs for missing and duplicate entries", () => {
  const populations = normaliseSceneWebPopulations([
    { levelId: "base", categoryDensities: {} },
    { id: "web-fixed", levelId: "base", categoryDensities: {} },
    { id: "web-fixed", levelId: "base", categoryDensities: {} }
  ], {
    levels: [{ id: "base" }],
    generateMissingIds: true
  });

  assert.match(populations[0].id, /^web-[A-Za-z0-9_-]{16}$/u);
  assert.equal(populations[1].id, "web-fixed");
  assert.match(populations[2].id, /^web-[A-Za-z0-9_-]{16}$/u);
  assert.equal(new Set(populations.map((entry) => entry.id)).size, 3);
  assert.equal(populations.every((entry) => !Object.prototype.hasOwnProperty.call(entry, "label")), true);
});

test("opaque population ID generation preserves existing IDs and avoids collisions", () => {
  const generated = createWebPopulationId({
    randomIdFactory: () => "AbCdEf1234567890"
  });

  assert.equal(generated, "web-AbCdEf1234567890");
  assert.equal(createUniqueWebPopulationId({
    preferredId: "web-existing",
    usedIds: new Set()
  }), "web-existing");

  let attempt = 0;
  const unique = createUniqueWebPopulationId({
    usedIds: new Set(["web-AbCdEf1234567890"]),
    randomIdFactory: () => {
      attempt += 1;
      return attempt === 1
        ? "AbCdEf1234567890"
        : "ZyXwVu0987654321";
    }
  });

  assert.equal(unique, "web-ZyXwVu0987654321");
});

test("unavailable levels are preserved but excluded from active generation", () => withBaseEnvironment(() => {
  const scene = {
    id: "scene",
    getFlag(_namespace, key) {
      return key === "webPopulations" ? [{
        id: "missing",
        enabled: true,
        levelId: "level-99",
        categoryDensities: { ground: "dense" },
        colourProfileId: "blood-red",
        thicknessMultiplier: 2
      }] : undefined;
    }
  };

  const configuration = getSceneWebPopulationConfiguration(scene);
  assert.equal(configuration.populations[0].levelAvailable, false);
  assert.equal(configuration.populations[0].generationActive, false);
  assert.deepEqual(configuration.unavailablePopulationIds, ["missing"]);
}));

test("default population uses hidden random identity and middle density", () => {
  const population = createDefaultSceneWebPopulation({
    levels: [{ id: "level-0" }]
  });
  assert.equal(population.levelId, "level-0");
  assert.match(population.id, /^web-[A-Za-z0-9_-]{16}$/u);
  assert.equal(Object.prototype.hasOwnProperty.call(population, "label"), false);
  assert.deepEqual(population.categoryDensities, {
    "wall-corner": "standard",
    "wall-span": "standard",
    ground: "standard",
    "web-carpet": "standard"
  });
  assert.equal(Object.isFrozen(population.categoryDensities), true);
});
