import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  DEFAULT_SCENE_WEB_COLOUR
} from "./sceneConfigurationDefaults.js";

import {
  readRawSceneWebConfiguration
} from "./sceneWebFlagReading.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "./sceneWebFlagPaths.js";

import {
  WEB_COLOUR_PROFILE_ORDER,
  getWebColourProfile,
  isSupportedWebColourProfileId
} from "../simulation/webs/webColourProfiles.js";

if (
  !isSupportedWebColourProfileId(
    DEFAULT_SCENE_WEB_COLOUR
  )
) {
  throw new Error(
    `${MODULE_TITLE} | JSON-backed default web colour "${DEFAULT_SCENE_WEB_COLOUR}" is unsupported.`
  );
}

/** Normalise one persisted Scene web-colour profile identifier. */
export function normaliseSceneWebColour(
  value
) {
  const candidate =
    value === null ||
    value === undefined ||
    value === ""
      ? DEFAULT_SCENE_WEB_COLOUR
      : value;

  if (
    typeof candidate !==
      "string"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_COLOUR} must be a string.`
    );
  }

  const profileId =
    candidate.trim();

  if (
    !isSupportedWebColourProfileId(
      profileId
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported Scene web colour "${profileId}". Supported profiles: ${WEB_COLOUR_PROFILE_ORDER.join(", ")}.`
    );
  }

  return profileId;
}

/** Resolve one Scene's immutable colour-profile configuration. */
export function getSceneWebColourConfiguration(
  scene
) {
  if (
    !scene ||
    typeof scene !==
      "object" ||
    Array.isArray(
      scene
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A Scene document is required to read web colour.`
    );
  }

  const rawConfiguration =
    readRawSceneWebConfiguration(
      scene
    );

  const profileId =
    normaliseSceneWebColour(
      rawConfiguration[
        SCENE_WEB_FLAG_KEYS.WEB_COLOUR
      ]
    );

  return Object.freeze({
    profileId,
    profile:
      getWebColourProfile(
        profileId
      )
  });
}
