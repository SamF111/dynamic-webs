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
  detectFoundryMajorVersion
} from "./foundryVersionCompatibility.js";

export class FoundryV14NativeWebLevelProvider {
  constructor({
    game = globalThis.game,
    canvas = globalThis.canvas
  } = {}) {
    this.game =
      game;
    this.canvas =
      canvas;
    this.mode =
      WEB_LEVEL_PROVIDER_MODES.NATIVE_V14;
  }

  isAvailable(
    scene = this.canvas?.scene
  ) {
    return detectFoundryMajorVersion({
      game:
        this.game
    }) >=
      14 &&
      Boolean(
        scene
      );
  }

  resolveLevels(
    scene = this.canvas?.scene
  ) {
    const rawLevels =
      collectValues(
        scene?.levels ??
        scene?.availableLevels
      );

    const levels =
      rawLevels
        .map(
          (
            level,
            index
          ) =>
            normaliseNativeLevel(
              level,
              index
            )
        )
        .filter(
          Boolean
        );

    if (
      levels.length ===
        0
    ) {
      const initial =
        normaliseNativeLevel(
          scene?.initialLevel ??
          scene?.firstLevel,
          0
        );

      if (initial) {
        levels.push(
          initial
        );
      }
    }

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

    const parent =
      document?.parent ??
      candidate?.parent ??
      null;

    const directLevelId =
      firstIdentifier(
        document?.level?.id,
        document?.levelId,
        document?._source?.levelId,
        document?._source?.level,
        parent?.documentName ===
          "Level"
          ? parent.id
          : null,
        parent?.constructor?.name ===
          "Level"
          ? parent.id
          : null
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

    const band =
      resolveDocumentBand(
        document
      );

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
      directLevelId
    ) {
      level =
        createWebLevelDescriptor({
          id:
            directLevelId,
          label:
            directLevelId,
          providerMode:
            this.mode,
          elevationBand:
            band ??
            {},
          source:
            "wall-direct"
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
          ? "native-level-id"
          : band
            ? "native-elevation-band"
            : "native-fallback"
    });
  }

  resolveActiveViewedLevel(
    scene = this.canvas?.scene,
    levels = this.resolveLevels(
      scene
    )
  ) {
    const directId =
      firstIdentifier(
        scene?._view,
        scene?.viewedLevel?.id,
        scene?.viewedLevelId,
        this.canvas?.level?.id,
        this.canvas?.scene?.initialLevel?.id
      );

    if (
      directId &&
      levels.some(
        (
          level
        ) =>
          level.id ===
          directId
      )
    ) {
      return directId;
    }

    const viewElevation =
      normaliseOptionalFiniteNumber(
        scene?.viewedLevel?.elevation?.bottom ??
        scene?.viewedElevation ??
        this.canvas?.scene?.initialLevel?.elevation?.bottom
      );

    if (
      viewElevation !==
        null
    ) {
      const matching =
        levels.find(
          (
            level
          ) =>
            containsElevation(
              level.elevationBand,
              viewElevation
            )
        );

      if (matching) {
        return matching.id;
      }
    }

    return levels[0]?.id ??
      BASE_WEB_LEVEL_ID;
  }
}

function normaliseNativeLevel(
  level,
  index
) {
  if (
    !level ||
    typeof level !==
      "object"
  ) {
    return null;
  }

  const band =
    resolveDocumentBand(
      level
    ) ??
    {
      bottom:
        null,
      top:
        null
    };

  const id =
    firstIdentifier(
      level.id,
      level._id,
      level.uuid
    ) ??
    (
      band.bottom !==
        null ||
      band.top !==
        null
        ? createElevationBandLevelId(
            band.bottom,
            band.top
          )
        : `native-level-${index}`
    );

  return createWebLevelDescriptor({
    id,
    label:
      firstIdentifier(
        level.name,
        level.label
      ),
    providerMode:
      WEB_LEVEL_PROVIDER_MODES.NATIVE_V14,
    elevationBand:
      band,
    source:
      "foundry-v14"
  });
}

function resolveDocumentBand(
  document
) {
  const bottom =
    firstFinite(
      document?.elevation?.bottom,
      document?._source?.elevation?.bottom,
      document?.bottom,
      document?._source?.bottom,
      document?.range?.bottom,
      document?._source?.range?.bottom
    );

  const top =
    firstFinite(
      document?.elevation?.top,
      document?._source?.elevation?.top,
      document?.top,
      document?._source?.top,
      document?.range?.top,
      document?._source?.range?.top
    );

  return bottom ===
      null &&
    top ===
      null
    ? null
    : {
        bottom,
        top:
          top ??
          bottom
      };
}

function collectValues(
  collection
) {
  if (
    Array.isArray(
      collection?.contents
    )
  ) {
    return collection.contents;
  }

  if (
    Array.isArray(
      collection
    )
  ) {
    return collection;
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
    compareLevels
  );
}

function compareLevels(
  first,
  second
) {
  const firstBottom =
    first.elevationBand.bottom ??
    Number.NEGATIVE_INFINITY;

  const secondBottom =
    second.elevationBand.bottom ??
    Number.NEGATIVE_INFINITY;

  return firstBottom -
    secondBottom ||
    first.id.localeCompare(
      second.id
    );
}

function containsElevation(
  band,
  elevation
) {
  const bottom =
    band.bottom ??
    Number.NEGATIVE_INFINITY;

  const top =
    band.top ??
    Number.POSITIVE_INFINITY;

  return elevation >=
    bottom &&
    elevation <=
      top;
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
