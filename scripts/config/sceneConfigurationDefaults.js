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
    "webThickness",
    "webPopulationDensity",
    "webPopulations"
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
    `Dynamic Webs | ${DEFAULTS_CONTEXT} must contain only webDensity, webColour, webThickness, webPopulationDensity and webPopulations.`
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
    webPopulationDensity:
      assertRequiredString(
        rawDefaults.webPopulationDensity,
        `${DEFAULTS_CONTEXT}.webPopulationDensity`
      ),
    webPopulations:
      Array.isArray(rawDefaults.webPopulations)
        ? rawDefaults.webPopulations
        : (() => { throw new TypeError(`Dynamic Webs | ${DEFAULTS_CONTEXT}.webPopulations must be an array.`); })(),
    webThickness:
      assertNumberInRange(
        rawDefaults.webThickness,
        `${DEFAULTS_CONTEXT}.webThickness`,
        {
          minimum:
            1,
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

export const DEFAULT_SCENE_WEB_POPULATION_DENSITY =
  DEFAULT_SCENE_CONFIGURATION.webPopulationDensity;

export const DEFAULT_SCENE_WEB_POPULATIONS =
  DEFAULT_SCENE_CONFIGURATION.webPopulations;

