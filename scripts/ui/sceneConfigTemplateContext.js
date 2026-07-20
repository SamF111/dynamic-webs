import {
  createDefaultSceneWebPopulation,
  getSceneWebPopulationConfiguration
} from "../config/sceneWebPopulationConfiguration.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "../config/sceneWebFlagPaths.js";

import {
  WEB_CATEGORY_DENSITY_DEFINITIONS
} from "../config/sceneWebCategoryDensityConfiguration.js";

import {
  MAXIMUM_SCENE_WEB_THICKNESS,
  MINIMUM_SCENE_WEB_THICKNESS,
  SCENE_WEB_THICKNESS_STEP
} from "../config/sceneWebThicknessConfiguration.js";

import {
  WEB_DENSITY_OPTIONS,
  WEB_DENSITY_ORDER
} from "../simulation/webs/webDensityPresets.js";

import {
  getWebColourOptions
} from "../simulation/webs/webColourProfiles.js";

const DENSITY_LABELS = new Map(
  WEB_DENSITY_OPTIONS.map((option) => [option.id, option.label])
);

const COLOUR_LABELS = new Map(
  getWebColourOptions().map((option) => [option.id, option.label])
);

export async function createSceneConfigTemplateContext({ application, scene }) {
  const configuration = getSceneWebPopulationConfiguration(scene);
  const editable = application?.isEditable !== false;

  return {
    editable,
    fieldNames: {
      webPopulations: `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS}`
    },
    populationValue: JSON.stringify(
      configuration.populations.map(toPersistedPopulation)
    ),
    populationCards: configuration.populations.map((population, index) =>
      createPopulationCardContext({
        population,
        index,
        configuration,
        editable
      })
    ),
    newPopulationCard: createPopulationCardContext({
      population: createDefaultSceneWebPopulation({
        levels: configuration.levels,
        usedIds: new Set(
          configuration.populations.map(
            (population) => population.id
          )
        )
      }),
      index: configuration.populations.length,
      configuration,
      editable,
      template: true
    }),
    hasPopulations: configuration.populations.length > 0,
    provider: configuration.provider,
    levelProviderHint: createLevelProviderHint(configuration.provider)
  };
}

function createPopulationCardContext({
  population,
  index,
  configuration,
  editable,
  template = false
}) {
  const levelOptions = configuration.levels.map((level) => ({
    value: level.id,
    label: level.label ?? formatElevationBand(level.elevationBand) ?? level.id,
    selected: level.id === population.levelId
  }));

  if (!levelOptions.some((option) => option.value === population.levelId)) {
    levelOptions.unshift({
      value: population.levelId,
      label: `Unavailable level: ${population.levelId}`,
      selected: true,
      unavailable: true
    });
  }

  const colourOptions = getWebColourOptions().map((option) => ({
    value: option.id,
    label: option.label,
    selected: option.id === population.colourProfileId
  }));

  return {
    index,
    number: index + 1,
    template,
    id: population.id,
    enabled: population.enabled === true,
    levelId: population.levelId,
    levelAvailable: population.levelAvailable !== false,
    levelOptions,
    colourProfileId: population.colourProfileId,
    colourLabel: COLOUR_LABELS.get(population.colourProfileId) ?? population.colourProfileId,
    colourOptions,
    thicknessMultiplier: population.thicknessMultiplier,
    thicknessMinimum: MINIMUM_SCENE_WEB_THICKNESS,
    thicknessMaximum: MAXIMUM_SCENE_WEB_THICKNESS,
    thicknessStep: SCENE_WEB_THICKNESS_STEP,
    densityControls: WEB_CATEGORY_DENSITY_DEFINITIONS.map((definition) => {
      const densityId = population.categoryDensities[definition.categoryId];

      return {
        categoryId: definition.categoryId,
        label: definition.label,
        future: definition.implemented !== true,
        densityId,
        densityLabel: DENSITY_LABELS.get(densityId) ?? densityId,
        sliderValue: Math.max(0, WEB_DENSITY_ORDER.indexOf(densityId)),
        minimum: 0,
        maximum: WEB_DENSITY_ORDER.length - 1,
        step: 1,
        description: createDensityDescription(definition.categoryId)
      };
    }),
    summaryTitle: `Web Population ${index + 1}`,
    summaryDetail: `${population.enabled
      ? resolveLevelLabel(levelOptions, population.levelId)
      : "Disabled"} · ${COLOUR_LABELS.get(population.colourProfileId) ?? population.colourProfileId}`,
    editable
  };
}

function toPersistedPopulation(population) {
  return {
    id: population.id,
    enabled: population.enabled,
    levelId: population.levelId,
    categoryDensities: population.categoryDensities,
    colourProfileId: population.colourProfileId,
    thicknessMultiplier: population.thicknessMultiplier
  };
}

function resolveLevelLabel(options, id) {
  return options.find((option) => option.value === id)?.label ?? id;
}

function formatElevationBand(band) {
  if (!band || (band.bottom == null && band.top == null)) return null;
  if (band.bottom === band.top || band.top == null) return `Elevation ${band.bottom}`;
  return `Elevation ${band.bottom}–${band.top}`;
}

function createLevelProviderHint(provider) {
  if (provider?.resolvedMode === "base") {
    return "Web populations can currently target Base Level only. Enable theripper93's Levels in Foundry v13, or use native Scene levels in Foundry v14, for additional choices.";
  }

  return "Each population targets one detected level. Add another population to use different density, colour or thickness on another level.";
}

function createDensityDescription(categoryId) {
  switch (categoryId) {
    case "wall-corner":
      return "Maximum abundance at compatible wall corners on this population's level.";
    case "wall-span":
      return "Wall-span abundance and preset-owned spacing on this population's level.";
    case "ground":
      return "Freely placed ground-web abundance on this population's level.";
    case "web-carpet":
      return "Reserved density for future region-bound web carpets; it currently has no generation effect.";
    default:
      return "Population-specific web density.";
  }
}
