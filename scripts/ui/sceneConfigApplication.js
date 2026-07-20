import {
  createSceneConfigHookRegistration
} from "./sceneConfigHookRegistration.js";

import {
  createSceneConfigTemplateContext
} from "./sceneConfigTemplateContext.js";

import {
  activateSceneConfigDensitySliders
} from "./sceneConfigDensitySliders.js";

const registerSceneConfigHooksInternal =
  createSceneConfigHookRegistration({
    createTemplateContext:
      createSceneConfigTemplateContext,

    activateControls:
      activateSceneConfigDensitySliders,

    registerAdditionalHooks:
      () => {
        // Reserved for later level-aware refresh hooks.
      }
  });

/**
 * Register the Dynamic Webs native Scene Configuration tab.
 *
 * @returns {boolean} True when registration occurred.
 */
export function registerSceneConfigHooks() {
  return registerSceneConfigHooksInternal();
}
