import sceneConfigurationDefaultsData from "../../data/scene-configuration-defaults.json" with {
  type:
    "json"
};

import {
  assertJsonObject,
  assertRequiredString,
  deepFreezeJsonData
} from "../data/jsonData.js";

const DEFAULTS_CONTEXT =
  "Scene configuration defaults";

const rawDefaults =
  assertJsonObject(
    sceneConfigurationDefaultsData,
    DEFAULTS_CONTEXT
  );

const expectedKeys =
  [
    "webDensity"
  ];

const actualKeys =
  Object.keys(
    rawDefaults
  );

const unexpectedKeys =
  actualKeys.filter(
    (
      key
    ) =>
      !expectedKeys.includes(
        key
      )
  );

const missingKeys =
  expectedKeys.filter(
    (
      key
    ) =>
      !Object.prototype.hasOwnProperty.call(
        rawDefaults,
        key
      )
  );

if (
  unexpectedKeys.length >
    0 ||
  missingKeys.length >
    0
) {
  throw new Error(
    `Dynamic Webs | ${DEFAULTS_CONTEXT} must contain only webDensity.`
  );
}

export const DEFAULT_SCENE_CONFIGURATION =
  deepFreezeJsonData({
    webDensity:
      assertRequiredString(
        rawDefaults.webDensity,
        `${DEFAULTS_CONTEXT}.webDensity`
      )
  });

export const DEFAULT_SCENE_WEB_DENSITY =
  DEFAULT_SCENE_CONFIGURATION.webDensity;
