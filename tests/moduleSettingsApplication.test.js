import test from "node:test";
import assert from "node:assert/strict";

import {
  createDynamicWebsSettingsApplicationClass
} from "../scripts/ui/moduleSettingsApplication.js";

function preserveGlobals() {
  return {
    FormApplication: globalThis.FormApplication,
    ui: globalThis.ui
  };
}

function restoreGlobals(previous) {
  globalThis.FormApplication = previous.FormApplication;
  globalThis.ui = previous.ui;
}

test("settings submenu extends FormApplication and delegates context and saves", async () => {
  const previous = preserveGlobals();
  const calls = [];

  class TestFormApplication {
    static get defaultOptions() {
      return {
        classes: ["base-class"]
      };
    }

    activateListeners(html) {
      calls.push(["super-listeners", html]);
    }
  }

  globalThis.FormApplication = TestFormApplication;

  try {
    const SettingsApplication = createDynamicWebsSettingsApplicationClass({
      templatePath: "modules/dynamic-webs/templates/ui/module-settings.hbs",
      createContext() {
        calls.push(["context"]);
        return { grouped: true };
      },
      async saveValues(values) {
        calls.push(["save", values]);
      },
      async clearCarpetTextureCache() {
        calls.push(["clear"]);
      }
    });

    assert.ok(SettingsApplication.prototype instanceof TestFormApplication);
    assert.equal(SettingsApplication.defaultOptions.id, "dynamic-webs-settings");
    assert.equal(SettingsApplication.defaultOptions.template, "modules/dynamic-webs/templates/ui/module-settings.hbs");
    assert.ok(SettingsApplication.defaultOptions.classes.includes("base-class"));
    assert.ok(SettingsApplication.defaultOptions.classes.includes("dynamic-webs-settings"));

    const application = new SettingsApplication();
    assert.deepEqual(await application.getData(), { grouped: true });
    await application._updateObject(null, { maximumSpanGridUnits: 2.5 });

    assert.deepEqual(calls.slice(0, 2), [
      ["context"],
      ["save", { maximumSpanGridUnits: 2.5 }]
    ]);
  } finally {
    restoreGlobals(previous);
  }
});

test("maintenance button clears the cache and reports completion", async () => {
  const previous = preserveGlobals();
  const listeners = new Map();
  const notifications = [];
  let clearCount = 0;

  globalThis.FormApplication = class {
    static get defaultOptions() {
      return {};
    }
    activateListeners() {}
  };
  globalThis.ui = {
    notifications: {
      info(message) {
        notifications.push(message);
      }
    }
  };

  try {
    const SettingsApplication = createDynamicWebsSettingsApplicationClass({
      templatePath: "settings.hbs",
      createContext: () => ({}),
      saveValues: async () => {},
      clearCarpetTextureCache: async () => {
        clearCount += 1;
      }
    });

    const button = {
      disabled: false,
      addEventListener(event, callback) {
        listeners.set(event, callback);
      }
    };

    const root = {
      querySelector(selector) {
        assert.equal(selector, "[data-dynamic-webs-clear-carpet-cache]");
        return button;
      }
    };

    const application = new SettingsApplication();
    application.activateListeners(root);

    const click = listeners.get("click");
    assert.equal(typeof click, "function");

    let prevented = false;
    await click({
      preventDefault() {
        prevented = true;
      },
      currentTarget: button
    });

    assert.equal(prevented, true);
    assert.equal(clearCount, 1);
    assert.equal(button.disabled, false);
    assert.deepEqual(notifications, ["Dynamic Webs carpet texture cache cleared."]);
  } finally {
    restoreGlobals(previous);
  }
});
