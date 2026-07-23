import test from "node:test";
import assert from "node:assert/strict";

import { WebGenerationService } from "../scripts/simulation/webs/WebGenerationService.js";
import { getWebDensityPreset } from "../scripts/simulation/webs/webDensityPresets.js";
import { isPointInsideWebRegionRecord } from "../scripts/foundry/webRegionCompatibility.js";

const level = Object.freeze({
  id: "base",
  label: "Base level",
  providerMode: "base",
  elevationBand: Object.freeze({ bottom: 0, top: 9 }),
  source: "test"
});

function createRegion({
  id,
  tags,
  x,
  y,
  width,
  height
}) {
  return Object.freeze({
    id,
    name: id,
    tags: Object.freeze([...tags]),
    levelId: "base",
    elevationBand: level.elevationBand,
    shapes: Object.freeze([
      Object.freeze({
        type: "rectangle",
        x,
        y,
        width,
        height,
        rotation: 0
      })
    ])
  });
}

function createContext(regions) {
  return Object.freeze({
    sceneId: "carpet-scene",
    gridSize: 100,
    sceneRect: Object.freeze({
      x: 0,
      y: 0,
      width: 1200,
      height: 900,
      right: 1200,
      bottom: 900
    }),
    wallSegments: Object.freeze([]),
    levels: Object.freeze([level]),
    regions: Object.freeze(regions),
    levelProvider: Object.freeze({
      requestedMode: "base",
      resolvedMode: "base",
      providerAvailable: true,
      fallbackUsed: false,
      fallbackReason: null,
      activeViewedLevelId: "base",
      levels: Object.freeze([level])
    })
  });
}

function createPopulation(overrides = {}) {
  const densityId =
    overrides.densityId ??
    "standard";

  const density =
    getWebDensityPreset(
      densityId
    ).configuration;

  const { densityId: _densityId, ...populationOverrides } =
    overrides;

  return {
    id: "web-carpet-test",
    enabled: true,
    levelId: "base",
    confineRegionTags: ["carpet"],
    excludeRegionTags: ["hole"],
    categoryDensities: {
      "wall-corner": "disabled",
      "wall-span": "disabled",
      ground: "disabled",
      "web-carpet": densityId
    },
    colourProfileId: "natural-white",
    thicknessMultiplier: 1,
    generationOptions: {
      cornerWebs: { enabled: false },
      spanWebs: { enabled: false },
      groundWebs: { enabled: false },
      carpetWebs: {
        ...density.carpetWebs,
        enabled: true
      }
    },
    ...populationOverrides
  };
}

const confine = createRegion({
  id: "carpet-region",
  tags: ["carpet"],
  x: 100,
  y: 100,
  width: 700,
  height: 500
});

const hole = createRegion({
  id: "hole-region",
  tags: ["hole"],
  x: 350,
  y: 250,
  width: 180,
  height: 160
});

test("carpet generation creates deterministic WebP patch recipes clipped to Confine minus Exclude", () => {
  const service = new WebGenerationService();
  const context = createContext([confine, hole]);
  const options = { populations: [createPopulation()] };

  const first = service.generate(context, options);
  const second = service.generate(context, options);

  assert.deepEqual(first, second);
  assert.equal(first.counts.carpet, 1);
  assert.equal(first.counts.byWebKind["web-carpet"], 1);
  assert.equal(first.counts.strands, 0);
  assert.equal(first.webs.length, 1);

  const web = first.webs[0];
  assert.equal(web.kind, "web-carpet");
  assert.equal(web.strands.length, 0);
  assert.equal(web.regionIds[0], "carpet-region");
  assert.ok(web.carpet.patches.length >= 2);
  assert.ok(Object.isFrozen(web.carpet));
  assert.ok(Object.isFrozen(web.carpet.patches));
  assert.equal(web.carpet.mask.confineShapes.length, 1);
  assert.equal(web.carpet.mask.excludeShapes.length, 1);
  assert.match(web.carpet.mask.cacheKey, /:mask-[0-9a-f]{8}$/u);

  for (const patch of web.carpet.patches) {
    assert.match(patch.modulePath, /\.webp$/u);
    assert.equal(
      isPointInsideWebRegionRecord(confine, patch.x, patch.y, { elevation: 0 }),
      true
    );
    assert.equal(
      isPointInsideWebRegionRecord(hole, patch.x, patch.y, { elevation: 0 }),
      false
    );
  }
});

