import {
  BASE_WEB_LEVEL_ID,
  WEB_LEVEL_PROVIDER_MODES,
  createBaseWebLevel,
  createElevationBandLevelId,
  createWebLevelDescriptor,
  elevationBandsEqual,
  elevationBandsOverlap
} from "../simulation/webs/webLevelContract.js";

import {
  normaliseOptionalFiniteNumber
} from "./compatibilityNumbers.js";

import {
  detectLevelsModuleSupport
} from "./foundryVersionCompatibility.js";

export class LevelsV13WebLevelProvider {
  constructor({
    game = globalThis.game,
    canvas = globalThis.canvas,
    levelsApi = globalThis.CONFIG?.Levels
  } = {}) {
    this.game =
      game;
    this.canvas =
      canvas;
    this.levelsApi =
      levelsApi;
    this.mode =
      WEB_LEVEL_PROVIDER_MODES.LEVELS_V13;
  }

  isAvailable() {
    return detectLevelsModuleSupport({
      game:
        this.game,
      canvas:
        this.canvas
    });
  }

  resolveLevels(
    scene = this.canvas?.scene
  ) {
    const source =
      scene?.getFlag?.(
        "levels",
        "sceneLevels"
      ) ??
      scene?.flags?.levels?.sceneLevels ??
      this.levelsApi?.sceneLevels ??
      this.levelsApi?.UI?.levels ??
      [];

    const levels =
      collectValues(
        source
      )
        .map(
          (
            value,
            index
          ) =>
            normaliseLevelsEntry(
              value,
              index
            )
        )
        .filter(
          Boolean
        );

    return Object.freeze(
      deduplicateAndSortLevels(
        levels.length >
          0
          ? levels
          : [
              createBaseWebLevel()
            ]
      )
    );
  }

  resolveWallLevelMetadata(
    candidate,
    levels = this.resolveLevels()
  ) {
    const document =
      candidate?.document ??
      candidate;

    const helperBand =
      resolveLevelsHelperBand(
        this.levelsApi,
        document
      );

    const band =
      helperBand ??
      resolveWallHeightBand(
        document
      );

    const directLevelId =
      firstIdentifier(
        document?.flags?.levels?.levelId,
        document?._source?.flags?.levels?.levelId,
        document?.flags?.levels?.id,
        document?._source?.flags?.levels?.id
      );

    let level =
      directLevelId
        ? levels.find(
            (
              entry
            ) =>
              entry.id ===
              directLevelId
          ) ??
          null
        : null;

    if (
      !level &&
      band
    ) {
      level =
        levels.find(
          (
            entry
          ) =>
            elevationBandsEqual(
              entry.elevationBand,
              band
            )
        ) ??
        levels.find(
          (
            entry
          ) =>
            elevationBandsOverlap(
              entry.elevationBand,
              band
            )
        ) ??
        null;
    }

    if (
      !level &&
      band
    ) {
      level =
        createWebLevelDescriptor({
          id:
            createElevationBandLevelId(
              band.bottom,
              band.top
            ),
          providerMode:
            this.mode,
          elevationBand:
            band,
          source:
            "wall-height"
        });
    }

    level ??=
      levels.find(
        (
          entry
        ) =>
          entry.id ===
          BASE_WEB_LEVEL_ID
      ) ??
      levels[0] ??
      createBaseWebLevel();

    return Object.freeze({
      levelProviderMode:
        this.mode,
      levelId:
        level.id,
      elevationBand:
        level.elevationBand,
      resolved:
        Boolean(
          directLevelId ||
          band
        ),
      source:
        directLevelId
          ? "levels-level-id"
          : band
            ? "levels-elevation-band"
            : "levels-fallback"
    });
  }

  resolveActiveViewedLevel(
    _scene = this.canvas?.scene,
    levels = this.resolveLevels()
  ) {
    const controlledTokenLevelId =
      resolveControlledTokenLevelId({
        canvas:
          this.canvas,
        levelsApi:
          this.levelsApi,
        levels
      });

    if (controlledTokenLevelId) {
      return controlledTokenLevelId;
    }

    const range =
      resolveActiveRange(
        this.levelsApi
      );

    const rangeLevel =
      resolveLevelForElevationBand(
        levels,
        range
      );

    return rangeLevel?.id ??
      levels[0]?.id ??
      BASE_WEB_LEVEL_ID;
  }
}

