import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  WEB_LEVEL_PROVIDER_MODES,
  normaliseWebLevelProviderMode
} from "../simulation/webs/webLevelContract.js";

import {
  detectFoundryMajorVersion,
  detectLevelsModuleSupport
} from "../foundry/foundryVersionCompatibility.js";

import {
  reportDiagnostic
} from "../diagnostics/diagnosticReporter.js";

export const MODULE_SETTING_KEYS =
  Object.freeze({
    LEVEL_PROVIDER_MODE:
      "levelProviderMode"
  });

/**
 * Match Ambient Critters: v13 starts at Base Level and lets the GM opt into
 * theripper93's Levels when that provider is available.
 */
export const DEFAULT_WEB_LEVEL_PROVIDER_MODE =
  WEB_LEVEL_PROVIDER_MODES.BASE;

export const LEVEL_PROVIDER_MODE_CHANGED_HOOK =
  `${MODULE_ID}.levelProviderModeChanged`;

export const WEB_LEVEL_PROVIDER_SETTING_LABELS =
  Object.freeze({
    [WEB_LEVEL_PROVIDER_MODES.BASE]:
      "Base Level only",
    [WEB_LEVEL_PROVIDER_MODES.LEVELS_V13]:
      "theripper93's Levels",
    [WEB_LEVEL_PROVIDER_MODES.NATIVE_V14]:
      "Scene elevation"
  });

let settingsRegistered =
  false;

let settingsConfigHookRegistered =
  false;

let cachedWebLevelProviderMode =
  DEFAULT_WEB_LEVEL_PROVIDER_MODE;

/**
 * Register Dynamic Webs' world-level provider setting.
 *
 * The presentation deliberately mirrors Ambient Critters:
 *
 * - Foundry v14+ hides the control and uses native Scene elevation.
 * - Foundry v13 with Levels offers Base Level or theripper93's Levels.
 * - Foundry v13 without Levels shows one disabled Base Level choice.
 *
 * @param {object} [options] - Registration callbacks.
 * @returns {boolean} True when registration occurred.
 */
