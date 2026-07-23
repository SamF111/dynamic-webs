import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebTokenMovementSnapshot
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