/**
 * Resolve one unambiguous viewed level from the currently controlled tokens.
 *
 * A single controlled token, or several controlled tokens on the same level,
 * takes precedence over the Levels UI range. When controlled tokens resolve to
 * different levels no arbitrary choice is made; callers fall back to the
 * provider-owned active range instead.
 *
 * @param {object} options - Resolution values.
 * @returns {string|null} Matching detected level ID or null.
 */
function resolveControlledTokenLevelId({
  canvas,
  levelsApi,
  levels
}) {
  const controlledTokens =
    collectControlledTokens(
      canvas
    );

  if (
    controlledTokens.length ===
      0
  ) {
    return null;
  }

  const resolvedLevelIds =
    new Set();

  for (
    const token of
    controlledTokens
  ) {
    const level =
      resolveLevelForToken({
        token,
        levelsApi,
        levels
      });

    if (level) {
      resolvedLevelIds.add(
        level.id
      );
    }
  }

  return resolvedLevelIds.size ===
    1
    ? resolvedLevelIds.values().next().value
    : null;
}

/** @returns {object[]} Controlled canvas token placeables/documents. */
function collectControlledTokens(
  canvas
) {
  const tokens =
    [];

  const addToken =
    (
      token
    ) => {
      if (
        !token ||
        typeof token !==
          "object" ||
        tokens.includes(
          token
        )
      ) {
        return;
      }

      tokens.push(
        token
      );
    };

  for (
    const token of
    Array.isArray(
      canvas?.tokens?.controlled
    )
      ? canvas.tokens.controlled
      : []
  ) {
    addToken(
      token
    );
  }

  for (
    const token of
    collectValues(
      canvas?.tokens?.placeables ??
      canvas?.tokens?.objects?.children ??
      []
    )
  ) {
    if (
      token?.controlled ===
        true ||
      token?.isControlled ===
        true
    ) {
      addToken(
        token
      );
    }
  }

  return tokens;
}

/** Resolve one controlled token against the provider's detected levels. */
function resolveLevelForToken({
  token,
  levelsApi,
  levels
}) {
  const document =
    token?.document ??
    token;

  const directLevelId =
    firstIdentifier(
      document?.flags?.levels?.levelId,
      document?._source?.flags?.levels?.levelId,
      document?.flags?.levels?.id,
      document?._source?.flags?.levels?.id
    );

  if (directLevelId) {
    const directLevel =
      levels.find(
        (
          level
        ) =>
          level.id ===
            directLevelId
      );

    if (directLevel) {
      return directLevel;
    }
  }

  const band =
    resolveLevelsHelperBand(
      levelsApi,
      document
    ) ??
    resolveTokenElevationBand(
      document
    );

  return resolveLevelForElevationBand(
    levels,
    band
  );
}

/** Resolve a point-like token elevation band. */
function resolveTokenElevationBand(
  document
) {
  const explicitBand =
    resolveWallHeightBand(
      document
    );

  if (explicitBand) {
    return explicitBand;
  }

  const elevation =
    firstFinite(
      document?.elevation,
      document?._source?.elevation,
      document?.document?.elevation,
      document?.document?._source?.elevation
    );

  return elevation ===
    null
    ? null
    : {
        bottom:
          elevation,
        top:
          elevation
      };
}

/** Resolve the closest detected level for one elevation band. */
function resolveLevelForElevationBand(
  levels,
  band
) {
  if (!band) {
    return null;
  }

  return levels.find(
    (
      level
    ) =>
      elevationBandsEqual(
        level.elevationBand,
        band
      )
  ) ??
    levels.find(
      (
        level
      ) =>
        elevationBandsOverlap(
          level.elevationBand,
          band
        )
    ) ??
    null;
}

function normaliseLevelsEntry(
  value,
  index
) {
  if (
    Array.isArray(
      value
    )
  ) {
    const bottom =
      normaliseOptionalFiniteNumber(
        value[0]
      );

    const top =
      normaliseOptionalFiniteNumber(
        value[1]
      ) ??
      bottom;

    if (
      bottom ===
        null &&
      top ===
        null
    ) {
      return null;
    }

    return createWebLevelDescriptor({
      id:
        firstIdentifier(
          value[3]
        ) ??
        createElevationBandLevelId(
          bottom,
          top
        ),
      label:
        firstIdentifier(
          value[2]
        ),
      providerMode:
        WEB_LEVEL_PROVIDER_MODES.LEVELS_V13,
      elevationBand: {
        bottom,
        top
      },
      source:
        "levels-scene-flag"
    });
  }

  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const bottom =
    firstFinite(
      value.bottom,
      value.rangeBottom,
      value.min,
      value.elevation?.bottom,
      value.range?.bottom
    );

  const top =
    firstFinite(
      value.top,
      value.rangeTop,
      value.max,
      value.elevation?.top,
      value.range?.top
    ) ??
    bottom;

  if (
    bottom ===
      null &&
    top ===
      null
  ) {
    return null;
  }

  return createWebLevelDescriptor({
    id:
      firstIdentifier(
        value.id,
        value._id,
        value.levelId
      ) ??
      createElevationBandLevelId(
        bottom,
        top
      ) ??
      `levels-level-${index}`,
    label:
      firstIdentifier(
        value.name,
        value.label
      ),
    providerMode:
      WEB_LEVEL_PROVIDER_MODES.LEVELS_V13,
    elevationBand: {
      bottom,
      top
    },
    source:
      "levels-scene-flag"
  });
}

