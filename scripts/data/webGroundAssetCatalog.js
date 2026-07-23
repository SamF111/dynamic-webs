import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

export const WEB_GROUND_ASSET_PRESENTATION_SCHEMA_VERSION =
  1;

export const WEB_GROUND_ASSET_VARIANT_COUNT =
  12;

const SOURCE_PIVOT =
  Object.freeze({
    x:
      0.5,
    y:
      0.5
  });

const SOURCE_RADIUS =
  0.42;

const SOURCE_BASIS =
  deepFreeze({
    pivot:
      SOURCE_PIVOT,
    firstAnchor: {
      x:
        SOURCE_PIVOT.x +
        SOURCE_RADIUS,
      y:
        SOURCE_PIVOT.y
    },
    secondAnchor: {
      x:
        SOURCE_PIVOT.x,
      y:
        SOURCE_PIVOT.y +
        SOURCE_RADIUS
    }
  });

export const WEB_GROUND_ASSETS =
  Object.freeze(
    Array.from(
      {
        length:
          WEB_GROUND_ASSET_VARIANT_COUNT
      },
      (
        _unused,
        index
      ) =>
        createAssetRecord(
          index +
          1
        )
    )
  );

const ASSETS_BY_ID =
  new Map(
    WEB_GROUND_ASSETS.map(
      (
        asset
      ) => [
        asset.id,
        asset
      ]
    )
  );

export function getWebGroundAsset(
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

export function selectWebGroundAsset({
  selectionKey
}) {
  if (
    WEB_GROUND_ASSETS.length ===
      0
  ) {
    return null;
  }

  const variantIndex =
    hashText(
      `${String(selectionKey ?? "ground")}:variant`
    ) %
    WEB_GROUND_ASSETS.length;

  return WEB_GROUND_ASSETS[
    variantIndex
  ];
}

/**
 * Create one deterministic presentation descriptor for an irregular radial
 * ground-web asset. The authored source basis is mapped onto two orthogonal
 * generated axes, preserving procedural rotation and unequal X/Y radii.
 */
export function createWebGroundAssetPresentation({
  selectionKey,
  pivot,
  radiusX,
  radiusY,
  rotation = 0
}) {
  const asset =
    selectWebGroundAsset({
      selectionKey
    });

  if (!asset) {
    return null;
  }

  const targetPivot =
    requirePoint(
      pivot,
      "ground asset target pivot"
    );

  const targetRadiusX =
    requirePositiveNumber(
      radiusX,
      "ground asset target X radius"
    );

  const targetRadiusY =
    requirePositiveNumber(
      radiusY,
      "ground asset target Y radius"
    );

  const targetRotation =
    requireFiniteNumber(
      rotation,
      "ground asset rotation"
    );

  const cosine =
    Math.cos(
      targetRotation
    );

  const sine =
    Math.sin(
      targetRotation
    );

  const alphaUnit =
    hashText(
      `${String(selectionKey ?? "ground")}:alpha`
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
      WEB_GROUND_ASSET_PRESENTATION_SCHEMA_VERSION,
    assetId:
      asset.id,
    modulePath:
      asset.modulePath,
    variant:
      asset.variant,
    alpha:
      clamp(
        alpha,
        0.05,
        1
      ),
    targetRadiusXPx:
      targetRadiusX,
    targetRadiusYPx:
      targetRadiusY,
    rotation:
      targetRotation,
    source:
      asset.source,
    target: {
      pivot:
        targetPivot,
      firstAnchor: {
        x:
          targetPivot.x +
          cosine *
          targetRadiusX,
        y:
          targetPivot.y +
          sine *
          targetRadiusX
      },
      secondAnchor: {
        x:
          targetPivot.x -
          sine *
          targetRadiusY,
        y:
          targetPivot.y +
          cosine *
          targetRadiusY
      }
    }
  });
}

function createAssetRecord(
  variant
) {
  const variantId =
    String(
      variant
    ).padStart(
      2,
      "0"
    );

  const id =
    `ground-${variantId}`;

  return deepFreeze({
    id,
    variant,
    file:
      `${id}.webp`,
    modulePath:
      `modules/dynamic-webs/assets/web-ground/generated/${id}.webp`,
    recommendedAlpha:
      Object.freeze([
        0.92,
        1
      ]),
    tintable:
      true,
    source:
      SOURCE_BASIS
  });
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

function requirePositiveNumber(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <=
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a positive finite number.`
    );
  }

  return number;
}

function requireFiniteNumber(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a finite number.`
    );
  }

  return number;
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
