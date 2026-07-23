import {
  createSceneConfigHookRegistration
} from "./sceneConfigHookRegistration.js";

import {
  createSceneConfigTemplateContext
} from "./sceneConfigTemplateContext.js";

import {
  activateSceneConfigPopulationControls
} from "./sceneConfigPopulationControls.js";

import {
  activateSceneConfigSpanBehaviourControls
} from "./sceneConfigSpanBehaviourControls.js";

import {
  activateSceneConfigSpanWallControls
} from "./sceneConfigSpanWallControls.js";

const registerSceneConfigHooksInternal = createSceneConfigHookRegistration({
  createTemplateContext: createSceneConfigTemplateContext,
  activateControls: activateSceneConfigControls,
  registerAdditionalHooks: registerPopulationLevelRefreshHooks
});

let refreshHooksRegistered = false;

function activateSceneConfigControls(
  application,
  partElement
) {
  activateSceneConfigPopulationControls(
    application,
    partElement
  );

  activateSceneConfigSpanBehaviourControls(
    application,
    partElement
  );

  activateSceneConfigSpanWallControls(
    application,
    partElement
  );
}


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

