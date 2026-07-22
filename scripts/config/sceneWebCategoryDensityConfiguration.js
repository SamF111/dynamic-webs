import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getSceneWebDensityConfiguration,
  normaliseSceneWebDensity
} from "./sceneWebDensityConfiguration.js";

import {
  readRawSceneWebConfiguration
} from "./sceneWebFlagReading.js";

import {
  SCENE_WEB_FLAG_KEYS
} from "./sceneWebFlagPaths.js";

import {
  DISABLED_WEB_DENSITY_ID,
  getWebDensityPreset
} from "../simulation/webs/webDensityPresets.js";

export const WEB_CATEGORY_IDS =
  Object.freeze([
    "wall-corner",
    "wall-span",
    "ground",
    "web-carpet"
  ]);

export const IMPLEMENTED_WEB_CATEGORY_IDS =
  Object.freeze([
    "wall-corner",
    "wall-span",
    "ground",
    "web-carpet"
  ]);

export const WEB_CATEGORY_DENSITY_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      categoryId:
        "wall-corner",
      flagKey:
        SCENE_WEB_FLAG_KEYS.CORNER_WEB_DENSITY,
      generationKey:
        "cornerWebs",
      label:
        "Corner-web density",
      implemented:
        true
    }),
    Object.freeze({
      categoryId:
        "wall-span",
      flagKey:
        SCENE_WEB_FLAG_KEYS.SPAN_WEB_DENSITY,
      generationKey:
        "spanWebs",
      label:
        "Span-web density",
      implemented:
        true
    }),
    Object.freeze({
      categoryId:
        "ground",
      flagKey:
        SCENE_WEB_FLAG_KEYS.GROUND_WEB_DENSITY,
      generationKey:
        "groundWebs",
      label:
        "Ground-web density",
      implemented:
        true
    }),
    Object.freeze({
      categoryId:
        "web-carpet",
      flagKey:
        SCENE_WEB_FLAG_KEYS.CARPET_WEB_DENSITY,
      generationKey:
        "carpetWebs",
      label:
        "Carpet-web density",
      implemented:
        true
    })
  ]);

const WEB_CATEGORY_DENSITY_DEFINITIONS_BY_ID =
  new Map(
    WEB_CATEGORY_DENSITY_DEFINITIONS.map(
      (
        definition
      ) => [
        definition.categoryId,
        definition
      ]
    )
  );

/** Resolve one supported public web-category identifier. */
export function getWebCategoryDensityDefinition(
  categoryId
) {
  if (
    typeof categoryId !==
      "string"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Web category must be a string.`
    );
  }

  const normalisedCategoryId =
    categoryId.trim();

  const definition =
    WEB_CATEGORY_DENSITY_DEFINITIONS_BY_ID.get(
      normalisedCategoryId
    );

  if (!definition) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported web category "${normalisedCategoryId}". Supported categories: ${WEB_CATEGORY_IDS.join(", ")}.`
    );
  }

  return definition;
}

/** Normalise one category-specific density using the shared density states. */
export function normaliseSceneWebCategoryDensity(
  value,
  categoryId
) {
  getWebCategoryDensityDefinition(
    categoryId
  );

  return normaliseSceneWebDensity(
    value
  );
}

/**
 * Resolve all Scene category densities with legacy webDensity fallback.
 *
 * @param {object} scene - Scene document or Scene-like object.
 * @returns {Readonly<object>} Frozen category-density resolution.
 */
export function getSceneWebCategoryDensityConfiguration(
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
      `${MODULE_TITLE} | A Scene document is required to read category web densities.`
    );
  }

  const rawConfiguration =
    readRawSceneWebConfiguration(
      scene
    );

  const legacyConfiguration =
    getSceneWebDensityConfiguration(
      scene
    );

  const categoryConfigurations =
    {};

  const densityIds =
    {};

  const sources =
    {};

  const generationOptions =
    {};

  for (
    const definition of
    WEB_CATEGORY_DENSITY_DEFINITIONS
  ) {
    const rawValue =
      rawConfiguration[
        definition.flagKey
      ];

    const hasExplicitValue =
      rawValue !==
        null &&
      rawValue !==
        undefined &&
      rawValue !==
        "";

    const densityId =
      normaliseSceneWebCategoryDensity(
        hasExplicitValue
          ? rawValue
          : legacyConfiguration.densityId,
        definition.categoryId
      );

    const preset =
      getWebDensityPreset(
        densityId
      );

    const enabled =
      densityId !==
        DISABLED_WEB_DENSITY_ID;

    const source =
      hasExplicitValue
        ? "explicit"
        : "legacy-fallback";

    let categoryGenerationOptions =
      null;

    if (
      definition.implemented ===
        true &&
      definition.generationKey
    ) {
      categoryGenerationOptions =
        Object.freeze(
          enabled
            ? {
                ...preset.configuration[
                  definition.generationKey
                ],
                enabled:
                  true
              }
            : {
                enabled:
                  false
              }
        );

      generationOptions[
        definition.generationKey
      ] =
        categoryGenerationOptions;
    }

    categoryConfigurations[
      definition.categoryId
    ] =
      Object.freeze({
        categoryId:
          definition.categoryId,
        flagKey:
          definition.flagKey,
        densityId,
        source,
        explicit:
          hasExplicitValue,
        enabled,
        implemented:
          definition.implemented,
        generationActive:
          definition.implemented ===
            true &&
          enabled,
        preset,
        generationOptions:
          categoryGenerationOptions
      });

    densityIds[
      definition.categoryId
    ] =
      densityId;

    sources[
      definition.categoryId
    ] =
      source;
  }

  const frozenCategories =
    Object.freeze(
      categoryConfigurations
    );

  const frozenDensityIds =
    Object.freeze(
      densityIds
    );

  const frozenSources =
    Object.freeze(
      sources
    );

  const frozenGenerationOptions =
    Object.freeze(
      generationOptions
    );

  return Object.freeze({
    legacyDensityId:
      legacyConfiguration.densityId,
    categoryDensities:
      frozenDensityIds,
    categoryDensitySources:
      frozenSources,
    categories:
      frozenCategories,
    implementedEnabled:
      IMPLEMENTED_WEB_CATEGORY_IDS.some(
        (
          categoryId
        ) =>
          frozenCategories[
            categoryId
          ].generationActive ===
            true
      ),
    generationOptions:
      frozenGenerationOptions
  });
}
