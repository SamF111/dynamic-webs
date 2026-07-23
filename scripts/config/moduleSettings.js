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

import {
  DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR,
  DEFAULT_SCENE_WEB_POPULATION_CATEGORY_DENSITIES,
  DEFAULT_SCENE_WEB_POPULATION_COLOUR,
  DEFAULT_SCENE_WEB_POPULATION_THICKNESS
} from "./sceneConfigurationDefaults.js";

import {
  WEB_DENSITY_OPTIONS,
  isSupportedWebDensityId
} from "../simulation/webs/webDensityPresets.js";

import {
  getWebColourOptions,
  isSupportedWebColourProfileId
} from "../simulation/webs/webColourProfiles.js";

import {
  MAXIMUM_SCENE_WEB_THICKNESS,
  MINIMUM_SCENE_WEB_THICKNESS,
  SCENE_WEB_THICKNESS_VALUES,
  normaliseSceneWebThickness
} from "./sceneWebThicknessConfiguration.js";

import {
  DEFAULT_WEB_GENERATION_CONFIGURATION
} from "../simulation/webs/webConfigurationDefaults.js";

import {
  SPAN_WEB_VISION_OPTIONS,
  normaliseSpanWebBehaviourBoolean,
  normaliseSpanWebVisionMode
} from "./spanWebBehaviourContract.js";



export const MODULE_SETTING_KEYS =
  Object.freeze({
    LEVEL_PROVIDER_MODE:
      "levelProviderMode",
    CLEAR_CARPET_TEXTURE_CACHE:
      "clearCarpetTextureCache",
    MAXIMUM_SPAN_GRID_UNITS:
      "maximumSpanGridUnits",
    DEFAULT_CORNER_WEB_DENSITY:
      "defaultCornerWebDensity",
    DEFAULT_SPAN_WEB_DENSITY:
      "defaultSpanWebDensity",
    DEFAULT_GROUND_WEB_DENSITY:
      "defaultGroundWebDensity",
    DEFAULT_CARPET_WEB_DENSITY:
      "defaultCarpetWebDensity",
    DEFAULT_WEB_COLOUR:
      "defaultWebColour",
    DEFAULT_WEB_THICKNESS:
      "defaultWebThickness",
    DEFAULT_SPAN_VISION_MODE:
      "defaultSpanVisionMode",
    DEFAULT_SPAN_SECRET_DOOR:
      "defaultSpanSecretDoor",
    DEFAULT_SPAN_DESTRUCTIBLE:
      "defaultSpanDestructible"
  });

export const DEFAULT_WEB_LEVEL_PROVIDER_MODE =
  WEB_LEVEL_PROVIDER_MODES.BASE;

export const MINIMUM_MAXIMUM_SPAN_GRID_UNITS =
  DEFAULT_WEB_GENERATION_CONFIGURATION.spanWebs.minimumSpanGridUnits;

export const MAXIMUM_MAXIMUM_SPAN_GRID_UNITS =
  10;

export const MAXIMUM_SPAN_GRID_UNITS_STEP =
  0.05;

export const DEFAULT_MAXIMUM_SPAN_GRID_UNITS =
  DEFAULT_WEB_GENERATION_CONFIGURATION.spanWebs.maximumSpanGridUnits;

export const LEVEL_PROVIDER_MODE_CHANGED_HOOK =
  `${MODULE_ID}.levelProviderModeChanged`;

export const CARPET_TEXTURE_CACHE_CLEAR_REQUESTED_HOOK =
  `${MODULE_ID}.carpetTextureCacheClearRequested`;

export const MAXIMUM_SPAN_GRID_UNITS_CHANGED_HOOK =
  `${MODULE_ID}.maximumSpanGridUnitsChanged`;

export const DEFAULT_WEB_POPULATION_SETTINGS_CHANGED_HOOK =
  `${MODULE_ID}.defaultWebPopulationSettingsChanged`;

export const DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS_CHANGED_HOOK =
  `${MODULE_ID}.defaultSpanWebBehaviourSettingsChanged`;

