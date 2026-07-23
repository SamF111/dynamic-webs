import test from "node:test";
import assert from "node:assert/strict";

import {
  createGeneratedSpanWallData,
  createSpanWallCoordinates,
  getGeneratedSpanWallWebId,
  isGeneratedSpanWallDocument
} from "../scripts/foundry/webSpanWallCompatibility.js";

function createWeb(
  overrides = {}
) {
  return {
    id:
      "wall-span:scene:population:base:test",
    kind:
      "wall-span",
    levelProviderMode:
      "base",
    levelId:
      "base",
    elevationBand: {
      bottom:
        null,
      top:
        null
    },
    spanAsset: {
      target: {
        firstWallStart: {
          x:
            0,
          y:
            0
        },
        firstWallEnd: {
          x:
            0,
          y:
            100
        },
        secondWallStart: {
          x:
            200,
          y:
            0
        },
        secondWallEnd: {
          x:
            200,
          y:
            100
        }
      }
    },
    ...overrides
  };
}

test(
  "generated span wall coordinates join the two wall-edge centres",
  () => {
    assert.deepEqual(
      createSpanWallCoordinates(
        createWeb()
      ),
      [
        0,
        50,
        200,
        50
      ]
    );
  }
);

test(
  "vision-only generated walls never block movement",
  () => {
    const limited =
      createGeneratedSpanWallData({
        web:
          createWeb(),
        behaviour: {
          visionMode:
            "limited",
          secretDoor:
            false
        }
      });

    const blocked =
      createGeneratedSpanWallData({
        web:
          createWeb(),
        behaviour: {
          visionMode:
            "blocked",
          secretDoor:
            false
        }
      });

    assert.equal(
      limited.move,
      0
    );
    assert.equal(
      limited.sight,
      10
    );
    assert.equal(
      limited.door,
      0
    );
    assert.equal(
      blocked.move,
      0
    );
    assert.equal(
      blocked.sight,
      20
    );
  }
);

test(
  "movement blocking is represented only by a closed secret door",
  () => {
    const created =
      createGeneratedSpanWallData({
        web:
          createWeb(),
        behaviour: {
          visionMode:
            "none",
          secretDoor:
            true
        }
      });

    assert.equal(
      created.move,
      20
    );
    assert.equal(
      created.door,
      2
    );
    assert.equal(
      created.ds,
      0
    );

    const open =
      createGeneratedSpanWallData({
        web:
          createWeb(),
        behaviour: {
          visionMode:
            "limited",
          secretDoor:
            true
        },
        existingWall: {
          door:
            2,
          ds:
            1
        }
      });

    assert.equal(
      open.ds,
      1
    );
  }
);

test(
  "generated span walls carry module ownership and level metadata",
  () => {
    const data =
      createGeneratedSpanWallData({
        web:
          createWeb({
            levelProviderMode:
              "levels-v13",
            levelId:
              "elevation:10:20",
            elevationBand: {
              bottom:
                10,
              top:
                20
            }
          }),
        behaviour: {
          visionMode:
            "limited",
          secretDoor:
            false
        }
      });

    const document = {
      flags:
        data.flags,
      getFlag(
        namespace,
        key
      ) {
        return this.flags?.[
          namespace
        ]?.[
          key
        ];
      }
    };

    assert.equal(
      isGeneratedSpanWallDocument(
        document
      ),
      true
    );
    assert.equal(
      getGeneratedSpanWallWebId(
        document
      ),
      createWeb().id
    );
    assert.deepEqual(
      data.flags[
        "wall-height"
      ],
      {
        bottom:
          10,
        top:
          20
      }
    );
  }
);
