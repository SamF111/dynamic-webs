import {
  getSceneWebCategoryDensityConfiguration,
  WEB_CATEGORY_DENSITY_DEFINITIONS
} from "../config/sceneWebCategoryDensityConfiguration.js";

import {
  getSceneWebColourConfiguration
} from "../config/sceneWebColourConfiguration.js";

import {
  MAXIMUM_SCENE_WEB_THICKNESS,
  MINIMUM_SCENE_WEB_THICKNESS,
  SCENE_WEB_THICKNESS_STEP,
  getSceneWebThicknessConfiguration
} from "../config/sceneWebThicknessConfiguration.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "../config/sceneWebFlagPaths.js";

import {
  WEB_DENSITY_OPTIONS,
  WEB_DENSITY_ORDER
} from "../simulation/webs/webDensityPresets.js";

import {
  getWebColourOptions
} from "../simulation/webs/webColourProfiles.js";

const DENSITY_LABELS_BY_ID =
  new Map(
    WEB_DENSITY_OPTIONS.map(
      (
        option
      ) => [
        option.id,
        option.label
      ]
    )
  );

/** Build the standalone Dynamic Webs SceneConfig part context. */
export async function createSceneConfigTemplateContext({
  application,
  scene
}) {
  const categoryDensityConfiguration =
    getSceneWebCategoryDensityConfiguration(
      scene
    );

  const colourConfiguration =
    getSceneWebColourConfiguration(
      scene
    );

  const thicknessConfiguration =
    getSceneWebThicknessConfiguration(
      scene
    );

  const categoryDensityControls =
    WEB_CATEGORY_DENSITY_DEFINITIONS.map(
      (
        definition
      ) => {
        const resolved =
          categoryDensityConfiguration.categories[
            definition.categoryId
          ];

        const sliderValue =
          Math.max(
            0,
            WEB_DENSITY_ORDER.indexOf(
              resolved.densityId
            )
          );

        const domId =
          `dynamic-webs-${definition.flagKey}`;

        return {
          categoryId:
            definition.categoryId,
          domId,
          outputId:
            `${domId}-output`,
          label:
            definition.label,
          description:
            createCategoryDensityDescription(
              definition.categoryId,
              resolved.source
            ),
          future:
            definition.implemented !==
              true,
          fieldName:
            `${SCENE_WEB_FLAG_PATH}.${definition.flagKey}`,
          densityId:
            resolved.densityId,
          densityLabel:
            DENSITY_LABELS_BY_ID.get(
              resolved.densityId
            ) ??
            resolved.densityId,
          source:
            resolved.source,
          sourceLabel:
            resolved.source ===
              "explicit"
              ? "Scene-specific value"
              : `Inherited from legacy Web density: ${DENSITY_LABELS_BY_ID.get(
                  categoryDensityConfiguration.legacyDensityId
                ) ?? categoryDensityConfiguration.legacyDensityId}`,
          sliderValue,
          minimum:
            0,
          maximum:
            WEB_DENSITY_ORDER.length -
              1,
          step:
            1
        };
      }
    );

  return {
    editable:
      application?.isEditable !==
        false,

    configuration: {
      webDensity:
        categoryDensityConfiguration.legacyDensityId,
      categoryDensities:
        categoryDensityConfiguration.categoryDensities,
      webColour:
        colourConfiguration.profileId,
      webThickness:
        thicknessConfiguration.thicknessMultiplier
    },

    fieldNames: {
      webDensity:
        `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_DENSITY}`,
      webColour:
        `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_COLOUR}`,
      webThickness:
        `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_THICKNESS}`
    },

    webCategoryDensityControls:
      categoryDensityControls,

    webColourControl: {
      label:
        "Web colour",
      description:
        "Choose the visual colour profile used by all generated webs in this Scene.",
      options:
        getWebColourOptions()
          .map(
            (
              option
            ) => ({
              value:
                option.id,
              label:
                option.label,
              selected:
                option.id ===
                  colourConfiguration.profileId
            })
          )
    },

    webThicknessControl: {
      label:
        "Web thickness",
      description:
        "Multiply visible strand thickness without changing web geometry or interaction width.",
      value:
        thicknessConfiguration.thicknessMultiplier,
      minimum:
        MINIMUM_SCENE_WEB_THICKNESS,
      maximum:
        MAXIMUM_SCENE_WEB_THICKNESS,
      step:
        SCENE_WEB_THICKNESS_STEP
    }
  };
}

function createCategoryDensityDescription(
  categoryId,
  source
) {
  const sourceText =
    source ===
      "explicit"
      ? "This Scene already has an independent value."
      : "This currently inherits the legacy Web density until the Scene is saved.";

  switch (categoryId) {
    case "wall-corner":
      return `Control the maximum number of webs generated from compatible wall corners. ${sourceText}`;

    case "wall-span":
      return `Control wall-span abundance and the preset-owned minimum spacing between span webs. ${sourceText}`;

    case "ground":
      return `Control the number of freely placed ground webs. ${sourceText}`;

    case "web-carpet":
      return `Reserve the independent density for future region-bound web carpets. This value is saved now but has no generation effect until carpets are implemented. ${sourceText}`;

    default:
      return sourceText;
  }
}
