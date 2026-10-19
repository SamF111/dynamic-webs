import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  WEB_LEVEL_PROVIDER_MODES
} from "../simulation/webs/webLevelContract.js";

import {
  normaliseSpanWebVisionMode
} from "../config/spanWebBehaviourContract.js";

export const GENERATED_SPAN_WALL_FLAG =
  "generatedSpanWall";

export const GENERATED_SPAN_WALL_WEB_ID_FLAG =
  "spanWebId";

export const GENERATED_SPAN_WALL_SCHEMA_VERSION =
  1;

/** Return whether one WallDocument is owned by Dynamic Webs span behaviour. */
export function isGeneratedSpanWallDocument(
  wallDocument
) {
  const document =
    wallDocument?.document ??
    wallDocument;

  return document?.getFlag?.(
    MODULE_ID,
    GENERATED_SPAN_WALL_FLAG
  ) ===
    true ||
    document?.flags?.[
      MODULE_ID
    ]?.[
      GENERATED_SPAN_WALL_FLAG
    ] ===
      true ||
    document?._source?.flags?.[
      MODULE_ID
    ]?.[
      GENERATED_SPAN_WALL_FLAG
    ] ===
      true;
}

/** Read the stable source web ID from a generated wall. */
export function getGeneratedSpanWallWebId(
  wallDocument
) {
  const document =
    wallDocument?.document ??
    wallDocument;

  const value =
    document?.getFlag?.(
      MODULE_ID,
      GENERATED_SPAN_WALL_WEB_ID_FLAG
    ) ??
    document?.flags?.[
      MODULE_ID
    ]?.[
      GENERATED_SPAN_WALL_WEB_ID_FLAG
    ] ??
    document?._source?.flags?.[
      MODULE_ID
    ]?.[
      GENERATED_SPAN_WALL_WEB_ID_FLAG
    ];

  const text =
    String(
      value ??
      ""
    ).trim();

  return text ||
    null;
}


/** Return whether one generated wall is an already-open secret door. */
export function isGeneratedSpanWallOpenSecretDoor(
  wallDocument
) {
  if (
    !isGeneratedSpanWallDocument(
      wallDocument
    )
  ) {
    return false;
  }

  const document =
    wallDocument?.document ??
    wallDocument;

  const constants =
    resolveWallConstants();

  const door =
    Number(
      document?.door ??
      document?._source?.door ??
      constants.doorNone
    );

  const state =
    Number(
      document?.ds ??
      document?._source?.ds ??
      constants.doorClosed
    );

  return door ===
    constants.doorSecret &&
    state ===
      constants.doorOpen;
}

/** Create one Foundry WallDocument payload for an intact wall-span web. */
export function createGeneratedSpanWallData({
  web,
  behaviour,
  existingWall = null,
  preserveDoorState = true
}) {
  if (
    web?.kind !==
      "wall-span"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Generated span walls require a wall-span web blueprint.`
    );
  }

  const webId =
    String(
      web.id ??
      ""
    ).trim();

  if (
    !webId
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Generated span walls require a stable web ID.`
    );
  }

  const coordinates =
    // WallDocument's integer NumberField rounds coordinates during cleaning.
    // Compare and submit the same values to avoid rewriting unchanged walls.
    Object.freeze(
      createSpanWallCoordinates(web).map(value => Math.round(value))
    );

  const constants =
    resolveWallConstants();

  const visionMode =
    normaliseSpanWebVisionMode(
      behaviour?.visionMode
    );

  const secretDoor =
    behaviour?.secretDoor ===
      true;

  const existingDoor =
    Number(
      existingWall?.door ??
      existingWall?._source?.door ??
      constants.doorNone
    );

  const existingDoorState =
    Number(
      existingWall?.ds ??
      existingWall?._source?.ds ??
      constants.doorClosed
    );

  const shouldPreserveDoorState =
    preserveDoorState ===
      true &&
    secretDoor &&
    existingDoor ===
      constants.doorSecret;

  const levelData =
    createSpanWallLevelData(
      web
    );

  return Object.freeze({
    c:
      coordinates,
    move:
      secretDoor
        ? constants.movementNormal
        : constants.movementNone,
    sight:
      visionMode ===
        "blocked"
        ? constants.senseNormal
        : visionMode ===
            "limited"
          ? constants.senseLimited
          : constants.senseNone,
    light:
      constants.senseNone,
    sound:
      constants.senseNone,
    door:
      secretDoor
        ? constants.doorSecret
        : constants.doorNone,
    ds:
      secretDoor
        ? shouldPreserveDoorState
          ? existingDoorState
          : constants.doorClosed
        : constants.doorClosed,
    dir:
      constants.directionBoth,
    ...levelData,
    flags: {
      ...(
        levelData.flags ??
        {}
      ),
      [MODULE_ID]: {
        [GENERATED_SPAN_WALL_FLAG]:
          true,
        [GENERATED_SPAN_WALL_WEB_ID_FLAG]:
          webId,
        schemaVersion:
          GENERATED_SPAN_WALL_SCHEMA_VERSION,
        levelId:
          web.levelId ??
          null
      }
    }
  });
}

