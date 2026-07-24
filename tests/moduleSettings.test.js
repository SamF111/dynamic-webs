import test from "node:test";
import assert from "node:assert/strict";

import {
  CARPET_TEXTURE_CACHE_CLEAR_REQUESTED_HOOK,
  DEFAULT_MAXIMUM_SPAN_GRID_UNITS,
  DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS_CHANGED_HOOK,
  DEFAULT_WEB_LEVEL_PROVIDER_MODE,
  DEFAULT_WEB_POPULATION_SETTINGS_CHANGED_HOOK,
  LEVEL_PROVIDER_MODE_CHANGED_HOOK,
  MAXIMUM_SPAN_GRID_UNITS_CHANGED_HOOK,
  MODULE_SETTINGS_CATEGORY_DEFINITIONS,
  MODULE_SETTING_KEYS,
  applyModuleSettingsCategories,
  createAvailableWebLevelProviderChoices,
  createWebLevelProviderHint,
  getConfiguredDefaultSpanWebBehaviourSettings,
  getConfiguredDefaultWebPopulationSettings,
  getConfiguredMaximumSpanGridUnits,
  getConfiguredWebLevelProviderMode,
  normaliseConfiguredMaximumSpanGridUnits,
  normaliseConfiguredWebLevelProviderMode,
  registerModuleSettings,
  resetModuleSettingsRegistrationForTests,
  shouldShowWebLevelProviderSetting
} from "../scripts/config/moduleSettings.js";

import {
  WEB_LEVEL_PROVIDER_MODES
} from "../scripts/simulation/webs/webLevelContract.js";

const EXPECTED_SETTING_KEYS = Object.freeze([
  MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS,
  MODULE_SETTING_KEYS.DEFAULT_SPAN_VISION_MODE,
  MODULE_SETTING_KEYS.DEFAULT_SPAN_SECRET_DOOR,
  MODULE_SETTING_KEYS.DEFAULT_SPAN_DESTRUCTIBLE,
  MODULE_SETTING_KEYS.DEFAULT_CORNER_WEB_DENSITY,
  MODULE_SETTING_KEYS.DEFAULT_SPAN_WEB_DENSITY,
  MODULE_SETTING_KEYS.DEFAULT_GROUND_WEB_DENSITY,
  MODULE_SETTING_KEYS.DEFAULT_CARPET_WEB_DENSITY,
  MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR,
  MODULE_SETTING_KEYS.DEFAULT_WEB_THICKNESS,
  MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE,
  MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE
]);

function preserveGlobals() {
  return {
    game: globalThis.game,
    canvas: globalThis.canvas,
    Hooks: globalThis.Hooks,
    Levels: globalThis.Levels,
    localStorage: globalThis.localStorage
  };
}

function restoreGlobals(previous) {
  resetModuleSettingsRegistrationForTests();
  globalThis.game = previous.game;
  globalThis.canvas = previous.canvas;
  globalThis.Hooks = previous.Hooks;
  globalThis.Levels = previous.Levels;
  globalThis.localStorage = previous.localStorage;
}

function createSettingsHarness(initialValues = {}) {
  const registrations = [];
  const menus = [];
  const writes = [];
  const values = new Map(Object.entries(initialValues));

  return {
    registrations,
    menus,
    writes,
    values,
    settings: {
      register(moduleId, key, configuration) {
        registrations.push({ moduleId, key, configuration });
        if (!values.has(key)) values.set(key, configuration.default);
      },
      registerMenu(moduleId, key, configuration) {
        menus.push({ moduleId, key, configuration });
      },
      get(moduleId, key) {
        assert.equal(moduleId, "dynamic-webs");
        return values.get(key);
      },
      async set(moduleId, key, value) {
        assert.equal(moduleId, "dynamic-webs");
        values.set(key, value);
        writes.push({ moduleId, key, value });
        return value;
      }
    }
  };
}

function findRegistration(harness, key) {
  return harness.registrations.find((entry) => entry.key === key)?.configuration ?? null;
}