export const WEB_LEVEL_PROVIDER_SETTING_LABELS =
  Object.freeze({
    [WEB_LEVEL_PROVIDER_MODES.BASE]:
      "Base Level only",
    [WEB_LEVEL_PROVIDER_MODES.LEVELS_V13]:
      "theripper93's Levels",
    [WEB_LEVEL_PROVIDER_MODES.NATIVE_V14]:
      "Scene elevation"
  });

export const MODULE_SETTINGS_CATEGORY_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      id: "generation",
      label: "Generation Defaults",
      firstSettingKey: MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS
    }),
    Object.freeze({
      id: "population",
      label: "Population Defaults",
      firstSettingKey: MODULE_SETTING_KEYS.DEFAULT_CORNER_WEB_DENSITY
    }),
    Object.freeze({
      id: "appearance",
      label: "Appearance Defaults",
      firstSettingKey: MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR
    }),
    Object.freeze({
      id: "level-awareness",
      label: "Level Awareness",
      firstSettingKey: MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE
    }),
    Object.freeze({
      id: "maintenance",
      label: "Maintenance",
      firstSettingKey: MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE
    })
  ]);

const DEFAULT_DENSITY_SETTING_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      categoryId:
        "wall-corner",
      key:
        MODULE_SETTING_KEYS.DEFAULT_CORNER_WEB_DENSITY,
      name:
        "Default Corner-Web Density"
    }),
    Object.freeze({
      categoryId:
        "wall-span",
      key:
        MODULE_SETTING_KEYS.DEFAULT_SPAN_WEB_DENSITY,
      name:
        "Default Span-Web Density"
    }),
    Object.freeze({
      categoryId:
        "ground",
      key:
        MODULE_SETTING_KEYS.DEFAULT_GROUND_WEB_DENSITY,
      name:
        "Default Ground-Web Density"
    }),
    Object.freeze({
      categoryId:
        "web-carpet",
      key:
        MODULE_SETTING_KEYS.DEFAULT_CARPET_WEB_DENSITY,
      name:
        "Default Carpet-Web Density"
    })
  ]);

const AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS =
  createFrozenDefaultWebPopulationSettings({
    categoryDensities:
      DEFAULT_SCENE_WEB_POPULATION_CATEGORY_DENSITIES,
    colourProfileId:
      DEFAULT_SCENE_WEB_POPULATION_COLOUR,
    thicknessMultiplier:
      DEFAULT_SCENE_WEB_POPULATION_THICKNESS
  });

const AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS =
  createFrozenDefaultSpanWebBehaviourSettings(
    DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR
  );

let settingsRegistered =
  false;

let settingsConfigHookRegistered =
  false;

let cachedWebLevelProviderMode =
  DEFAULT_WEB_LEVEL_PROVIDER_MODE;

let cachedMaximumSpanGridUnits =
  DEFAULT_MAXIMUM_SPAN_GRID_UNITS;

let cachedDefaultWebPopulationSettings =
  AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS;

let cachedDefaultSpanWebBehaviourSettings =
  AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS;

