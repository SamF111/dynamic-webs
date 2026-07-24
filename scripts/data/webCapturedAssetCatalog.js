import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

export const WEB_CAPTURED_ASSET_PRESENTATION_SCHEMA_VERSION =
  1;

export const WEB_CAPTURED_ASSET_VARIANT_COUNT =
  8;

const SOURCE_PIVOT =
  Object.freeze({
    x:
      0.5,
    y:
      0.5
  });

const SOURCE_RADIUS =
  0.44;

const SOURCE_WIDTH_PX =
  512;

const SOURCE_HEIGHT_PX =
  512;

export const WEB_CAPTURED_ASSETS =
  Object.freeze(
    Array.from(
      {
        length:
          WEB_CAPTURED_ASSET_VARIANT_COUNT
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
    WEB_CAPTURED_ASSETS.map(
      asset =>
        [
          asset.id,
          asset
        ]
    )
  );

export function getWebCapturedAsset(
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

export function selectWebCapturedAsset({
  selectionKey,
  variant = null
} = {}) {
  if (
    variant !==
      null &&
    variant !==
      undefined &&
    variant !==
      ""
  ) {
    const numericVariant =
      Number(
        variant
      );

    if (
      Number.isInteger(
        numericVariant
      ) &&
      numericVariant >=
        1 &&
      numericVariant <=
        WEB_CAPTURED_ASSET_VARIANT_COUNT
    ) {
      return WEB_CAPTURED_ASSETS[
        numericVariant -
        1
      ];
    }

    const explicit =
      getWebCapturedAsset(
        variant
      );

    if (
      explicit
    ) {
      return explicit;
    }

    throw new TypeError(
      `${MODULE_TITLE} | Captured-web variant must be an asset ID or an integer from 1 to ${WEB_CAPTURED_ASSET_VARIANT_COUNT}.`
    );
  }

  const index =
    hashText(
      `${String(selectionKey ?? "captured")}:variant`
    ) %
    WEB_CAPTURED_ASSETS.length;

  return WEB_CAPTURED_ASSETS[
    index
  ];
}

export function createWebCapturedAssetPresentation({
  selectionKey,
  point,
  radiusPx,
  rotation = 0,
  alpha = null,
  variant = null
}) {
  const asset =
    selectWebCapturedAsset({
      selectionKey,
      variant
    });

  const targetPoint =
    requirePoint(
      point,
      "captured-web target point"
    );

  const targetRadiusPx =
    requirePositiveNumber(
      radiusPx,
      "captured-web target radius"
    );

  const targetRotation =
    requireFiniteNumber(
      rotation,
      "captured-web rotation"
    );

  const selectedAlpha =
    alpha ===
      null ||
    alpha ===
      undefined ||
    alpha ===
      ""
      ? resolveDeterministicAlpha(
          asset,
          selectionKey
        )
      : clamp(
          requireFiniteNumber(
            alpha,
            "captured-web alpha"
          ),
          0,
          1
        );

  return deepFreeze({
    schemaVersion:
      WEB_CAPTURED_ASSET_PRESENTATION_SCHEMA_VERSION,
    assetId:
      asset.id,
    modulePath:
      asset.modulePath,
    variant:
      asset.variant,
    alpha:
      selectedAlpha,
    rotation:
      targetRotation,
    source: {
      ...asset.source,
      widthPx:
        asset.width,
      heightPx:
        asset.height
    },
    target: {
      pivot:
        targetPoint,
      radiusPx:
        targetRadiusPx
    }
  });
}

function createAssetRecord(
  variant
) {
  const suffix =
    String(
      variant
    ).padStart(
      2,
      "0"
    );

  const id =
    `captured-${suffix}`;

  return deepFreeze({
    id,
    variant,
    file:
      `${id}.webp`,
    modulePath:
      `modules/dynamic-webs/assets/web-captured/generated/${id}.webp`,
    recommendedAlpha:
      [
        0.82,
        1
      ],
    tintable:
      true,
    width:
      SOURCE_WIDTH_PX,
    height:
      SOURCE_HEIGHT_PX,
    source: {
      pivot:
        SOURCE_PIVOT,
      radius:
        SOURCE_RADIUS
    }
  });
}

function resolveDeterministicAlpha(
  asset,
  selectionKey
) {
  const unit =
    hashText(
      `${String(selectionKey ?? "captured")}:${asset.id}:alpha`
    ) /
    0xffffffff;

  return clamp(
    asset.recommendedAlpha[0] +
      (
        asset.recommendedAlpha[1] -
        asset.recommendedAlpha[0]
      ) *
      unit,
    0.05,
    1
  );
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

  return Object.freeze({
    x,
    y
  });
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
      `${MODULE_TITLE} | ${label} must be finite.`
    );
  }

  return number;
}

function hashText(
  value
) {
  let hash =
    2166136261;

  for (
    const character of
    String(
      value
    )
  ) {
    hash ^=
      character.codePointAt(
        0
      );

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return hash >>>
    0;
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
      "object"
  ) {
    return value;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return Object.freeze(
      value.map(
        deepFreeze
      )
    );
  }

  const clone =
    {};

  for (
    const [
      key,
      entry
    ] of Object.entries(
      value
    )
  ) {
    clone[key] =
      deepFreeze(
        entry
      );
  }

  return Object.freeze(
    clone
  );
}