/** Create the barrier segment joining the centres of the two asset wall edges. */
export function createSpanWallCoordinates(
  web
) {
  const target =
    web?.spanAsset?.target;

  const first =
    midpoint(
      target?.firstWallStart,
      target?.firstWallEnd
    ) ??
    findPerchPoint(
      web,
      "wall-a"
    );

  const second =
    midpoint(
      target?.secondWallStart,
      target?.secondWallEnd
    ) ??
    findPerchPoint(
      web,
      "wall-b"
    );

  if (
    !first ||
    !second ||
    Math.hypot(
      second.x -
        first.x,
      second.y -
        first.y
    ) <
      0.001
  ) {
    throw new Error(
      `${MODULE_TITLE} | Wall-span web "${String(web?.id ?? "unknown")}" does not expose usable span wall anchors.`
    );
  }

  return Object.freeze([
    first.x,
    first.y,
    second.x,
    second.y
  ]);
}

/** Create provider-compatible level metadata for one generated wall. */
export function createSpanWallLevelData(
  web
) {
  const providerMode =
    web?.levelProviderMode;

  const levelId =
    String(
      web?.levelId ??
      ""
    ).trim();

  const bottom =
    normaliseOptionalFiniteNumber(
      web?.elevationBand?.bottom
    );

  const top =
    normaliseOptionalFiniteNumber(
      web?.elevationBand?.top
    ) ??
    bottom;

  if (
    providerMode ===
      WEB_LEVEL_PROVIDER_MODES.NATIVE_V14 &&
    levelId &&
    levelId !==
      "base"
  ) {
    return Object.freeze({
      levels: Object.freeze([levelId])
    });
  }

  if (
    providerMode ===
      WEB_LEVEL_PROVIDER_MODES.LEVELS_V13 &&
    (
      bottom !==
        null ||
      top !==
        null
    )
  ) {
    return Object.freeze({
      flags: {
        "wall-height": {
          bottom,
          top
        },
        levels: {
          rangeBottom:
            bottom,
          rangeTop:
            top,
          levelId:
            levelId ||
            null
        }
      }
    });
  }

  return Object.freeze({});
}

/** Compare one existing wall with a desired wall payload. */
export function generatedSpanWallMatches(
  existingWall,
  desiredData
) {
  const existing =
    existingWall?.document ??
    existingWall;

  const fields =
    [
      "move",
      "sight",
      "light",
      "sound",
      "door",
      "ds",
      "dir"
    ];

  if (
    !coordinatesEqual(
      existing?.c ??
      existing?._source?.c,
      desiredData.c
    )
  ) {
    return false;
  }

  for (
    const field of
    fields
  ) {
    if (
      Number(
        existing?.[
          field
        ] ??
        existing?._source?.[
          field
        ]
      ) !==
      Number(
        desiredData[
          field
        ]
      )
    ) {
      return false;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      desiredData,
      "levels"
    ) &&
    !levelIdsEqual(
      existing?.levels ?? existing?._source?.levels,
      desiredData.levels
    )
  ) {
    return false;
  }

  const desiredHeight =
    desiredData.flags?.[
      "wall-height"
    ];

  if (
    desiredHeight
  ) {
    const existingHeight =
      existing?.flags?.[
        "wall-height"
      ] ??
      existing?._source?.flags?.[
        "wall-height"
      ] ??
      {};

    if (
      normaliseOptionalFiniteNumber(
        existingHeight.bottom
      ) !==
        normaliseOptionalFiniteNumber(
          desiredHeight.bottom
        ) ||
      normaliseOptionalFiniteNumber(
        existingHeight.top
      ) !==
        normaliseOptionalFiniteNumber(
          desiredHeight.top
        )
    ) {
      return false;
    }
  }

  return getGeneratedSpanWallWebId(
    existing
  ) ===
    desiredData.flags?.[
      MODULE_ID
    ]?.[
      GENERATED_SPAN_WALL_WEB_ID_FLAG
    ];
}

