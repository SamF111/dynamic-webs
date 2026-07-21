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

  const levels =
    normaliseDetectedLevels(
      resolution?.levels
    );

  const allLevelIds =
    Object.freeze(
      levels.map(
        (
          level
        ) =>
          level.id
      )
    );

  const requestedActiveViewedLevelId =
    typeof resolution?.activeViewedLevelId ===
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

  const visibleLevelIds =
    resolveActiveAndLowerLevelIds({
      levels,
      activeViewedLevelId
    });

  return Object.freeze({
    policy:
      "active-viewed-and-lower-levels",
    activeViewedLevelId,
    visibleLevelIds
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

function resolveActiveAndLowerLevelIds({
  levels,
  activeViewedLevelId
}) {
  if (
    !Array.isArray(
      levels
    ) ||
    levels.length ===
      0
  ) {
    return Object.freeze([
      activeViewedLevelId
    ]);
  }

  const orderedLevels =
    levels
      .map(
        (
          level,
          sourceIndex
        ) =>
          Object.freeze({
            level,
            sourceIndex,
            bottom:
              normaliseOptionalFiniteNumber(
                level?.elevationBand?.bottom
              ),
            top:
              normaliseOptionalFiniteNumber(
                level?.elevationBand?.top
              )
          })
      )
      .sort(
        compareVerticalLevelEntries
      );

  const activeIndex =
    orderedLevels.findIndex(
      (
        entry
      ) =>
        entry.level.id ===
          activeViewedLevelId
    );

  if (
    activeIndex <
      0
  ) {
    return Object.freeze([
      activeViewedLevelId
    ]);
  }

  return Object.freeze(
    orderedLevels
      .slice(
        0,
        activeIndex +
          1
      )
      .map(
        (
          entry
        ) =>
          entry.level.id
      )
  );
}

function normaliseDetectedLevels(
  levels
) {
  const normalised = [];
  const seenIds =
    new Set();

  for (
    const level of
    Array.isArray(
      levels
    )
      ? levels
      : []
  ) {
    const id =
      typeof level?.id ===
        "string"
        ? level.id.trim()
        : "";

    if (
      !id ||
      seenIds.has(
        id
      )
    ) {
      continue;
    }

    seenIds.add(
      id
    );

    normalised.push({
      ...level,
      id
    });
  }

  return normalised;
}

function compareVerticalLevelEntries(
  first,
  second
) {
  const bottomComparison =
    compareOptionalElevations(
      first.bottom,
      second.bottom
    );

  if (
    bottomComparison !==
      0
  ) {
    return bottomComparison;
  }

  const topComparison =
    compareOptionalElevations(
      first.top,
      second.top
    );

  if (
    topComparison !==
      0
  ) {
    return topComparison;
  }

  return first.sourceIndex -
    second.sourceIndex;
}

function compareOptionalElevations(
  first,
  second
) {
  if (
    first ===
      null &&
    second ===
      null
  ) {
    return 0;
  }

  if (
    first ===
      null
  ) {
    return -1;
  }

  if (
    second ===
      null
  ) {
    return 1;
  }

  return first -
    second;
}

function normaliseOptionalFiniteNumber(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
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
