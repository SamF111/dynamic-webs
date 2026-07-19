import {
  getSceneWebDensityConfiguration
} from "../config/sceneWebDensityConfiguration.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "../config/sceneWebFlagPaths.js";

import {
  getWebDensityOptions
} from "../simulation/webs/webDensityPresets.js";

/**
 * Build the standalone Dynamic Webs SceneConfig part context.
 *
 * @param {object} options - Context values.
 * @param {object} options.application - SceneConfig application.
 * @param {object} options.scene - Configured Scene.
 * @returns {Promise<object>} Template context.
 */
export async function createSceneConfigTemplateContext({
  application,
  scene
}) {
  const configuration =
    getSceneWebDensityConfiguration(
      scene
    );

  return {
    editable:
      application?.isEditable !==
        false,

    configuration: {
      webDensity:
        configuration.densityId
    },

    fieldNames: {
      webDensity:
        `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_DENSITY}`
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
                  configuration.densityId
            })
          )
    }
  };
}
