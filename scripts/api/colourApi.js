import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  normaliseSceneWebColour
} from "../config/sceneWebColourConfiguration.js";

import {
  SCENE_WEB_FLAG_KEYS
} from "../config/sceneWebFlagPaths.js";

import {
  getWebColourProfile,
  getWebColourProfiles
} from "../simulation/webs/webColourProfiles.js";

import {
  requireCurrentUserIsGM,
  resolveSceneDocument
} from "./foundryAccess.js";

/** Return all immutable authored web-colour profiles. */
export function getPublicWebColourProfiles() {
  return getWebColourProfiles();
}

/** Return one immutable authored web-colour profile. */
export function getPublicWebColourProfile(
  profileId
) {
  return getWebColourProfile(
    profileId
  );
}

/** Read the persisted web-colour profile for one Scene. */
export function getPublicSceneWebColour(
  sceneId = null
) {
  const scene =
    resolveSceneDocument(
      sceneId
    );

  return normaliseSceneWebColour(
    scene.getFlag?.(
      MODULE_ID,
      SCENE_WEB_FLAG_KEYS.WEB_COLOUR
    ) ??
    scene.flags?.[
      MODULE_ID
    ]?.[
      SCENE_WEB_FLAG_KEYS.WEB_COLOUR
    ]
  );
}

/** Persist one Scene web-colour profile through Foundry's flag API. */
export async function setPublicSceneWebColour(
  profileId,
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
    SCENE_WEB_FLAG_KEYS.WEB_COLOUR,
    normaliseSceneWebColour(
      profileId
    )
  );
}
