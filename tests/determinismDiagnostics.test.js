import test from "node:test";
import assert from "node:assert/strict";

import {
  runDeterminismDiagnostic
} from "../scripts/diagnostics/determinismDiagnostics.js";

function createWeb(
  pointX
) {
  return Object.freeze({
    schemaVersion:
      1,
    id:
      "ground:scene:test",
    kind:
      "ground",
    sceneId:
      "scene",
    seed:
      "seed",
    sourceKey:
      "test",
    hub:
      Object.freeze({
        x:
          pointX,
        y:
          20
      }),
    bounds:
      Object.freeze({
        x:
          pointX,
        y:
          20,
        width:
          10,
        height:
          10,
        right:
          pointX +
          10,
        bottom:
          30
      }),
    strands:
      Object.freeze([
        Object.freeze({
          schemaVersion:
            1,
          id:
            "ground:scene:test:structural-0",
          localId:
            "structural-0",
          kind:
            "structural",
          points:
            Object.freeze([
              Object.freeze({
                x:
                  pointX,
                y:
                  20
              }),
              Object.freeze({
                x:
                  pointX +
                  10,
                y:
                  30
              })
            ]),
          alpha:
            0.7,
          widthPx:
            1.2,
          collisionWidthPx:
            2.25
        })
      ]),
    perches:
      Object.freeze([]),
    supportingWallIds:
      Object.freeze([])
  });
}

test(
  "determinism diagnostic compares two generations without mutating runtime webs",
  () => {
    const runtimeWebs =
      Object.freeze([
        createWeb(
          10
        )
      ]);

    const generationService = {
      generate:
        () =>
          Object.freeze({
            webs:
              Object.freeze([
                createWeb(
                  10
                )
              ])
          })
    };

    const report =
      runDeterminismDiagnostic({
        generationService,
        context: {
          sceneId:
            "scene"
        },
        configuration: {
          seed:
            "seed"
        },
        currentWebs:
          runtimeWebs
      });

    assert.equal(
      report.executed,
      true
    );

    assert.equal(
      report.deterministic,
      true
    );

    assert.equal(
      report.matchesRuntimeState,
      true
    );

    assert.deepEqual(
      report.mismatchedWebIds,
      []
    );

    assert.equal(
      Object.isFrozen(
        report
      ),
      true
    );

    assert.equal(
      runtimeWebs[0].hub.x,
      10
    );
  }
);

test(
  "determinism diagnostic identifies mismatched web geometry",
  () => {
    let generation =
      0;

    const generationService = {
      generate:
        () => {
          generation +=
            1;

          return {
            webs: [
              createWeb(
                generation
              )
            ]
          };
        }
    };

    const report =
      runDeterminismDiagnostic({
        generationService,
        context: {},
        configuration: {}
      });

    assert.equal(
      report.deterministic,
      false
    );

    assert.deepEqual(
      report.mismatchedWebIds,
      [
        "ground:scene:test"
      ]
    );

    assert.notEqual(
      report.firstHash,
      report.secondHash
    );
  }
);
