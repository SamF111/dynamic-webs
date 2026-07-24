import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_CAPTURED_ASSETS,
  createWebCapturedAssetPresentation,
  selectWebCapturedAsset
} from "../scripts/data/webCapturedAssetCatalog.js";

import {
  createWebCapturedAssetMatrix
} from "../scripts/rendering/webs/webCapturedAssetTransform.js";

test(
  "captured asset catalog exposes eight deterministic tintable WebP variants",
  () => {
    assert.equal(
      WEB_CAPTURED_ASSETS.length,
      8
    );

    assert.equal(
      new Set(
        WEB_CAPTURED_ASSETS.map(
          asset =>
            asset.id
        )
      ).size,
      8
    );

    assert.ok(
      WEB_CAPTURED_ASSETS.every(
        asset =>
          asset.modulePath.endsWith(
            ".webp"
          ) &&
          asset.tintable ===
            true &&
          Object.isFrozen(
            asset
          )
      )
    );
  }
);

test(
  "captured asset selection and presentation remain stable for one entity key",
  () => {
    const first =
      selectWebCapturedAsset({
        selectionKey:
          "ambient-critters:critter-1"
      });

    const second =
      selectWebCapturedAsset({
        selectionKey:
          "ambient-critters:critter-1"
      });

    assert.equal(
      first.id,
      second.id
    );

    const presentation =
      createWebCapturedAssetPresentation({
        selectionKey:
          "ambient-critters:critter-1",
        point: {
          x:
            100,
          y:
            200
        },
        radiusPx:
          40,
        rotation:
          Math.PI /
          2
      });

    assert.equal(
      Object.isFrozen(
        presentation
      ),
      true
    );

    const matrix =
      createWebCapturedAssetMatrix(
        presentation
      );

    const pivot = {
      x:
        presentation.source.pivot.x *
        presentation.source.widthPx,
      y:
        presentation.source.pivot.y *
        presentation.source.heightPx
    };

    assert.equal(
      presentation.source.widthPx,
      512
    );

    assert.equal(
      presentation.source.heightPx,
      512
    );

    assert.ok(
      Math.abs(
        matrix.a *
          pivot.x +
        matrix.c *
          pivot.y +
        matrix.tx -
        100
      ) <
        0.000001
    );

    assert.ok(
      Math.abs(
        matrix.b *
          pivot.x +
        matrix.d *
          pivot.y +
        matrix.ty -
        200
      ) <
        0.000001
    );

    assert.ok(
      Math.abs(
        Math.hypot(
          matrix.a,
          matrix.b
        ) -
        40 /
        (
          0.44 *
          512
        )
      ) <
        0.000001
    );
  }
);

