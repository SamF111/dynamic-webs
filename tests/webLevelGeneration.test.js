import test from "node:test";
import assert from "node:assert/strict";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

const LEVELS =
  Object.freeze([
    Object.freeze({
      id:
        "lower",
      label:
        "Lower",
      providerMode:
        "native-v14",
      elevationBand:
        Object.freeze({
          bottom:
            0,
          top:
            9
        })
    }),
    Object.freeze({
      id:
        "upper",
      label:
        "Upper",
      providerMode:
        "native-v14",
      elevationBand:
        Object.freeze({
          bottom:
            10,
          top:
            19
        })
    })
  ]);

function createContext({
  upperOffset =
    0
} = {}) {
  return Object.freeze({
    sceneId:
      "scene-levels",
    gridSize:
      100,
    sceneRect:
      Object.freeze({
        x:
          0,
        y:
          0,
        width:
          1000,
        height:
          1000,
        right:
          1000,
        bottom:
          1000
      }),
    levels:
      LEVELS,
    levelProvider:
      Object.freeze({
        requestedMode:
          "native-v14",
        resolvedMode:
          "native-v14",
        activeViewedLevelId:
          "lower",
        levels:
          LEVELS
      }),
    wallSegments:
      Object.freeze([
        createWall(
          "lower-a",
          "lower",
          100,
          100,
          700,
          100,
          0,
          9
        ),
        createWall(
          "lower-b",
          "lower",
          100,
          100,
          100,
          700,
          0,
          9
        ),
        createWall(
          "upper-a",
          "upper",
          200 +
            upperOffset,
          200,
          800 +
            upperOffset,
          200,
          10,
          19
        ),
        createWall(
          "upper-b",
          "upper",
          200 +
            upperOffset,
          200,
          200 +
            upperOffset,
          800,
          10,
          19
        )
      ])
  });
}

function createWall(
  wallId,
  levelId,
  x1,
  y1,
  x2,
  y2,
  bottom,
  top
) {
  return Object.freeze({
    wallId,
    levelId,
    levelProviderMode:
      "native-v14",
    elevationBand:
      Object.freeze({
        bottom,
        top
      }),
    a:
      Object.freeze({
        x:
          x1,
        y:
          y1
      }),
    b:
      Object.freeze({
        x:
          x2,
        y:
          y2
      })
  });
}

function projectLevel(
  result,
  levelId
) {
  return result.webs
    .filter(
      (
        web
      ) =>
        web.levelId ===
        levelId
    )
    .map(
      (
        web
      ) => ({
        id:
          web.id,
        seed:
          web.seed,
        hub:
          web.hub,
        strands:
          web.strands.map(
            (
              strand
            ) => ({
              id:
                strand.id,
              points:
                strand.points
            })
          )
      })
    );
}

test(
  "every detected level receives the complete ground density allocation",
  () => {
    const result =
      new WebGenerationService().generate(
        createContext(),
        {
          cornerWebs: {
            enabled:
              false
          },
          spanWebs: {
            enabled:
              false
          },
          groundWebs: {
            enabled:
              true,
            count:
              3
          }
        }
      );

    assert.equal(
      result.counts.ground,
      6
    );

    assert.equal(
      result.counts.byLevel.lower.byWebKind.ground,
      3
    );

    assert.equal(
      result.counts.byLevel.upper.byWebKind.ground,
      3
    );

    assert.equal(
      new Set(
        result.webs.map(
          (
            web
          ) =>
            web.id
        )
      ).size,
      result.webs.length
    );

    assert.ok(
      result.webs.every(
        (
          web
        ) =>
          web.id.includes(
            `:${web.levelId}:`
          ) &&
          Object.isFrozen(
            web.elevationBand
          )
      )
    );
  }
);

test(
  "wall-supported webs never combine walls from different levels",
  () => {
    const result =
      new WebGenerationService().generate(
        createContext(),
        {
          cornerWebs: {
            enabled:
              true,
            maximumCount:
              4
          },
          spanWebs: {
            enabled:
              false
          },
          groundWebs: {
            enabled:
              false
          }
        }
      );

    const wallLevels =
      Object.fromEntries(
        createContext().wallSegments.map(
          (
            wall
          ) => [
            wall.wallId,
            wall.levelId
          ]
        )
      );

    assert.ok(
      result.webs.length >=
        2
    );

    for (
      const web of
      result.webs
    ) {
      assert.ok(
        web.supportingWallIds.every(
          (
            wallId
          ) =>
            wallLevels[
              wallId
            ] ===
            web.levelId
        )
      );
    }
  }
);

test(
  "editing one level does not reshuffle another level's deterministic population",
  () => {
    const service =
      new WebGenerationService();

    const options = {
      cornerWebs: {
        enabled:
          true,
        maximumCount:
          4
      },
      spanWebs: {
        enabled:
          false
      },
      groundWebs: {
        enabled:
          true,
        count:
          2
      }
    };

    const first =
      service.generate(
        createContext(),
        options
      );

    const second =
      service.generate(
        createContext({
          upperOffset:
            80
        }),
        options
      );

    assert.deepEqual(
      projectLevel(
        first,
        "lower"
      ),
      projectLevel(
        second,
        "lower"
      )
    );
  }
);
