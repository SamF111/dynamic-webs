import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

/**
 * Create a texture-pixel-to-Scene transform for one captured-web asset.
 *
 * Captured asset catalogue coordinates are normalised. The optional runtime
 * dimensions allow the loaded texture to remain authoritative while the
 * catalogue dimensions provide a deterministic fallback before loading.
 */
export function createWebCapturedAssetMatrix(
  presentation,
  {
    sourceWidthPx =
      null,
    sourceHeightPx =
      null
  } = {}
) {
  const sourcePivot =
    requirePoint(
      presentation?.source?.pivot,
      "captured asset source pivot"
    );

  const sourceRadius =
    requirePositiveNumber(
      presentation?.source?.radius,
      "captured asset source radius"
    );

  const sourceWidth =
    resolvePositiveDimension(
      sourceWidthPx,
      presentation?.source?.widthPx,
      "captured asset source width"
    );

  const sourceHeight =
    resolvePositiveDimension(
      sourceHeightPx,
      presentation?.source?.heightPx,
      "captured asset source height"
    );

  const targetPivot =
    requirePoint(
      presentation?.target?.pivot,
      "captured asset target pivot"
    );

  const targetRadius =
    requirePositiveNumber(
      presentation?.target?.radiusPx,
      "captured asset target radius"
    );

  const rotation =
    requireFiniteNumber(
      presentation?.rotation ??
      0,
      "captured asset rotation"
    );

  const sourcePivotPx = {
    x:
      sourcePivot.x *
      sourceWidth,
    y:
      sourcePivot.y *
      sourceHeight
  };

  const sourceRadiusPx =
    sourceRadius *
    Math.min(
      sourceWidth,
      sourceHeight
    );

  const scale =
    targetRadius /
    sourceRadiusPx;

  const cosine =
    Math.cos(
      rotation
    );

  const sine =
    Math.sin(
      rotation
    );

  const a =
    scale *
    cosine;

  const b =
    scale *
    sine;

  const c =
    -scale *
    sine;

  const d =
    scale *
    cosine;

  const tx =
    targetPivot.x -
    a *
      sourcePivotPx.x -
    c *
      sourcePivotPx.y;

  const ty =
    targetPivot.y -
    b *
      sourcePivotPx.x -
    d *
      sourcePivotPx.y;

  return Object.freeze({
    a,
    b,
    c,
    d,
    tx,
    ty
  });
}

export function applyWebCapturedAssetTransform({
  pixi,
  displayObject,
  presentation,
  sourceDimensions =
    null
}) {
  if (
    !displayObject ||
    typeof displayObject !==
      "object"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A display object is required for captured asset transformation.`
    );
  }

  const values =
    createWebCapturedAssetMatrix(
      presentation,
      {
        sourceWidthPx:
          sourceDimensions?.width ??
          sourceDimensions?.widthPx ??
          null,
        sourceHeightPx:
          sourceDimensions?.height ??
          sourceDimensions?.heightPx ??
          null
      }
    );

  const matrix =
    typeof pixi?.Matrix ===
      "function"
      ? new pixi.Matrix(
          values.a,
          values.b,
          values.c,
          values.d,
          values.tx,
          values.ty
        )
      : {
          a:
            values.a,
          b:
            values.b,
          c:
            values.c,
          d:
            values.d,
          tx:
            values.tx,
          ty:
            values.ty
        };

  if (
    typeof displayObject.setFromMatrix ===
      "function"
  ) {
    displayObject.setFromMatrix(
      matrix
    );
  } else if (
    typeof displayObject.transform?.setFromMatrix ===
      "function"
  ) {
    displayObject.transform.setFromMatrix(
      matrix
    );
  } else {
    displayObject.transform =
      displayObject.transform ??
      {};

    displayObject.transform.matrix =
      matrix;
  }

  return matrix;
}

function resolvePositiveDimension(
  runtimeValue,
  catalogueValue,
  label
) {
  const runtimeNumber =
    Number(
      runtimeValue
    );

  if (
    Number.isFinite(
      runtimeNumber
    ) &&
    runtimeNumber >
      0
  ) {
    return runtimeNumber;
  }

  const catalogueNumber =
    Number(
      catalogueValue
    );

  if (
    Number.isFinite(
      catalogueNumber
    ) &&
    catalogueNumber >
      0
  ) {
    return catalogueNumber;
  }

  /** Legacy presentation descriptors used a normalised one-unit texture. */
  if (
    catalogueValue ===
      null ||
    catalogueValue ===
      undefined
  ) {
    return 1;
  }

  throw new TypeError(
    `${MODULE_TITLE} | ${label} must be a positive finite number.`
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
      `${MODULE_TITLE} | ${label} must be finite.`
    );
  }

  return number;
}
