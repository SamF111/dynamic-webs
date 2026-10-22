import test from "node:test";
import assert from "node:assert/strict";

import {
  createSceneConfigHookRegistration
} from "../scripts/ui/sceneConfigHookRegistration.js";

function createBaseSceneConfig() {
  return class SceneConfig {
    static PARTS = { tabs: {}, basics: {}, footer: {} };
    static TABS = { sheet: { tabs: [{ id: "basics" }, { id: "misc" }] } };
    async _preparePartContext(_partId, context) { return context; }
    _attachPartListeners() {}
  };
}

function tabIds(sheetClass) {
  return sheetClass.TABS.sheet.tabs.map((tab) => tab.id);
}

test("Scene sheet subclasses that own TABS or PARTS receive the Dynamic Webs tab and part", () => {
  const originalFoundry = globalThis.foundry;
  const originalConfig = globalThis.CONFIG;
  const originalLog = console.log;
  const SceneConfig = createBaseSceneConfig();

  globalThis.foundry = {
    applications: {
      sheets: { SceneConfig },
      handlebars: { loadTemplates: async () => {} }
    }
  };
  globalThis.CONFIG = { Scene: { sheetClasses: { base: {} } } };
  console.log = () => {};

  try {
    const register = createSceneConfigHookRegistration({
      createTemplateContext: async () => ({}),
      activateControls: () => {},
      registerAdditionalHooks: () => {}
    });

    assert.equal(register(), true);

    // Mirrors PF2e: the system sheet copies the base TABS and is registered
    // before the module's "ready" call.
    class SystemSceneConfig extends SceneConfig {
      static TABS = { sheet: { tabs: [{ id: "basics" }, { id: "misc" }, { id: "system" }] } };
      static PARTS = { tabs: {}, basics: {}, system: {}, footer: {} };
    }
    class InheritingSceneConfig extends SceneConfig {}

    globalThis.CONFIG.Scene.sheetClasses.base = {
      "core.SceneConfig": { cls: SceneConfig },
      "system.SceneConfig": { cls: SystemSceneConfig },
      "other.SceneConfig": { cls: InheritingSceneConfig }
    };

    assert.equal(register(), true);
    assert.deepEqual(tabIds(SystemSceneConfig), ["basics", "misc", "system", "dynamicWebs"]);
    assert.deepEqual(Object.keys(SystemSceneConfig.PARTS), ["tabs", "basics", "system", "dynamicWebs", "footer"]);
    assert.deepEqual(tabIds(SceneConfig), ["basics", "misc", "dynamicWebs"]);
    assert.equal(Object.hasOwn(InheritingSceneConfig, "TABS"), false);
    assert.deepEqual(tabIds(InheritingSceneConfig), ["basics", "misc", "dynamicWebs"]);

    assert.equal(register(), false);
    assert.deepEqual(tabIds(SystemSceneConfig), ["basics", "misc", "system", "dynamicWebs"]);
  } finally {
    globalThis.foundry = originalFoundry;
    globalThis.CONFIG = originalConfig;
    console.log = originalLog;
  }
});
