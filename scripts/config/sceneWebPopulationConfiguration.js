import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  readRawSceneWebConfiguration
} from "./sceneWebFlagReading.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "./sceneWebFlagPaths.js";

import {
  WEB_CATEGORY_DENSITY_DEFINITIONS,
  IMPLEMENTED_WEB_CATEGORY_IDS,
  normaliseSceneWebCategoryDensity
} from "./sceneWebCategoryDensityConfiguration.js";

import {
  normaliseSceneWebColour
} from "./sceneWebColourConfiguration.js";

import {
  normaliseSceneWebThickness
} from "./sceneWebThicknessConfiguration.js";

import {
  DEFAULT_SCENE_WEB_COLOUR,
  DEFAULT_SCENE_WEB_POPULATION_DENSITY,
  DEFAULT_SCENE_WEB_THICKNESS
} from "./sceneConfigurationDefaults.js";

import {
  DISABLED_WEB_DENSITY_ID,
  getWebDensityPreset
} from "../simulation/webs/webDensityPresets.js";

import {
  resolveWebLevelProvider
} from "../foundry/webLevelProvider.js";

import {
  BASE_WEB_LEVEL_ID
} from "../simulation/webs/webLevelContract.js";

import {
  createUniqueWebPopulationId
} from "./sceneWebPopulationIds.js";

import {
  normaliseRegionRoleTags,
  validateRegionTagListsAreUnique
} from "./regionTagConfiguration.js";

export const DEFAULT_WEB_POPULATION_DENSITY =
  normaliseSceneWebCategoryDensity(
    DEFAULT_SCENE_WEB_POPULATION_DENSITY,
    "ground"
  );

export function createDefaultSceneWebPopulation({
  levels = [],
  usedIds = new Set()
} = {}) {
  const level = Array.isArray(levels) && levels.length > 0
    ? levels[0]
    : { id: BASE_WEB_LEVEL_ID };

  return deepFreeze({
    id: createUniqueWebPopulationId({
      usedIds
    }),
    enabled: true,
    levelId: String(level.id ?? BASE_WEB_LEVEL_ID),
    confineRegionTags: Object.freeze([]),
    excludeRegionTags: Object.freeze([]),
    categoryDensities: createDefaultCategoryDensities(),
    colourProfileId: DEFAULT_SCENE_WEB_COLOUR,
    thicknessMultiplier: DEFAULT_SCENE_WEB_THICKNESS
  });
}

export function getSceneWebPopulationConfiguration(scene) {
  validateScene(scene);

  const provider = resolveWebLevelProvider({ scene });
  const raw = readRawSceneWebConfiguration(scene)[SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS];
  const populations = normaliseSceneWebPopulations(raw, {
    levels: provider.levels
  });

  const levelsById = new Map(provider.levels.map((level) => [level.id, level]));

  const resolvedPopulations = Object.freeze(populations.map((population) => {
    const level = levelsById.get(population.levelId) ?? null;
    const generation = resolvePopulationGeneration(population);

    return deepFreeze({
      ...population,
      level,
      levelAvailable: Boolean(level),
      generationActive:
        population.enabled === true &&
        Boolean(level) &&
        generation.implementedEnabled,
      generationOptions: generation.generationOptions,
      categories: generation.categories
    });
  }));

  return deepFreeze({
    provider,
    levels: provider.levels,
    populations: resolvedPopulations,
    enabledPopulations: resolvedPopulations.filter((population) => population.enabled),
    activePopulations: resolvedPopulations.filter((population) => population.generationActive),
    hasActivePopulations: resolvedPopulations.some((population) => population.generationActive),
    unavailablePopulationIds: resolvedPopulations
      .filter((population) => !population.levelAvailable)
      .map((population) => population.id)
  });
}

