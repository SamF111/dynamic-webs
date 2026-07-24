import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

export function createWebCapturedAssetMatrix(
  presentation
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

  const scale =
    targetRadius /
    sourceRadius;

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
      sourcePivot.x -
    c *
      sourcePivot.y;

  const ty =
    targetPivot.y -
    b *
      sourcePivot.x -
    d *
      sourcePivot.y;

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
  presentation
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
      presentation
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
          ...values
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
