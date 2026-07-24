import test from "node:test";
import assert from "node:assert/strict";

import {
  activateSettingsConfigMaintenanceControls,
  confirmCleanupAction,
  confirmRestoreAllDestroyedSpanWebsAction,
  confirmUninstallAction
} from "../scripts/ui/settingsConfigMaintenanceControls.js";

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.disabled = false;
    this.parentNode = null;
    this.nextSibling = null;
    this.className = "";
    this.textContent = "";
    this.innerHTML = "";
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  appendChild(child) {
    this.append(child);
  }

  addEventListener(event, callback) {
    this.listeners.set(event, callback);
  }
}

function createHarness() {
  const documentObject = {
    createElement(tagName) {
      return new FakeElement(tagName, documentObject);
    }
  };

  const parent = new FakeElement("section", documentObject);
  parent.insertBefore = function(child) {
    child.parentNode = this;
    this.children.push(child);
  };

  const cacheRow = new FakeElement("div", documentObject);
  cacheRow.parentNode = parent;

  const cacheControl = new FakeElement("input", documentObject);
  cacheControl.closest = selector => selector === ".form-group" ? cacheRow : null;

  let inserted = null;
  parent.insertBefore = function(child) {
    inserted = child;
    child.parentNode = this;
    this.children.push(child);
  };
  parent.appendChild = function(child) {
    inserted = child;
    child.parentNode = this;
    this.children.push(child);
  };

  const root = {
    querySelector(selector) {
      if (selector === "[data-dynamic-webs-world-maintenance-controls]") return inserted;
      if (selector === '[name="dynamic-webs.clearCarpetTextureCache"]') return cacheControl;
      return null;
    }
  };

  return {
    root,
    getInserted: () => inserted
  };
}

function preserveGlobals() {
  return {
    foundry: globalThis.foundry,
    game: globalThis.game,
    ui: globalThis.ui
  };
}

function restoreGlobals(previous) {
  globalThis.foundry = previous.foundry;
  globalThis.game = previous.game;
  globalThis.ui = previous.ui;
}

function installDialogHarness({
  confirmResult = true,
  inputResult = { confirmation: "UNINSTALL" }
} = {}) {
  const calls = [];

  globalThis.foundry = {
    applications: {
      api: {
        DialogV2: {
          async confirm(configuration) {
            calls.push({ type: "confirm", configuration });
            return confirmResult;
          },
          async input(configuration) {
            calls.push({ type: "input", configuration });
            return inputResult;
          }
        }
      }
    }
  };

  return calls;
}

test("standard Settings Configuration uses DialogV2 for cleanup and uninstall confirmation", async () => {
  const previous = preserveGlobals();
  const harness = createHarness();
  const actions = [];

  globalThis.game = { user: { isGM: true } };
  globalThis.ui = {
    notifications: {
      info() {},
      warn() {},
      error() {}
    }
  };

  const dialogCalls = installDialogHarness();

  try {
    assert.equal(activateSettingsConfigMaintenanceControls(harness.root, {
      async onRestoreDestroyedSpanWebsRequested() {
        actions.push("restore");
        return { restoredWebCount: 4, restoredSceneCount: 2, failedSceneCount: 0 };
      },
      async onCleanupLingeringWebWallsRequested() {
        actions.push("cleanup");
        return { deletedWallCount: 2, sceneCount: 1, failedSceneCount: 0 };
      },
      async onPrepareUninstallRequested() {
        actions.push("uninstall");
        return { clearedSceneCount: 1, deletedWallCount: 3, failedSceneCount: 0 };
      }
    }), true);

    assert.equal(activateSettingsConfigMaintenanceControls(harness.root), false);

    const group = harness.getInserted();
    assert.equal(group.className, "form-group stacked");
    assert.equal(group.children[0].textContent, "World Maintenance");

    const fields = group.children[1];
    const [restoreButton, cleanupButton, uninstallButton] = fields.children;

    assert.match(restoreButton.innerHTML, /Restore Destroyed Span Webs in All Scenes/u);
    assert.match(cleanupButton.innerHTML, /Destroy All Lingering Web Walls/u);
    assert.match(uninstallButton.innerHTML, /Clear All Webs and Prepare for Uninstall/u);

    await restoreButton.listeners.get("click")({ preventDefault() {} });
    await cleanupButton.listeners.get("click")({ preventDefault() {} });
    await uninstallButton.listeners.get("click")({ preventDefault() {} });

    assert.deepEqual(actions, ["restore", "cleanup", "uninstall"]);
    assert.deepEqual(dialogCalls.map(call => call.type), ["confirm", "confirm", "input"]);
    assert.match(dialogCalls[2].configuration.content, /name="confirmation"/u);
    assert.doesNotMatch(dialogCalls[2].configuration.content, /prompt\(/u);
  } finally {
    restoreGlobals(previous);
  }
});

test("DialogV2 cancellation or incorrect text does not run destructive actions", async () => {
  const previous = preserveGlobals();
  const warnings = [];

  globalThis.game = { user: { isGM: true } };
  globalThis.ui = {
    notifications: {
      info() {},
      warn(message) {
        warnings.push(message);
      },
      error() {}
    }
  };

  try {
    installDialogHarness({
      confirmResult: false,
      inputResult: { confirmation: "uninstall" }
    });

    assert.equal(await confirmRestoreAllDestroyedSpanWebsAction(), false);
    assert.equal(await confirmCleanupAction(), false);
    assert.equal(await confirmUninstallAction(), false);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /did not match UNINSTALL/u);
  } finally {
    restoreGlobals(previous);
  }
});

test("uninstall confirmation accepts FormData-style DialogV2 results", async () => {
  const previous = preserveGlobals();

  globalThis.game = { user: { isGM: true } };
  globalThis.ui = {
    notifications: {
      info() {},
      warn() {},
      error() {}
    }
  };

  try {
    installDialogHarness({
      inputResult: new Map([
        ["confirmation", " UNINSTALL "]
      ])
    });

    assert.equal(await confirmUninstallAction(), true);
  } finally {
    restoreGlobals(previous);
  }
});

test("missing DialogV2 fails safely without using browser prompt or confirm", async () => {
  const previous = preserveGlobals();
  const errors = [];

  globalThis.foundry = undefined;
  globalThis.game = { user: { isGM: true } };
  globalThis.ui = {
    notifications: {
      info() {},
      warn() {},
      error(message) {
        errors.push(message);
      }
    }
  };

  try {
    assert.equal(await confirmRestoreAllDestroyedSpanWebsAction(), false);
    assert.equal(await confirmCleanupAction(), false);
    assert.equal(await confirmUninstallAction(), false);
    assert.equal(errors.length, 3);
    assert.ok(errors.every(message => /DialogV2/u.test(message)));
  } finally {
    restoreGlobals(previous);
  }
});

