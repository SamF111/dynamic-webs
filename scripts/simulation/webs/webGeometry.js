import {
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../../module/moduleConstants.js";

import {
  assertWebBlueprintIntegrity,
  createStableStrandId,
  deepFreezeWebValue
} from "./webBlueprintContract.js";

/** Generic geometry helpers shared by deterministic web generators. */

export const WEB_STRAND_KINDS =
  Object.freeze({
    STRUCTURAL:
      "structural",
    CAPTURE:
      "capture",
    DECORATIVE:
      "decorative"
  });

const SUPPORTED_STRAND_KINDS =
  new Set(
    Object.values(
      WEB_STRAND_KINDS
    )
  );

const STRAND_VISUAL_RANGES =
  Object.freeze({
    [WEB_STRAND_KINDS.STRUCTURAL]:
      Object.freeze({
        minimumAlpha: 0.58,
        maximumAlpha: 0.78,
        minimumWidthPx: 1.0,
        maximumWidthPx: 1.4,
        collisionWidthPx: 2.25
      }),
    [WEB_STRAND_KINDS.CAPTURE]:
      Object.freeze({
        minimumAlpha: 0.28,
        maximumAlpha: 0.52,
        minimumWidthPx: 0.65,
        maximumWidthPx: 1.0,
        collisionWidthPx: 2
      }),
    [WEB_STRAND_KINDS.DECORATIVE]:
      Object.freeze({
        minimumAlpha: 0.16,
        maximumAlpha: 0.36,
        minimumWidthPx: 0.5,
        maximumWidthPx: 0.8,
        collisionWidthPx: 1.5
      })
  });

/**
 * Create one immutable web-local strand.
 *
 * The final globally unique strand ID is assigned by createWebBlueprint(),
 * which qualifies this stable local ID with the owning web ID.
 */
export function createWebStrand({
  id,
  kind,
  points,
  random,
  alphaMultiplier = 1
}) {
  const localId =
    requireIdentifier(
      id,
      "local strand ID"
    );

  const strandKind =
    requireIdentifier(
      kind,
      `kind for strand "${localId}"`
    );

  if (
    !SUPPORTED_STRAND_KINDS.has(
      strandKind
    )
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${localId}" has unsupported kind "${strandKind}".`
    );
  }

  if (
    typeof random !==
      "function"
  ) {
    throw new TypeError(
      `Dynamic Webs | Strand "${localId}" requires a deterministic random function.`
    );
  }

  const safePoints =
    Array.isArray(
      points
    )
      ? points
          .filter(
            isFinitePoint
          )
          .map(
            (
              point
            ) => ({
              x:
                Number(
                  point.x
                ),
              y:
                Number(
                  point.y
                )
            })
          )
      : [];

  if (
    safePoints.length <
      2
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${localId}" must contain at least two finite points.`
    );
  }

  const range =
    STRAND_VISUAL_RANGES[
      strandKind
    ];

  const safeAlphaMultiplier =
    Number.isFinite(
      Number(
        alphaMultiplier
      )
    )
      ? Number(
          alphaMultiplier
        )
      : 1;

  const baseAlpha =
    clamp(
      randomBetween(
        random,
        range.minimumAlpha,
        range.maximumAlpha
      ) *
        safeAlphaMultiplier,
      0.05,
      1
    );

  return deepFreezeWebValue({
    schemaVersion:
      WEB_BLUEPRINT_SCHEMA_VERSION,
    id:
      localId,
    localId,
    kind:
      strandKind,
    points:
      safePoints,
    baseAlpha,
    alpha:
      baseAlpha,
    widthPx:
      randomBetween(
        random,
        range.minimumWidthPx,
        range.maximumWidthPx
      ),
    collisionWidthPx:
      range.collisionWidthPx
  });
}

/**
 * Create one complete immutable generated-web blueprint.
 *
 * @param {object} options - Blueprint values.
 * @returns {Readonly<object>} Validated immutable blueprint.
 */