/** Merge provider flags with Dynamic Webs ownership flags. */
export function mergeGeneratedSpanWallFlags(
  data
) {
  const providerFlags =
    data?.flags &&
    typeof data.flags ===
      "object"
      ? data.flags
      : {};

  const moduleFlags =
    providerFlags[
      MODULE_ID
    ] ??
    {};

  return Object.freeze({
    ...providerFlags,
    [MODULE_ID]: {
      ...moduleFlags
    }
  });
}

/** Native wall levels may be exposed as a Set or a source array. */
function levelIdsEqual(existing, desired) {
  const existingIds = new Set(existing ?? []);
  return existingIds.size === desired.length &&
    desired.every(id => existingIds.has(id));
}

function resolveWallConstants() {
  const constants =
    globalThis.CONST ??
    {};

  const senseTypes = constants.EDGE_SENSE_TYPES ?? constants.WALL_SENSE_TYPES;
  const directions = constants.EDGE_DIRECTIONS ?? constants.WALL_DIRECTIONS;

  return {
    movementNone:
      constants.WALL_MOVEMENT_TYPES?.NONE ??
      0,
    movementNormal:
      constants.WALL_MOVEMENT_TYPES?.NORMAL ??
      20,
    senseNone:
      senseTypes?.NONE ??
      0,
    senseLimited:
      senseTypes?.LIMITED ??
      10,
    senseNormal:
      senseTypes?.NORMAL ??
      20,
    doorNone:
      constants.WALL_DOOR_TYPES?.NONE ??
      0,
    doorSecret:
      constants.WALL_DOOR_TYPES?.SECRET ??
      2,
    doorClosed:
      constants.WALL_DOOR_STATES?.CLOSED ??
      0,
    doorOpen:
      constants.WALL_DOOR_STATES?.OPEN ??
      1,
    directionBoth:
      directions?.BOTH ??
      0
  };
}


function findPerchPoint(
  web,
  perchId
) {
  const perch =
    (
      Array.isArray(
        web?.perches
      )
        ? web.perches
        : []
    ).find(
      entry =>
        entry?.id ===
        perchId
    );

  const x =
    Number(
      perch?.x
    );
  const y =
    Number(
      perch?.y
    );

  return Number.isFinite(
    x
  ) &&
    Number.isFinite(
      y
    )
    ? Object.freeze({
        x,
        y
      })
    : null;
}

function midpoint(
  first,
  second
) {
  const firstX =
    Number(
      first?.x
    );
  const firstY =
    Number(
      first?.y
    );
  const secondX =
    Number(
      second?.x
    );
  const secondY =
    Number(
      second?.y
    );

  if (
    ![
      firstX,
      firstY,
      secondX,
      secondY
    ].every(
      Number.isFinite
    )
  ) {
    return null;
  }

  return Object.freeze({
    x:
      (
        firstX +
        secondX
      ) /
      2,
    y:
      (
        firstY +
        secondY
      ) /
      2
  });
}

function coordinatesEqual(
  first,
  second
) {
  if (
    !Array.isArray(
      first
    ) ||
    !Array.isArray(
      second
    ) ||
    first.length <
      4 ||
    second.length <
      4
  ) {
    return false;
  }

  return first
    .slice(
      0,
      4
    )
    .every(
      (
        value,
        index
      ) =>
        Math.abs(
          Number(
            value
          ) -
          Number(
            second[
              index
            ]
          )
        ) <
          0.001
    );
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
