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


test(
  "all supported wall coordinate differential forms rebuild webs",
  () => {
    for (
      const changed of
      [
        {
          coords: [
            0,
            0,
            10,
            10
          ]
        },
        {
          coordinates: [
            0,
            0,
            10,
            10
          ]
        },
        {
          x1:
            0
        },
        {
          y1:
            0
        },
        {
          x2:
            10
        },
        {
          y2:
            10
        },
        {
          "c.0":
            5
        },
        {
          c: {
            0:
              5
          }
        }
      ]
    ) {
      assert.equal(
        doesWallUpdateAffectWebs(
          changed
        ),
        true
      );
    }
  }
);

test(
  "door type changes rebuild while restrictions and metadata do not",
  () => {
    assert.equal(
      doesWallUpdateAffectWebs({
        doorType:
          2
      }),
      true
    );

    for (
      const changed of
      [
        {
          move:
            0
        },
        {
          light:
            0
        },
        {
          sound:
            0
        },
        {
          flags: {
            test:
              true
          }
        },
        {
          name:
            "Renamed"
        }
      ]
    ) {
      assert.equal(
        doesWallUpdateAffectWebs(
          changed
        ),
        false
      );
    }
  }
);
