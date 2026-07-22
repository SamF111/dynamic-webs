import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

export const WEB_CORNER_ASSET_PRESENTATION_SCHEMA_VERSION =
  1;

export const WEB_CORNER_ASSET_VARIANTS_PER_ANGLE =
  6;

const SOURCE_PIVOT =
  Object.freeze({
    x:
      0.5,
    y:
      0.5
  });

const SOURCE_ANCHOR_RADIUS =
  0.42;

export const WEB_CORNER_ASSET_ANGLE_FAMILIES =
  Object.freeze([
    createAngleFamily(5, 3, 7.5),
    createAngleFamily(10, 7.5, 12.5),
    createAngleFamily(15, 12.5, 20),
    createAngleFamily(25, 20, 30),
    createAngleFamily(35, 30, 40),
    createAngleFamily(45, 40, 52.5),
    createAngleFamily(60, 52.5, 67.5),
    createAngleFamily(75, 67.5, 82.5),
    createAngleFamily(90, 82.5, 100),
    createAngleFamily(110, 100, 122.5),
    createAngleFamily(135, 122.5, 142.5),
    createAngleFamily(150, 142.5, 160)
  ]);

export const WEB_CORNER_ASSETS =
  Object.freeze(
    WEB_CORNER_ASSET_ANGLE_FAMILIES.flatMap(
      (
        family
      ) =>
        Array.from(
          {
            length:
              WEB_CORNER_ASSET_VARIANTS_PER_ANGLE
          },
          (
            _unused,
            index
          ) =>
            createAssetRecord({
              family,
              variant:
                index +
                1
            })
        )
    )
  );

const ASSETS_BY_ID =
  new Map(
    WEB_CORNER_ASSETS.map(
      (
        asset
      ) => [
        asset.id,
        asset
      ]
    )
  );

const ASSETS_BY_CANONICAL_ANGLE =
  new Map(
    WEB_CORNER_ASSET_ANGLE_FAMILIES.map(
      (
        family
      ) => [
        family.canonicalAngleDeg,
        Object.freeze(
          WEB_CORNER_ASSETS.filter(
            (
              asset
            ) =>
              asset.canonicalAngleDeg ===
                family.canonicalAngleDeg
          )
        )
      ]
    )
  );

export function getWebCornerAsset(
  assetId
) {
  return ASSETS_BY_ID.get(
    String(
      assetId ??
      ""
    ).trim()
  ) ??
    null;
}

export function getWebCornerAssetsForAngle(
  canonicalAngleDeg
) {
  return ASSETS_BY_CANONICAL_ANGLE.get(
    Number(
      canonicalAngleDeg
    )
  ) ??
    Object.freeze([]);
}

export function selectWebCornerAsset({
  targetAngleDeg,
  selectionKey
}) {
  const angle =
    requireCornerAngle(
      targetAngleDeg,
      "target corner angle"
    );

  const family =
    selectNearestAngleFamily(
      angle
    );

  const assets =
    getWebCornerAssetsForAngle(
      family.canonicalAngleDeg
    );

  if (
    assets.length ===
      0
  ) {
    return null;
  }

  const variantIndex =
    hashText(
      `${String(selectionKey ?? "corner")}:variant`
    ) %
    assets.length;

  return assets[
    variantIndex
  ];
}

export function createWebCornerAssetPresentation({
  targetAngleDeg,
  selectionKey,
  corner,
  firstAnchor,
  secondAnchor
}) {
  const asset =
    selectWebCornerAsset({
      targetAngleDeg,
      selectionKey
    });

  if (!asset) {
    return null;
  }

  const alphaUnit =
    hashText(
      `${String(selectionKey ?? "corner")}:alpha`
    ) /
    0xffffffff;

  const alpha =
    asset.recommendedAlpha[0] +
    (
      asset.recommendedAlpha[1] -
      asset.recommendedAlpha[0]
    ) *
    alphaUnit;

  return deepFreeze({
    schemaVersion:
      WEB_CORNER_ASSET_PRESENTATION_SCHEMA_VERSION,
    assetId:
      asset.id,
    modulePath:
      asset.modulePath,
    canonicalAngleDeg:
      asset.canonicalAngleDeg,
    targetAngleDeg:
      requireCornerAngle(
        targetAngleDeg,
        "target corner angle"
      ),
    supportedAngleRangeDeg:
      asset.supportedAngleRangeDeg,
    variant:
      asset.variant,
    alpha:
      clamp(
        alpha,
        0.05,
        1
      ),
    source: {
      pivot:
        asset.source.pivot,
      firstAnchor:
        asset.source.firstAnchor,
      secondAnchor:
        asset.source.secondAnchor
    },
    target: {
      pivot:
        requirePoint(
          corner,
          "corner asset target pivot"
        ),
      firstAnchor:
        requirePoint(
          firstAnchor,
          "corner asset first target anchor"
        ),
      secondAnchor:
        requirePoint(
          secondAnchor,
          "corner asset second target anchor"
        )
    }
  });
}

