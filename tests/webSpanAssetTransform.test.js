import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebSpanAssetPresentation
} from "../scripts/data/webSpanAssetCatalog.js";

import {
  createWebSpanAssetQuadMapping,
  transformWebSpanAssetPoint
} from "../scripts/rendering/webs/webSpanAssetTransform.js";

function createPresentation() {
  return createWebSpanAssetPresentation({
    selectionKey: "transform",
    firstWallStart: { x: 300, y: 400 },
    firstWallEnd: { x: 600, y: 400 },
    secondWallStart: { x: 330, y: 510 },
    secondWallEnd: { x: 540, y: 610 },
    targetLengthPx: 255,
    targetSpanPx: 120
  });
}

test("span quad mapping targets the exact four generated wall anchors", () => {
  const presentation = createPresentation();
  const mapping = createWebSpanAssetQuadMapping(presentation);

  assert.deepEqual(mapping.vertices, [
    presentation.target.firstWallStart,
    presentation.target.firstWallEnd,
    presentation.target.secondWallEnd,
    presentation.target.secondWallStart
  ]);
  assert.deepEqual(mapping.uvs, [
    presentation.source.firstWallStart,
    presentation.source.firstWallEnd,
    presentation.source.secondWallEnd,
    presentation.source.secondWallStart
  ]);
  assert.deepEqual(mapping.indices, [0, 1, 2, 0, 2, 3]);
});

test("diagnostic bilinear mapping preserves all four authored anchors", () => {
  const presentation = createPresentation();

  for (const pointName of [
    "firstWallStart",
    "firstWallEnd",
    "secondWallStart",
    "secondWallEnd"
  ]) {
    assert.deepEqual(
      transformWebSpanAssetPoint(presentation, presentation.source[pointName]),
      presentation.target[pointName]
    );
  }
});