export function registerModuleSettings({
  onLevelProviderChanged = null
} = {}) {
  if (
    settingsRegistered
  ) {
    return false;
  }

  const settings =
    globalThis.game?.settings;

  if (
    !settings ||
    typeof settings.register !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | Foundry module settings are unavailable.`
    );
  }

  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE,
    {
      name:
        "Level Awareness Provider",
      hint:
        createWebLevelProviderHint(),
      scope:
        "world",
      config:
        shouldShowWebLevelProviderSetting(),
      type:
        String,
      choices:
        createAvailableWebLevelProviderChoices(),
      default:
        DEFAULT_WEB_LEVEL_PROVIDER_MODE,
      onChange:
        (
          value
        ) => {
          cachedWebLevelProviderMode =
            normaliseConfiguredWebLevelProviderMode(
              value
            );

          globalThis.Hooks?.callAll?.(
            LEVEL_PROVIDER_MODE_CHANGED_HOOK,
            cachedWebLevelProviderMode
          );

          console.log(
            `${MODULE_ID} | World level-awareness provider mode changed to ${cachedWebLevelProviderMode}.`
          );

          if (
            typeof onLevelProviderChanged ===
              "function"
          ) {
            return onLevelProviderChanged(
              cachedWebLevelProviderMode
            );
          }

          return undefined;
        }
    }
  );

  registerWebLevelProviderSettingsConfigHook();

  cachedWebLevelProviderMode =
    readInitialWebLevelProviderMode(
      settings
    );

  settingsRegistered =
    true;

  return true;
}

/**
 * Return the cached world-level provider mode.
 *
 * @returns {string} Resolved provider mode for this Foundry setup.
 */
export function getConfiguredWebLevelProviderMode() {
  return cachedWebLevelProviderMode;
}

/**
 * Determine whether the provider row should appear in Game Settings.
 *
 * Foundry v14+ always uses native Scene elevation, matching Ambient Critters.
 * The setting remains registered so stored world data stays readable.
 *
 * @returns {boolean} True when the setting should be visible.
 */
export function shouldShowWebLevelProviderSetting() {
  return detectFoundryMajorVersion() <=
    13;
}

/**
 * Create the provider choices appropriate to the current Foundry setup.
 *
 * @returns {Readonly<object>} Provider choices shown by Foundry.
 */
export function createAvailableWebLevelProviderChoices() {
  const choices = {
    [WEB_LEVEL_PROVIDER_MODES.BASE]:
      WEB_LEVEL_PROVIDER_SETTING_LABELS[
        WEB_LEVEL_PROVIDER_MODES.BASE
      ]
  };

  if (
    detectFoundryMajorVersion() >=
      14
  ) {
    return Object.freeze(
      choices
    );
  }

  if (
    detectLevelsModuleSupport()
  ) {
    choices[
      WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
    ] =
      WEB_LEVEL_PROVIDER_SETTING_LABELS[
        WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
      ];
  }

  return Object.freeze(
    choices
  );
}

/**
 * Create provider-specific help text for Foundry's Settings Configuration.
 *
 * @returns {string} Human-readable setting hint.
 */
export function createWebLevelProviderHint() {
  const foundryMajor =
    detectFoundryMajorVersion();

  if (
    foundryMajor >=
      14
  ) {
    return "Dynamic Webs uses native Scene elevation automatically in Foundry v14 and later. This provider setting is hidden in the v14+ Game Settings UI.";
  }

  if (
    !detectLevelsModuleSupport()
  ) {
    return "This Foundry v13 world has no supported level provider active, so Dynamic Webs uses Base Level only. Install and enable theripper93's Levels module to choose level-aware behaviour.";
  }

  return "Choose whether Dynamic Webs uses Base Level only or theripper93's Levels module.";
}

/**
 * Normalise a stored or changed setting against the active Foundry setup.
 *
 * The hidden AUTO value remains accepted for compatibility with the rejected
 * pre-release implementation and programmatic diagnostics, but it is not
 * presented as a user-selectable setting choice.
 *
 * @param {unknown} value - Candidate setting value.
 * @returns {string} Safe provider mode.
 */
export function normaliseConfiguredWebLevelProviderMode(
  value
) {
  const foundryMajor =
    detectFoundryMajorVersion();

  if (
    foundryMajor >=
      14
  ) {
    return WEB_LEVEL_PROVIDER_MODES.NATIVE_V14;
  }

  let normalisedValue;

  try {
    normalisedValue =
      normaliseWebLevelProviderMode(
        value,
        DEFAULT_WEB_LEVEL_PROVIDER_MODE
      );
  } catch (_error) {
    return DEFAULT_WEB_LEVEL_PROVIDER_MODE;
  }

  if (
    normalisedValue ===
      WEB_LEVEL_PROVIDER_MODES.NATIVE_V14
  ) {
    return DEFAULT_WEB_LEVEL_PROVIDER_MODE;
  }

  if (
    normalisedValue ===
      WEB_LEVEL_PROVIDER_MODES.LEVELS_V13 &&
    !detectLevelsModuleSupport()
  ) {
    return DEFAULT_WEB_LEVEL_PROVIDER_MODE;
  }

  return normalisedValue;
}

/**
 * Reset local registration state for focused tests.
 */
export function resetModuleSettingsRegistrationForTests() {
  settingsRegistered =
    false;

  settingsConfigHookRegistered =
    false;

  cachedWebLevelProviderMode =
    DEFAULT_WEB_LEVEL_PROVIDER_MODE;
}

function readInitialWebLevelProviderMode(
  settings
) {
  try {
    return normaliseConfiguredWebLevelProviderMode(
      settings.get(
        MODULE_ID,
        MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE
      )
    );
  } catch (error) {
    const fallbackValue =
      normaliseConfiguredWebLevelProviderMode(
        DEFAULT_WEB_LEVEL_PROVIDER_MODE
      );

    reportDiagnostic({
      code:
        "config.settings.level-provider-read-failed",
      severity:
        "warn",
      message:
        "Could not initialise the World level-awareness provider setting.",
      context: {
        settingKey:
          MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE,
        fallbackValue
      },
      nextAction:
        "Check the stored World setting value; Dynamic Webs will use the provider appropriate to this Foundry setup.",
      error
    });

    return fallbackValue;
  }
}

/**
 * Disable the single-choice v13 selector when theripper93's Levels is absent.
 *
 * Foundry still owns the form, save/reset behaviour and permissions. This hook
 * only mirrors Ambient Critters' unavailable-provider presentation.
 */
function registerWebLevelProviderSettingsConfigHook() {
  if (
    settingsConfigHookRegistered
  ) {
    return;
  }

  settingsConfigHookRegistered =
    true;

  globalThis.Hooks?.on?.(
    "renderSettingsConfig",
    (
      _application,
      html
    ) => {
      if (
        !shouldShowWebLevelProviderSetting() ||
        Object.keys(
          createAvailableWebLevelProviderChoices()
        ).length >
          1
      ) {
        return;
      }

      const select =
        findSettingsSelect(
          html,
          `${MODULE_ID}.${MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE}`
        );

      if (!select) {
        return;
      }

      select.disabled =
        true;

      select.title =
        "Base Level is the only level-awareness provider available in this Foundry setup.";

      const settingRow =
        typeof select.closest ===
          "function"
          ? select.closest(
              ".form-group"
            ) ??
            select.closest(
              "li"
            ) ??
            select.parentElement
          : null;

      settingRow?.style?.setProperty?.(
        "opacity",
        "0.65"
      );
    }
  );
}

function findSettingsSelect(
  html,
  settingName
) {
  const control =
    findSettingsControl(
      html,
      settingName
    );

  return control?.tagName?.toLowerCase?.() ===
    "select"
    ? control
    : null;
}

function findSettingsControl(
  html,
  settingName
) {
  const selector =
    `[name="${escapeAttributeSelectorValue(settingName)}"]`;

  const root =
    resolveSettingsConfigRoot(
      html
    );

  if (
    root?.querySelector
  ) {
    return root.querySelector(
      selector
    );
  }

  const found =
    typeof html?.find ===
      "function"
      ? html.find(
          selector
        )
      : null;

  return found?.[0] ??
    null;
}

function resolveSettingsConfigRoot(
  html
) {
  if (
    html?.querySelector
  ) {
    return html;
  }

  if (
    html?.[0]?.querySelector
  ) {
    return html[0];
  }

  if (
    html?.element?.querySelector
  ) {
    return html.element;
  }

  return null;
}

function escapeAttributeSelectorValue(
  value
) {
  const backslash =
    String.fromCharCode(
      92
    );

  const quote =
    String.fromCharCode(
      34
    );

  let escapedValue =
    "";

  for (
    const character of
    String(
      value
    )
  ) {
    if (
      character ===
        backslash ||
      character ===
        quote
    ) {
      escapedValue +=
        backslash;
    }

    escapedValue +=
      character;
  }

  return escapedValue;
}
