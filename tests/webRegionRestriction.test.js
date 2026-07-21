import test from "node:test";
import assert from "node:assert/strict";

import {
  buildWebRegionRestrictionIndex,
  createWebRegionRestrictionDiagnostics,
  evaluateWebRegionRestrictionAtPoint,
  evaluateWebRegionRestrictionForStrands
} from "../scripts/spatial/webRegionRestrictionIndex.js";

const regions = Object.freeze([
  Object.freeze({ id: "crypt", levelId: "base", tags: Object.freeze(["crypt"]), shapes: Object.freeze([{ type: "rectangle", x: 0, y: 0, width: 500, height: 500, rotation: 0 }]) }),
  Object.freeze({ id: "altar", levelId: "base", tags: Object.freeze(["altar"]), shapes: Object.freeze([{ type: "rectangle", x: 200, y: 200, width: 100, height: 100, rotation: 0 }]) }),
  Object.freeze({ id: "upper-crypt", levelId: "upper", tags: Object.freeze(["crypt"]), shapes: Object.freeze([{ type: "rectangle", x: 0, y: 0, width: 500, height: 500, rotation: 0 }]) })
]);

test("Confine is OR, Exclude subtracts, and Exclude wins", () => {
  const index = buildWebRegionRestrictionIndex({
    regions,
    population: { confineRegionTags: ["crypt", "other"], excludeRegionTags: ["altar"] },
    level: { id: "base" }
  });

  assert.equal(evaluateWebRegionRestrictionAtPoint(index, 100, 100).allowed, true);
  assert.equal(evaluateWebRegionRestrictionAtPoint(index, 250, 250).allowed, false);
  assert.equal(evaluateWebRegionRestrictionAtPoint(index, 700, 700).allowed, false);
  assert.deepEqual(evaluateWebRegionRestrictionAtPoint(index, 100, 100).regionIds, ["crypt"]);
});

test("restriction diagnostics report missing and level-incompatible matches", () => {
  const index = buildWebRegionRestrictionIndex({
    regions,
    population: { confineRegionTags: ["crypt", "missing"], excludeRegionTags: [] },
    level: { id: "base" }
  });
  const diagnostics = createWebRegionRestrictionDiagnostics(index);
  assert.deepEqual(diagnostics.matchedConfineRegionIds, ["crypt"]);
  assert.deepEqual(diagnostics.missingConfineTags, ["missing"]);
  assert.deepEqual(diagnostics.incompatibleRegionIds, ["upper-crypt"]);
});


test("full-strand confinement rejects unassigned gaps and Exclude intersections", () => {
  const separatedRegions = [
    { id: "area-1", levelId: "base", tags: ["area1"], shapes: [{ type: "rectangle", x: 0, y: 0, width: 300, height: 500, rotation: 0 }] },
    { id: "area-2", levelId: "base", tags: ["area2"], shapes: [{ type: "rectangle", x: 600, y: 0, width: 300, height: 500, rotation: 0 }] }
  ];
  const index = buildWebRegionRestrictionIndex({
    regions: separatedRegions,
    population: { confineRegionTags: ["area1"], excludeRegionTags: ["area2"] },
    level: { id: "base" }
  });

  const inside = evaluateWebRegionRestrictionForStrands(index, [{
    points: [{ x: 50, y: 50 }, { x: 250, y: 250 }]
  }]);
  const entersGap = evaluateWebRegionRestrictionForStrands(index, [{
    points: [{ x: 50, y: 50 }, { x: 450, y: 250 }]
  }]);
  const reachesExclude = evaluateWebRegionRestrictionForStrands(index, [{
    points: [{ x: 50, y: 50 }, { x: 650, y: 250 }]
  }]);

  assert.equal(inside.allowed, true);
  assert.deepEqual(inside.regionIds, ["area-1"]);
  assert.equal(entersGap.allowed, false);
  assert.equal(reachesExclude.allowed, false);
  assert.deepEqual(reachesExclude.excludeRegionIds, ["area-2"]);
});
