import test from "node:test";
import assert from "node:assert/strict";

import {
  collectWebRegionRecords,
  doesPolylineIntersectWebRegionRecords,
  isPointInsideWebRegionRecord,
  isPolylineFullyInsideWebRegionRecords,
  resolveRegionShapeRecords
} from "../scripts/foundry/webRegionCompatibility.js";

const LEVELS = Object.freeze([
  Object.freeze({ id: "lower", elevationBand: Object.freeze({ bottom: 0, top: 9 }) }),
  Object.freeze({ id: "upper", elevationBand: Object.freeze({ bottom: 10, top: 19 }) })
]);

test("Region compatibility collects tags, geometry, and native level ownership", () => {
  const region = {
    documentName: "Region",
    id: "crypt",
    name: "Crypt",
    elevation: { bottom: 10, top: 19 },
    shapes: [{ type: "rectangle", x: 100, y: 200, width: 300, height: 400 }],
    flags: {
      "dynamic-webs": { regionTags: ["Crypt"] },
      "ambient-critters": { regionTags: ["Area 2"] }
    }
  };
  const scene = { regions: [region] };
  const records = collectWebRegionRecords({
    scene,
    providerResolution: {
      levels: LEVELS,
      resolveWallLevelMetadata: () => ({
        levelId: "lower",
        elevationBand: LEVELS[0].elevationBand,
        resolved: false,
        source: "fallback"
      })
    }
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].levelId, "upper");
  assert.deepEqual(records[0].tags, ["crypt", "area-2"]);
  assert.equal(isPointInsideWebRegionRecord(records[0], 200, 300), true);
  assert.equal(isPointInsideWebRegionRecord(records[0], 50, 300), false);
  assert.equal(Object.isFrozen(records[0].shapes), true);
});

test("polygon and ellipse Region shapes support ownership-point containment", () => {
  const polygon = { documentName: "Region", shapes: [{ type: "polygon", x: 10, y: 20, points: [0, 0, 100, 0, 100, 100, 0, 100] }] };
  const ellipse = { documentName: "Region", shapes: [{ type: "ellipse", x: 100, y: 100, radiusX: 50, radiusY: 25 }] };
  const polygonRecord = { shapes: resolveRegionShapeRecords(polygon) };
  const ellipseRecord = { shapes: resolveRegionShapeRecords(ellipse) };
  assert.equal(isPointInsideWebRegionRecord(polygonRecord, 60, 70), true);
  assert.equal(isPointInsideWebRegionRecord(polygonRecord, 5, 5), false);
  assert.equal(isPointInsideWebRegionRecord(ellipseRecord, 100, 100), true);
  assert.equal(isPointInsideWebRegionRecord(ellipseRecord, 151, 100), false);
});


test("polyline containment uses the union of Confine Regions and detects gaps", () => {
  const left = {
    id: "left",
    shapes: [{ type: "rectangle", x: 0, y: 0, width: 50, height: 100, rotation: 0 }]
  };
  const right = {
    id: "right",
    shapes: [{ type: "rectangle", x: 50, y: 0, width: 50, height: 100, rotation: 0 }]
  };
  const separatedRight = {
    id: "separated-right",
    shapes: [{ type: "rectangle", x: 60, y: 0, width: 40, height: 100, rotation: 0 }]
  };
  const crossing = [{ x: 10, y: 50 }, { x: 90, y: 50 }];

  assert.equal(
    isPolylineFullyInsideWebRegionRecords([left, right], crossing),
    true
  );
  assert.equal(
    isPolylineFullyInsideWebRegionRecords([left, separatedRight], crossing),
    false
  );
  assert.equal(
    doesPolylineIntersectWebRegionRecords([separatedRight], crossing),
    true
  );
});


test("native RegionDocument containment overrides incompatible serialised shape fallbacks", () => {
  const calls = [];
  const region = {
    documentName: "Region",
    id: "native-region",
    name: "Native Region",
    elevation: { bottom: 10, top: 19 },
    shapes: [{
      type: "rectangle",
      x: 0,
      y: 0,
      width: 1000,
      height: 1000
    }],
    flags: {
      "dynamic-webs": {
        regionTags: ["area1"]
      }
    },
    testPoint(point, elevation) {
      calls.push({ point, elevation });
      return Boolean(
        point &&
        typeof point === "object" &&
        Number(point.x) >= 0 &&
        Number(point.x) <= 300 &&
        Number(point.y) >= 0 &&
        Number(point.y) <= 1000 &&
        Number(elevation ?? point.elevation) === 10
      );
    }
  };

  const records = collectWebRegionRecords({
    scene: {
      regions: [region]
    },
    providerResolution: {
      levels: LEVELS,
      resolveWallLevelMetadata: () => ({
        levelId: "upper",
        elevationBand: LEVELS[1].elevationBand,
        resolved: true,
        source: "test"
      })
    }
  });

  assert.equal(
    isPointInsideWebRegionRecord(
      records[0],
      200,
      500,
      {
        elevation: 10
      }
    ),
    true
  );

  assert.equal(
    isPointInsideWebRegionRecord(
      records[0],
      500,
      500,
      {
        elevation: 10
      }
    ),
    false
  );

  assert.ok(
    calls.length >
      0
  );
});