function createAngleFamily(
  canonicalAngleDeg,
  minimumAngleDeg,
  maximumAngleDeg
) {
  return Object.freeze({
    canonicalAngleDeg,
    supportedAngleRangeDeg:
      Object.freeze([
        minimumAngleDeg,
        maximumAngleDeg
      ])
  });
}

function createAssetRecord({
  family,
  variant
}) {
  const angleId =
    String(
      family.canonicalAngleDeg
    ).padStart(
      3,
      "0"
    );

  const variantId =
    String(
      variant
    ).padStart(
      2,
      "0"
    );

  const id =
    `corner-${angleId}-${variantId}`;

  const radians =
    family.canonicalAngleDeg *
    Math.PI /
    180;

  return deepFreeze({
    id,
    familyId:
      `corner-${angleId}`,
    canonicalAngleDeg:
      family.canonicalAngleDeg,
    supportedAngleRangeDeg:
      family.supportedAngleRangeDeg,
    variant,
    file:
      `${id}.webp`,
    modulePath:
      `modules/dynamic-webs/assets/web-corner/generated/${id}.webp`,
    recommendedAlpha:
      Object.freeze([
        0.88,
        1
      ]),
    tintable:
      true,
    source: {
      pivot:
        SOURCE_PIVOT,
      firstAnchor:
        Object.freeze({
          x:
            SOURCE_PIVOT.x +
            SOURCE_ANCHOR_RADIUS,
          y:
            SOURCE_PIVOT.y
        }),
      secondAnchor:
        Object.freeze({
          x:
            SOURCE_PIVOT.x +
            Math.cos(
              radians
            ) *
            SOURCE_ANCHOR_RADIUS,
          y:
            SOURCE_PIVOT.y +
            Math.sin(
              radians
            ) *
            SOURCE_ANCHOR_RADIUS
        })
    }
  });
}

function selectNearestAngleFamily(
  targetAngleDeg
) {
  let selected =
    WEB_CORNER_ASSET_ANGLE_FAMILIES[0];

  let selectedDistance =
    Infinity;

  for (
    const family of
    WEB_CORNER_ASSET_ANGLE_FAMILIES
  ) {
    const distance =
      Math.abs(
        family.canonicalAngleDeg -
        targetAngleDeg
      );

    const insideRange =
      targetAngleDeg >=
        family.supportedAngleRangeDeg[0] &&
      targetAngleDeg <=
        family.supportedAngleRangeDeg[1];

    const selectedInsideRange =
      targetAngleDeg >=
        selected.supportedAngleRangeDeg[0] &&
      targetAngleDeg <=
        selected.supportedAngleRangeDeg[1];

    if (
      (
        insideRange &&
        !selectedInsideRange
      ) ||
      (
        insideRange ===
          selectedInsideRange &&
        distance <
          selectedDistance
      )
    ) {
      selected =
        family;

      selectedDistance =
        distance;
    }
  }

  return selected;
}

function requireCornerAngle(
  value,
  label
) {
  const angle =
    Number(
      value
    );

  if (
    !Number.isFinite(
      angle
    ) ||
    angle <=
      0 ||
    angle >=
      180
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be between 0 and 180 degrees.`
    );
  }

  return angle;
}

function requirePoint(
  value,
  label
) {
  const x =
    Number(
      value?.x
    );

  const y =
    Number(
      value?.y
    );

  if (
    !Number.isFinite(
      x
    ) ||
    !Number.isFinite(
      y
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must contain finite x and y values.`
    );
  }

  return {
    x,
    y
  };
}

function hashText(
  value
) {
  const text =
    String(
      value ??
      ""
    );

  let hash =
    0x811c9dc5;

  for (
    let index = 0;
    index <
      text.length;
    index +=
      1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        0x01000193
      ) >>>
      0;
  }

  return hash;
}

function clamp(
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

function deepFreeze(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object" ||
    Object.isFrozen(
      value
    )
  ) {
    return value;
  }

  for (
    const child of
    Object.values(
      value
    )
  ) {
    deepFreeze(
      child
    );
  }

  return Object.freeze(
    value
  );
}
