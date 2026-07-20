import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_WEB_LEVEL_PROVIDER_MODE,
  LEVEL_PROVIDER_MODE_CHANGED_HOOK,
  MODULE_SETTING_KEYS,
  createAvailableWebLevelProviderChoices,
  createWebLevelProviderHint,
  getConfiguredWebLevelProviderMode,
  normaliseConfiguredWebLevelProviderMode,
  registerModuleSettings,
  resetModuleSettingsRegistrationForTests,
  shouldShowWebLevelProviderSetting
} from "../scripts/config/moduleSettings.js";

import {
  WEB_LEVEL_PROVIDER_MODES
} from "../scripts/simulation/webs/webLevelContract.js";

function preserveGlobals() {
  return {
    game:
      globalThis.game,
    canvas:
      globalThis.canvas,
    Hooks:
      globalThis.Hooks,
    Levels:
      globalThis.Levels
  };
}

function restoreGlobals(
  previous
) {
  resetModuleSettingsRegistrationForTests();

  globalThis.game =
    previous.game;

  globalThis.canvas =
    previous.canvas;

  globalThis.Hooks =
    previous.Hooks;

  globalThis.Levels =
    previous.Levels;
}

test(
  "Foundry v13 with Levels mirrors Ambient Critters' two-choice provider setting",
  () => {
    const previous =
      preserveGlobals();

    const registrations =
      [];

    const hookRegistrations =
      [];

    const emittedHooks =
      [];

    let changedMode =
      null;

    globalThis.game = {
      release: {
        generation:
          13
      },
      modules: {
        get(
          id
        ) {
          return id ===
            "levels"
            ? {
                active:
                  true
              }
            : null;
        }
      },
      settings: {
        register(
          moduleId,
          key,
          configuration
        ) {
          registrations.push({
            moduleId,
            key,
            configuration
          });
        },
        get() {
          return WEB_LEVEL_PROVIDER_MODES.BASE;
        }
      }
    };

    globalThis.canvas = {};

    globalThis.Hooks = {
      on(
        event,
        callback
      ) {
        hookRegistrations.push({
          event,
          callback
        });
      },
      callAll(
        event,
        value
      ) {
        emittedHooks.push({
          event,
          value
        });
      }
    };

    resetModuleSettingsRegistrationForTests();

    try {
      assert.equal(
        registerModuleSettings({
          onLevelProviderChanged:
            (
              mode
            ) => {
              changedMode =
                mode;
            }
        }),
        true
      );

      assert.equal(
        registerModuleSettings(),
        false
      );

      assert.equal(
        registrations.length,
        1
      );

      const registration =
        registrations[0];

      assert.equal(
        registration.moduleId,
        "dynamic-webs"
      );

      assert.equal(
        registration.key,
        MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE
      );

      assert.equal(
        registration.configuration.name,
        "Level Awareness Provider"
      );

      assert.equal(
        registration.configuration.scope,
        "world"
      );

      assert.equal(
        registration.configuration.config,
        true
      );

      assert.equal(
        registration.configuration.default,
        DEFAULT_WEB_LEVEL_PROVIDER_MODE
      );

      assert.equal(
        DEFAULT_WEB_LEVEL_PROVIDER_MODE,
        WEB_LEVEL_PROVIDER_MODES.BASE
      );

      assert.deepEqual(
        registration.configuration.choices,
        {
          [WEB_LEVEL_PROVIDER_MODES.BASE]:
            "Base Level only",
          [WEB_LEVEL_PROVIDER_MODES.LEVELS_V13]:
            "theripper93's Levels"
        }
      );

      assert.match(
        registration.configuration.hint,
        /Base Level only or theripper93's Levels/
      );

      assert.equal(
        getConfiguredWebLevelProviderMode(),
        WEB_LEVEL_PROVIDER_MODES.BASE
      );

      registration.configuration.onChange(
        WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
      );

      assert.equal(
        changedMode,
        WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
      );

      assert.equal(
        getConfiguredWebLevelProviderMode(),
        WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
      );

      assert.deepEqual(
        emittedHooks,
        [
          {
            event:
              LEVEL_PROVIDER_MODE_CHANGED_HOOK,
            value:
              WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
          }
        ]
      );

      assert.equal(
        hookRegistrations[0]?.event,
        "renderSettingsConfig"
      );
    } finally {
      restoreGlobals(
        previous
      );
    }
  }
);

