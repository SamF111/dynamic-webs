import test from "node:test";
import assert from "node:assert/strict";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

import {
  createCanonicalPopulationProjection
} from "../scripts/diagnostics/determinismDiagnostics.js";

function createContext() {
  return {
    sceneId: "scene-populations",
    gridSize: 100,
    sceneRect: { x: 0, y: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 },
    wallSegments: [],
    levels: [
      { id: "level-0", label: "Level 0", providerMode: "base", elevationBand: { bottom: 0, top: 9 } },
      { id: "level-10", label: "Level 10", providerMode: "base", elevationBand: { bottom: 10, top: 19 } }
    ],
    levelProvider: {
      requestedMode: "base",
      resolvedMode: "base",
      providerAvailable: true,
      fallbackUsed: false,
      fallbackReason: null,
      activeViewedLevelId: "level-0",
      levels: []
    }
  };
}

function population({ id, levelId, colourProfileId, thicknessMultiplier, count = 2 }) {
  return {
    id,
    label: id,
    enabled: true,
    levelId,
    categoryDensities: {
      "wall-corner": "disabled",
      "wall-span": "disabled",
      ground: "sparse",
      "web-carpet": "disabled"
    },
    colourProfileId,
    thicknessMultiplier,
    generationOptions: {
      cornerWebs: { enabled: false },
      spanWebs: { enabled: false },
      groundWebs: { enabled: true, count }
    }
  };
}

test("modular populations generate only on their selected levels with independent presentation", () => {
  const generated = new WebGenerationService().generate(createContext(), {
    populations: [
      population({ id: "blue-zero", levelId: "level-0", colourProfileId: "arcane-blue", thicknessMultiplier: 1 }),
      population({ id: "red-ten", levelId: "level-10", colourProfileId: "blood-red", thicknessMultiplier: 2 })
    ]
  });

  assert.equal(generated.webs.length, 4);
  assert.deepEqual(new Set(generated.webs.map((web) => web.populationId)), new Set(["blue-zero", "red-ten"]));
  assert.ok(generated.webs.filter((web) => web.populationId === "blue-zero").every((web) => web.levelId === "level-0" && web.colourProfileId === "arcane-blue" && web.thicknessMultiplier === 1));
  assert.ok(generated.webs.filter((web) => web.populationId === "red-ten").every((web) => web.levelId === "level-10" && web.colourProfileId === "blood-red" && web.thicknessMultiplier === 2));
  assert.equal(generated.counts.byPopulation["blue-zero"].total, 2);
  assert.equal(generated.counts.byPopulation["red-ten"].total, 2);
  assert.ok(generated.webs.every((web) => web.id.includes(`:${encodeURIComponent(web.populationId)}:`)));
});

test("equivalent modular inputs reproduce equivalent population-qualified geometry", () => {
  const service = new WebGenerationService();
  const options = {
    populations: [population({ id: "blue-zero", levelId: "level-0", colourProfileId: "arcane-blue", thicknessMultiplier: 1 })]
  };
  assert.deepEqual(
    createCanonicalPopulationProjection(service.generate(createContext(), options).webs),
    createCanonicalPopulationProjection(service.generate(createContext(), options).webs)
  );
});

test("changing one population leaves another population byte-equivalent", () => {
  const service = new WebGenerationService();
  const first = service.generate(createContext(), {
    populations: [
      population({ id: "blue-zero", levelId: "level-0", colourProfileId: "arcane-blue", thicknessMultiplier: 1, count: 2 }),
      population({ id: "red-ten", levelId: "level-10", colourProfileId: "blood-red", thicknessMultiplier: 2, count: 2 })
    ]
  });
  const second = service.generate(createContext(), {
    populations: [
      population({ id: "blue-zero", levelId: "level-0", colourProfileId: "arcane-blue", thicknessMultiplier: 1, count: 2 }),
      population({ id: "red-ten", levelId: "level-10", colourProfileId: "blood-red", thicknessMultiplier: 2, count: 5 })
    ]
  });

  const blue = (webs) => createCanonicalPopulationProjection(webs.filter((web) => web.populationId === "blue-zero"));
  assert.deepEqual(blue(first.webs), blue(second.webs));
});

test("multiple populations on one level cannot collide", () => {
  const generated = new WebGenerationService().generate(createContext(), {
    populations: [
      population({ id: "blue", levelId: "level-0", colourProfileId: "arcane-blue", thicknessMultiplier: 1 }),
      population({ id: "red", levelId: "level-0", colourProfileId: "blood-red", thicknessMultiplier: 1 })
    ]
  });
  assert.equal(new Set(generated.webs.map((web) => web.id)).size, generated.webs.length);
  assert.equal(new Set(generated.webs.flatMap((web) => web.strands.map((strand) => strand.id))).size, generated.webs.flatMap((web) => web.strands).length);
});