test("v13 registers all settings in Foundry's standard settings page and no submenu", () => {
  const previous = preserveGlobals();
  const harness = createSettingsHarness({
    [MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE]: WEB_LEVEL_PROVIDER_MODES.BASE
  });
  const emitted = [];
  const registeredHooks = [];
  let changedMode = null;

  globalThis.game = {
    release: { generation: 13 },
    modules: {
      get(id) {
        return id === "levels" ? { active: true } : null;
      }
    },
    user: { isGM: true },
    settings: harness.settings
  };
  globalThis.canvas = {};
  globalThis.Hooks = {
    on(event, callback) {
      registeredHooks.push({ event, callback });
      return registeredHooks.length;
    },
    callAll(event, ...args) {
      emitted.push({ event, args });
    }
  };

  try {
    assert.equal(registerModuleSettings({
      onLevelProviderChanged(mode) {
        changedMode = mode;
      }
    }), true);
    assert.equal(registerModuleSettings(), false);

    assert.deepEqual(
      harness.registrations.map((entry) => entry.key),
      EXPECTED_SETTING_KEYS
    );
    assert.equal(harness.registrations.length, 12);
    assert.ok(harness.registrations.every((entry) => entry.moduleId === "dynamic-webs"));
    assert.ok(harness.registrations.every((entry) => entry.configuration.scope === "world"));
    assert.ok(harness.registrations.every((entry) => entry.configuration.config === true));
    assert.equal(harness.menus.length, 0);
    assert.ok(registeredHooks.some((entry) => entry.event === "renderSettingsConfig"));

    const provider = findRegistration(harness, MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE);
    assert.deepEqual(provider.choices, {
      [WEB_LEVEL_PROVIDER_MODES.BASE]: "Base Level only",
      [WEB_LEVEL_PROVIDER_MODES.LEVELS_V13]: "theripper93's Levels"
    });
    assert.equal(provider.default, DEFAULT_WEB_LEVEL_PROVIDER_MODE);
    assert.equal(getConfiguredWebLevelProviderMode(), WEB_LEVEL_PROVIDER_MODES.BASE);

    provider.onChange(WEB_LEVEL_PROVIDER_MODES.LEVELS_V13);
    assert.equal(changedMode, WEB_LEVEL_PROVIDER_MODES.LEVELS_V13);
    assert.equal(getConfiguredWebLevelProviderMode(), WEB_LEVEL_PROVIDER_MODES.LEVELS_V13);
    assert.equal(emitted.at(-1).event, LEVEL_PROVIDER_MODE_CHANGED_HOOK);
  } finally {
    restoreGlobals(previous);
  }
});

test("v14 hides only the obsolete provider selector while keeping the other standard settings visible", () => {
  const previous = preserveGlobals();
  const harness = createSettingsHarness();

  globalThis.game = {
    release: { generation: 14 },
    modules: { get() { return { active: true }; } },
    user: { isGM: true },
    settings: harness.settings
  };
  globalThis.canvas = { levels: {} };
  globalThis.Hooks = { on() {}, callAll() {} };

  try {
    registerModuleSettings();

    assert.equal(
      findRegistration(harness, MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE).config,
      false
    );

    for (const key of EXPECTED_SETTING_KEYS.filter((key) => key !== MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE)) {
      assert.equal(findRegistration(harness, key).config, true);
    }

    assert.equal(shouldShowWebLevelProviderSetting(), false);
    assert.equal(
      normaliseConfiguredWebLevelProviderMode(WEB_LEVEL_PROVIDER_MODES.BASE),
      WEB_LEVEL_PROVIDER_MODES.NATIVE_V14
    );
    assert.match(createWebLevelProviderHint(), /native Scene elevation/);
  } finally {
    restoreGlobals(previous);
  }
});

