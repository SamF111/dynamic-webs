import test from "node:test";
import assert from "node:assert/strict";

import { WebGenerationService } from "../scripts/simulation/webs/WebGenerationService.js";
import { getWebDensityPreset } from "../scripts/simulation/webs/webDensityPresets.js";
import { collectWebRegionRecords } from "../scripts/foundry/webRegionCompatibility.js";

const level = Object.freeze({
  id: "base",
  label: "Base level",
  providerMode: "base",
  elevationBand: Object.freeze({ bottom: null, top: null }),
  source: "test"
});

function createContext(regions) {
  return Object.freeze({
    sceneId: "region-generation",
    gridSize: 100,
    sceneRect: Object.freeze({ x: 0, y: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 }),
    wallSegments: Object.freeze([]),
    levels: Object.freeze([level]),
    regions: Object.freeze(regions),
    levelProvider: Object.freeze({ requestedMode: "base", resolvedMode: "base", providerAvailable: true, fallbackUsed: false, fallbackReason: null, activeViewedLevelId: "base", levels: Object.freeze([level]) })
  });
}

function createPopulation(overrides = {}) {
  const standard = getWebDensityPreset("standard").configuration;
  return {
    id: "web-region-test",
    enabled: true,
    levelId: "base",
    confineRegionTags: [],
    excludeRegionTags: [],
    categoryDensities: { "wall-corner": "disabled", "wall-span": "disabled", ground: "standard", "web-carpet": "disabled" },
    colourProfileId: "natural-white",
    thicknessMultiplier: 1,
    generationOptions: {
      cornerWebs: { enabled: false },
      spanWebs: { enabled: false },
      groundWebs: { ...standard.groundWebs, enabled: true }
    },
    ...overrides
  };
}

const crypt = Object.freeze({
  id: "crypt-region",
  name: "Crypt",
  tags: Object.freeze(["crypt", "all"]),
  levelId: "base",
  elevationBand: Object.freeze({ bottom: null, top: null }),
  shapes: Object.freeze([{ type: "rectangle", x: 0, y: 0, width: 500, height: 1000, rotation: 0 }])
});

test("confined ground webs keep every visible strand inside the Confine Region", () => {
  const result = new WebGenerationService().generate(createContext([crypt]), {
    populations: [createPopulation({ confineRegionTags: ["crypt"] })]
  });
  assert.ok(result.webs.length > 0);
  assert.ok(result.webs.every((web) =>
    web.strands.every((strand) => strand.points.every((point) => point.x <= 500))
  ));
  assert.ok(result.webs.every((web) => web.regionIds.includes("crypt-region")));
  assert.ok(result.webs.every((web) => web.regionTags.includes("crypt")));
});

test("missing confine Regions and full exclusion safely generate no webs", () => {
  const service = new WebGenerationService();
  const missing = service.generate(createContext([crypt]), {
    populations: [createPopulation({ confineRegionTags: ["missing"] })]
  });
  assert.equal(missing.webs.length, 0);

  const excluded = service.generate(createContext([crypt]), {
    populations: [createPopulation({ confineRegionTags: ["crypt"], excludeRegionTags: ["all"] })]
  });
  assert.equal(excluded.webs.length, 0);
});

test("empty Region lists preserve unrestricted deterministic identifiers", () => {
  const service = new WebGenerationService();
  const first = service.generate(createContext([crypt]), { populations: [createPopulation()] });
  const second = service.generate(createContext([crypt]), { populations: [createPopulation({ confineRegionTags: [], excludeRegionTags: [] })] });
  assert.deepEqual(first.webs.map((web) => web.id), second.webs.map((web) => web.id));
  assert.ok(first.webs.every((web) => web.regionIds.length === 0));
});


