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
      "webDensity",
    WEB_COLOUR:
      "webColour",
    WEB_THICKNESS:
      "webThickness",
    CORNER_WEB_DENSITY:
      "cornerWebDensity",
    SPAN_WEB_DENSITY:
      "spanWebDensity",
    GROUND_WEB_DENSITY:
      "groundWebDensity",
    CARPET_WEB_DENSITY:
      "carpetWebDensity",
    WEB_POPULATIONS:
      "webPopulations",
    MUTABLE_STATE:
      "mutableState"
  });


/** Determine whether a Scene differential affects modular web populations. */
export function doesSceneUpdateAffectWebPopulations(
  changed
) {
  return doesSceneUpdateAffectFlag(
    changed,
    SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS
  );
}

/** Determine whether a Scene differential carries persistent destroyed-span state. */
export function doesSceneUpdateAffectWebMutableState(
  changed
) {
  return doesSceneUpdateAffectFlag(
    changed,
    SCENE_WEB_FLAG_KEYS.MUTABLE_STATE
  );
}

/** Determine whether a Scene differential affects Dynamic Webs density. */
export function doesSceneUpdateAffectWebDensity(
  changed
) {
  return doesSceneUpdateAffectFlag(
    changed,
    SCENE_WEB_FLAG_KEYS.WEB_DENSITY
  );
}


/** Determine whether a Scene differential affects a category-specific density. */
export function doesSceneUpdateAffectWebCategoryDensity(
  changed
) {
  return [
    SCENE_WEB_FLAG_KEYS.CORNER_WEB_DENSITY,
    SCENE_WEB_FLAG_KEYS.SPAN_WEB_DENSITY,
    SCENE_WEB_FLAG_KEYS.GROUND_WEB_DENSITY,
    SCENE_WEB_FLAG_KEYS.CARPET_WEB_DENSITY
  ].some(
    (
      flagKey
    ) =>
      doesSceneUpdateAffectFlag(
        changed,
        flagKey
      )
  );
}

/** Determine whether a Scene differential affects the web colour profile. */
export function doesSceneUpdateAffectWebColour(
  changed
) {
  return doesSceneUpdateAffectFlag(
    changed,
    SCENE_WEB_FLAG_KEYS.WEB_COLOUR
  );
}

/** Determine whether a Scene differential affects visible web thickness. */
export function doesSceneUpdateAffectWebThickness(
  changed
) {
  return doesSceneUpdateAffectFlag(
    changed,
    SCENE_WEB_FLAG_KEYS.WEB_THICKNESS
  );
}

/** Determine whether a Scene differential changes generation geometry. */
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

function doesSceneUpdateAffectFlag(
  changed,
  flagKey
) {
  return objectContainsPath(
    changed,
    (
      path,
      child
    ) => {
      const exactPath =
        `${SCENE_WEB_FLAG_PATH}.${flagKey}`;

      return (
        path ===
          exactPath ||
        path.startsWith(
          `${exactPath}.`
        ) ||
        path ===
          `flags.${SCENE_WEB_FLAG_NAMESPACE}.-=${flagKey}` ||
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