test("the standard settings form receives five idempotent collapsible groups and remembers their open state", () => {
  const previous = preserveGlobals();

  globalThis.game = {
    release: { generation: 13 },
    modules: { get() { return { active: true }; } },
    user: { isGM: false }
  };
  globalThis.canvas = {};

  const storedValues = new Map([
    [
      "dynamic-webs.settingsGroups",
      JSON.stringify({
        generation: false,
        maintenance: true
      })
    ]
  ]);

  globalThis.localStorage = {
    getItem(key) {
      return storedValues.get(key) ?? null;
    },
    setItem(key, value) {
      storedValues.set(key, value);
    }
  };

  try {
    let settingsContainer = null;
    const controls = new Map();

    function createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        dataset: {},
        style: {},
        children: [],
        className: "",
        textContent: "",
        open: false,
        listeners: new Map(),
        appendChild(child) {
          child.parentNode = this;
          child.parentElement = this;
          this.children.push(child);
          return child;
        },
        addEventListener(event, callback) {
          this.listeners.set(event, callback);
        }
      };
    }

    const documentObject = {
      createElement
    };

    const parent = createElement("section");
    parent.insertBefore = function(child) {
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);

      if (child.dataset?.dynamicWebsSettingsGroups === "true") {
        settingsContainer = child;
      }
    };

    for (const definition of MODULE_SETTINGS_CATEGORY_DEFINITIONS) {
      for (const settingKey of definition.settingKeys) {
        const row = createElement("div");
        row.ownerDocument = documentObject;
        row.parentNode = parent;
        row.parentElement = parent;
        row.style = { setProperty() {} };

        controls.set(`dynamic-webs.${settingKey}`, {
          tagName: settingKey === MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE
            ? "SELECT"
            : "INPUT",
          closest(selector) {
            return selector === ".form-group" ? row : null;
          }
        });
      }
    }

    const root = {
      querySelector(selector) {
        if (selector === "[data-dynamic-webs-settings-groups]") {
          return settingsContainer;
        }

        if (selector === "[data-dynamic-webs-world-maintenance-controls]") {
          return null;
        }

        const match = /^\[name="(.+)"\]$/u.exec(selector);
        return match
          ? controls.get(
              match[1]
                .replaceAll('\\"', '"')
                .replaceAll('\\\\', '\\')
            ) ?? null
          : null;
      }
    };

    assert.equal(applyModuleSettingsCategories(root), 5);
    assert.ok(settingsContainer);
    assert.equal(settingsContainer.children.length, 5);

    const labels = settingsContainer.children.map(
      details => details.children[0].children[0].textContent
    );

    assert.deepEqual(labels, [
      "Generation Defaults",
      "Population Defaults",
      "Appearance Defaults",
      "Level Awareness",
      "Maintenance"
    ]);

    assert.deepEqual(
      settingsContainer.children.map(details => details.open),
      [false, false, false, false, true]
    );

    const generationGroup = settingsContainer.children[0];
    generationGroup.open = true;
    generationGroup.listeners.get("toggle")();

    assert.deepEqual(
      JSON.parse(storedValues.get("dynamic-webs.settingsGroups")),
      {
        generation: true,
        maintenance: true
      }
    );

    assert.equal(applyModuleSettingsCategories(root), 0);
  } finally {
    restoreGlobals(previous);
  }
});