/** Register GM-facing world settings in Foundry's standard Settings Configuration. */
export function registerModuleSettings({
  onLevelProviderChanged = null,
  onCarpetTextureCacheClearRequested = null,
  onMaximumSpanWidthChanged = null,
  onDefaultWebPopulationSettingsChanged = null,
  onDefaultSpanWebBehaviourSettingsChanged = null
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

  registerMaximumSpanWidthSetting(
    settings,
    onMaximumSpanWidthChanged
  );

  registerDefaultSpanBehaviourSettings(
    settings,
    onDefaultSpanWebBehaviourSettingsChanged
  );

  registerDefaultPopulationSettings(
    settings,
    onDefaultWebPopulationSettingsChanged
  );

  registerLevelProviderSetting(
    settings,
    onLevelProviderChanged
  );

  registerCarpetTextureCacheSetting(
    settings,
    onCarpetTextureCacheClearRequested
  );

  registerDefaultSettingsCategorisationHook();

  cachedWebLevelProviderMode =
    readInitialWebLevelProviderMode(
      settings
    );

  cachedMaximumSpanGridUnits =
    readInitialMaximumSpanGridUnits(
      settings
    );

  cachedDefaultWebPopulationSettings =
    readInitialDefaultWebPopulationSettings(
      settings
    );

  cachedDefaultSpanWebBehaviourSettings =
    readInitialDefaultSpanWebBehaviourSettings(
      settings
    );

  settingsRegistered =
    true;

  return true;
}

export function getConfiguredWebLevelProviderMode() {
  return cachedWebLevelProviderMode;
}

export function getConfiguredMaximumSpanGridUnits() {
  return cachedMaximumSpanGridUnits;
}

export function getConfiguredDefaultWebPopulationSettings() {
  return cachedDefaultWebPopulationSettings;
}

export function getConfiguredDefaultSpanWebBehaviourSettings() {
  return cachedDefaultSpanWebBehaviourSettings;
}

export function shouldShowWebLevelProviderSetting() {
  return detectFoundryMajorVersion() <=
    13;
}

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

export function createWebLevelProviderHint() {
  const foundryMajor =
    detectFoundryMajorVersion();

  if (
    foundryMajor >=
      14
  ) {
    return "Dynamic Webs uses native Scene elevation automatically in Foundry v14 and later.";
  }

  if (
    !detectLevelsModuleSupport()
  ) {
    return "This Foundry v13 world has no supported level provider active, so Dynamic Webs uses Base Level only. Install and enable theripper93's Levels module to choose level-aware behaviour.";
  }

  return "Choose whether Dynamic Webs uses Base Level only or theripper93's Levels module.";
}

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

export function normaliseConfiguredMaximumSpanGridUnits(
  value
) {
  const numericValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return DEFAULT_MAXIMUM_SPAN_GRID_UNITS;
  }

  const clamped =
    Math.max(
      MINIMUM_MAXIMUM_SPAN_GRID_UNITS,
      Math.min(
        MAXIMUM_MAXIMUM_SPAN_GRID_UNITS,
        numericValue
      )
    );

  const stepped =
    Math.round(
      clamped /
      MAXIMUM_SPAN_GRID_UNITS_STEP
    ) *
    MAXIMUM_SPAN_GRID_UNITS_STEP;

  return Number(
    stepped.toFixed(
      2
    )
  );
}

export function resetModuleSettingsRegistrationForTests() {
  settingsRegistered =
    false;

  settingsConfigHookRegistered =
    false;

  cachedWebLevelProviderMode =
    DEFAULT_WEB_LEVEL_PROVIDER_MODE;

  cachedMaximumSpanGridUnits =
    DEFAULT_MAXIMUM_SPAN_GRID_UNITS;

  cachedDefaultWebPopulationSettings =
    AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS;

  cachedDefaultSpanWebBehaviourSettings =
    AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS;
}

/**
 * Insert readable headings into Foundry's standard module-settings form.
 *
 * This keeps Foundry's own SettingsConfig application, form submission,
 * permissions and reset behaviour. Dynamic Webs only adds non-interactive
 * headings before the first setting in each group.
 */
export function applyModuleSettingsCategories(
  html
) {
  const root =
    resolveSettingsConfigRoot(
      html
    );

  if (!root) {
    return 0;
  }

  let insertedCount =
    0;

  for (
    const definition of
    MODULE_SETTINGS_CATEGORY_DEFINITIONS
  ) {
    const control =
      findSettingsControl(
        root,
        `${MODULE_ID}.${definition.firstSettingKey}`
      );

    if (!control) {
      continue;
    }

    const row =
      resolveSettingsRow(
        control
      );

    const parent =
      row?.parentNode ??
      null;

    if (
      !row ||
      !parent ||
      parent.querySelector?.(
        `[data-dynamic-webs-settings-category="${definition.id}"]`
      )
    ) {
      continue;
    }

    const documentObject =
      row.ownerDocument ??
      globalThis.document;

    if (
      typeof documentObject?.createElement !==
        "function"
    ) {
      continue;
    }

    const heading =
      documentObject.createElement(
        "h3"
      );

    heading.textContent =
      definition.label;

    heading.className =
      "dynamic-webs-settings-category";

    heading.dataset.dynamicWebsSettingsCategory =
      definition.id;

    parent.insertBefore(
      heading,
      row
    );

    insertedCount +=
      1;
  }

  disableUnavailableLevelProviderControl(
    root
  );

  return insertedCount;
}

