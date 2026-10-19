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
  SCENE_WEB_THICKNESS_STEP,
  SCENE_WEB_THICKNESS_VALUES
} from "../config/sceneWebThicknessConfiguration.js";

import {
  WEB_DENSITY_OPTIONS,
  WEB_DENSITY_ORDER
} from "../simulation/webs/webDensityPresets.js";

import {
  getWebColourOptions
} from "../simulation/webs/webColourProfiles.js";

import {
  formatRegionRoleTagsForInput
} from "../config/regionTagConfiguration.js";

import {
  MAXIMUM_MAXIMUM_SPAN_GRID_UNITS,
  MAXIMUM_SPAN_GRID_UNITS_STEP,
  MINIMUM_MAXIMUM_SPAN_GRID_UNITS
} from "../config/moduleSettings.js";

import {
  SPAN_WEB_CROSSING_ACTION_OPTIONS,
  SPAN_WEB_CROSSING_ACTIONS,
  SPAN_WEB_VISION_OPTIONS
} from "../config/spanWebBehaviourContract.js";

import {
  SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION
} from "../config/sceneSpanWebBehaviourConfiguration.js";

import {
  getSceneWebMutableStateConfiguration
} from "../config/sceneWebMutableStateConfiguration.js";

const DENSITY_LABELS = new Map(
  WEB_DENSITY_OPTIONS.map((option) => [option.id, option.label])
);

const COLOUR_LABELS = new Map(
  getWebColourOptions().map((option) => [option.id, option.label])
);

