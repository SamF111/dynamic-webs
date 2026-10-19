// D:/FoundryVTT/Data/modules/dynamic-webs/scripts/config/moduleSettings.js
// Purpose: Register standalone module settings and organize their optional UI controls.
import {activateOptionalCompanionLink} from "../ui/optionalCompanion.js";
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
  SPAN_WEB_CROSSING_ACTIONS,
  SPAN_WEB_CROSSING_ACTION_OPTIONS,
  SPAN_WEB_VISION_OPTIONS,
  normaliseSpanWebBehaviourBoolean,
  normaliseSpanWebCrossingAction,
  normaliseSpanWebVisionMode
} from "./spanWebBehaviourContract.js";

import {
  SETTINGS_CONFIG_MAINTENANCE_CONTROLS_SELECTOR,
  activateSettingsConfigMaintenanceControls
} from "../ui/settingsConfigMaintenanceControls.js";



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
    DEFAULT_SPAN_CROSSING_ACTION:
      "defaultSpanCrossingAction",
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

const SETTINGS_GROUP_STATE_STORAGE_KEY =
  `${MODULE_ID}.settingsGroups`;

const SETTINGS_GROUPS_SELECTOR =
  "[data-dynamic-webs-settings-groups]";

export const MODULE_SETTINGS_CATEGORY_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      id:
        "generation",
      label:
        "Generation Defaults",
      description:
        "Span eligibility, vision, movement blocking, and crossing behaviour.",
      open:
        true,
      firstSettingKey:
        MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS,
      settingKeys:
        Object.freeze([
          MODULE_SETTING_KEYS.MAXIMUM_SPAN_GRID_UNITS,
          MODULE_SETTING_KEYS.DEFAULT_SPAN_VISION_MODE,
          MODULE_SETTING_KEYS.DEFAULT_SPAN_SECRET_DOOR,
          MODULE_SETTING_KEYS.DEFAULT_SPAN_CROSSING_ACTION
        ])
    }),
    Object.freeze({
      id:
        "population",
      label:
        "Population Defaults",
      description:
        "Default density for each generated web category.",
      open:
        false,
      firstSettingKey:
        MODULE_SETTING_KEYS.DEFAULT_CORNER_WEB_DENSITY,
      settingKeys:
        Object.freeze([
          MODULE_SETTING_KEYS.DEFAULT_CORNER_WEB_DENSITY,
          MODULE_SETTING_KEYS.DEFAULT_SPAN_WEB_DENSITY,
          MODULE_SETTING_KEYS.DEFAULT_GROUND_WEB_DENSITY,
          MODULE_SETTING_KEYS.DEFAULT_CARPET_WEB_DENSITY
        ])
    }),
    Object.freeze({
      id:
        "appearance",
      label:
        "Appearance Defaults",
      description:
        "Default web colour and visible thickness.",
      open:
        false,
      firstSettingKey:
        MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR,
      settingKeys:
        Object.freeze([
          MODULE_SETTING_KEYS.DEFAULT_WEB_COLOUR,
          MODULE_SETTING_KEYS.DEFAULT_WEB_THICKNESS
        ])
    }),
    Object.freeze({
      id:
        "level-awareness",
      label:
        "Level Awareness",
      description:
        "Foundry v13 level-provider selection.",
      open:
        false,
      firstSettingKey:
        MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE,
      settingKeys:
        Object.freeze([
          MODULE_SETTING_KEYS.LEVEL_PROVIDER_MODE
        ])
    }),
    Object.freeze({
      id:
        "maintenance",
      label:
        "Maintenance",
      description:
        "Texture caches, destroyed-span restoration, generated-wall clean-up, and uninstall preparation.",
      open:
        false,
      firstSettingKey:
        MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE,
      settingKeys:
        Object.freeze([
          MODULE_SETTING_KEYS.CLEAR_CARPET_TEXTURE_CACHE
        ]),
      includesMaintenanceControls:
        true
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
  onDefaultSpanWebBehaviourSettingsChanged = null,
  onRestoreDestroyedSpanWebsRequested = null,
  onCleanupLingeringWebWallsRequested = null,
  onPrepareUninstallRequested = null
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

  registerDefaultSettingsCategorisationHook({
    onRestoreDestroyedSpanWebsRequested,
    onCleanupLingeringWebWallsRequested,
    onPrepareUninstallRequested
  });

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
 * Group Dynamic Webs settings into Ambient Critters-style collapsible sections.
 *
 * Foundry still owns form submission, permissions, reset behaviour, and setting
 * controls. Dynamic Webs only moves its existing rows into labelled details
 * blocks and adds its immediate maintenance controls to the final section.
 *
 * @param {object} html - Rendered SettingsConfig HTML.
 * @param {object} maintenanceActions - Immediate maintenance callbacks.
 * @returns {number} Number of groups created.
 */
export function applyModuleSettingsCategories(
  html,
  maintenanceActions = {}
) {
  const root =
    resolveSettingsConfigRoot(
      html
    );

  if (!root) {
    return 0;
  }

  activateSettingsConfigMaintenanceControls(
    root,
    maintenanceActions
  );

  if (
    root.querySelector?.(
      SETTINGS_GROUPS_SELECTOR
    )
  ) {
    disableUnavailableLevelProviderControl(
      root
    );

    return 0;
  }

  const groups =
    createModuleSettingsGroups(
      root
    );

  if (
    groups.length ===
      0
  ) {
    disableUnavailableLevelProviderControl(
      root
    );

    return 0;
  }

  const firstRow =
    groups[0].rows[0];

  const parent =
    firstRow?.parentElement ??
    firstRow?.parentNode ??
    null;

  const documentReference =
    firstRow?.ownerDocument ??
    globalThis.document;

  if (
    !parent ||
    typeof documentReference?.createElement !==
      "function"
  ) {
    disableUnavailableLevelProviderControl(
      root
    );

    return 0;
  }

  const groupState =
    readModuleSettingsGroupState();

  const container =
    documentReference.createElement(
      "section"
    );

  container.dataset.dynamicWebsSettingsGroups =
    "true";

  container.className =
    "dynamic-webs-settings-groups";

  applySettingsContainerStyles(
    container
  );

  parent.insertBefore(
    container,
    firstRow
  );

  for (const group of groups) {
    container.appendChild(
      createModuleSettingsGroupElement({
        documentReference,
        group,
        groupState
      })
    );
  }

  disableUnavailableLevelProviderControl(
    root
  );

  return groups.length;
}

/**
 * Resolve each configured group and its currently rendered rows.
 *
 * Groups with no visible rows are omitted. This naturally hides Level
 * Awareness in Foundry v14, where the provider setting remains registered but
 * is not rendered.
 *
 * @param {HTMLElement} root - SettingsConfig root.
 * @returns {object[]} Group descriptors with DOM rows.
 */
function createModuleSettingsGroups(
  root
) {
  const maintenanceControls =
    root.querySelector?.(
      SETTINGS_CONFIG_MAINTENANCE_CONTROLS_SELECTOR
    ) ??
    null;

  return MODULE_SETTINGS_CATEGORY_DEFINITIONS
    .map(
      (definition) => {
        const rows =
          definition.settingKeys
            .map(
              (settingKey) =>
                findSettingsRow(
                  root,
                  `${MODULE_ID}.${settingKey}`
                )
            )
            .filter(
              Boolean
            );

        if (
          definition.includesMaintenanceControls ===
            true &&
          maintenanceControls &&
          !rows.includes(
            maintenanceControls
          )
        ) {
          rows.push(
            maintenanceControls
          );
        }

        return {
          ...definition,
          rows
        };
      }
    )
    .filter(
      (group) =>
        group.rows.length >
          0
    );
}

/**
 * Create one collapsible settings group.
 *
 * @param {object} options - Element creation values.
 * @returns {HTMLElement} Details element.
 */
function createModuleSettingsGroupElement({
  documentReference,
  group,
  groupState
}) {
  const details =
    documentReference.createElement(
      "details"
    );

  details.dataset.dynamicWebsSettingsGroup =
    group.id;

  details.className =
    "dynamic-webs-settings-group";

  details.open =
    resolveModuleSettingsGroupOpenState(
      group,
      groupState
    );

  details.addEventListener?.(
    "toggle",
    () =>
      persistModuleSettingsGroupOpenState(
        group.id,
        details.open
      )
  );

  applySettingsGroupStyles(
    details
  );

  const summary =
    documentReference.createElement(
      "summary"
    );

  applySettingsSummaryStyles(
    summary
  );

  const label =
    documentReference.createElement(
      "strong"
    );

  label.textContent =
    group.label;

  summary.appendChild(
    label
  );

  const description =
    documentReference.createElement(
      "span"
    );

  description.textContent =
    group.description;

  applySettingsDescriptionStyles(
    description
  );

  summary.appendChild(
    description
  );

  details.appendChild(
    summary
  );

  const body =
    documentReference.createElement(
      "div"
    );

  body.dataset.dynamicWebsSettingsGroupBody =
    group.id;

  applySettingsBodyStyles(
    body
  );

  for (const row of group.rows) {
    body.appendChild(
      row
    );
  }

  details.appendChild(
    body
  );

  return details;
}

/** @returns {Record<string, boolean>} Persisted local group state. */
function readModuleSettingsGroupState() {
  try {
    const rawState =
      globalThis.localStorage?.getItem?.(
        SETTINGS_GROUP_STATE_STORAGE_KEY
      );

    const parsedState =
      rawState
        ? JSON.parse(
            rawState
          )
        : {};

    return parsedState &&
      typeof parsedState ===
        "object" &&
      !Array.isArray(
        parsedState
      )
      ? parsedState
      : {};
  } catch {
    return {};
  }
}

/** Resolve one group's persisted or authored open state. */
function resolveModuleSettingsGroupOpenState(
  group,
  groupState
) {
  const storedOpenState =
    groupState?.[
      group.id
    ];

  return typeof storedOpenState ===
    "boolean"
    ? storedOpenState
    : group.open ===
        true;
}

/** Persist one group's open state locally. */
function persistModuleSettingsGroupOpenState(
  groupId,
  isOpen
) {
  try {
    const groupState =
      readModuleSettingsGroupState();

    groupState[
      groupId
    ] =
      isOpen ===
      true;

    globalThis.localStorage?.setItem?.(
      SETTINGS_GROUP_STATE_STORAGE_KEY,
      JSON.stringify(
        groupState
      )
    );
  } catch {
    // Group state is a convenience; the settings form remains functional.
  }
}

function applySettingsContainerStyles(
  element
) {
  element.style.display =
    "grid";
  element.style.gap =
    "0.75rem";
  element.style.margin =
    "0.5rem 0";
}

function applySettingsGroupStyles(
  element
) {
  element.style.border =
    "1px solid var(--color-border-light-primary, rgba(0, 0, 0, 0.25))";
  element.style.borderRadius =
    "6px";
  element.style.padding =
    "0.35rem 0.55rem";
  element.style.background =
    "var(--color-bg-option, rgba(0, 0, 0, 0.035))";
}

function applySettingsSummaryStyles(
  element
) {
  element.style.cursor =
    "pointer";
  element.style.display =
    "grid";
  element.style.gap =
    "0.15rem";
  element.style.padding =
    "0.2rem 0";
}

function applySettingsDescriptionStyles(
  element
) {
  element.style.fontSize =
    "0.9em";
  element.style.opacity =
    "0.78";
  element.style.fontWeight =
    "normal";
}

function applySettingsBodyStyles(
  element
) {
  element.style.marginTop =
    "0.45rem";
}

function registerDefaultSettingsCategorisationHook(
  maintenanceActions = {}
) {
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
        html,
        maintenanceActions
      );
      activateOptionalCompanionLink(resolveSettingsConfigRoot(html));
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

function findSettingsRow(
  root,
  settingName
) {
  return resolveSettingsRow(
    findSettingsControl(
      root,
      settingName
    )
  );
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

  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.DEFAULT_SPAN_SECRET_DOOR,
    {
      name:
        "Default Block Movement",
      hint:
        "When enabled, intact spans use module-owned closed secret-door walls for movement blocking.",
      scope:
        "world",
      config:
        true,
      type:
        Boolean,
      default:
        AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS.secretDoor,
      onChange:
        value =>
          handleDefaultSpanWebBehaviourSettingChanged({
            settingKey:
              MODULE_SETTING_KEYS.DEFAULT_SPAN_SECRET_DOOR,
            secretDoor:
              value,
            onDefaultSpanWebBehaviourSettingsChanged
          })
    }
  );

  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.DEFAULT_SPAN_CROSSING_ACTION,
    {
      name:
        "Default Crossing Action",
      hint:
        "Default token interaction with intact spans. Open Secret Door requires movement blocking. Destroy Web removes the web asset/state; a blocking secret door is opened and left for later clean-up instead of being deleted during the crossing.",
      scope:
        "world",
      config:
        true,
      type:
        String,
      choices:
        Object.freeze(
          Object.fromEntries(
            SPAN_WEB_CROSSING_ACTION_OPTIONS.map(
              option => [
                option.id,
                option.label
              ]
            )
          )
        ),
      default:
        AUTHORED_DEFAULT_SPAN_WEB_BEHAVIOUR_SETTINGS.crossingAction,
      onChange:
        value =>
          handleDefaultSpanWebBehaviourSettingChanged({
            settingKey:
              MODULE_SETTING_KEYS.DEFAULT_SPAN_CROSSING_ACTION,
            crossingAction:
              value,
            onDefaultSpanWebBehaviourSettingsChanged
          })
    }
  );

  /**
   * Legacy v1 world setting. Keep it registered but hidden so an existing
   * world's explicit Boolean value can be migrated when the new crossing
   * setting has not yet been stored.
   */
  settings.register(
    MODULE_ID,
    MODULE_SETTING_KEYS.DEFAULT_SPAN_DESTRUCTIBLE,
    {
      name:
        "Legacy Default Span Destructibility",
      hint:
        "Legacy Dynamic Webs setting retained only for migration.",
      scope:
        "world",
      config:
        false,
      type:
        Boolean,
      default:
        true
    }
  );
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
  crossingAction = undefined,
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
      crossingAction:
        crossingAction ===
          undefined
          ? current.crossingAction
          : normaliseSpanWebCrossingAction(
              crossingAction,
              current.crossingAction
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
  const crossingAction =
    hasExplicitWorldSetting(
      settings,
      MODULE_SETTING_KEYS.DEFAULT_SPAN_CROSSING_ACTION
    )
      ? readSettingSafely(
          settings,
          MODULE_SETTING_KEYS.DEFAULT_SPAN_CROSSING_ACTION
        )
      : normaliseSpanWebBehaviourBoolean(
          readSettingSafely(
            settings,
            MODULE_SETTING_KEYS.DEFAULT_SPAN_DESTRUCTIBLE
          ),
          true
        )
        ? SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB
        : SPAN_WEB_CROSSING_ACTIONS.NONE;

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
    crossingAction
  });
}