function resolveWallHeightBand(
  document
) {
  const wallHeight =
    document?.flags?.["wall-height"] ??
    document?._source?.flags?.["wall-height"] ??
    {};

  const levels =
    document?.flags?.levels ??
    document?._source?.flags?.levels ??
    {};

  const bottom =
    firstFinite(
      wallHeight.bottom,
      wallHeight.rangeBottom,
      levels.bottom,
      levels.rangeBottom
    );

  const top =
    firstFinite(
      wallHeight.top,
      wallHeight.rangeTop,
      levels.top,
      levels.rangeTop
    ) ??
    bottom;

  return bottom ===
      null &&
    top ===
      null
    ? null
    : {
        bottom,
        top
      };
}

function resolveLevelsHelperBand(
  levelsApi,
  document
) {
  const helpers =
    levelsApi?.helpers ??
    levelsApi?.API ??
    null;

  const resolver =
    helpers?.getRangeForDocument ??
    helpers?.getDocumentRange ??
    null;

  if (
    typeof resolver !==
      "function"
  ) {
    return null;
  }

  try {
    const value =
      resolver.call(
        helpers,
        document
      );

    const bottom =
      firstFinite(
        value?.bottom,
        value?.[0]
      );

    const top =
      firstFinite(
        value?.top,
        value?.[1]
      ) ??
      bottom;

    return bottom ===
        null &&
      top ===
        null
      ? null
      : {
          bottom,
          top
        };
  } catch (_error) {
    return null;
  }
}

function resolveActiveRange(
  levelsApi
) {
  const value =
    levelsApi?.UI?.range ??
    levelsApi?.ui?.range ??
    levelsApi?.currentRange ??
    null;

  const bottom =
    firstFinite(
      value?.bottom,
      value?.[0],
      levelsApi?.UI?.rangeBottom
    );

  const top =
    firstFinite(
      value?.top,
      value?.[1],
      levelsApi?.UI?.rangeTop
    ) ??
    bottom;

  return bottom ===
      null &&
    top ===
      null
    ? null
    : {
        bottom,
        top
      };
}

function collectValues(
  collection
) {
  if (
    Array.isArray(
      collection
    )
  ) {
    return collection;
  }

  if (
    Array.isArray(
      collection?.contents
    )
  ) {
    return collection.contents;
  }

  if (
    collection &&
    typeof collection.values ===
      "function"
  ) {
    return Array.from(
      collection.values()
    );
  }

  if (
    collection &&
    typeof collection ===
      "object"
  ) {
    return Object.values(
      collection
    );
  }

  return [];
}

function deduplicateAndSortLevels(
  levels
) {
  const byId =
    new Map();

  for (
    const level of
    levels
  ) {
    byId.set(
      level.id,
      level
    );
  }

  return Array.from(
    byId.values()
  ).sort(
    (
      first,
      second
    ) =>
      (
        first.elevationBand.bottom ??
        Number.NEGATIVE_INFINITY
      ) -
        (
          second.elevationBand.bottom ??
          Number.NEGATIVE_INFINITY
        ) ||
      first.id.localeCompare(
        second.id
      )
  );
}

function firstIdentifier(
  ...values
) {
  for (
    const value of
    values
  ) {
    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      continue;
    }

    const text =
      String(
        value
      ).trim();

    if (
      text.length >
        0 &&
      text !==
        "[object Object]"
    ) {
      return text;
    }
  }

  return null;
}

function firstFinite(
  ...values
) {
  for (
    const value of
    values
  ) {
    const number =
      normaliseOptionalFiniteNumber(
        value
      );

    if (
      number !==
        null
    ) {
      return number;
    }
  }

  return null;
}
