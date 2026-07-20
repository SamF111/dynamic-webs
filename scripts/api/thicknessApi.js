import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  normaliseSceneWebThickness
} from "../config/sceneWebThicknessConfiguration.js";

import {
  SCENE_WEB_FLAG_KEYS
} from "../config/sceneWebFlagPaths.js";

import {
  requireCurrentUserIsGM,
  resolveSceneDocument
} from "./foundryAccess.js";

/** Read the persisted web-thickness multiplier for one Scene. */
export function getPublicSceneWebThickness(
  sceneId = null
) {
  const scene =
    resolveSceneDocument(
      sceneId
    );

  return normaliseSceneWebThickness(
    scene.getFlag?.(
      MODULE_ID,
      SCENE_WEB_FLAG_KEYS.WEB_THICKNESS
    ) ??
    scene.flags?.[
      MODULE_ID
    ]?.[
      SCENE_WEB_FLAG_KEYS.WEB_THICKNESS
    ]
  );
}

/** Persist one Scene web-thickness multiplier through Foundry's flag API. */
export async function setPublicSceneWebThickness(
  thicknessMultiplier,
  sceneId = null
) {
  requireCurrentUserIsGM();

  const scene =
    resolveSceneDocument(
      sceneId
    );

  if (
    typeof scene.setFlag !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | Scene.setFlag() is unavailable.`
    );
  }

  return scene.setFlag(
    MODULE_ID,
    SCENE_WEB_FLAG_KEYS.WEB_THICKNESS,
    normaliseSceneWebThickness(
      thicknessMultiplier
    )
  );
}
