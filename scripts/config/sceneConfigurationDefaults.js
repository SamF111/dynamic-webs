import sceneConfigurationDefaultsData from "../../data/scene-configuration-defaults.json" with {
  type:
    "json"
};

import {
  assertJsonObject,
  assertNumberInRange,
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
    "webDensity",
    "webColour",
    "webThickness"
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
    `Dynamic Webs | ${DEFAULTS_CONTEXT} must contain only webDensity, webColour and webThickness.`
  );
}

export const DEFAULT_SCENE_CONFIGURATION =
  deepFreezeJsonData({
    webDensity:
      assertRequiredString(
        rawDefaults.webDensity,
        `${DEFAULTS_CONTEXT}.webDensity`
      ),
    webColour:
      assertRequiredString(
        rawDefaults.webColour,
        `${DEFAULTS_CONTEXT}.webColour`
      ),
    webThickness:
      assertNumberInRange(
        rawDefaults.webThickness,
        `${DEFAULTS_CONTEXT}.webThickness`,
        {
          minimum:
            0.5,
          maximum:
            4
        }
      )
  });

export const DEFAULT_SCENE_WEB_DENSITY =
  DEFAULT_SCENE_CONFIGURATION.webDensity;

export const DEFAULT_SCENE_WEB_COLOUR =
  DEFAULT_SCENE_CONFIGURATION.webColour;

export const DEFAULT_SCENE_WEB_THICKNESS =
  DEFAULT_SCENE_CONFIGURATION.webThickness;
