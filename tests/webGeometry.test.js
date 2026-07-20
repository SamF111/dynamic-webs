import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../scripts/module/moduleConstants.js";

import {
  WEB_BLUEPRINT_KINDS,
  assertWebPopulationIntegrity,
  createStableWebId
} from "../scripts/simulation/webs/webBlueprintContract.js";

import {
  WEB_STRAND_KINDS,
  createWebBlueprint,
  createWebStrand
} from "../scripts/simulation/webs/webGeometry.js";

function fixedRandom() {
  return 0.5;
}

function createBlueprint(
  {
    id = null,
    sceneId = "scene-one",
    sourceKey = "source-one",
    strands = null
  } = {}
) {
  const webId =
    id ??
    createStableWebId({
      sceneId,
      kind:
        WEB_BLUEPRINT_KINDS.GROUND,
      sourceKey
    });

  const resolvedStrands =
    strands ??
    [
      createWebStrand({
        id:
          "structural-0",
        kind:
          WEB_STRAND_KINDS.STRUCTURAL,
        points:
          [
            {
              x:
                0,
              y:
                0
            },
            {
              x:
                10,
              y:
                10
            }
          ],
        random:
          fixedRandom
      })
    ];

  return createWebBlueprint({
    id:
      webId,
    sceneId,
    seed:
      "dynamic-webs:test",
    sourceKey,
    kind:
      WEB_BLUEPRINT_KINDS.GROUND,
    hub: {
      x:
        0,
      y:
        0
    },
    strands:
      resolvedStrands,
    perches:
      [
        {
          id:
            "hub",
          x:
            0,
          y:
            0,
          rotation:
            0
        }
      ]
  });
}

test(
  "stable web IDs encode category-local source separators",
  () => {
    assert.equal(
      createStableWebId({
        sceneId:
          "scene:one",
        kind:
          WEB_BLUEPRINT_KINDS.WALL_CORNER,
        sourceKey:
          "wall-a:wall-b:100:100"
      }),
      "wall-corner:scene%3Aone:wall-a%3Awall-b%3A100%3A100"
    );
  }
);

test(
  "createWebBlueprint qualifies stable local strand IDs",
  () => {
    const blueprint =
      createBlueprint();

    assert.equal(
      blueprint.schemaVersion,
      WEB_BLUEPRINT_SCHEMA_VERSION
    );

    assert.equal(
      blueprint.strands[0].localId,
      "structural-0"
    );

    assert.equal(
      blueprint.strands[0].id,
      `${blueprint.id}:structural-0`
    );

    assert.equal(
      Object.isFrozen(
        blueprint
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        blueprint.strands[0].points[0]
      ),
      true
    );
  }
);

test(
  "duplicate local strand IDs fail blueprint construction",
  () => {
    const first =
      createWebStrand({
        id:
          "capture-0",
        kind:
          WEB_STRAND_KINDS.CAPTURE,
        points:
          [
            {
              x:
                0,
              y:
                0
            },
            {
              x:
                5,
              y:
                5
            }
          ],
        random:
          fixedRandom
      });

    const second =
      createWebStrand({
        id:
          "capture-0",
        kind:
          WEB_STRAND_KINDS.CAPTURE,
        points:
          [
            {
              x:
                1,
              y:
                1
            },
            {
              x:
                6,
              y:
                6
            }
          ],
        random:
          fixedRandom
      });

    assert.throws(
      () =>
        createBlueprint({
          strands:
            [
              first,
              second
            ]
        }),
      /duplicate local strand ID/u
    );
  }
);

test(
  "population integrity rejects duplicate web and strand identifiers",
  () => {
    const blueprint =
      createBlueprint();

    assert.throws(
      () =>
        assertWebPopulationIntegrity(
          Object.freeze([
            blueprint,
            blueprint
          ]),
          {
            expectedSceneId:
              "scene-one"
          }
        ),
      /duplicate web ID/u
    );
  }
);

test(
  "invalid strand geometry fails before rendering",
  () => {
    assert.throws(
      () =>
        createWebStrand({
          id:
            "broken",
          kind:
            WEB_STRAND_KINDS.DECORATIVE,
          points:
            [
              {
                x:
                  0,
                y:
                  0
              }
            ],
          random:
            fixedRandom
        }),
      /at least two finite points/u
    );
  }
);
