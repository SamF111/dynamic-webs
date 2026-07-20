import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  DEFAULT_SCENE_WEB_THICKNESS
} from "./sceneConfigurationDefaults.js";

import {
  readRawSceneWebConfiguration
} from "./sceneWebFlagReading.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "./sceneWebFlagPaths.js";

export const MINIMUM_SCENE_WEB_THICKNESS =
  0.5;

export const MAXIMUM_SCENE_WEB_THICKNESS =
  4;

export const SCENE_WEB_THICKNESS_STEP =
  0.25;

const THICKNESS_TOLERANCE =
  0.000001;

const normalisedDefaultThickness =
  normaliseSceneWebThickness(
    DEFAULT_SCENE_WEB_THICKNESS
  );

if (
  Math.abs(
    normalisedDefaultThickness -
      DEFAULT_SCENE_WEB_THICKNESS
  ) >
    THICKNESS_TOLERANCE
) {
  throw new Error(
    `${MODULE_TITLE} | JSON-backed default web thickness must already be normalised.`
  );
}

/** Normalise one persisted Scene web-thickness multiplier. */
export function normaliseSceneWebThickness(
  value
) {
  const candidate =
    value === null ||
    value === undefined ||
    value === ""
      ? DEFAULT_SCENE_WEB_THICKNESS
      : value;

  const thickness =
    typeof candidate ===
      "string"
      ? Number(
          candidate.trim()
        )
      : Number(
          candidate
        );

  if (
    !Number.isFinite(
      thickness
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_THICKNESS} must be a finite number.`
    );
  }

  if (
    thickness <
      MINIMUM_SCENE_WEB_THICKNESS -
        THICKNESS_TOLERANCE ||
    thickness >
      MAXIMUM_SCENE_WEB_THICKNESS +
        THICKNESS_TOLERANCE
  ) {
    throw new Error(
      `${MODULE_TITLE} | Scene web thickness must be between ${MINIMUM_SCENE_WEB_THICKNESS} and ${MAXIMUM_SCENE_WEB_THICKNESS}.`
    );
  }

  return thickness;
}

/** Resolve one Scene's immutable web-thickness configuration. */
export function getSceneWebThicknessConfiguration(
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
      `${MODULE_TITLE} | A Scene document is required to read web thickness.`
    );
  }

  const rawConfiguration =
    readRawSceneWebConfiguration(
      scene
    );

  return Object.freeze({
    thicknessMultiplier:
      normaliseSceneWebThickness(
        rawConfiguration[
          SCENE_WEB_FLAG_KEYS.WEB_THICKNESS
        ]
      )
  });
}
