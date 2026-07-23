import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

const MINIMUM_BASIS_DETERMINANT =
  0.000000001;

export function createWebGroundAssetAffineMatrix(
  presentation
) {
  const sourcePivot =
    requirePoint(
      presentation?.source?.pivot,
      "ground asset source pivot"
    );

  const sourceFirst =
    requirePoint(
      presentation?.source?.firstAnchor,
      "ground asset first source anchor"
    );

  const sourceSecond =
    requirePoint(
      presentation?.source?.secondAnchor,
      "ground asset second source anchor"
    );

  const targetPivot =
    requirePoint(
      presentation?.target?.pivot,
      "ground asset target pivot"
    );

  const targetFirst =
    requirePoint(
      presentation?.target?.firstAnchor,
      "ground asset first target anchor"
    );

  const targetSecond =
    requirePoint(
      presentation?.target?.secondAnchor,
      "ground asset second target anchor"
    );

  const sourceU = {
    x:
      sourceFirst.x -
      sourcePivot.x,
    y:
      sourceFirst.y -
      sourcePivot.y
  };

  const sourceV = {
    x:
      sourceSecond.x -
      sourcePivot.x,
    y:
      sourceSecond.y -
      sourcePivot.y
  };

  const targetU = {
    x:
      targetFirst.x -
      targetPivot.x,
    y:
      targetFirst.y -
      targetPivot.y
  };

  const targetV = {
    x:
      targetSecond.x -
      targetPivot.x,
    y:
      targetSecond.y -
      targetPivot.y
  };

  const determinant =
    sourceU.x *
      sourceV.y -
    sourceU.y *
      sourceV.x;

  if (
    !Number.isFinite(
      determinant
    ) ||
    Math.abs(
      determinant
    ) <
      MINIMUM_BASIS_DETERMINANT
  ) {
    throw new Error(
      `${MODULE_TITLE} | Ground asset source anchors form a degenerate basis.`
    );
  }

  const a =
    (
      targetU.x *
        sourceV.y -
      targetV.x *
        sourceU.y
    ) /
    determinant;

  const c =
    (
      -targetU.x *
        sourceV.x +
      targetV.x *
        sourceU.x
    ) /
    determinant;

  const b =
    (
      targetU.y *
        sourceV.y -
      targetV.y *
        sourceU.y
    ) /
    determinant;

  const d =
    (
      -targetU.y *
        sourceV.x +
      targetV.y *
        sourceU.x
    ) /
    determinant;

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

  const matrix =
    Object.freeze({
      a,
      b,
      c,
      d,
      tx,
      ty
    });

  if (
    !Object.values(
      matrix
    ).every(
      Number.isFinite
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Ground asset affine transform contains non-finite values.`
    );
  }

  return matrix;
}

export function transformWebGroundAssetPoint(
  matrix,
  point
) {
  const value =
    requirePoint(
      point,
      "ground asset point"
    );

  return Object.freeze({
    x:
      matrix.a *
        value.x +
      matrix.c *
        value.y +
      matrix.tx,
    y:
      matrix.b *
        value.x +
      matrix.d *
        value.y +
      matrix.ty
  });
}

export function applyWebGroundAssetAffineTransform({
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
      `${MODULE_TITLE} | A display object is required for ground asset transformation.`
    );
  }

  const values =
    createWebGroundAssetAffineMatrix(
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
  } else if (
    typeof matrix.decompose ===
      "function" &&
    displayObject.transform
  ) {
    matrix.decompose(
      displayObject.transform
    );
  } else {
    throw new Error(
      `${MODULE_TITLE} | The active PIXI display API cannot apply an affine ground-web transform.`
    );
  }

  displayObject.dynamicWebsGroundAssetMatrix =
    Object.freeze({
      ...values
    });

  return displayObject.dynamicWebsGroundAssetMatrix;
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
