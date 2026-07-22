import test from "node:test";
import assert from "node:assert/strict";

import {
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../scripts/module/moduleConstants.js";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

import {
  getWebDensityPreset
} from "../scripts/simulation/webs/webDensityPresets.js";

const BASE_CONTEXT =
  Object.freeze({
    sceneId:
      "scene-one",
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
    wallSegments:
      Object.freeze([
        Object.freeze({
          wallId:
            "a",
          a:
            Object.freeze({
              x:
                100,
              y:
                100
            }),
          b:
            Object.freeze({
              x:
                900,
              y:
                100
            })
        }),
        Object.freeze({
          wallId:
            "b",
          a:
            Object.freeze({
              x:
                100,
              y:
                100
            }),
          b:
            Object.freeze({
              x:
                100,
              y:
                900
            })
        }),
        Object.freeze({
          wallId:
            "c",
          a:
            Object.freeze({
              x:
                300,
              y:
                300
            }),
          b:
            Object.freeze({
              x:
                300,
              y:
                800
            })
        }),
        Object.freeze({
          wallId:
            "d",
          a:
            Object.freeze({
              x:
                400,
              y:
                300
            }),
          b:
            Object.freeze({
              x:
                400,
              y:
                800
            })
        })
      ])
  });

function createOptions() {
  return getWebDensityPreset(
    "standard"
  ).configuration;
}

function generate(
  context = BASE_CONTEXT,
  options = createOptions()
) {
  return new WebGenerationService()
    .generate(
      context,
      options
    );
}

function selectKinds(
  result,
  kinds
) {
  const allowed =
    new Set(
      kinds
    );

  return result.webs.filter(
    (
      web
    ) =>
      allowed.has(
        web.kind
      )
  );
}

function assertDeeplyFrozen(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object"
  ) {
    return;
  }

  assert.equal(
    Object.isFrozen(
      value
    ),
    true
  );

  for (
    const child of
    Object.values(
      value
    )
  ) {
    assertDeeplyFrozen(
      child
    );
  }
}

test(
  "web generation is deterministic for one Scene and density",
  () => {
    const first =
      generate();

    const second =
      generate();

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.blueprintSchemaVersion,
      WEB_BLUEPRINT_SCHEMA_VERSION
    );

    assert.equal(
      first.seed,
      "dynamic-webs:web-generation:v3:scene-one"
    );

    assert.deepEqual(
      first.categorySeeds,
      {
        base: {
          corner:
            `${first.seed}:base:wall-corner`,
          span:
            `${first.seed}:base:wall-span`,
          ground:
            `${first.seed}:base:ground`,
          carpet:
            `${first.seed}:base:web-carpet`
        }
      }
    );

    assert.equal(
      first.counts.ground,
      6
    );

    assert.ok(
      first.counts.total >=
        6
    );
  }
);

test(
  "generated web and strand identifiers are unique, stable, and Scene-qualified",
  () => {
    const first =
      generate();

    const second =
      generate();

    const firstWebIds =
      first.webs.map(
        (
          web
        ) =>
          web.id
      );

    const secondWebIds =
      second.webs.map(
        (
          web
        ) =>
          web.id
      );

    assert.deepEqual(
      firstWebIds,
      secondWebIds
    );

    assert.equal(
      new Set(
        firstWebIds
      ).size,
      firstWebIds.length
    );

    const strandIds =
      first.webs.flatMap(
        (
          web
        ) =>
          web.strands.map(
            (
              strand
            ) =>
              strand.id
          )
      );

    assert.equal(
      new Set(
        strandIds
      ).size,
      strandIds.length
    );

    for (
      const web of
      first.webs
    ) {
      assert.equal(
        web.schemaVersion,
        WEB_BLUEPRINT_SCHEMA_VERSION
      );

      assert.equal(
        web.sceneId,
        BASE_CONTEXT.sceneId
      );

      assert.ok(
        web.id.includes(
          BASE_CONTEXT.sceneId
        )
      );

      for (
        const strand of
        web.strands
      ) {
        assert.equal(
          strand.schemaVersion,
          WEB_BLUEPRINT_SCHEMA_VERSION
        );

        assert.ok(
          strand.id.startsWith(
            `${web.id}:`
          )
        );
      }
    }
  }
);

test(
  "a different Scene ID produces a separately qualified deterministic population",
  () => {
    const first =
      generate();

    const second =
      generate({
        ...BASE_CONTEXT,
        sceneId:
          "scene-two"
      });

    assert.notEqual(
      first.seed,
      second.seed
    );

    assert.notDeepEqual(
      first.webs.map(
        (
          web
        ) =>
          web.id
      ),
      second.webs.map(
        (
          web
        ) =>
          web.id
      )
    );

    assert.ok(
      second.webs.every(
        (
          web
        ) =>
          web.sceneId ===
            "scene-two" &&
          web.id.includes(
            "scene-two"
          )
      )
    );
  }
);

test(
  "category random streams remain independent",
  () => {
    const options =
      createOptions();

    const baseline =
      generate(
        BASE_CONTEXT,
        options
      );

    const moreGroundWebs =
      generate(
        BASE_CONTEXT,
        {
          ...options,
          groundWebs: {
            ...options.groundWebs,
            count:
              options.groundWebs.count +
              5
          }
        }
      );

    assert.deepEqual(
      selectKinds(
        baseline,
        [
          "wall-corner",
          "wall-span"
        ]
      ),
      selectKinds(
        moreGroundWebs,
        [
          "wall-corner",
          "wall-span"
        ]
      )
    );

    const noSpanWebs =
      generate(
        BASE_CONTEXT,
        {
          ...options,
          spanWebs: {
            ...options.spanWebs,
            enabled:
              false
          }
        }
      );

    assert.deepEqual(
      selectKinds(
        baseline,
        [
          "wall-corner",
          "ground"
        ]
      ),
      selectKinds(
        noSpanWebs,
        [
          "wall-corner",
          "ground"
        ]
      )
    );
  }
);

test(
  "generated blueprint geometry is deeply immutable",
  () => {
    const generated =
      generate();

    assertDeeplyFrozen(
      generated.webs
    );

    for (
      const web of
      generated.webs
    ) {
      assert.throws(
        () => {
          web.id =
            "mutated";
        },
        TypeError
      );

      if (
        web.strands.length >
          0
      ) {
        assert.throws(
          () => {
            web.strands[0].points[0].x =
              -1;
          },
          TypeError
        );
      }
    }
  }
);

test(
  "blueprint bounds contain every hub and strand point",
  () => {
    const generated =
      generate();

    for (
      const web of
      generated.webs
    ) {
      const points =
        [
          web.hub,
          ...web.strands.flatMap(
            (
              strand
            ) =>
              strand.points
          )
        ];

      for (
        const point of
        points
      ) {
        assert.ok(
          point.x >=
            web.bounds.x -
            0.000001
        );

        assert.ok(
          point.x <=
            web.bounds.right +
            0.000001
        );

        assert.ok(
          point.y >=
            web.bounds.y -
            0.000001
        );

        assert.ok(
          point.y <=
            web.bounds.bottom +
            0.000001
        );
      }
    }
  }
);