test(
  "Foundry v13 without Levels shows one disabled Base Level selector",
  () => {
    const previous =
      preserveGlobals();

    const registrations =
      [];

    let renderSettingsConfig =
      null;

    globalThis.game = {
      release: {
        generation:
          13
      },
      modules: {
        get() {
          return null;
        }
      },
      settings: {
        register(
          moduleId,
          key,
          configuration
        ) {
          registrations.push({
            moduleId,
            key,
            configuration
          });
        },
        get() {
          return WEB_LEVEL_PROVIDER_MODES.BASE;
        }
      }
    };

    globalThis.canvas = {};
    globalThis.Levels =
      undefined;

    globalThis.Hooks = {
      on(
        event,
        callback
      ) {
        if (
          event ===
            "renderSettingsConfig"
        ) {
          renderSettingsConfig =
            callback;
        }
      },
      callAll() {}
    };

    resetModuleSettingsRegistrationForTests();

    try {
      registerModuleSettings();

      const registration =
        registrations[0];

      assert.deepEqual(
        registration.configuration.choices,
        {
          [WEB_LEVEL_PROVIDER_MODES.BASE]:
            "Base Level only"
        }
      );

      assert.match(
        registration.configuration.hint,
        /Install and enable theripper93's Levels/
      );

      const rowStyles =
        new Map();

      const row = {
        style: {
          setProperty(
            name,
            value
          ) {
            rowStyles.set(
              name,
              value
            );
          }
        }
      };

      const select = {
        tagName:
          "SELECT",
        disabled:
          false,
        title:
          "",
        closest(
          selector
        ) {
          return selector ===
            ".form-group"
            ? row
            : null;
        }
      };

      const html = {
        querySelector(
          selector
        ) {
          assert.equal(
            selector,
            '[name="dynamic-webs.levelProviderMode"]'
          );

          return select;
        }
      };

      assert.equal(
        typeof renderSettingsConfig,
        "function"
      );

      renderSettingsConfig(
        {},
        html
      );

      assert.equal(
        select.disabled,
        true
      );

      assert.equal(
        select.title,
        "Base Level is the only level-awareness provider available in this Foundry setup."
      );

      assert.equal(
        rowStyles.get(
          "opacity"
        ),
        "0.65"
      );
    } finally {
      restoreGlobals(
        previous
      );
    }
  }
);

test(
  "Foundry v14 hides the setting and always resolves native Scene elevation",
  () => {
    const previous =
      preserveGlobals();

    const registrations =
      [];

    let changedMode =
      null;

    globalThis.game = {
      release: {
        generation:
          14
      },
      modules: {
        get() {
          return {
            active:
              true
          };
        }
      },
      settings: {
        register(
          moduleId,
          key,
          configuration
        ) {
          registrations.push({
            moduleId,
            key,
            configuration
          });
        },
        get() {
          return WEB_LEVEL_PROVIDER_MODES.BASE;
        }
      }
    };

    globalThis.canvas = {
      levels: {}
    };

    globalThis.Hooks = {
      on() {},
      callAll() {}
    };

    resetModuleSettingsRegistrationForTests();

    try {
      registerModuleSettings({
        onLevelProviderChanged:
          (
            mode
          ) => {
            changedMode =
              mode;
          }
      });

      const registration =
        registrations[0];

      assert.equal(
        registration.configuration.config,
        false
      );

      assert.deepEqual(
        registration.configuration.choices,
        {
          [WEB_LEVEL_PROVIDER_MODES.BASE]:
            "Base Level only"
        }
      );

      assert.match(
        registration.configuration.hint,
        /uses native Scene elevation automatically/
      );

      assert.equal(
        getConfiguredWebLevelProviderMode(),
        WEB_LEVEL_PROVIDER_MODES.NATIVE_V14
      );

      registration.configuration.onChange(
        WEB_LEVEL_PROVIDER_MODES.BASE
      );

      assert.equal(
        changedMode,
        WEB_LEVEL_PROVIDER_MODES.NATIVE_V14
      );

      assert.equal(
        shouldShowWebLevelProviderSetting(),
        false
      );
    } finally {
      restoreGlobals(
        previous
      );
    }
  }
);

test(
  "provider helpers expose only choices valid for the active Foundry setup",
  () => {
    const previous =
      preserveGlobals();

    try {
      globalThis.game = {
        version:
          "13.351",
        modules: {
          get() {
            return null;
          }
        }
      };

      globalThis.canvas = {
        levels: {
          active:
            true
        }
      };

      assert.deepEqual(
        createAvailableWebLevelProviderChoices(),
        {
          [WEB_LEVEL_PROVIDER_MODES.BASE]:
            "Base Level only",
          [WEB_LEVEL_PROVIDER_MODES.LEVELS_V13]:
            "theripper93's Levels"
        }
      );

      assert.equal(
        normaliseConfiguredWebLevelProviderMode(
          WEB_LEVEL_PROVIDER_MODES.NATIVE_V14
        ),
        WEB_LEVEL_PROVIDER_MODES.BASE
      );

      assert.match(
        createWebLevelProviderHint(),
        /theripper93's Levels module/
      );
    } finally {
      restoreGlobals(
        previous
      );
    }
  }
);