export async function createSceneConfigTemplateContext({ application, scene }) {
  const configuration = getSceneWebPopulationConfiguration(scene);
  const mutableState =
    getSceneWebMutableStateConfiguration(
      scene
    );
  const editable = application?.isEditable !== false;
  const isActiveScene =
    String(
      globalThis.canvas?.scene?.id ??
      ""
    ) ===
    String(
      scene?.id ??
      ""
    );
  const runtimeMutableState =
    isActiveScene
      ? globalThis.dynamicWebs
          ?.api
          ?.interactions
          ?.getState?.() ??
        null
      : null;
  const destroyedWebCount =
    runtimeMutableState &&
    String(
      runtimeMutableState.sceneId ??
      ""
    ) ===
    String(
      scene?.id ??
      ""
    ) &&
    Array.isArray(
      runtimeMutableState.destroyedWebIds
    )
      ? runtimeMutableState.destroyedWebIds.length
      : mutableState.destroyedWebIds.length;

  return {
    editable,
    fieldNames: {
      webPopulations: `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS}`,
      spanWebBehaviour: `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.SPAN_WEB_BEHAVIOUR}`
    },
    spanWebBehaviourValue:
      JSON.stringify({
        schemaVersion:
          SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION,
        maximumSpanGridUnits:
          configuration.spanWebBehaviour.maximumSpanGridUnitsOverride,
        visionMode:
          configuration.spanWebBehaviour.visionMode,
        secretDoor:
          configuration.spanWebBehaviour.secretDoor,
        crossingAction:
          configuration.spanWebBehaviour.crossingAction
      }),
    spanWebBehaviour: {
      useWorldMaximumSpanWidth:
        configuration.spanWebBehaviour.usesWorldMaximumSpanWidth,
      maximumSpanGridUnits:
        configuration.spanWebBehaviour.maximumSpanGridUnits,
      worldMaximumSpanGridUnits:
        configuration.spanWebBehaviour.worldMaximumSpanGridUnits,
      maximumMinimum:
        MINIMUM_MAXIMUM_SPAN_GRID_UNITS,
      maximumMaximum:
        MAXIMUM_MAXIMUM_SPAN_GRID_UNITS,
      maximumStep:
        MAXIMUM_SPAN_GRID_UNITS_STEP,
      visionMode:
        configuration.spanWebBehaviour.visionMode,
      visionOptions:
        SPAN_WEB_VISION_OPTIONS.map(
          (
            option
          ) => ({
            value:
              option.id,
            label:
              option.label,
            selected:
              option.id ===
              configuration.spanWebBehaviour.visionMode
          })
        ),
      secretDoor:
        configuration.spanWebBehaviour.secretDoor,
      crossingAction:
        configuration.spanWebBehaviour.crossingAction,
      crossingActionOptions:
        SPAN_WEB_CROSSING_ACTION_OPTIONS.map(
          (
            option
          ) => ({
            value:
              option.id,
            label:
              option.label,
            selected:
              option.id ===
              configuration.spanWebBehaviour.crossingAction,
            disabled:
              option.requiresSecretDoor ===
                true &&
              configuration.spanWebBehaviour.secretDoor !==
                true
          })
        ),
      destroyedWebCount,
      hasDestroyedWebs:
        destroyedWebCount >
          0,
      isActiveScene,
      summary:
        createSpanBehaviourSummary(
          configuration.spanWebBehaviour
        )
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
    usesWorldPopulationDefaults:
      configuration.usesWorldPopulationDefaults ===
      true,
    populationDefaultsHint:
      configuration.usesWorldPopulationDefaults ===
        true
        ? "This Scene has no saved web-population configuration. It is currently using the GM's world defaults; saving this Scene Configuration makes the displayed population explicit for this Scene."
        : null,
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
    confineRegionTagsInput: formatRegionRoleTagsForInput(population.confineRegionTags),
    excludeRegionTagsInput: formatRegionRoleTagsForInput(population.excludeRegionTags),
    regionSummary: createRegionSummary(population.confineRegionTags, population.excludeRegionTags),
    colourProfileId: population.colourProfileId,
    colourLabel: COLOUR_LABELS.get(population.colourProfileId) ?? population.colourProfileId,
    colourOptions,
    thicknessMultiplier: population.thicknessMultiplier,
    thicknessMinimum: MINIMUM_SCENE_WEB_THICKNESS,
    thicknessMaximum: MAXIMUM_SCENE_WEB_THICKNESS,
    thicknessStep: SCENE_WEB_THICKNESS_STEP,
    thicknessOptions: SCENE_WEB_THICKNESS_VALUES.map((value) => ({
      value,
      label: `${value}×`,
      selected: value === population.thicknessMultiplier
    })),
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
    confineRegionTags: population.confineRegionTags,
    excludeRegionTags: population.excludeRegionTags,
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
      return "Deterministic reusable WebP patch abundance inside matching Confine Regions. Carpet generation requires at least one matching Confine Region tag.";
    default:
      return "Population-specific web density.";
  }
}


function createRegionSummary(confineTags, excludeTags) {
  const confineCount = Array.isArray(confineTags) ? confineTags.length : 0;
  const excludeCount = Array.isArray(excludeTags) ? excludeTags.length : 0;
  if (confineCount === 0 && excludeCount === 0) return "Unrestricted";
  const parts = [];
  if (confineCount > 0) parts.push(`Confine: ${confineCount}`);
  if (excludeCount > 0) parts.push(`Exclude: ${excludeCount}`);
  return parts.join(" · ");
}




function createSpanBehaviourSummary(
  behaviour
) {
  const visionLabel =
    SPAN_WEB_VISION_OPTIONS.find(
      (
        option
      ) =>
        option.id ===
        behaviour.visionMode
    )?.label ??
    behaviour.visionMode;

  const crossingLabel =
    behaviour.crossingAction ===
      SPAN_WEB_CROSSING_ACTIONS.OPEN_SECRET_DOOR
      ? "Opens on crossing"
      : behaviour.crossingAction ===
          SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB
        ? "Destroys on crossing"
        : "No crossing action";

  const parts =
    [
      `${behaviour.maximumSpanGridUnits} grid`,
      `${visionLabel} vision`,
      behaviour.secretDoor
        ? "Blocks movement"
        : "Free movement",
      crossingLabel
    ];

  return parts.join(
    " · "
  );
}
