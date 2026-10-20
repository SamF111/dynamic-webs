import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_CORNER_ASSETS,
  WEB_CORNER_ASSET_ANGLE_FAMILIES,
  createWebCornerAssetPresentation,
  selectWebCornerAsset
} from "../scripts/data/webCornerAssetCatalog.js";
import manifest from "../assets/web-corner/generated/manifest.json" with {type: "json"};

test(
  "corner asset catalog matches the generated manifest and covers every angle family",
  () => {
    assert.ok(WEB_CORNER_ASSET_ANGLE_FAMILIES.length > 0);
    assert.ok(WEB_CORNER_ASSETS.length > 0);
    assert.deepEqual(WEB_CORNER_ASSETS.map(({id, modulePath}) => ({id, modulePath})),
      manifest.assets.map(({id, modulePath}) => ({id, modulePath})));
    assert.ok(WEB_CORNER_ASSET_ANGLE_FAMILIES.every(family =>
      WEB_CORNER_ASSETS.some(asset => asset.canonicalAngleDeg === family.canonicalAngleDeg)));

    assert.equal(
      new Set(
        WEB_CORNER_ASSETS.map(
          asset =>
            asset.id
        )
      ).size,
      WEB_CORNER_ASSETS.length
    );

    assert.ok(
      WEB_CORNER_ASSETS.every(
        asset =>
          asset.modulePath.endsWith(
            ".webp"
          ) &&
          Object.isFrozen(
            asset
          )
      )
    );

    assert.ok(
      WEB_CORNER_ASSETS.every(
        asset =>
          asset.recommendedAlpha[0] ===
            0.88 &&
          asset.recommendedAlpha[1] ===
            1
      )
    );
  }
);

test(
  "a six-degree corner selects the dedicated five-degree family",
  () => {
    const asset =
      selectWebCornerAsset({
        targetAngleDeg:
          6,
        selectionKey:
          "scene:corner:narrow"
      });

    assert.equal(
      asset.canonicalAngleDeg,
      5
    );

    assert.deepEqual(
      asset.supportedAngleRangeDeg,
      [
        3,
        7.5
      ]
    );
  }
);

test(
  "a seventeen-degree corner selects a fifteen-degree family and keeps selection stable",
  () => {
    const first =
      selectWebCornerAsset({
        targetAngleDeg:
          17,
        selectionKey:
          "scene:corner:one"
      });

    const second =
      selectWebCornerAsset({
        targetAngleDeg:
          17,
        selectionKey:
          "scene:corner:one"
      });

    assert.equal(
      first.canonicalAngleDeg,
      15
    );

    assert.equal(
      first.id,
      second.id
    );

    assert.deepEqual(
      first.supportedAngleRangeDeg,
      [
        12.5,
        20
      ]
    );
  }
);

test(
  "corner presentation stores immutable source and target affine bases",
  () => {
    const presentation =
      createWebCornerAssetPresentation({
        targetAngleDeg:
          73,
        selectionKey:
          "corner:73",
        corner: {
          x:
            100,
          y:
            200
        },
        firstAnchor: {
          x:
            180,
          y:
            200
        },
        secondAnchor: {
          x:
            120,
          y:
            270
        }
      });

    assert.equal(
      presentation.canonicalAngleDeg,
      75
    );

    assert.equal(
      presentation.targetAngleDeg,
      73
    );

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
  }
);
