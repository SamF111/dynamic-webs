import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_SPAN_ASSETS,
  createWebSpanAssetPresentation,
  selectWebSpanAsset
} from "../scripts/data/webSpanAssetCatalog.js";

function createPresentation() {
  return createWebSpanAssetPresentation({
    selectionKey: "scene:span",
    firstWallStart: { x: 100, y: 100 },
    firstWallEnd: { x: 260, y: 100 },
    secondWallStart: { x: 120, y: 180 },
    secondWallEnd: { x: 245, y: 230 },
    targetLengthPx: 160,
    targetSpanPx: 100
  });
}

test("span asset catalogue exposes eight deterministic WebP variants", () => {
  assert.equal(WEB_SPAN_ASSETS.length, 8);
  assert.equal(new Set(WEB_SPAN_ASSETS.map((asset) => asset.id)).size, 8);
  assert.ok(WEB_SPAN_ASSETS.every((asset) => asset.modulePath.endsWith(".webp")));
  assert.ok(WEB_SPAN_ASSETS.every((asset) =>
    asset.recommendedAlpha[0] === 1 &&
    asset.recommendedAlpha[1] === 1
  ));
  assert.equal(
    selectWebSpanAsset({ selectionKey: "same" }).id,
    selectWebSpanAsset({ selectionKey: "same" }).id
  );
});

test("span presentation keeps an immutable four-anchor quadrilateral", () => {
  const presentation = createPresentation();

  assert.equal(presentation.schemaVersion, 2);
  assert.equal(presentation.warpMode, "piecewise-affine-quad");
  assert.equal(Object.isFrozen(presentation), true);
  assert.equal(Object.isFrozen(presentation.source), true);
  assert.equal(Object.isFrozen(presentation.target), true);
  assert.equal(Object.isFrozen(presentation.target.secondWallEnd), true);
  assert.equal(presentation.targetLengthPx, 160);
  assert.equal(presentation.targetSpanPx, 100);
  assert.deepEqual(
    Object.keys(presentation.target).sort(),
    ["firstWallEnd", "firstWallStart", "secondWallEnd", "secondWallStart"]
  );
});

test("degenerate span quadrilaterals are rejected", () => {
  assert.throws(
    () => createWebSpanAssetPresentation({
      selectionKey: "degenerate",
      firstWallStart: { x: 0, y: 0 },
      firstWallEnd: { x: 100, y: 0 },
      secondWallStart: { x: 0, y: 0 },
      secondWallEnd: { x: 100, y: 0 }
    }),
    /quadrilateral is degenerate/u
  );
});
