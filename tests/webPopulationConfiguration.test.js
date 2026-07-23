import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultSceneWebPopulation,
  getSceneWebPopulationConfiguration,
  normaliseSceneWebPopulations
} from "../scripts/config/sceneWebPopulationConfiguration.js";

import {
  createImplicitSceneWebPopulationId,
  createWebPopulationId,
  createUniqueWebPopulationId
} from "../scripts/config/sceneWebPopulationIds.js";

import {
  MODULE_SETTING_KEYS,
  registerModuleSettings,
  resetModuleSettingsRegistrationForTests
} from "../scripts/config/moduleSettings.js";

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

test("a Scene with no persisted population flag resolves one stable world-default population", () => withBaseEnvironment(() => {
  const scene = { id: "scene", getFlag: () => undefined };
  const first = getSceneWebPopulationConfiguration(scene);
  const second = getSceneWebPopulationConfiguration(scene);

  assert.equal(first.populationSource, "world-default");
  assert.equal(first.hasPersistedPopulations, false);
  assert.equal(first.usesWorldPopulationDefaults, true);
  assert.equal(first.populations.length, 1);
  assert.equal(first.populations[0].id, createImplicitSceneWebPopulationId("scene"));
  assert.equal(second.populations[0].id, first.populations[0].id);
  assert.equal(first.hasActivePopulations, true);
  assert.equal(Object.isFrozen(first.populations), true);
}));

test("an explicit empty population array remains an intentional no-web Scene", () => withBaseEnvironment(() => {
  const scene = {
    id: "scene",
    getFlag(_namespace, key) {
      return key === "webPopulations"
        ? []
        : undefined;
    }
  };

  const configuration = getSceneWebPopulationConfiguration(scene);
  assert.equal(configuration.populationSource, "scene");
  assert.equal(configuration.hasPersistedPopulations, true);
  assert.equal(configuration.usesWorldPopulationDefaults, false);
  assert.deepEqual(configuration.populations, []);
  assert.equal(configuration.hasActivePopulations, false);
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
        confineRegionTags: ["Crypt", "crypt-*"],
        excludeRegionTags: ["Altar"],
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
  assert.deepEqual(population.confineRegionTags, ["crypt", "crypt-*"]);
  assert.deepEqual(population.excludeRegionTags, ["altar"]);
  assert.equal(population.categoryDensities["wall-corner"], "dense");
  assert.equal(population.categoryDensities["wall-span"], "sparse");
  assert.equal(population.categoryDensities.ground, "disabled");
  assert.equal(population.categoryDensities["web-carpet"], "infested");
  assert.equal(Object.prototype.hasOwnProperty.call(population, "label"), false);
  assert.equal(population.colourProfileId, "arcane-blue");
  assert.equal(population.thicknessMultiplier, 2);
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



test("world defaults affect only new and genuinely unconfigured populations", () => {
  const previousGame =
    globalThis.game;

  const previousCanvas =
    globalThis.canvas;

  const previousHooks =
    globalThis.Hooks;

  const registrations =
    [];

  const values =
    new Map([
      [MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE, "base"],
      [MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS, 3.25],
      [MODULE_SETTING_KEYS.DEFAULT_CORNER_WEB_DENSITY, "sparse"],
      [MODULE_SETTING_KEYS.DEFAULT_SPAN_WEB_DENSITY, "dense"],
      [MODULE_SETTING_KEYS.DEFAULT_GROUND_WEB_DENSITY, "disabled"],
      [MODULE_SETTING_KEYS.DEFAULT_CARPET_WEB_DENSITY, "infested"],
      [MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR, "arcane-blue"],
      [MODULE_SETTING_KEYS.DEFAULT_WEB_THICKNESS, 4]
    ]);

  globalThis.game = {
    release: { generation: 13 },
    version: "13",
    modules: { get: () => ({ active: false }) },
    user: { isGM: true },
    settings: {
      register(moduleId, key, configuration) {
        registrations.push({ moduleId, key, configuration });
      },
      get(_moduleId, key) {
        return values.get(key);
      }
    }
  };

  globalThis.canvas = { scene: null };
  globalThis.Hooks = { on() {}, callAll() {} };
  resetModuleSettingsRegistrationForTests();

  try {
    registerModuleSettings();

    const implicit = getSceneWebPopulationConfiguration({
      id: "unconfigured",
      getFlag: () => undefined
    }).populations[0];

    assert.deepEqual(implicit.categoryDensities, {
      "wall-corner": "sparse",
      "wall-span": "dense",
      ground: "disabled",
      "web-carpet": "infested"
    });
    assert.equal(implicit.colourProfileId, "arcane-blue");
    assert.equal(implicit.thicknessMultiplier, 4);
    assert.equal(implicit.generationOptions.spanWebs.maximumSpanGridUnits, 3.25);

    const apiCreated = normaliseSceneWebPopulations([
      {
        levelId: "base"
      }
    ], {
      levels: [{ id: "base" }],
      generateMissingIds: true
    })[0];

    assert.deepEqual(apiCreated.categoryDensities, implicit.categoryDensities);
    assert.equal(apiCreated.colourProfileId, "arcane-blue");
    assert.equal(apiCreated.thicknessMultiplier, 4);

    const configuredScene = {
      id: "configured",
      getFlag(_namespace, key) {
        return key === "webPopulations"
          ? [{
              id: "saved",
              levelId: "base",
              categoryDensities: {
                "wall-corner": "standard",
                "wall-span": "standard",
                ground: "standard",
                "web-carpet": "standard"
              },
              colourProfileId: "natural-white",
              thicknessMultiplier: 1
            }]
          : undefined;
      }
    };

    const defaultSpanRegistration = registrations.find((entry) =>
      entry.key === MODULE_SETTING_KEYS.DEFAULT_SPAN_WEB_DENSITY
    );
    defaultSpanRegistration.configuration.onChange("disabled");

    const existing = getSceneWebPopulationConfiguration(
      configuredScene
    ).populations[0];

    assert.equal(existing.categoryDensities["wall-span"], "standard");
    assert.equal(existing.colourProfileId, "natural-white");
    assert.equal(existing.thicknessMultiplier, 1);
  } finally {
    resetModuleSettingsRegistrationForTests();
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
    globalThis.Hooks = previousHooks;
  }
});

test("population Region roles reject exact tag reuse", () => {
  assert.throws(() => normaliseSceneWebPopulations([{
    id: "web-region-conflict",
    levelId: "base",
    confineRegionTags: ["crypt"],
    excludeRegionTags: ["CRYPT"],
    categoryDensities: {}
  }], { levels: [{ id: "base" }] }), /cannot be reused/u);
});


