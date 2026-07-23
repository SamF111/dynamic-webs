import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebGroundAssetPresentation
} from "../scripts/data/webGroundAssetCatalog.js";

import {
  createWebGroundAssetAffineMatrix,
  transformWebGroundAssetPoint
} from "../scripts/rendering/webs/webGroundAssetTransform.js";

test(
  "affine ground fitting maps authored axes onto rotated unequal Scene radii",
  () => {
    const presentation =
      createWebGroundAssetPresentation({
        selectionKey:
          "ground:transform",
        pivot: {
          x:
            20,
          y:
            30
        },
        radiusX:
          120,
        radiusY:
          75,
        rotation:
          0.63
      });

    const matrix =
      createWebGroundAssetAffineMatrix(
        presentation
      );

    assertPointClose(
      transformWebGroundAssetPoint(
        matrix,
        presentation.source.pivot
      ),
      presentation.target.pivot
    );

    assertPointClose(
      transformWebGroundAssetPoint(
        matrix,
        presentation.source.firstAnchor
      ),
      presentation.target.firstAnchor
    );

    assertPointClose(
      transformWebGroundAssetPoint(
        matrix,
        presentation.source.secondAnchor
      ),
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
