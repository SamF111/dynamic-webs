import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_WEB_GENERATION_CONFIGURATION
} from "../scripts/simulation/webs/webConfigurationDefaults.js";

import {
  WallSpanWebGenerator
} from "../scripts/simulation/webs/WallSpanWebGenerator.js";

const LEVEL = Object.freeze({
  id: "base",
  providerMode: "base",
  elevationBand: Object.freeze({ bottom: null, top: null })
});

test("moderately skewed cave walls can generate a four-anchor span asset", () => {
  const webs = new WallSpanWebGenerator().generate({
    sceneId: "cave-scene",
    populationId: "cave-population",
    populationLabel: "cave-population",
    thicknessMultiplier: 1,
    level: LEVEL,
    generationSeed: "dynamic-webs:test:cave-span",
    gridSize: 100,
    configuration: DEFAULT_WEB_GENERATION_CONFIGURATION.spanWebs,
    random: () => 0.5,
    regionRestriction: null,
    wallSegments: [
      {
        wallId: "upper-cave-wall",
        a: { x: 100, y: 100 },
        b: { x: 500, y: 100 }
      },
      {
        wallId: "skewed-cave-wall",
        a: { x: 150, y: 180 },
        b: { x: 350, y: 526.4101615 }
      }
    ]
  });

  assert.equal(webs.length, 1);
  const span = webs[0];
  assert.equal(span.kind, "wall-span");
  assert.equal(span.spanAsset.schemaVersion, 2);
  assert.equal(span.spanAsset.warpMode, "piecewise-affine-quad");
  assert.deepEqual(span.supportingWallIds, ["skewed-cave-wall", "upper-cave-wall"]);

  const target = span.spanAsset.target;
  assert.equal(target.firstWallStart.y, target.firstWallEnd.y);
  assert.notEqual(target.secondWallStart.y, target.secondWallEnd.y);
  assert.notEqual(target.secondWallStart.x, target.secondWallEnd.x);
});
