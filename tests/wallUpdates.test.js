import test from "node:test";
import assert from "node:assert/strict";

import {
  doesWallUpdateAffectWebs
} from "../scripts/lifecycle/sceneLifecycle/sceneLifecycleWallUpdates.js";

test(
  "wall geometry and door classification rebuild webs",
  () => {
    assert.equal(
      doesWallUpdateAffectWebs({
        c: [
          0,
          0,
          100,
          100
        ]
      }),
      true
    );

    assert.equal(
      doesWallUpdateAffectWebs({
        door:
          1
      }),
      true
    );
  }
);

test(
  "door state and senses do not rebuild webs",
  () => {
    assert.equal(
      doesWallUpdateAffectWebs({
        ds:
          1
      }),
      false
    );

    assert.equal(
      doesWallUpdateAffectWebs({
        sight:
          0
      }),
      false
    );
  }
);
