import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_CARPET_ASSET_MANIFEST,
  WEB_CARPET_ASSETS,
  getWebCarpetAsset,
  getWebCarpetAssetsByCategory,
  validateWebCarpetAssetManifest
} from "../scripts/data/webCarpetAssetManifest.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("generated carpet manifest exposes immutable transparent WebP assets", () => {
  assert.equal(WEB_CARPET_ASSET_MANIFEST.schemaVersion, 1);
  assert.equal(WEB_CARPET_ASSET_MANIFEST.rendering.format, "webp");
  assert.equal(WEB_CARPET_ASSET_MANIFEST.rendering.colourMode, "transparent-white");
  assert.equal(WEB_CARPET_ASSETS.length, 48);
  assert.ok(Object.isFrozen(WEB_CARPET_ASSET_MANIFEST));
  assert.ok(Object.isFrozen(WEB_CARPET_ASSETS));

  for (const asset of WEB_CARPET_ASSETS) {
    assert.match(asset.file, /\.webp$/u);
    assert.match(asset.modulePath, /^modules\/dynamic-webs\/assets\/web-carpet\/generated\/.+\.webp$/u);
    assert.equal(asset.tintable, true);
    assert.ok(Object.isFrozen(asset));
    assert.ok(Object.isFrozen(asset.recommendedScale));
    assert.ok(Object.isFrozen(asset.recommendedAlpha));
    assert.equal(getWebCarpetAsset(asset.id), asset);
  }

  for (const category of [
    "loose-network",
    "support-arc",
    "dense-knot",
    "fray",
    "faint-sheet"
  ]) {
    const assets = getWebCarpetAssetsByCategory(category);
    assert.ok(assets.length > 0);
    assert.ok(assets.every((asset) => asset.category === category));
    assert.ok(Object.isFrozen(assets));
  }
});

test("carpet manifest validation rejects non-WebP, duplicate and malformed assets", () => {
  const png = clone(WEB_CARPET_ASSET_MANIFEST);
  png.assets[0].file = "invalid.png";
  assert.throws(
    () => validateWebCarpetAssetManifest(png),
    /must reference WebP files/u
  );

  const duplicate = clone(WEB_CARPET_ASSET_MANIFEST);
  duplicate.assets[1].id = duplicate.assets[0].id;
  assert.throws(
    () => validateWebCarpetAssetManifest(duplicate),
    /Duplicate web-carpet asset ID/u
  );

  const hash = clone(WEB_CARPET_ASSET_MANIFEST);
  hash.assets[0].sha256 = "not-a-hash";
  assert.throws(
    () => validateWebCarpetAssetManifest(hash),
    /SHA-256/u
  );
});