test("carpets require a matching same-level Confine Region", () => {
  const service = new WebGenerationService();
  const missing = service.generate(createContext([confine]), {
    populations: [createPopulation({ confineRegionTags: ["missing"] })]
  });
  const unrestricted = service.generate(createContext([confine]), {
    populations: [createPopulation({ confineRegionTags: [], excludeRegionTags: [] })]
  });

  assert.equal(missing.webs.length, 0);
  assert.equal(unrestricted.webs.length, 0);
});

test("per-Region carpet random streams do not reshuffle neighbouring Region recipes", () => {
  const firstRegion = createRegion({
    id: "region-a",
    tags: ["carpet"],
    x: 0,
    y: 0,
    width: 250,
    height: 250
  });
  const changedFirstRegion = createRegion({
    id: "region-a",
    tags: ["carpet"],
    x: 0,
    y: 0,
    width: 600,
    height: 500
  });
  const secondRegion = createRegion({
    id: "region-b",
    tags: ["carpet"],
    x: 700,
    y: 100,
    width: 350,
    height: 350
  });

  const service = new WebGenerationService();
  const first = service.generate(createContext([firstRegion, secondRegion]), {
    populations: [createPopulation({ excludeRegionTags: [] })]
  });
  const changed = service.generate(createContext([changedFirstRegion, secondRegion]), {
    populations: [createPopulation({ excludeRegionTags: [] })]
  });

  const firstSecond = first.webs.find((web) => web.carpet.regionId === "region-b");
  const changedSecond = changed.webs.find((web) => web.carpet.regionId === "region-b");
  assert.ok(firstSecond);
  assert.ok(changedSecond);
  assert.deepEqual(firstSecond.carpet.patches, changedSecond.carpet.patches);
});

test("carpet density presets produce a deliberately dramatic patch-count progression", () => {
  const densityRegion = createRegion({
    id: "density-region",
    tags: ["carpet"],
    x: 0,
    y: 0,
    width: 1000,
    height: 1000
  });

  const service = new WebGenerationService();
  const context = createContext([densityRegion]);

  const patchCounts = Object.fromEntries(
    ["sparse", "standard", "dense", "infested"].map((densityId) => {
      const generated = service.generate(context, {
        populations: [
          createPopulation({
            densityId,
            excludeRegionTags: []
          })
        ]
      });

      return [
        densityId,
        generated.webs[0]?.carpet?.patches?.length ?? 0
      ];
    })
  );

  assert.deepEqual(
    patchCounts,
    {
      sparse: 24,
      standard: 75,
      dense: 175,
      infested: 800
    }
  );
});

test("small Regions retain distinct per-density minimum carpet populations", () => {
  const smallRegion = createRegion({
    id: "small-density-region",
    tags: ["carpet"],
    x: 0,
    y: 0,
    width: 200,
    height: 200
  });

  const service = new WebGenerationService();
  const context = createContext([smallRegion]);

  const patchCounts = Object.fromEntries(
    ["sparse", "standard", "dense", "infested"].map((densityId) => {
      const generated = service.generate(context, {
        populations: [
          createPopulation({
            densityId,
            excludeRegionTags: []
          })
        ]
      });

      return [
        densityId,
        generated.webs[0]?.carpet?.patches?.length ?? 0
      ];
    })
  );

  assert.deepEqual(
    patchCounts,
    {
      sparse: 3,
      standard: 8,
      dense: 18,
      infested: 96
    }
  );
});


