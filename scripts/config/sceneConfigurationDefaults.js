import sceneConfigurationDefaultsData from "../../data/scene-configuration-defaults.json" with {
  type:
    "json"
};

import {
  assertBoolean,
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
    "webPopulationCategoryDensities",
    "webPopulationColour",
    "webPopulationThickness",
    "spanWebBehaviour",
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
    `Dynamic Webs | ${DEFAULTS_CONTEXT} must contain only ${expectedKeys.join(", ")}.`
  );
}

const populationCategoryDensities =
  assertJsonObject(
    rawDefaults.webPopulationCategoryDensities,
    `${DEFAULTS_CONTEXT}.webPopulationCategoryDensities`
  );

const expectedPopulationCategoryIds =
  [
    "wall-corner",
    "wall-span",
    "ground",
    "web-carpet"
  ];

const populationCategoryKeys =
  Object.keys(
    populationCategoryDensities
  );

if (
  populationCategoryKeys.length !==
    expectedPopulationCategoryIds.length ||
  expectedPopulationCategoryIds.some(
    (
      categoryId
    ) =>
      !Object.prototype.hasOwnProperty.call(
        populationCategoryDensities,
        categoryId
      )
  )
) {
  throw new Error(
    `Dynamic Webs | ${DEFAULTS_CONTEXT}.webPopulationCategoryDensities must contain exactly ${expectedPopulationCategoryIds.join(", ")}.`
  );
}


const spanWebBehaviour =
  assertJsonObject(
    rawDefaults.spanWebBehaviour,
    `${DEFAULTS_CONTEXT}.spanWebBehaviour`
  );

const expectedSpanWebBehaviourKeys =
  [
    "visionMode",
    "secretDoor",
    "crossingAction"
  ];

if (
  Object.keys(
    spanWebBehaviour
  ).length !==
    expectedSpanWebBehaviourKeys.length ||
  expectedSpanWebBehaviourKeys.some(
    (
      key
    ) =>
      !Object.prototype.hasOwnProperty.call(
        spanWebBehaviour,
        key
      )
  )
) {
  throw new Error(
    `Dynamic Webs | ${DEFAULTS_CONTEXT}.spanWebBehaviour must contain exactly ${expectedSpanWebBehaviourKeys.join(", ")}.`
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
    webPopulationCategoryDensities:
      Object.fromEntries(
        expectedPopulationCategoryIds.map(
          (
            categoryId
          ) => [
            categoryId,
            assertRequiredString(
              populationCategoryDensities[
                categoryId
              ],
              `${DEFAULTS_CONTEXT}.webPopulationCategoryDensities.${categoryId}`
            )
          ]
        )
      ),
    webPopulationColour:
      assertRequiredString(
        rawDefaults.webPopulationColour,
        `${DEFAULTS_CONTEXT}.webPopulationColour`
      ),
    webPopulationThickness:
      assertNumberInRange(
        rawDefaults.webPopulationThickness,
        `${DEFAULTS_CONTEXT}.webPopulationThickness`,
        {
          minimum:
            1,
          maximum:
            4
        }
      ),
    spanWebBehaviour: {
      visionMode:
        assertRequiredString(
          spanWebBehaviour.visionMode,
          `${DEFAULTS_CONTEXT}.spanWebBehaviour.visionMode`
        ),
      secretDoor:
        assertBoolean(
          spanWebBehaviour.secretDoor,
          `${DEFAULTS_CONTEXT}.spanWebBehaviour.secretDoor`
        ),
      crossingAction:
        assertRequiredString(
          spanWebBehaviour.crossingAction,
          `${DEFAULTS_CONTEXT}.spanWebBehaviour.crossingAction`
        )
    },
    webPopulations:
      Array.isArray(rawDefaults.webPopulations)
        ? rawDefaults.webPopulations
        : (() => {
            throw new TypeError(
              `Dynamic Webs | ${DEFAULTS_CONTEXT}.webPopulations must be an array.`
            );
          })(),
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

export const DEFAULT_SCENE_WEB_POPULATION_CATEGORY_DENSITIES =
  DEFAULT_SCENE_CONFIGURATION.webPopulationCategoryDensities;

export const DEFAULT_SCENE_WEB_POPULATION_COLOUR =
  DEFAULT_SCENE_CONFIGURATION.webPopulationColour;

export const DEFAULT_SCENE_WEB_POPULATION_THICKNESS =
  DEFAULT_SCENE_CONFIGURATION.webPopulationThickness;

export const DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR =
  DEFAULT_SCENE_CONFIGURATION.spanWebBehaviour;

export const DEFAULT_SCENE_WEB_POPULATIONS =
  DEFAULT_SCENE_CONFIGURATION.webPopulations;