export function createWebBlueprint({
  id,
  sceneId,
  populationId = "default",
  populationLabel = "Default Web Population",
  thicknessMultiplier = 1,
  levelProviderMode,
  levelId,
  elevationBand,
  seed,
  sourceKey,
  kind,
  hub,
  strands,
  perches = [],
  supportingWallIds = [],
  regionIds = [],
  regionTags = [],
  bounds = null,
  carpet = null,
  cornerAsset = null
}) {
  const webId =
    requireIdentifier(
      id,
      "web ID"
    );

  const safeSceneId =
    requireIdentifier(
      sceneId,
      `Scene ID for web "${webId}"`
    );

  const safePopulationId =
    requireIdentifier(
      populationId,
      `population ID for web "${webId}"`
    );

  const safePopulationLabel =
    requireIdentifier(
      populationLabel,
      `population label for web "${webId}"`
    );

  const safeThicknessMultiplier =
    Number(thicknessMultiplier);

  if (
    !Number.isFinite(safeThicknessMultiplier) ||
    safeThicknessMultiplier <= 0
  ) {
    throw new TypeError(
      `Dynamic Webs | Web "${webId}" requires a positive thickness multiplier.`
    );
  }

  const safeLevelProviderMode =
    requireIdentifier(
      levelProviderMode,
      `level provider mode for web "${webId}"`
    );

  const safeLevelId =
    requireIdentifier(
      levelId,
      `level ID for web "${webId}"`
    );

  const safeElevationBand =
    {
      bottom:
        normaliseOptionalFiniteNumber(
          elevationBand?.bottom
        ),
      top:
        normaliseOptionalFiniteNumber(
          elevationBand?.top
        )
    };

  if (
    safeElevationBand.bottom !==
      null &&
    safeElevationBand.top !==
      null &&
    safeElevationBand.top <
      safeElevationBand.bottom
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" has an inverted elevation band.`
    );
  }

  const safeSeed =
    requireIdentifier(
      seed,
      `generation seed for web "${webId}"`
    );

  const safeSourceKey =
    requireIdentifier(
      sourceKey,
      `source key for web "${webId}"`
    );

  const safeKind =
    requireIdentifier(
      kind,
      `kind for web "${webId}"`
    );

  if (
    !isFinitePoint(
      hub
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | Web "${webId}" requires a finite hub point.`
    );
  }

  const localStrandIds =
    new Set();

  const safeStrands =
    (
      Array.isArray(
        strands
      )
        ? strands
        : []
    )
      .filter(
        Boolean
      )
      .map(
        (
          strand
        ) => {
          const localId =
            requireIdentifier(
              strand?.localId ??
                strand?.id,
              `local strand ID for web "${webId}"`
            );

          if (
            localStrandIds.has(
              localId
            )
          ) {
            throw new Error(
              `Dynamic Webs | Web "${webId}" contains duplicate local strand ID "${localId}".`
            );
          }

          localStrandIds.add(
            localId
          );

          return {
            ...strand,
            schemaVersion:
              WEB_BLUEPRINT_SCHEMA_VERSION,
            id:
              createStableStrandId(
                webId,
                localId
              ),
            localId
          };
        }
      );

  const safeHub = {
    x:
      Number(
        hub.x
      ),
    y:
      Number(
        hub.y
      )
  };

  const safePerches =
    (
      Array.isArray(
        perches
      )
        ? perches
        : []
    )
      .filter(
        isFinitePoint
      )
      .map(
        (
          perch
        ) => ({
          id:
            requireIdentifier(
              perch.id,
              `perch ID for web "${webId}"`
            ),
          x:
            Number(
              perch.x
            ),
          y:
            Number(
              perch.y
            ),
          rotation:
            Number.isFinite(
              Number(
                perch.rotation
              )
            )
              ? Number(
                  perch.rotation
                )
              : 0
        })
      );

  const safeSupportingWallIds =
    [
      ...new Set(
        (
          Array.isArray(
            supportingWallIds
          )
            ? supportingWallIds
            : []
        )
          .filter(
            (
              wallId
            ) =>
              wallId !==
                null &&
              wallId !==
                undefined
          )
          .map(
            String
          )
      )
    ].sort(
      (
        first,
        second
      ) =>
        first.localeCompare(
          second
        )
    );

  const safeRegionIds = normaliseIdentifierList(regionIds);
  const safeRegionTags = normaliseIdentifierList(regionTags);

  const blueprint =
    deepFreezeWebValue({
      schemaVersion:
        WEB_BLUEPRINT_SCHEMA_VERSION,
      id:
        webId,
      sceneId:
        safeSceneId,
      populationId:
        safePopulationId,
      populationLabel:
        safePopulationLabel,
      thicknessMultiplier:
        safeThicknessMultiplier,
      levelProviderMode:
        safeLevelProviderMode,
      levelId:
        safeLevelId,
      elevationBand:
        safeElevationBand,
      seed:
        safeSeed,
      sourceKey:
        safeSourceKey,
      kind:
        safeKind,
      hub:
        safeHub,
      bounds:
        normaliseBlueprintBounds(
          bounds,
          calculatePointBounds([
            safeHub,
            ...safeStrands.flatMap(
              (
                strand
              ) =>
                strand.points
            )
          ])
        ),
      strands:
        safeStrands,
      perches:
        safePerches,
      supportingWallIds:
        safeSupportingWallIds,
      regionIds:
        safeRegionIds,
      regionTags:
        safeRegionTags,
      ...(
        carpet
          ? {
              carpet
            }
          : {}
      ),
      ...(
        cornerAsset
          ? {
              cornerAsset
            }
          : {}
      )
    });

  return assertWebBlueprintIntegrity(
    blueprint,
    {
      expectedSceneId:
        safeSceneId
    }
  );
}

export function sampleQuadraticBezier(
  start,
  control,
  end,
  steps = 8
) {
  const points =
    [];

  const safeSteps =
    Math.max(
      1,
      Math.trunc(
        Number(
          steps
        ) ||
        1
      )
    );

  for (
    let index = 0;
    index <=
      safeSteps;
    index += 1
  ) {
    const t =
      index /
      safeSteps;

    const inverse =
      1 -
      t;

    points.push({
      x:
        inverse *
          inverse *
          start.x +
        2 *
          inverse *
          t *
          control.x +
        t *
          t *
          end.x,
      y:
        inverse *
          inverse *
          start.y +
        2 *
          inverse *
          t *
          control.y +
        t *
          t *
          end.y
    });
  }

  return points;
}

export function lerpPoint(
  start,
  end,
  t
) {
  return {
    x:
      start.x +
      (
        end.x -
        start.x
      ) *
      t,
    y:
      start.y +
      (
        end.y -
        start.y
      ) *
      t
  };
}

export function addScaled(
  point,
  direction,
  length
) {
  return {
    x:
      point.x +
      direction.x *
      length,
    y:
      point.y +
      direction.y *
      length
  };
}

export function normaliseVector(
  vector
) {
  const length =
    Math.hypot(
      Number(
        vector?.x
      ),
      Number(
        vector?.y
      )
    );

  if (
    !Number.isFinite(
      length
    ) ||
    length <=
      0.000001
  ) {
    return {
      x:
        0,
      y:
        0
    };
  }

  return {
    x:
      Number(
        vector.x
      ) /
      length,
    y:
      Number(
        vector.y
      ) /
      length
  };
}

export function randomBetween(
  random,
  minimum,
  maximum
) {
  if (
    typeof random !==
      "function" ||
    !Number.isFinite(
      minimum
    ) ||
    !Number.isFinite(
      maximum
    )
  ) {
    return 0;
  }

  if (
    maximum <=
      minimum
  ) {
    return minimum;
  }

  return minimum +
    random() *
    (
      maximum -
      minimum
    );
}

export function clamp(
  value,
  minimum,
  maximum
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  );
}

export function calculatePointBounds(
  points
) {
  const safePoints =
    (
      Array.isArray(
        points
      )
        ? points
        : []
    ).filter(
      isFinitePoint
    );

  if (
    safePoints.length ===
      0
  ) {
    return {
      x:
        0,
      y:
        0,
      width:
        0,
      height:
        0,
      right:
        0,
      bottom:
        0
    };
  }

  const xs =
    safePoints.map(
      (
        point
      ) =>
        Number(
          point.x
        )
    );

  const ys =
    safePoints.map(
      (
        point
      ) =>
        Number(
          point.y
        )
    );

  const x =
    Math.min(
      ...xs
    );

  const y =
    Math.min(
      ...ys
    );

  const right =
    Math.max(
      ...xs
    );

  const bottom =
    Math.max(
      ...ys
    );

  return {
    x,
    y,
    width:
      right -
      x,
    height:
      bottom -
      y,
    right,
    bottom
  };
}

function normaliseBlueprintBounds(
  candidate,
  fallback
) {
  if (
    !candidate ||
    typeof candidate !==
      "object" ||
    Array.isArray(
      candidate
    )
  ) {
    return fallback;
  }

  const x =
    Number(
      candidate.x
    );

  const y =
    Number(
      candidate.y
    );

  const width =
    Number(
      candidate.width
    );

  const height =
    Number(
      candidate.height
    );

  const right =
    Number.isFinite(
      Number(
        candidate.right
      )
    )
      ? Number(
          candidate.right
        )
      : x +
        width;

  const bottom =
    Number.isFinite(
      Number(
        candidate.bottom
      )
    )
      ? Number(
          candidate.bottom
        )
      : y +
        height;

  if (
    ![
      x,
      y,
      width,
      height,
      right,
      bottom
    ].every(
      Number.isFinite
    ) ||
    width <
      0 ||
    height <
      0
  ) {
    return fallback;
  }

  return {
    x,
    y,
    width,
    height,
    right,
    bottom
  };
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
      "" ||
    value ===
      Infinity ||
    value ===
      -Infinity
  ) {
    return null;
  }

  const numericValue =
    Number(
      value
    );

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : null;
}

function isFinitePoint(
  point
) {
  return Boolean(
    point &&
    Number.isFinite(
      Number(
        point.x
      )
    ) &&
    Number.isFinite(
      Number(
        point.y
      )
    )
  );
}

function requireIdentifier(
  value,
  label
) {
  const identifier =
    String(
      value ??
      ""
    ).trim();

  if (
    identifier.length ===
      0
  ) {
    throw new TypeError(
      `Dynamic Webs | ${label} must be a non-empty identifier.`
    );
  }

  return identifier;
}


function normaliseIdentifierList(value) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean)
  )).sort((first, second) => first.localeCompare(second));
}
