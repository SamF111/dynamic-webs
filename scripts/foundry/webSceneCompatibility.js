import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getSceneRect
} from "./canvasCompatibility.js";

import {
  createWebLevelProviderSnapshot,
  resolveWebLevelProvider
} from "./webLevelProvider.js";

import {
  createWebLevelDescriptor
} from "../simulation/webs/webLevelContract.js";

import {
  collectWebRegionRecords
} from "./webRegionCompatibility.js";

import {
  isGeneratedSpanWallDocument
} from "./webSpanWallCompatibility.js";

/** Build the plain active-Scene context consumed by web generation. */
export function createActiveWebSceneContext(
  scene = globalThis.canvas?.scene,
  {
    requestedProviderMode = null,
    providerResolution = null
  } = {}
) {
  const sceneId =
    typeof scene?.id ===
      "string"
      ? scene.id.trim()
      : "";

  const sceneRect =
    getSceneRect();

  const gridSize =
    resolveGridSize(
      scene
    );

  if (
    !sceneId ||
    !sceneRect ||
    gridSize ===
      null
  ) {
    throw new Error(
      `${MODULE_TITLE} | The active Scene cannot provide web-generation geometry.`
    );
  }

  const levelProvider =
    providerResolution ??
    resolveWebLevelProvider({
      requestedMode:
        requestedProviderMode,
      scene
    });

  const wallSegments =
    collectStructuralWallSegments(
      scene,
      {
        providerResolution:
          levelProvider
      }
    );

  const levels =
    mergeProviderAndWallLevels(
      levelProvider.levels,
      wallSegments
    );

  const levelProviderSnapshot =
    createWebLevelProviderSnapshot({
      ...levelProvider,
      levels
    });

  const regions =
    collectWebRegionRecords({
      scene,
      providerResolution:
        levelProvider
    });

  return Object.freeze({
    sceneId,
    sceneRect,
    gridSize,
    levels,
    activeViewedLevelId:
      levelProvider.activeViewedLevelId,
    levelProvider:
      levelProviderSnapshot,
    regions,
    wallSegments:
      Object.freeze(
        wallSegments
      )
  });
}

/** Collect non-door structural wall segments from every detected Scene level. */
export function collectStructuralWallSegments(
  scene = globalThis.canvas?.scene,
  {
    providerResolution = null,
    requestedProviderMode = null
  } = {}
) {
  const levelProvider =
    providerResolution ??
    resolveWebLevelProvider({
      requestedMode:
        requestedProviderMode,
      scene
    });

  const candidates =
    resolveWallCandidates(
      scene
    );

  const byId =
    new Map();

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    const segment =
      normaliseWallSegment(
        candidates[index],
        index,
        levelProvider
      );

    if (!segment) {
      continue;
    }

    // Generation contexts already partition geometry by level. Expand native
    // multi-level walls here so each floor receives only its applicable walls.
    const { levelIds, ...geometry } = segment;
    for (const levelId of levelIds ?? [segment.levelId]) {
      const level = levelProvider.levels?.find(entry => entry.id === levelId);
      byId.set(
        `${segment.wallId}:${levelId}`,
        Object.freeze({ ...geometry, levelId,
          elevationBand: level?.elevationBand ?? segment.elevationBand })
      );
    }
  }

  return Array.from(
    byId.values()
  ).sort(
    (
      first,
      second
    ) =>
      first.levelId.localeCompare(
        second.levelId
      ) ||
      first.wallId.localeCompare(
        second.wallId
      )
  );
}

function resolveWallCandidates(
  scene
) {
  const candidates =
    [];

  appendCollection(
    candidates,
    globalThis.canvas?.walls?.placeables
  );

  appendCollection(
    candidates,
    scene?.walls
  );

  for (
    const level of
    iterateCollectionValues(
      scene?.levels ??
      scene?.availableLevels
    )
  ) {
    appendCollection(
      candidates,
      level?.walls
    );
  }

  return candidates;
}

function appendCollection(
  target,
  collection
) {
  for (
    const value of
    iterateCollectionValues(
      collection
    )
  ) {
    target.push(
      value
    );
  }
}

function iterateCollectionValues(
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

function normaliseWallSegment(
  candidate,
  index,
  levelProvider
) {
  const document =
    candidate?.document ??
    candidate;

  if (
    isGeneratedSpanWallDocument(
      document
    )
  ) {
    return null;
  }

  const coordinates =
    document?.c ??
    document?.coords ??
    document?._source?.c ??
    document?._source?.coords;

  if (
    !Array.isArray(
      coordinates
    ) ||
    coordinates.length <
      4
  ) {
    return null;
  }

  const door =
    Number(
      document?.door ??
      document?._source?.door ??
      0
    );

  if (
    door !==
      0
  ) {
    return null;
  }

  const [
    x1,
    y1,
    x2,
    y2
  ] =
    coordinates
      .slice(
        0,
        4
      )
      .map(
        Number
      );

  if (
    ![
      x1,
      y1,
      x2,
      y2
    ].every(
      Number.isFinite
    )
  ) {
    return null;
  }

  const length =
    Math.hypot(
      x2 -
        x1,
      y2 -
        y1
    );

  if (
    length <=
      0
  ) {
    return null;
  }

  const wallId =
    String(
      document?.uuid ??
      document?.id ??
      document?._id ??
      candidate?.id ??
      `wall-${index}`
    );

  const levelMetadata =
    levelProvider.resolveWallLevelMetadata(
      candidate
    );

  return Object.freeze({
    wallId,
    x1,
    y1,
    x2,
    y2,
    a:
      Object.freeze({
        x:
          x1,
        y:
          y1
      }),
    b:
      Object.freeze({
        x:
          x2,
        y:
          y2
      }),
    length,
    levelProviderMode:
      levelMetadata.levelProviderMode,
    levelId:
      levelMetadata.levelId,
    levelIds:
      levelMetadata.levelIds,
    elevationBand:
      levelMetadata.elevationBand,
    levelMetadataResolved:
      levelMetadata.resolved ===
        true,
    levelMetadataSource:
      levelMetadata.source ??
      null
  });
}

function mergeProviderAndWallLevels(
  providerLevels,
  wallSegments
) {
  const byId =
    new Map(
      (
        Array.isArray(
          providerLevels
        )
          ? providerLevels
          : []
      ).map(
        (
          level
        ) => [
          level.id,
          level
        ]
      )
    );

  for (
    const segment of
    wallSegments
  ) {
    if (
      byId.has(
        segment.levelId
      )
    ) {
      continue;
    }

    const level =
      createWebLevelDescriptor({
        id:
          segment.levelId,
        label:
          segment.levelId,
        providerMode:
          segment.levelProviderMode,
        elevationBand:
          segment.elevationBand,
        source:
          "wall-metadata"
      });

    byId.set(
      level.id,
      level
    );
  }

  return Object.freeze(
    Array.from(
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
    )
  );
}

function resolveGridSize(
  scene
) {
  const candidates =
    [
      globalThis.canvas?.dimensions?.size,
      globalThis.canvas?.grid?.size,
      scene?.grid?.size,
      scene?.grid?.distance
    ];

  for (
    const candidate of
    candidates
  ) {
    const numericValue =
      Number(
        candidate
      );

    if (
      Number.isFinite(
        numericValue
      ) &&
      numericValue >
        0
    ) {
      return numericValue;
    }
  }

  return 100;
}