export function normaliseSceneWebPopulations(
  value,
  {
    levels = [],
    generateMissingIds = false
  } = {}
) {
  const parsed = parsePopulationArray(value);
  if (!Array.isArray(parsed)) {
    throw new TypeError(`${MODULE_TITLE} | ${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS} must be an array.`);
  }

  const usedIds = new Set();
  const fallbackLevelId = String(levels?.[0]?.id ?? BASE_WEB_LEVEL_ID);

  return Object.freeze(parsed.map((entry, index) => {
    const source = requirePlainObject(entry, `web population ${index + 1}`);
    const preferredId = normaliseOptionalText(
      source.id ??
      source.populationId
    );

    if (
      !preferredId &&
      generateMissingIds !== true
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | Web population ${index + 1} requires a persisted ID.`
      );
    }

    if (
      preferredId &&
      usedIds.has(preferredId) &&
      generateMissingIds !== true
    ) {
      throw new Error(
        `${MODULE_TITLE} | Duplicate web-population ID "${preferredId}".`
      );
    }

    const id = createUniqueWebPopulationId({
      preferredId,
      usedIds
    });

    usedIds.add(id);

    const levelId = normaliseOptionalText(source.levelId) ?? fallbackLevelId;
    const categorySource = requireOptionalPlainObject(source.categoryDensities) ?? {};
    const categoryDensities = {};

    for (const definition of WEB_CATEGORY_DENSITY_DEFINITIONS) {
      categoryDensities[definition.categoryId] = normaliseSceneWebCategoryDensity(
        categorySource[definition.categoryId] ?? DEFAULT_WEB_POPULATION_DENSITY,
        definition.categoryId
      );
    }

    const confineRegionTags = normaliseRegionRoleTags(source.confineRegionTags);
    const excludeRegionTags = normaliseRegionRoleTags(source.excludeRegionTags);
    validateRegionTagListsAreUnique({
      confine: confineRegionTags,
      exclude: excludeRegionTags
    });

    return deepFreeze({
      id,
      populationId: id,
      enabled: normaliseBoolean(source.enabled, true),
      levelId,
      confineRegionTags,
      excludeRegionTags,
      categoryDensities,
      colourProfileId: normaliseSceneWebColour(
        source.colourProfileId
      ),
      thicknessMultiplier: normaliseSceneWebThickness(
        source.thicknessMultiplier
      )
    });
  }));
}

export function validateSceneWebPopulations(value, options = {}) {
  normaliseSceneWebPopulations(value, options);
  return true;
}

function resolvePopulationGeneration(population) {
  const categories = {};
  const generationOptions = {};

  for (const definition of WEB_CATEGORY_DENSITY_DEFINITIONS) {
    const densityId = population.categoryDensities[definition.categoryId];
    const preset = getWebDensityPreset(densityId);
    const enabled = densityId !== DISABLED_WEB_DENSITY_ID;
    const generationActive = definition.implemented === true && enabled;
    const options = generationActive && definition.generationKey
      ? Object.freeze({
          ...preset.configuration[definition.generationKey],
          enabled: true
        })
      : definition.implemented && definition.generationKey
        ? Object.freeze({ enabled: false })
        : null;

    if (definition.generationKey && options) {
      generationOptions[definition.generationKey] = options;
    }

    categories[definition.categoryId] = Object.freeze({
      categoryId: definition.categoryId,
      densityId,
      enabled,
      implemented: definition.implemented,
      generationActive,
      preset,
      generationOptions: options
    });
  }

  return {
    categories: Object.freeze(categories),
    generationOptions: Object.freeze(generationOptions),
    implementedEnabled: IMPLEMENTED_WEB_CATEGORY_IDS.some(
      (categoryId) => categories[categoryId].generationActive
    )
  };
}

function createDefaultCategoryDensities() {
  return Object.freeze(Object.fromEntries(
    WEB_CATEGORY_DENSITY_DEFINITIONS.map((definition) => [
      definition.categoryId,
      DEFAULT_WEB_POPULATION_DENSITY
    ])
  ));
}

function parsePopulationArray(value) {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${MODULE_TITLE} | Web populations contain invalid JSON.`, { cause: error });
  }
}

function normaliseBoolean(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if ([1, "1", "true", "on"].includes(value)) return true;
  if ([0, "0", "false", "off"].includes(value)) return false;
  throw new TypeError(`${MODULE_TITLE} | Web population enabled state must be boolean.`);
}

function normaliseOptionalText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function requireOptionalPlainObject(value) {
  if (value === null || value === undefined || value === "") return null;
  return requirePlainObject(value, "web population category densities");
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${MODULE_TITLE} | ${label} must be a plain object.`);
  }
  return value;
}

function validateScene(scene) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    throw new TypeError(`${MODULE_TITLE} | A Scene document is required to read web populations.`);
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
