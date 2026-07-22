import test from "node:test";
import assert from "node:assert/strict";

import {
  collectWebRegionRecords,
  doesPolylineIntersectWebRegionRecords,
  isPointInsideWebRegionRecord,
  isPolylineFullyInsideWebRegionRecords,
  resolveRegionMaskShapeRecords,
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


test("Region mask geometry prefers Foundry polygonTree fill and cut operations", () => {
  const document = {
    documentName: "Region",
    id: "compound-region",
    shapes: [
      { type: "rectangle", x: 0, y: 0, width: 100, height: 100 },
      { type: "rectangle", x: 25, y: 25, width: 50, height: 50, isHole: true }
    ],
    polygonTree: {
      isHole: true,
      points: null,
      children: [
        {
          isHole: false,
          points: [0, 0, 100, 0, 100, 100, 0, 100],
          children: [
            {
              isHole: true,
              points: [25, 25, 75, 25, 75, 75, 25, 75],
              children: []
            }
          ]
        }
      ]
    }
  };

  const maskShapes = resolveRegionMaskShapeRecords(document);

  assert.equal(maskShapes.length, 1);
  assert.equal(maskShapes[0].type, "polygon-tree");
  assert.deepEqual(
    maskShapes[0].operations.map((operation) => operation.operation),
    ["fill", "cut"]
  );
  assert.equal(Object.isFrozen(maskShapes[0].operations), true);
});

test("raw Region hole shapes remain holes in fallback containment", () => {
  const document = {
    documentName: "Region",
    shapes: [
      { type: "rectangle", x: 0, y: 0, width: 100, height: 100 },
      { type: "rectangle", x: 25, y: 25, width: 50, height: 50, isHole: true }
    ]
  };

  const record = {
    shapes: resolveRegionShapeRecords(document)
  };

  assert.equal(isPointInsideWebRegionRecord(record, 10, 10), true);
  assert.equal(isPointInsideWebRegionRecord(record, 50, 50), false);
  assert.equal(record.shapes[1].isHole, true);
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

test("native Region containment uses the v13+ RegionDocument ElevatedPoint signature", () => {
  const calls = [];
  const document = {
    documentName: "Region",
    id: "native-signature",
    name: "Native signature",
    elevation: { bottom: 10, top: 19 },
    shapes: [{ type: "rectangle", x: 0, y: 0, width: 100, height: 100 }],
    testPoint(...args) {
      calls.push(args);
      return args.length === 1 && args[0]?.x === 25 && args[0]?.y === 30 && args[0]?.elevation === 10;
    }
  };

  const records = collectWebRegionRecords({
    scene: { regions: [document] },
    providerResolution: {
      levels: [{
        id: "level-10",
        label: "Level 10",
        providerMode: "native-v14",
        elevationBand: { bottom: 10, top: 19 }
      }]
    }
  });

  assert.equal(
    isPointInsideWebRegionRecord(records[0], 25, 30, { elevation: 10 }),
    true
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  assert.deepEqual(calls[0][0], { x: 25, y: 30, elevation: 10 });
});
