import {
  BASE_WEB_LEVEL_ID
} from "../simulation/webs/webLevelContract.js";

import {
  resolveWebLevelProvider
} from "./webLevelProvider.js";

export function resolveVisibleWebLevelIds({
  scene = globalThis.canvas?.scene,
  providerResolution = null
} = {}) {
  const resolution =
    providerResolution ??
    resolveWebLevelProvider({
      scene
    });

  const allLevelIds =
    Object.freeze(
      resolution.levels.map(
        (
          level
        ) =>
          level.id
      )
    );

  const requestedActiveViewedLevelId =
    typeof resolution.activeViewedLevelId ===
      "string"
      ? resolution.activeViewedLevelId.trim()
      : "";

  const activeViewedLevelId =
    allLevelIds.includes(
      requestedActiveViewedLevelId
    )
      ? requestedActiveViewedLevelId
      : allLevelIds[0] ??
        BASE_WEB_LEVEL_ID;

  return Object.freeze({
    policy:
      "active-viewed-level",
    activeViewedLevelId,
    visibleLevelIds:
      Object.freeze([
        activeViewedLevelId
      ])
  });
}

export function filterWebsForVisibleLevels(
  webs,
  visibleLevelIds
) {
  const allowed =
    new Set(
      Array.isArray(
        visibleLevelIds
      )
        ? visibleLevelIds.map(
            String
          )
        : []
    );

  return Object.freeze(
    (
      Array.isArray(
        webs
      )
        ? webs
        : []
    ).filter(
      (
        web
      ) =>
        allowed.has(
          String(
            web?.levelId ??
            BASE_WEB_LEVEL_ID
          )
        )
    )
  );
}

export function doesSceneUpdateAffectViewedWebLevel(
  changed
) {
  return objectContainsPathPrefix(
    changed,
    [
      "_view",
      "viewedLevel",
      "viewedLevelId",
      "initialLevel"
    ]
  );
}

export function doesTokenUpdateAffectViewedWebLevel(
  changed
) {
  return objectContainsPathPrefix(
    changed,
    [
      "elevation",
      "flags.levels",
      "flags.wall-height"
    ]
  );
}

function objectContainsPathPrefix(
  value,
  prefixes,
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
    ) {
      return true;
    }

    if (
      objectContainsPathPrefix(
        child,
        prefixes,
        path
      )
    ) {
      return true;
    }
  }

  return false;
}
