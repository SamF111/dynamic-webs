import {
  createSceneConfigHookRegistration
} from "./sceneConfigHookRegistration.js";

import {
  createSceneConfigTemplateContext
} from "./sceneConfigTemplateContext.js";

import {
  activateSceneConfigPopulationControls
} from "./sceneConfigPopulationControls.js";

const registerSceneConfigHooksInternal = createSceneConfigHookRegistration({
  createTemplateContext: createSceneConfigTemplateContext,
  activateControls: activateSceneConfigPopulationControls,
  registerAdditionalHooks: registerPopulationLevelRefreshHooks
});

let refreshHooksRegistered = false;

export function registerSceneConfigHooks() {
  return registerSceneConfigHooksInternal();
}

function registerPopulationLevelRefreshHooks() {
  if (refreshHooksRegistered) return;
  refreshHooksRegistered = true;

  for (const event of [
    "createLevel",
    "updateLevel",
    "deleteLevel",
    "levelsUIChange",
    "levelsUiChange",
    "levelsChange"
  ]) {
    globalThis.Hooks?.on?.(event, () => {
      for (const application of Object.values(globalThis.ui?.windows ?? {})) {
        if (application?.constructor?.name === "SceneConfig" && application?.rendered) {
          application.render({ force: true });
        }
      }
    });
  }
}
