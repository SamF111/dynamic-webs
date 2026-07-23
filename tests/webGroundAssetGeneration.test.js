import test from "node:test";
import assert from "node:assert/strict";

import {
  GroundWebGenerator
} from "../scripts/simulation/webs/GroundWebGenerator.js";

import {
  createSeededRandom
} from "../scripts/util/seededRandom.js";

const LEVEL = Object.freeze({
  id: "base",
  providerMode: "base",
  elevationBand: Object.freeze({
    bottom: null,
    top: null
  })
});

const SCENE_RECT = Object.freeze({
  x: 0,
  y: 0,
  width: 1000,
  height: 1000,
  right: 1000,
  bottom: 1000
});

const CONFIGURATION = Object.freeze({
  enabled: true,
  count: 3,
  minimumRadiusGridUnits: 0.55,
  maximumRadiusGridUnits: 0.95,
  edgeMarginGridUnits: 0.25
});

function generate() {
  const seed = "dynamic-webs:test:ground-assets";
  return new GroundWebGenerator().generate({
    sceneId: "scene-ground",
    populationId: "default",
    populationLabel: "Default Web Population",
    thicknessMultiplier: 1,
    level: LEVEL,
    generationSeed: seed,
    sceneRect: SCENE_RECT,
    gridSize: 100,
    configuration: CONFIGURATION,
    random: createSeededRandom(seed)
  });
}

test(
  "ground generation assigns deterministic immutable asset presentations without replacing strands",
  () => {
    const first = generate();
    const second = generate();

    assert.deepEqual(first, second);
    assert.equal(first.length, 3);

    for (const web of first) {
      assert.equal(web.kind, "ground");
      assert.ok(web.strands.length > 0);
      assert.ok(web.groundAsset);
      assert.match(web.groundAsset.modulePath, /assets\/web-ground\/generated\/ground-\d{2}\.webp$/u);
      assert.equal(Object.isFrozen(web.groundAsset), true);
      assert.equal(Object.isFrozen(web.groundAsset.target), true);
      assert.ok(web.groundAsset.targetRadiusXPx > 0);
      assert.ok(web.groundAsset.targetRadiusYPx > 0);
    }
  }
);