function registerDefaultSettingsCategorisationHook() {
  if (
    settingsConfigHookRegistered
  ) {
    return false;
  }

  const hooks =
    globalThis.Hooks;

  if (
    typeof hooks?.on !==
      "function"
  ) {
    return false;
  }

  hooks.on(
    "renderSettingsConfig",
    (
      _application,
      html
    ) => {
      applyModuleSettingsCategories(
        html
      );
    }
  );

  settingsConfigHookRegistered =
    true;

  return true;
}

function disableUnavailableLevelProviderControl(
  root
) {
  if (
    !shouldShowWebLevelProviderSetting() ||
    Object.keys(
      createAvailableWebLevelProviderChoices()
    ).length >
      1
  ) {
    return false;
  }

  const control =
    findSettingsControl(
      root,
      `${MODULE_ID}.${MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE}`
    );

  if (!control) {
    return false;
  }

  control.disabled =
    true;

  control.title =
    "Base Level is the only level-awareness provider available in this Foundry setup.";

  resolveSettingsRow(
    control
  )?.style?.setProperty?.(
    "opacity",
    "0.65"
  );

  return true;
}

function findSettingsControl(
  root,
  settingName
) {
  const selector =
    `[name="${escapeAttributeSelectorValue(settingName)}"]`;

  if (
    typeof root?.querySelector ===
      "function"
  ) {
    return root.querySelector(
      selector
    );
  }

  const found =
    typeof root?.find ===
      "function"
      ? root.find(
          selector
        )
      : null;

  return found?.[0] ??
    null;
}

function resolveSettingsRow(
  control
) {
  return control?.closest?.(
    ".form-group"
  ) ??
    control?.closest?.(
      "li"
    ) ??
    control?.parentElement ??
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
  return String(
    value
  ).replace(
    /[\\"]/gu,
    character =>
      `\\${character}`
  );
}

function registerLevelProviderSetting(
  settings,
  onLevelProviderChanged
) {
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
        value => {
          cachedWebLevelProviderMode =
            normaliseConfiguredWebLevelProviderMode(
              value
            );

          globalThis.Hooks?.callAll?.(
            LEVEL_PROVIDER_MODE_CHANGED_HOOK,
            cachedWebLevelProviderMode
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
}

function registerMaximumSpanWidthSetting(
  settings,
  onMaximumSpanWidthChanged
) {
  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS,
    {
      name:
        "Maximum Span Width",
      hint:
        "World default maximum wall-to-wall passage width, measured in Scene grid units. A Scene-specific override may replace this value.",
      scope:
        "world",
      config:
        true,
      type:
        Number,
      range: {
        min:
          MINIMUM_MAXIMUM_SPAN_GRID_UNITS,
        max:
          MAXIMUM_MAXIMUM_SPAN_GRID_UNITS,
        step:
          MAXIMUM_SPAN_GRID_UNITS_STEP
      },
      default:
        DEFAULT_MAXIMUM_SPAN_GRID_UNITS,
      onChange:
        value => {
          cachedMaximumSpanGridUnits =
            normaliseConfiguredMaximumSpanGridUnits(
              value
            );

          globalThis.Hooks?.callAll?.(
            MAXIMUM_SPAN_GRID_UNITS_CHANGED_HOOK,
            cachedMaximumSpanGridUnits
          );

          if (
            typeof onMaximumSpanWidthChanged ===
              "function"
          ) {
            return onMaximumSpanWidthChanged(
              cachedMaximumSpanGridUnits
            );
          }

          return undefined;
        }
    }
  );
}

function registerDefaultPopulationSettings(
  settings,
  onDefaultWebPopulationSettingsChanged
) {
  const densityChoices =
    Object.freeze(
      Object.fromEntries(
        WEB_DENSITY_OPTIONS.map(
          option => [
            option.id,
            option.label
          ]
        )
      )
    );

  for (
    const definition of
    DEFAULT_DENSITY_SETTING_DEFINITIONS
  ) {
    settings.register(
      MODULE_ID,
      definition.key,
      {
        name:
          definition.name,
        hint:
          "Used only for new or genuinely unconfigured web populations. Existing Scene populations are not changed.",
        scope:
          "world",
        config:
          true,
        type:
          String,
        choices:
          densityChoices,
        default:
          AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS.categoryDensities[
            definition.categoryId
          ],
        onChange:
          value =>
            handleDefaultWebPopulationSettingChanged({
              settingKey:
                definition.key,
              categoryId:
                definition.categoryId,
              value,
              onDefaultWebPopulationSettingsChanged
            })
      }
    );
  }

  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR,
    {
      name:
        "Default Web Colour",
      hint:
        "Used only for new or genuinely unconfigured web populations. Existing Scene populations are not changed.",
      scope:
        "world",
      config:
        true,
      type:
        String,
      choices:
        Object.freeze(
          Object.fromEntries(
            getWebColourOptions().map(
              option => [
                option.id,
                option.label
              ]
            )
          )
        ),
      default:
        AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS.colourProfileId,
      onChange:
        value =>
          handleDefaultWebPopulationSettingChanged({
            settingKey:
              MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR,
            colourProfileId:
              value,
            onDefaultWebPopulationSettingsChanged
          })
    }
  );

  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.DEFAULT_WEB_THICKNESS,
    {
      name:
        "Default Web Thickness",
      hint:
        "Used only for new or genuinely unconfigured web populations. Existing Scene populations are not changed.",
      scope:
        "world",
      config:
        true,
      type:
        Number,
      choices:
        Object.freeze(
          Object.fromEntries(
            SCENE_WEB_THICKNESS_VALUES.map(
              value => [
                String(
                  value
                ),
                `${value}×`
              ]
            )
          )
        ),
      default:
        AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS.thicknessMultiplier,
      onChange:
        value =>
          handleDefaultWebPopulationSettingChanged({
            settingKey:
              MODULE_SETTING_KEYS.DEFAULT_WEB_THICKNESS,
            thicknessMultiplier:
              value,
            onDefaultWebPopulationSettingsChanged
          })
    }
  );
}

