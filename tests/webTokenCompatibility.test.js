import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebTokenMovementSnapshot,
  createWebTokenMovementTransition,
  getRenderedWebTokenCentre,
  hasRenderedWebTokenArrived
} from "../scripts/foundry/webTokenCompatibility.js";

test("token movement snapshot resolves centre, radius and level", () => {
  const snapshot = createWebTokenMovementSnapshot({
    token: {
      id: "token-a",
      x: 100,
      y: 200,
      width: 2,
      height: 1,
      elevation: 10
    },
    scene: {
      id: "scene-a",
      grid: { size: 100 }
    },
    levels: [
      { id: "lower", elevationBand: { bottom: 0, top: 9 } },
      { id: "upper", elevationBand: { bottom: 10, top: 19 } }
    ]
  });

  assert.deepEqual(snapshot.centre, { x: 200, y: 250 });
  assert.equal(snapshot.collisionRadiusPx, 50);
  assert.equal(snapshot.levelId, "upper");
});



test("applied update data overrides animated v13 document getters", () => {
  const snapshot = createWebTokenMovementSnapshot({
    token: {
      id: "token-v13-animated",
      x: 3640,
      y: 1820,
      _source: {
        x: 3640,
        y: 1400,
        width: 1,
        height: 1,
        elevation: 0
      },
      width: 1,
      height: 1,
      elevation: 0,
      parent: { id: "scene-a" }
    },
    changed: { y: 1400 },
    scene: {
      id: "scene-a",
      grid: { size: 140 }
    },
    levels: [
      {
        id: "base",
        elevationBand: {
          bottom: Number.NEGATIVE_INFINITY,
          top: Number.POSITIVE_INFINITY
        }
      }
    ]
  });

  assert.equal(snapshot.y, 1400);
  assert.deepEqual(snapshot.centre, { x: 3710, y: 1470 });

  const canonicalSnapshot = createWebTokenMovementSnapshot({
    token: {
      id: "token-v13-canonical",
      x: 3640,
      y: 1820,
      _source: {
        x: 3640,
        y: 1400,
        width: 1,
        height: 1,
        elevation: 0
      },
      width: 1,
      height: 1,
      elevation: 0,
      parent: { id: "scene-a" }
    },
    scene: {
      id: "scene-a",
      grid: { size: 140 }
    },
    levels: [
      {
        id: "base",
        elevationBand: {
          bottom: Number.NEGATIVE_INFINITY,
          top: Number.POSITIVE_INFINITY
        }
      }
    ]
  });

  assert.equal(canonicalSnapshot.y, 1400);
  assert.deepEqual(canonicalSnapshot.centre, { x: 3710, y: 1470 });
});


test("pre-update movement transition preserves the old origin and proposed destination", () => {
  const token = {
    id: "token-transition",
    x: 100,
    y: 200,
    width: 1,
    height: 1,
    elevation: 0,
    parent: { id: "scene-a" },
    getSize({ width, height }) {
      return { width: width * 80, height: height * 80 };
    }
  };

  const movement = createWebTokenMovementTransition({
    token,
    changed: { x: 300, width: 2 },
    scene: { id: "scene-a", grid: { size: 100 } },
    levels: [
      { id: "level-0", elevationBand: { bottom: 0, top: 9 } }
    ],
    userId: "gm"
  });

  assert.deepEqual(movement.from.centre, { x: 140, y: 240 });
  assert.deepEqual(movement.to.centre, { x: 380, y: 240 });
  assert.equal(movement.collisionRadiusPx, 40);
  assert.equal(movement.levelId, "level-0");
  assert.equal(movement.userId, "gm");
});

test("rendered token centre follows PIXI position instead of destination document coordinates", () => {
  const movement = createWebTokenMovementTransition({
    token: {
      id: "token-rendered",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      elevation: 0,
      parent: { id: "scene-a" }
    },
    changed: { x: 200 },
    scene: { id: "scene-a", grid: { size: 100 } },
    levels: [
      { id: "level-0", elevationBand: { bottom: 0, top: 9 } }
    ]
  });

  const placeable = {
    position: { x: 80, y: 0 },
    w: 100,
    h: 100,
    document: { x: 200, y: 0 }
  };

  const centre = getRenderedWebTokenCentre(placeable, movement);

  assert.deepEqual(centre, { x: 130, y: 50 });
  assert.equal(hasRenderedWebTokenArrived(movement, centre), false);

  placeable.position.x = 200;
  assert.equal(
    hasRenderedWebTokenArrived(
      movement,
      getRenderedWebTokenCentre(placeable, movement)
    ),
    true
  );
});