function hasExplicitWorldSetting(
  settings,
  key
) {
  const storage =
    settings?.storage ??
    globalThis.game?.settings?.storage;

  const worldStorage =
    storage?.get?.(
      "world"
    );

  const fullKey =
    `${MODULE_ID}.${key}`;

  if (
    typeof worldStorage?.has ===
      "function"
  ) {
    return worldStorage.has(
      fullKey
    );
  }

  if (
    typeof worldStorage?.get ===
      "function"
  ) {
    return worldStorage.get(
      fullKey
    ) !==
      undefined;
  }

  return false;
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
      : DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR;

  let visionMode;
  let secretDoor;
  let crossingAction;

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

  const legacyCrossingAction =
    Object.prototype.hasOwnProperty.call(
      source,
      "destructible"
    )
      ? normaliseSpanWebBehaviourBoolean(
          source.destructible,
          true
        )
        ? SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB
        : SPAN_WEB_CROSSING_ACTIONS.NONE
      : DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.crossingAction;

  try {
    crossingAction =
      normaliseSpanWebCrossingAction(
        source.crossingAction,
        legacyCrossingAction
      );
  } catch (_error) {
    crossingAction =
      legacyCrossingAction;
  }

  return Object.freeze({
    visionMode,
    secretDoor,
    crossingAction
  });
}

