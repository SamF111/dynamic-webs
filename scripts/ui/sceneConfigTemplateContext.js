import {
  getSceneWebDensityConfiguration
} from "../config/sceneWebDensityConfiguration.js";

import {
  getSceneWebColourConfiguration
} from "../config/sceneWebColourConfiguration.js";

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

  return {
    editable:
      application?.isEditable !==
        false,

    configuration: {
      webDensity:
        densityConfiguration.densityId,
      webColour:
        colourConfiguration.profileId
    },

    fieldNames: {
      webDensity:
        `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_DENSITY}`,
      webColour:
        `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_COLOUR}`
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
    }
  };
}
