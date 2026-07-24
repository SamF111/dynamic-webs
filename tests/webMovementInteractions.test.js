import test from "node:test";
import assert from "node:assert/strict";

import {
  WebMovementInteractionService
} from "../scripts/interactions/WebMovementInteractionService.js";

import {
  segmentToSegmentDistance,
  sweptMovementIntersectsPolyline
} from "../scripts/interactions/spanWebMovementGeometry.js";

test("swept movement detects crossing and near-miss distances", () => {
  assert.equal(segmentToSegmentDistance(
    { x: 0, y: 5 }, { x: 10, y: 5 },
    { x: 5, y: 0 }, { x: 5, y: 10 }
  ), 0);

  assert.equal(sweptMovementIntersectsPolyline({
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    collisionRadiusPx: 1,
    points: [{ x: 5, y: 1.5 }, { x: 5, y: 4 }],
    interactionWidthPx: 1
  }), true);
});

test("movement service groups precise strand hits by stable web ID", () => {
  const queries = [];
  const runtime = {
    queryStrands(bounds, options) {
      queries.push({ bounds, options });
      return Object.freeze([
        Object.freeze({
          webId: "span-b",
          strandId: "span-b:s1",
          sceneId: "scene",
          populationId: "population",
          levelId: "level-0",
          elevationBand: Object.freeze({ bottom: 0, top: 9 }),
          webKind: "wall-span",
          points: Object.freeze([{ x: 5, y: -5 }, { x: 5, y: 5 }]),
          interactionWidthPx: 2,
          intact: true
        }),
        Object.freeze({
          webId: "span-b",
          strandId: "span-b:s2",
          sceneId: "scene",
          populationId: "population",
          levelId: "level-0",
          elevationBand: Object.freeze({ bottom: 0, top: 9 }),
          webKind: "wall-span",
          points: Object.freeze([{ x: 6, y: -5 }, { x: 6, y: 5 }]),
          interactionWidthPx: 2,
          intact: true
        })
      ]);
    }
  };

  const service = new WebMovementInteractionService({ webRuntimeService: runtime });
  const hits = service.queryMovement({
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    levelId: "level-0",
    collisionRadiusPx: 0
  });

  assert.equal(hits.length, 1);
  assert.equal(hits[0].webId, "span-b");
  assert.deepEqual(hits[0].strandIds, ["span-b:s1", "span-b:s2"]);
  assert.deepEqual(queries[0].options.categories, ["wall-span"]);
  assert.equal(queries[0].options.intactOnly, true);
});


test("movement service supports generic functional web categories while preserving span defaults", () => {
  const queries = [];
  const runtime = {
    queryStrands(bounds, options) {
      queries.push({ bounds, options });
      return Object.freeze([
        Object.freeze({
          webId: "ground-a",
          strandId: "ground-a:s1",
          sceneId: "scene",
          populationId: "population",
          levelId: "level-0",
          elevationBand: Object.freeze({ bottom: 0, top: 9 }),
          webKind: "ground",
          points: Object.freeze([{ x: 5, y: -5 }, { x: 5, y: 5 }]),
          interactionWidthPx: 2,
          intact: true
        })
      ]);
    }
  };

  const service = new WebMovementInteractionService({ webRuntimeService: runtime });
  const hits = service.queryMovement({
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    levelId: "level-0",
    categories: ["ground"],
    strandKinds: ["capture"]
  });

  assert.deepEqual(hits.map((hit) => hit.webId), ["ground-a"]);
  assert.deepEqual(queries[0].options.categories, ["ground"]);
  assert.deepEqual(queries[0].options.strandKinds, ["capture"]);
});
