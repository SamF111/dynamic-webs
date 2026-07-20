import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getSceneWebCategoryDensityConfiguration,
  getWebCategoryDensityDefinition,
  normaliseSceneWebCategoryDensity
} from "../config/sceneWebCategoryDensityConfiguration.js";

import {
  requireCurrentUserIsGM,
  resolveSceneDocument
} from "./foundryAccess.js";

/** Return all resolved category-density identifiers for one Scene. */
export function getPublicSceneWebCategoryDensities(
  sceneId = null
) {
  const scene =
    resolveSceneDocument(
      sceneId
    );

  return getSceneWebCategoryDensityConfiguration(
    scene
  ).categoryDensities;
}

/** Return one resolved category-density identifier for one Scene. */
export function getPublicSceneWebCategoryDensity(
  categoryId,
  sceneId = null
) {
  const definition =
    getWebCategoryDensityDefinition(
      categoryId
    );

  return getPublicSceneWebCategoryDensities(
    sceneId
  )[
    definition.categoryId
  ];
}

/** Persist one category-specific Scene density. */
export async function setPublicSceneWebCategoryDensity(
  categoryId,
  densityId,
  sceneId = null
) {
  requireCurrentUserIsGM();

  const scene =
    resolveSceneDocument(
      sceneId
    );

  const definition =
    getWebCategoryDensityDefinition(
      categoryId
    );

  const validDensityId =
    normaliseSceneWebCategoryDensity(
      densityId,
      definition.categoryId
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
    definition.flagKey,
    validDensityId
  );
}

/** Persist several category-specific Scene densities in one Scene update. */
export async function setPublicSceneWebCategoryDensities(
  values,
  sceneId = null
) {
  requireCurrentUserIsGM();

  if (
    !values ||
    typeof values !==
      "object" ||
    Array.isArray(
      values
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Category densities must be supplied as an object.`
    );
  }

  const entries =
    Object.entries(
      values
    );

  if (
    entries.length ===
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | At least one category density is required.`
    );
  }

  const scene =
    resolveSceneDocument(
      sceneId
    );

  const updates =
    {};

  const flagEntries =
    [];

  for (
    const [
      categoryId,
      densityId
    ] of entries
  ) {
    const definition =
      getWebCategoryDensityDefinition(
        categoryId
      );

    const validDensityId =
      normaliseSceneWebCategoryDensity(
        densityId,
        definition.categoryId
      );

    updates[
      `flags.${MODULE_ID}.${definition.flagKey}`
    ] =
      validDensityId;

    flagEntries.push([
      definition.flagKey,
      validDensityId
    ]);
  }

  if (
    typeof scene.update ===
      "function"
  ) {
    return scene.update(
      updates
    );
  }

  if (
    typeof scene.setFlag !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | Scene.update() and Scene.setFlag() are unavailable.`
    );
  }

  await Promise.all(
    flagEntries.map(
      ([
        flagKey,
        densityId
      ]) =>
        scene.setFlag(
          MODULE_ID,
          flagKey,
          densityId
        )
    )
  );

  return scene;
}
