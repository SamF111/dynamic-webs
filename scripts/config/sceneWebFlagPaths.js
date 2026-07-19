import {
  MODULE_ID
} from "../module/moduleConstants.js";

export const SCENE_WEB_FLAG_NAMESPACE =
  MODULE_ID;

export const SCENE_WEB_FLAG_PATH =
  `flags.${SCENE_WEB_FLAG_NAMESPACE}`;

export const SCENE_WEB_FLAG_KEYS =
  Object.freeze({
    WEB_DENSITY:
      "webDensity"
  });

/**
 * Determine whether a Scene differential affects Dynamic Webs density.
 *
 * @param {unknown} changed - updateScene differential.
 * @returns {boolean} True when density changed or the namespace was removed.
 */
export function doesSceneUpdateAffectWebDensity(
  changed
) {
  return objectContainsPath(
    changed,
    (
      path,
      child
    ) => {
      const exactPath =
        `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.WEB_DENSITY}`;

      return (
        path ===
          exactPath ||
        path.startsWith(
          `${exactPath}.`
        ) ||
        path ===
          `flags.${SCENE_WEB_FLAG_NAMESPACE}.-=${SCENE_WEB_FLAG_KEYS.WEB_DENSITY}` ||
        path ===
          `flags.-=${SCENE_WEB_FLAG_NAMESPACE}` ||
        (
          path ===
            SCENE_WEB_FLAG_PATH &&
          (
            !child ||
            typeof child !==
              "object" ||
            Array.isArray(
              child
            )
          )
        )
      );
    }
  );
}

/**
 * Determine whether a Scene differential changes geometry used by generation.
 *
 * @param {unknown} changed - updateScene differential.
 * @returns {boolean} True when Scene geometry may have changed.
 */
export function doesSceneUpdateAffectWebGeometry(
  changed
) {
  const prefixes =
    [
      "width",
      "height",
      "padding",
      "grid",
      "background.offsetX",
      "background.offsetY"
    ];

  return objectContainsPath(
    changed,
    (
      path
    ) =>
      prefixes.some(
        (
          prefix
        ) =>
          path ===
            prefix ||
          path.startsWith(
            `${prefix}.`
          )
      )
  );
}

function objectContainsPath(
  value,
  predicate,
  parentPath = ""
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return false;
  }

  for (
    const [
      key,
      child
    ] of Object.entries(
      value
    )
  ) {
    const path =
      parentPath
        ? `${parentPath}.${key}`
        : key;

    if (
      predicate(
        path,
        child
      )
    ) {
      return true;
    }

    if (
      objectContainsPath(
        child,
        predicate,
        path
      )
    ) {
      return true;
    }
  }

  return false;
}
