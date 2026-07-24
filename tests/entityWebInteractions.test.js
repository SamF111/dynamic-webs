import test from "node:test";
import assert from "node:assert/strict";

import {
  EntityWebInteractionService
} from "../scripts/interactions/EntityWebInteractionService.js";

import {
  WEB_ENTITY_INTERACTION_HOOKS,
  WEB_ENTITY_INTERACTION_OUTCOMES
} from "../scripts/interactions/webInteractionContract.js";

function createStrand(
  webId,
  strandId
) {
  return Object.freeze({
    webId,
    strandId,
    sceneId:
      "scene",
    populationId:
      "population",
    levelId:
      "level-0",
    elevationBand:
      Object.freeze({
        bottom:
          0,
        top:
          9
      }),
    webKind:
      "ground"
  });
}

test(
  "generic entity movement reports entered, intersected and current web IDs and emits immutable hooks",
  () => {
    const previousHooks =
      globalThis.Hooks;

    const hookCalls =
      [];

    globalThis.Hooks = {
      callAll(
        name,
        ...args
      ) {
        hookCalls.push({
          name,
          args
        });
      }
    };

    try {
      const runtime = {
        getState: () => ({
          sceneId:
            "scene"
        }),
        queryNearby(
          point
        ) {
          return point.x >=
            10
            ? Object.freeze([
                createStrand(
                  "ground-a",
                  "ground-a:s1"
                )
              ])
            : Object.freeze([]);
        }
      };

      const movement = {
        queryMovement() {
          return Object.freeze([
            Object.freeze({
              webId:
                "ground-a",
              sceneId:
                "scene",
              populationId:
                "population",
              levelId:
                "level-0",
              elevationBand:
                Object.freeze({
                  bottom:
                    0,
                  top:
                    9
                }),
              webKind:
                "ground",
              strandIds:
                Object.freeze([
                  "ground-a:s1"
                ])
            })
          ]);
        }
      };

      const service =
        new EntityWebInteractionService({
          webRuntimeService:
            runtime,
          movementInteractionService:
            movement
        });

      const result =
        service.evaluateMovement({
          sourceModuleId:
            "ambient-critters",
          entityType:
            "critter",
          entityId:
            "critter-1",
          from: {
            x:
              0,
            y:
              0
          },
          to: {
            x:
              10,
            y:
              0
          },
          levelId:
            "level-0",
          collisionRadiusPx:
            2,
          categories:
            [
              "ground"
            ]
        });

      assert.equal(
        result.primaryOutcome,
        WEB_ENTITY_INTERACTION_OUTCOMES.ENTERED_WEB
      );

      assert.deepEqual(
        result.enteredWebIds,
        [
          "ground-a"
        ]
      );

      assert.deepEqual(
        result.intersectedWebIds,
        [
          "ground-a"
        ]
      );

      assert.deepEqual(
        result.currentWebIds,
        [
          "ground-a"
        ]
      );

      assert.equal(
        result.onWeb,
        true
      );

      assert.equal(
        Object.isFrozen(
          result
        ),
        true
      );

      assert.ok(
        hookCalls.some(
          call =>
            call.name ===
            WEB_ENTITY_INTERACTION_HOOKS.INTERACTION
        )
      );

      assert.ok(
        hookCalls.some(
          call =>
            call.name ===
            WEB_ENTITY_INTERACTION_HOOKS.ENTERED_WEB
        )
      );

      assert.ok(
        hookCalls.some(
          call =>
            call.name ===
            WEB_ENTITY_INTERACTION_HOOKS.INTERSECTED_WEB
        )
      );
    } finally {
      globalThis.Hooks =
        previousHooks;
    }
  }
);

test(
  "generic entity evaluation requires explicit physical level compatibility",
  () => {
    const service =
      new EntityWebInteractionService({
        webRuntimeService: {
          queryNearby: () =>
            Object.freeze([])
        },
        movementInteractionService: {
          queryMovement: () =>
            Object.freeze([])
        }
      });

    assert.throws(
      () =>
        service.evaluateMovement({
          entityId:
            "entity",
          from: {
            x:
              0,
            y:
              0
          },
          to: {
            x:
              1,
            y:
              1
          }
        }),
      /require levelId, elevation or elevationBand/u
    );
  }
);

test(
  "position queries report current strand occupancy without emitting hooks",
  () => {
    const service =
      new EntityWebInteractionService({
        webRuntimeService: {
          getState: () => ({
            sceneId:
              "scene"
          }),
          queryNearby: () =>
            Object.freeze([
              createStrand(
                "ground-a",
                "ground-a:s1"
              )
            ])
        },
        movementInteractionService: {
          queryMovement: () =>
            Object.freeze([])
        }
      });

    const result =
      service.queryPosition({
        entityId:
          "entity",
        point: {
          x:
            5,
          y:
            5
        },
        levelId:
          "level-0",
        radiusPx:
          3
      });

    assert.equal(
      result.onWeb,
      true
    );

    assert.deepEqual(
      result.webIds,
      [
        "ground-a"
      ]
    );
  }
);