test("v13 without Levels offers only Base Level", () => {
  const previous = preserveGlobals();

  try {
    globalThis.game = {
      release: { generation: 13 },
      modules: { get() { return null; } }
    };
    globalThis.canvas = {};
    globalThis.Levels = undefined;

    assert.equal(shouldShowWebLevelProviderSetting(), true);
    assert.deepEqual(createAvailableWebLevelProviderChoices(), {
      [WEB_LEVEL_PROVIDER_MODES.BASE]: "Base Level only"
    });
    assert.match(createWebLevelProviderHint(), /Install and enable theripper93's Levels/);
    assert.equal(
      normaliseConfiguredWebLevelProviderMode(WEB_LEVEL_PROVIDER_MODES.LEVELS_V13),
      WEB_LEVEL_PROVIDER_MODES.BASE
    );
  } finally {
    restoreGlobals(previous);
  }
});

test("world setting changes update independent cached defaults and emit focused hooks", () => {
  const previous = preserveGlobals();
  const harness = createSettingsHarness();
  const emitted = [];
  const callbackKinds = [];

  globalThis.game = {
    release: { generation: 13 },
    modules: { get() { return null; } },
    user: { isGM: true },
    settings: harness.settings
  };
  globalThis.canvas = {};
  globalThis.Hooks = {
    on() {},
    callAll(event, ...args) {
      emitted.push({ event, args });
    }
  };

  try {
    registerModuleSettings({
      onMaximumSpanWidthChanged() { callbackKinds.push("maximum"); },
      onDefaultWebPopulationSettingsChanged() { callbackKinds.push("population"); },
      onDefaultSpanWebBehaviourSettingsChanged() { callbackKinds.push("span"); }
    });

    findRegistration(harness, MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS).onChange(2.74);
    assert.equal(getConfiguredMaximumSpanGridUnits(), 2.75);

    findRegistration(harness, MODULE_SETTING_KEYS.DEFAULT_SPAN_WEB_DENSITY).onChange("infested");
    findRegistration(harness, MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR).onChange("blood-red");
    findRegistration(harness, MODULE_SETTING_KEYS.DEFAULT_WEB_THICKNESS).onChange(4);

    const population = getConfiguredDefaultWebPopulationSettings();
    assert.equal(population.categoryDensities["wall-span"], "infested");
    assert.equal(population.colourProfileId, "blood-red");
    assert.equal(population.thicknessMultiplier, 4);

    findRegistration(harness, MODULE_SETTING_KEYS.DEFAULT_SPAN_VISION_MODE).onChange("blocked");
    findRegistration(harness, MODULE_SETTING_KEYS.DEFAULT_SPAN_SECRET_DOOR).onChange(true);
    findRegistration(harness, MODULE_SETTING_KEYS.DEFAULT_SPAN_DESTRUCTIBLE).onChange(false);

    assert.deepEqual(getConfiguredDefaultSpanWebBehaviourSettings(), {
      visionMode: "blocked",
      secretDoor: true,
      destructible: false
    });

    assert.deepEqual(callbackKinds, [
      "maximum",
      "population",
      "population",
      "population",
      "span",
      "span",
      "span"
    ]);
    assert.ok(emitted.some((entry) => entry.event === MAXIMUM_SPAN_GRID_UNITS_CHANGED_HOOK));
    assert.ok(emitted.some((entry) => entry.event === DEFAULT_WEB_POPULATION_SETTINGS_CHANGED_HOOK));
    assert.ok(emitted.some((entry) => entry.event === DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS_CHANGED_HOOK));
  } finally {
    restoreGlobals(previous);
  }
});

test("carpet-cache maintenance action broadcasts, calls the client callback and resets", async () => {
  const previous = preserveGlobals();
  const harness = createSettingsHarness();
  const emitted = [];
  let clearCount = 0;

  globalThis.game = {
    release: { generation: 13 },
    modules: { get() { return null; } },
    user: { isGM: true },
    settings: harness.settings
  };
  globalThis.canvas = {};
  globalThis.Hooks = {
    on() {},
    callAll(event) {
      emitted.push(event);
    }
  };

  try {
    registerModuleSettings({
      async onCarpetTextureCacheClearRequested() {
        clearCount += 1;
      }
    });

    const registration = findRegistration(harness, MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE);
    await registration.onChange(true);

    assert.equal(clearCount, 1);
    assert.ok(emitted.includes(CARPET_TEXTURE_CACHE_CLEAR_REQUESTED_HOOK));
    assert.deepEqual(harness.writes.at(-1), {
      moduleId: "dynamic-webs",
      key: MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE,
      value: false
    });
  } finally {
    restoreGlobals(previous);
  }
});

test("maximum span normalisation clamps and snaps to the authored step", () => {
  assert.equal(normaliseConfiguredMaximumSpanGridUnits("not-a-number"), DEFAULT_MAXIMUM_SPAN_GRID_UNITS);
  assert.equal(normaliseConfiguredMaximumSpanGridUnits(0), 0.35);
  assert.equal(normaliseConfiguredMaximumSpanGridUnits(2.73), 2.75);
  assert.equal(normaliseConfiguredMaximumSpanGridUnits(100), 10);
});