function registerDefaultSpanBehaviourSettings(
  settings,
  onDefaultSpanWebBehaviourSettingsChanged
) {
  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.DEFAULT_SPAN_VISION_MODE,
    {
      name:
        "Default Span Vision",
      hint:
        "Default intact wall-span vision mode for Scenes without explicit span behaviour.",
      scope:
        "world",
      config:
        true,
      type:
        String,
      choices:
        Object.freeze(
          Object.fromEntries(
            SPAN_WEB_VISION_OPTIONS.map(
              option => [
                option.id,
                option.label
              ]
            )
          )
        ),
      default:
        AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS.visionMode,
      onChange:
        value =>
          handleDefaultSpanWebBehaviourSettingChanged({
            settingKey:
              MODULE_SETTING_KEYS.DEFAULT_SPAN_VISION_MODE,
            visionMode:
              value,
            onDefaultSpanWebBehaviourSettingsChanged
          })
    }
  );

  for (
    const definition of
    [
      {
        key:
          MODULE_SETTING_KEYS.DEFAULT_SPAN_SECRET_DOOR,
        name:
          "Default Span Secret Door",
        property:
          "secretDoor"
      },
      {
        key:
          MODULE_SETTING_KEYS.DEFAULT_SPAN_DESTRUCTIBLE,
        name:
          "Default Span Destructibility",
        property:
          "destructible"
      }
    ]
  ) {
    settings.register(
      MODULE_ID,
      definition.key,
      {
        name:
          definition.name,
        hint:
          "Default intact wall-span behaviour for Scenes without explicit span behaviour.",
        scope:
          "world",
        config:
          true,
        type:
          Boolean,
        default:
          AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS[
            definition.property
          ],
        onChange:
          value =>
            handleDefaultSpanWebBehaviourSettingChanged({
              settingKey:
                definition.key,
              [definition.property]:
                value,
              onDefaultSpanWebBehaviourSettingsChanged
            })
      }
    );
  }
}

