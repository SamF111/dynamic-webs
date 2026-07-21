import test from "node:test";
import assert from "node:assert/strict";

import {
  installCooperativeRegionConfigTabs,
  registerRegionConfigHooks
} from "../scripts/ui/regionConfigApplication.js";

test("Region Configuration registers a render-hook fallback without a native part contract", () => {
  const previousFoundry = globalThis.foundry;
  const previousHooks = globalThis.Hooks;
  const previousLoadTemplates = globalThis.loadTemplates;
  const events = [];

  class RegionConfig {
    _onRender() {}
  }

  globalThis.foundry = { applications: { sheets: { RegionConfig } } };
  globalThis.Hooks = {
    on(event) {
      events.push(event);
      return events.length;
    },
    callAll() {}
  };
  globalThis.loadTemplates = async () => [];

  try {
    assert.equal(registerRegionConfigHooks(), true);
    assert.deepEqual(events, ["renderRegionConfig"]);
    assert.equal(typeof RegionConfig.prototype._onRender, "function");
  } finally {
    globalThis.foundry = previousFoundry;
    globalThis.Hooks = previousHooks;
    globalThis.loadTemplates = previousLoadTemplates;
  }
});

test("Region Configuration registers a native Dynamic Webs tag tab", async () => {
  const previousFoundry = globalThis.foundry;
  const previousLoadTemplates = globalThis.loadTemplates;
  const previousHooks = globalThis.Hooks;

  class RegionConfig {
    static PARTS = { main: { template: "main.hbs" }, footer: { template: "footer.hbs" } };
    static TABS = { sheet: { tabs: [{ id: "main", label: "Main" }] } };
    constructor(document) { this.document = document; }
    async _preparePartContext(_partId, context) { return context; }
    _attachPartListeners() {}
  }

  globalThis.foundry = { applications: { sheets: { RegionConfig } } };
  globalThis.loadTemplates = async () => [];
  globalThis.Hooks = { on() { return 1; } };

  try {
    assert.equal(registerRegionConfigHooks(), true);
    assert.equal(RegionConfig.PARTS.dynamicWebs.template, "modules/dynamic-webs/templates/ui/region-config.hbs");
    assert.equal(RegionConfig.TABS.sheet.tabs.at(-1).id, "dynamicWebs");

    const application = new RegionConfig({
      documentName: "Region",
      flags: {
        "dynamic-webs": { regionTags: ["Crypt"] },
        "ambient-critters": { regionTags: ["Area 1"] }
      }
    });
    const context = await application._preparePartContext("dynamicWebs", {});
    assert.equal(context.regionTagsInput, "crypt");
    assert.equal(context.regionTagsValue, '["crypt"]');
  } finally {
    globalThis.foundry = previousFoundry;
    globalThis.loadTemplates = previousLoadTemplates;
    globalThis.Hooks = previousHooks;
  }
});


class MockClassList {
  constructor(...values) {
    this.values = new Set(values);
  }

  add(...values) {
    for (const value of values) this.values.add(value);
  }

  remove(...values) {
    for (const value of values) this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

function createTabElement(tabId, { active = false, page = false } = {}) {
  const attributes = new Map([
    ["data-tab", tabId],
    ["data-group", "sheet"]
  ]);

  if (page) attributes.set("data-application-part", tabId);

  return {
    dataset: {
      tab: tabId,
      group: "sheet",
      ...(page ? { applicationPart: tabId } : {})
    },
    classList: new MockClassList(...(page ? ["tab"] : []), ...(active ? ["active"] : [])),
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    closest(selector) {
      return selector === "[data-tab]" ? this : null;
    }
  };
}

test("cooperative Region tabs switch directly between Ambient Critters and Dynamic Webs", async () => {
  const dynamicControl = createTabElement("dynamicWebs", { active: true });
  const ambientControl = createTabElement("ambientCritters");
  const dynamicPage = createTabElement("dynamicWebs", { active: true, page: true });
  const ambientPage = createTabElement("ambientCritters", { page: true });
  const controls = [dynamicControl, ambientControl];
  const pages = [dynamicPage, ambientPage];
  let clickListener = null;

  const navigation = {
    dataset: { group: "sheet" },
    querySelector(selector) {
      return selector === "[data-tab]" ? controls[0] : null;
    },
    querySelectorAll(selector) {
      return selector === "[data-tab]" ? controls : [];
    },
    contains(value) {
      return controls.includes(value);
    },
    addEventListener(type, listener) {
      if (type === "click") clickListener = listener;
    },
    getAttribute(name) {
      return name === "data-group" ? "sheet" : null;
    }
  };

  const root = {
    matches() {
      return false;
    },
    querySelector(selector) {
      return selector.includes("tabs") || selector.includes("tablist")
        ? navigation
        : null;
    },
    querySelectorAll(selector) {
      if (selector === ".tab[data-tab]" || selector === "[data-application-part].tab") {
        return pages;
      }

      const match = selector.match(/(?:data-tab|data-application-part)="([^"]+)"/u);
      return match ? pages.filter((page) => page.dataset.tab === match[1]) : [];
    }
  };

  assert.equal(installCooperativeRegionConfigTabs(root), true);
  assert.equal(typeof clickListener, "function");

  clickListener({ target: ambientControl });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(ambientControl.classList.contains("active"), true);
  assert.equal(ambientPage.classList.contains("active"), true);
  assert.equal(dynamicControl.classList.contains("active"), false);
  assert.equal(dynamicPage.classList.contains("active"), false);

  clickListener({ target: dynamicControl });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(dynamicControl.classList.contains("active"), true);
  assert.equal(dynamicPage.classList.contains("active"), true);
  assert.equal(ambientControl.classList.contains("active"), false);
  assert.equal(ambientPage.classList.contains("active"), false);
});