test("separate Exclude Regions do not permit webs in unassigned space", () => {
  const area1 = {
    id: "area-1",
    name: "Area 1",
    tags: ["area1"],
    levelId: "base",
    elevationBand: { bottom: null, top: null },
    shapes: [{ type: "rectangle", x: 0, y: 0, width: 350, height: 1000, rotation: 0 }]
  };
  const area2 = {
    id: "area-2",
    name: "Area 2",
    tags: ["area2"],
    levelId: "base",
    elevationBand: { bottom: null, top: null },
    shapes: [{ type: "rectangle", x: 650, y: 0, width: 350, height: 1000, rotation: 0 }]
  };

  const result = new WebGenerationService().generate(createContext([area1, area2]), {
    populations: [createPopulation({
      confineRegionTags: ["area1"],
      excludeRegionTags: ["area2"]
    })]
  });

  assert.ok(result.webs.length > 0);
  assert.ok(result.webs.every((web) =>
    web.strands.every((strand) =>
      strand.points.every((point) => point.x <= 350)
    )
  ));
});


test("v13 native Region containment survives generation-context normalisation", () => {
  const nativeArea1 = {
    documentName: "Region",
    id: "native-area-1",
    name: "Native Area 1",
    elevation: {
      bottom: 0,
      top: 9
    },
    flags: {
      "dynamic-webs": {
        regionTags: ["area1"]
      }
    },
    /**
     * Deliberately misleading fallback geometry. Native containment is the
     * authoritative boundary and permits only x <= 350.
     */
    shapes: [{
      type: "rectangle",
      x: 0,
      y: 0,
      width: 1000,
      height: 1000
    }],
    testPoint(point, elevation) {
      return Boolean(
        point &&
        typeof point === "object" &&
        Number(point.x) >= 0 &&
        Number(point.x) <= 350 &&
        Number(point.y) >= 0 &&
        Number(point.y) <= 1000 &&
        Number(elevation ?? point.elevation) === 0
      );
    }
  };

  const nativeArea2 = {
    documentName: "Region",
    id: "native-area-2",
    name: "Native Area 2",
    elevation: {
      bottom: 0,
      top: 9
    },
    flags: {
      "dynamic-webs": {
        regionTags: ["area2"]
      }
    },
    shapes: [{
      type: "rectangle",
      x: 0,
      y: 0,
      width: 1000,
      height: 1000
    }],
    testPoint(point, elevation) {
      return Boolean(
        point &&
        typeof point === "object" &&
        Number(point.x) >= 650 &&
        Number(point.x) <= 1000 &&
        Number(point.y) >= 0 &&
        Number(point.y) <= 1000 &&
        Number(elevation ?? point.elevation) === 0
      );
    }
  };

  const baseLevel = {
    ...level,
    elevationBand: Object.freeze({
      bottom: 0,
      top: 9
    })
  };

  const regions = collectWebRegionRecords({
    scene: {
      regions: [
        nativeArea1,
        nativeArea2
      ]
    },
    providerResolution: {
      levels: [
        baseLevel
      ],
      resolveWallLevelMetadata: () => ({
        levelId: "base",
        elevationBand: baseLevel.elevationBand,
        resolved: true,
        source: "test"
      })
    }
  });

  const context = {
    ...createContext(regions),
    levels: Object.freeze([
      Object.freeze(
        baseLevel
      )
    ]),
    levelProvider: Object.freeze({
      requestedMode: "base",
      resolvedMode: "base",
      providerAvailable: true,
      fallbackUsed: false,
      fallbackReason: null,
      activeViewedLevelId: "base",
      levels: Object.freeze([
        Object.freeze(
          baseLevel
        )
      ])
    })
  };

  const result = new WebGenerationService().generate(context, {
    populations: [createPopulation({
      confineRegionTags: ["area1"],
      excludeRegionTags: ["area2"]
    })]
  });

  assert.ok(
    result.webs.length >
      0
  );

  assert.ok(
    result.webs.every(
      (
        web
      ) =>
        web.strands.every(
          (
            strand
          ) =>
            strand.points.every(
              (
                point
              ) =>
                point.x <=
                350
            )
        )
    )
  );
});