function registerCarpetTextureCacheSetting(
  settings,
  onCarpetTextureCacheClearRequested
) {
  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE,
    {
      name:
        "Clear Web Carpet Texture Cache",
      hint:
        "Check and save to clear Dynamic Webs' client-local bundled carpet texture request cache on every connected client. Scene data and generated geometry are unchanged.",
      scope:
        "world",
      config:
        true,
      type:
        Boolean,
      default:
        false,
      onChange:
        async value => {
          if (
            value !==
              true
          ) {
            return;
          }

          globalThis.Hooks?.callAll?.(
            CARPET_TEXTURE_CACHE_CLEAR_REQUESTED_HOOK
          );

          if (
            typeof onCarpetTextureCacheClearRequested ===
              "function"
          ) {
            await onCarpetTextureCacheClearRequested();
          }

          if (
            globalThis.game?.user?.isGM ===
              true &&
            typeof settings.set ===
              "function"
          ) {
            await settings.set(
              MODULE_ID,
              MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE,
              false
            );
          }
        }
    }
  );
}

function handleDefaultWebPopulationSettingChanged({
  settingKey,
  categoryId = null,
  value = undefined,
  colourProfileId = undefined,
  thicknessMultiplier = undefined,
  onDefaultWebPopulationSettingsChanged = null
}) {
  const current =
    cachedDefaultWebPopulationSettings;

  const categoryDensities =
    {
      ...current.categoryDensities
    };

  if (
    categoryId
  ) {
    categoryDensities[
      categoryId
    ] =
      normaliseDefaultDensity(
        value,
        current.categoryDensities[
          categoryId
        ]
      );
  }

  cachedDefaultWebPopulationSettings =
    createFrozenDefaultWebPopulationSettings({
      categoryDensities,
      colourProfileId:
        colourProfileId ===
          undefined
          ? current.colourProfileId
          : normaliseDefaultColour(
              colourProfileId,
              current.colourProfileId
            ),
      thicknessMultiplier:
        thicknessMultiplier ===
          undefined
          ? current.thicknessMultiplier
          : normaliseDefaultThickness(
              thicknessMultiplier,
              current.thicknessMultiplier
            )
    });

  const metadata =
    Object.freeze({
      settingKey
    });

  globalThis.Hooks?.callAll?.(
    DEFAULT_WEB_POPULATION_SETTINGS_CHANGED_HOOK,
    cachedDefaultWebPopulationSettings,
    metadata
  );

  if (
    typeof onDefaultWebPopulationSettingsChanged ===
      "function"
  ) {
    return onDefaultWebPopulationSettingsChanged(
      cachedDefaultWebPopulationSettings,
      metadata
    );
  }

  return undefined;
}

function handleDefaultSpanWebBehaviourSettingChanged({
  settingKey,
  visionMode = undefined,
  secretDoor = undefined,
  destructible = undefined,
  onDefaultSpanWebBehaviourSettingsChanged = null
}) {
  const current =
    cachedDefaultSpanWebBehaviourSettings;

  cachedDefaultSpanWebBehaviourSettings =
    createFrozenDefaultSpanWebBehaviourSettings({
      visionMode:
        visionMode ===
          undefined
          ? current.visionMode
          : normaliseSpanWebVisionMode(
              visionMode,
              current.visionMode
            ),
      secretDoor:
        secretDoor ===
          undefined
          ? current.secretDoor
          : normaliseSpanWebBehaviourBoolean(
              secretDoor,
              current.secretDoor
            ),
      destructible:
        destructible ===
          undefined
          ? current.destructible
          : normaliseSpanWebBehaviourBoolean(
              destructible,
              current.destructible
            )
    });

  const metadata =
    Object.freeze({
      settingKey
    });

  globalThis.Hooks?.callAll?.(
    DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS_CHANGED_HOOK,
    cachedDefaultSpanWebBehaviourSettings,
    metadata
  );

  if (
    typeof onDefaultSpanWebBehaviourSettingsChanged ===
      "function"
  ) {
    return onDefaultSpanWebBehaviourSettingsChanged(
      cachedDefaultSpanWebBehaviourSettings,
      metadata
    );
  }

  return undefined;
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
        fallbackValue:
          DEFAULT_WEB_LEVEL_PROVIDER_MODE
      },
      nextAction:
        "Check the stored World setting value.",
      error
    });

    return normaliseConfiguredWebLevelProviderMode(
      DEFAULT_WEB_LEVEL_PROVIDER_MODE
    );
  }
}

function readInitialMaximumSpanGridUnits(
  settings
) {
  return normaliseConfiguredMaximumSpanGridUnits(
    readSettingSafely(
      settings,
      MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS
    )
  );
}

