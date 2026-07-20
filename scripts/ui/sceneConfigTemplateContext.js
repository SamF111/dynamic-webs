import {
  getSceneWebDensityConfiguration
} from "../config/sceneWebDensityConfiguration.js";

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
  getWebDensityOptions
} from "../simulation/webs/webDensityPresets.js";

import {
  getWebColourOptions
} from "../simulation/webs/webColourProfiles.js";

/** Build the standalone Dynamic Webs SceneConfig part context. */
export async function createSceneConfigTemplateContext({
  application,
  scene
}) {
  const densityConfiguration =
    getSceneWebDensityConfiguration(
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

  return {
    editable:
      application?.isEditable !==
        false,

    configuration: {
      webDensity:
        densityConfiguration.densityId,
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

    webDensityControl: {
      label:
        "Web density",
      description:
        "Choose how many procedural webs Dynamic Webs generates for this Scene.",
      options:
        getWebDensityOptions()
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
                  densityConfiguration.densityId
            })
          )
    },

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
