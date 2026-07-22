import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebCornerAssetPresentation
} from "../scripts/data/webCornerAssetCatalog.js";

import {
  createWebCornerAssetAffineMatrix,
  transformWebCornerAssetPoint
} from "../scripts/rendering/webs/webCornerAssetTransform.js";

test(
  "affine corner fitting maps both authored anchors onto unequal target wall lengths",
  () => {
    const targetAngle =
      17;

    const radians =
      targetAngle *
      Math.PI /
      180;

    const presentation =
      createWebCornerAssetPresentation({
        targetAngleDeg:
          targetAngle,
        selectionKey:
          "corner:17",
        corner: {
          x:
            20,
          y:
            30
        },
        firstAnchor: {
          x:
            140,
          y:
            30
        },
        secondAnchor: {
          x:
            20 +
            Math.cos(
              radians
            ) *
            75,
          y:
            30 +
            Math.sin(
              radians
            ) *
            75
        }
      });

    assert.equal(
      presentation.canonicalAngleDeg,
      15
    );

    const matrix =
      createWebCornerAssetAffineMatrix(
        presentation
      );

    const mappedPivot =
      transformWebCornerAssetPoint(
        matrix,
        presentation.source.pivot
      );

    const mappedFirst =
      transformWebCornerAssetPoint(
        matrix,
        presentation.source.firstAnchor
      );

    const mappedSecond =
      transformWebCornerAssetPoint(
        matrix,
        presentation.source.secondAnchor
      );

    assertPointClose(
      mappedPivot,
      presentation.target.pivot
    );

    assertPointClose(
      mappedFirst,
      presentation.target.firstAnchor
    );

    assertPointClose(
      mappedSecond,
      presentation.target.secondAnchor
    );
  }
);

function assertPointClose(
  actual,
  expected
) {
  assert.ok(
    Math.abs(
      actual.x -
      expected.x
    ) <
      0.000001
  );

  assert.ok(
    Math.abs(
      actual.y -
      expected.y
    ) <
      0.000001
  );
}