function readInitialDefaultWebPopulationSettings(
  settings
) {
  const categoryDensities =
    {};

  for (
    const definition of
    DEFAULT_DENSITY_SETTING_DEFINITIONS
  ) {
    categoryDensities[
      definition.categoryId
    ] =
      normaliseDefaultDensity(
        readSettingSafely(
          settings,
          definition.key
        ),
        AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS.categoryDensities[
          definition.categoryId
        ]
      );
  }

  return createFrozenDefaultWebPopulationSettings({
    categoryDensities,
    colourProfileId:
      normaliseDefaultColour(
        readSettingSafely(
          settings,
          MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR
        ),
        AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS.colourProfileId
      ),
    thicknessMultiplier:
      normaliseDefaultThickness(
        readSettingSafely(
          settings,
          MODULE_SETTING_KEYS.DEFAULT_WEB_THICKNESS
        ),
        AUTHORED_DEFAULT_WEB_POPULATION_SETTINGS.thicknessMultiplier
      )
  });
}

function readInitialDefaultSpanWebBehaviourSettings(
  settings
) {
  return createFrozenDefaultSpanWebBehaviourSettings({
    visionMode:
      readSettingSafely(
        settings,
        MODULE_SETTING_KEYS.DEFAULT_SPAN_VISION_MODE
      ) ??
      AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS.visionMode,
    secretDoor:
      readSettingSafely(
        settings,
        MODULE_SETTING_KEYS.DEFAULT_SPAN_SECRET_DOOR
      ) ??
      AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS.secretDoor,
    destructible:
      readSettingSafely(
        settings,
        MODULE_SETTING_KEYS.DEFAULT_SPAN_DESTRUCTIBLE
      ) ??
      AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS.destructible
  });
}

function readSettingSafely(
  settings,
  key
) {
  try {
    return settings?.get?.(
      MODULE_ID,
      key
    );
  } catch (_error) {
    return undefined;
  }
}

function normaliseDefaultDensity(
  value,
  fallback
) {
  const candidate =
    typeof value ===
      "string"
      ? value.trim()
      : "";

  return isSupportedWebDensityId(
    candidate
  )
    ? candidate
    : fallback;
}

function normaliseDefaultColour(
  value,
  fallback
) {
  const candidate =
    typeof value ===
      "string"
      ? value.trim()
      : "";

  return isSupportedWebColourProfileId(
    candidate
  )
    ? candidate
    : fallback;
}

function normaliseDefaultThickness(
  value,
  fallback
) {
  try {
    const normalised =
      normaliseSceneWebThickness(
        value
      );

    return Math.max(
      MINIMUM_SCENE_WEB_THICKNESS,
      Math.min(
        MAXIMUM_SCENE_WEB_THICKNESS,
        normalised
      )
    );
  } catch (_error) {
    return fallback;
  }
}

function createFrozenDefaultWebPopulationSettings({
  categoryDensities,
  colourProfileId,
  thicknessMultiplier
}) {
  return Object.freeze({
    categoryDensities:
      Object.freeze({
        "wall-corner":
          categoryDensities[
            "wall-corner"
          ],
        "wall-span":
          categoryDensities[
            "wall-span"
          ],
        ground:
          categoryDensities.ground,
        "web-carpet":
          categoryDensities[
            "web-carpet"
          ]
      }),
    colourProfileId,
    thicknessMultiplier
  });
}

function createFrozenDefaultSpanWebBehaviourSettings(
  value
) {
  const source =
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
      ? value
      : AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS ??
        DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR;

  let visionMode;
  let secretDoor;
  let destructible;

  try {
    visionMode =
      normaliseSpanWebVisionMode(
        source.visionMode,
        DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.visionMode
      );
  } catch (_error) {
    visionMode =
      DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.visionMode;
  }

  try {
    secretDoor =
      normaliseSpanWebBehaviourBoolean(
        source.secretDoor,
        DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.secretDoor
      );
  } catch (_error) {
    secretDoor =
      DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.secretDoor;
  }

  try {
    destructible =
      normaliseSpanWebBehaviourBoolean(
        source.destructible,
        DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.destructible
      );
  } catch (_error) {
    destructible =
      DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.destructible;
  }

  return Object.freeze({
    visionMode,
    secretDoor,
    destructible
  });
}
