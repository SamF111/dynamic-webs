import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_GROUND_ASSETS,
  createWebGroundAssetPresentation,
  selectWebGroundAsset
} from "../scripts/data/webGroundAssetCatalog.js";

test(
  "ground asset catalog exposes twelve deterministic tintable WebP variants",
  () => {
    assert.equal(
      WEB_GROUND_ASSETS.length,
      12
    );

    assert.equal(
      new Set(
        WEB_GROUND_ASSETS.map(
          asset =>
            asset.id
        )
      ).size,
      12
    );

    assert.ok(
      WEB_GROUND_ASSETS.every(
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
  "ground asset selection remains stable without consuming generation randomness",
  () => {
    const first =
      selectWebGroundAsset({
        selectionKey:
          "ground:scene:one"
      });

    const second =
      selectWebGroundAsset({
        selectionKey:
          "ground:scene:one"
      });

    assert.equal(
      first.id,
      second.id
    );
  }
);

test(
  "ground presentation stores immutable source and rotated unequal target bases",
  () => {
    const presentation =
      createWebGroundAssetPresentation({
        selectionKey:
          "ground:ellipse",
        pivot: {
          x:
            100,
          y:
            200
        },
        radiusX:
          80,
        radiusY:
          45,
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

    assert.equal(
      Object.isFrozen(
        presentation.target.firstAnchor
      ),
      true
    );

    assert.ok(
      Math.abs(
        presentation.target.firstAnchor.x -
        100
      ) <
        0.000001
    );

    assert.ok(
      Math.abs(
        presentation.target.firstAnchor.y -
        280
      ) <
        0.000001
    );

    assert.ok(
      Math.abs(
        presentation.target.secondAnchor.x -
        55
      ) <
        0.000001
    );

    assert.ok(
      Math.abs(
        presentation.target.secondAnchor.y -
        200
      ) <
        0.000001
    );
  }
);
