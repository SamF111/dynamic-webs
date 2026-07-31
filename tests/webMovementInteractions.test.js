import test from "node:test";
import assert from "node:assert/strict";

import {
  WebMovementInteractionService
} from "../scripts/interactions/WebMovementInteractionService.js";

import {
  segmentToSegmentDistance,
  sweptMovementIntersectsPolyline
} from "../scripts/interactions/spanWebMovementGeometry.js";

import {
  WebSpatialIndex
} from "../scripts/spatial/WebSpatialIndex.js";

test("swept movement detects crossing and near-miss distances", () => {
  assert.equal(segmentToSegmentDistance(
    { x: 0, y: 5 }, { x: 10, y: 5 },
    { x: 5, y: 0 }, { x: 5, y: 10 }
  ), 0);

  assert.equal(sweptMovementIntersectsPolyline({
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    collisionRadiusPx: 1,
    points: [{ x: 5, y: 1.5 }, { x: 5, y: 4 }],
    interactionWidthPx: 1
  }), true);
});

test("movement service groups precise strand hits by stable web ID", () => {
  const queries = [];
  const runtime = {
    queryStrands(bounds, options) {
      queries.push({ bounds, options });
      return Object.freeze([
        Object.freeze({
          webId: "span-b",
          strandId: "span-b:s1",
          sceneId: "scene",
          populationId: "population",
          levelId: "level-0",
          elevationBand: Object.freeze({ bottom: 0, top: 9 }),
          webKind: "wall-span",
          points: Object.freeze([{ x: 5, y: -5 }, { x: 5, y: 5 }]),
          interactionWidthPx: 2,
          intact: true
        }),
        Object.freeze({
          webId: "span-b",
          strandId: "span-b:s2",
          sceneId: "scene",
          populationId: "population",
          levelId: "level-0",
          elevationBand: Object.freeze({ bottom: 0, top: 9 }),
          webKind: "wall-span",
          points: Object.freeze([{ x: 6, y: -5 }, { x: 6, y: 5 }]),
          interactionWidthPx: 2,
          intact: true
        })
      ]);
    }
  };

  const service = new WebMovementInteractionService({ webRuntimeService: runtime });
  const hits = service.queryMovement({
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    levelId: "level-0",
    collisionRadiusPx: 0
  });

  assert.equal(hits.length, 1);
  assert.equal(hits[0].webId, "span-b");
  assert.deepEqual(hits[0].strandIds, ["span-b:s1", "span-b:s2"]);
  assert.deepEqual(queries[0].options.categories, ["wall-span"]);
  assert.equal(queries[0].options.intactOnly, true);
});


test("movement service supports generic functional web categories while preserving span defaults", () => {
  const queries = [];
  const runtime = {
    queryStrands(bounds, options) {
      queries.push({ bounds, options });
      return Object.freeze([
        Object.freeze({
          webId: "ground-a",
          strandId: "ground-a:s1",
          sceneId: "scene",
          populationId: "population",
          levelId: "level-0",
          elevationBand: Object.freeze({ bottom: 0, top: 9 }),
          webKind: "ground",
          points: Object.freeze([{ x: 5, y: -5 }, { x: 5, y: 5 }]),
          interactionWidthPx: 2,
          intact: true
        })
      ]);
    }
  };

  const service = new WebMovementInteractionService({ webRuntimeService: runtime });
  const hits = service.queryMovement({
    from: { x: 0, y: 0 },
    to: { x: 10, y: 0 },
    levelId: "level-0",
    categories: ["ground"],
    strandKinds: ["capture"]
  });

  assert.deepEqual(hits.map((hit) => hit.webId), ["ground-a"]);
  assert.deepEqual(queries[0].options.categories, ["ground"]);
  assert.deepEqual(queries[0].options.strandKinds, ["capture"]);
});


test("movement service uses the internal strand visitor when available", () => {
  const calls = [];

  const runtime = {
    queryStrands() {
      throw new Error(
        "public strand snapshots should not be materialised"
      );
    },

    visitStrands(
      bounds,
      options,
      visitor
    ) {
      calls.push({
        bounds,
        options
      });

      visitor({
        webId:
          "span-fast",
        strandId:
          "span-fast:s1",
        sceneId:
          "scene",
        populationId:
          "population",
        levelId:
          "level-0",
        elevationBand: {
          bottom:
            0,
          top:
            9
        },
        webKind:
          "wall-span",
        points:
          [
            {
              x:
                5,
              y:
                -5
            },
            {
              x:
                5,
              y:
                5
            }
          ],
        interactionWidthPx:
          2,
        intact:
          true
      });

      return 1;
    }
  };

  const service =
    new WebMovementInteractionService({
      webRuntimeService:
        runtime
    });

  const hits =
    service.queryMovement({
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
        0
    });

  assert.deepEqual(
    hits.map(
      hit =>
        hit.webId
    ),
    [
      "span-fast"
    ]
  );

  assert.equal(
    calls.length,
    1
  );

  assert.equal(
    calls[0].options.intactOnly,
    true
  );
});

test("movement service reuses one immutable empty result for no-hit queries", () => {
  const runtime = {
    queryStrands() {
      throw new Error(
        "public strand snapshots should not be materialised"
      );
    },

    visitStrands(
      _bounds,
      _options,
      visitor
    ) {
      visitor({
        webId:
          "span-miss",
        strandId:
          "span-miss:s1",
        sceneId:
          "scene",
        populationId:
          "population",
        levelId:
          "level-0",
        elevationBand: {
          bottom:
            0,
          top:
            9
        },
        webKind:
          "wall-span",
        points: [
          {
            x:
              50,
            y:
              50
          },
          {
            x:
              60,
            y:
              50
          }
        ],
        interactionWidthPx:
          1,
        intact:
          true
      });

      return 1;
    }
  };

  const service =
    new WebMovementInteractionService({
      webRuntimeService:
        runtime
    });

  const first =
    service.queryMovement({
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
        "level-0"
    });

  const second =
    service.queryMovement({
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
        "level-0"
    });

  assert.equal(
    first,
    second
  );

  assert.deepEqual(
    first,
    []
  );

  assert.equal(
    Object.isFrozen(
      first
    ),
    true
  );
});

test("spatial strand visitor filters indexed entries without public snapshots", () => {
  const index =
    new WebSpatialIndex({
      cellSizePx:
        50
    });

  index.rebuild(
    [
      {
        id:
          "span-indexed",
        sceneId:
          "scene",
        populationId:
          "population",
        levelId:
          "level-0",
        elevationBand: {
          bottom:
            0,
          top:
            9
        },
        kind:
          "wall-span",
        bounds: {
          x:
            0,
          y:
            -10,
          width:
            20,
          height:
            20
        },
        strands:
          [
            {
              id:
                "span-indexed:s1",
              localId:
                "s1",
              kind:
                "capture",
              collisionWidthPx:
                2,
              points:
                [
                  {
                    x:
                      5,
                    y:
                      -5
                  },
                  {
                    x:
                      5,
                    y:
                      5
                  }
                ]
            }
          ],
        perches:
          []
      }
    ],
    {
      sceneId:
        "scene",
      generationId:
        1
    }
  );

  const visited =
    [];

  const count =
    index.visitStrands(
      {
        x:
          0,
        y:
          -1,
        width:
          10,
        height:
          2
      },
      {
        levelId:
          "level-0",
        categories:
          [
            "wall-span"
          ],
        strandKinds:
          [
            "capture"
          ],
        intactOnly:
          true,
        limit:
          100
      },
      strand =>
        visited.push(
          strand.strandId
        )
    );

  assert.equal(
    count,
    1
  );

  assert.deepEqual(
    visited,
    [
      "span-indexed:s1"
    ]
  );
});

test("movement queries use web-kind strand partitions before metadata filtering", () => {
  const index =
    new WebSpatialIndex({
      cellSizePx:
        100
    });

  index.rebuild([
    {
      id:
        "span-indexed",
      sceneId:
        "scene",
      populationId:
        "population",
      levelId:
        "level-0",
      elevationBand: {
        bottom:
          0,
        top:
          9
      },
      kind:
        "wall-span",
      bounds: {
        x:
          0,
        y:
          -10,
        width:
          20,
        height:
          20
      },
      strands: [
        {
          id:
            "span-indexed:s1",
          localId:
            "s1",
          kind:
            "capture",
          collisionWidthPx:
            2,
          points: [
            {
              x:
                5,
              y:
                -5
            },
            {
              x:
                5,
              y:
                5
            }
          ]
        }
      ],
      perches:
        []
    },
    {
      id:
        "ground-indexed",
      sceneId:
        "scene",
      populationId:
        "population",
      levelId:
        "level-0",
      elevationBand: {
        bottom:
          0,
        top:
          9
      },
      kind:
        "ground",
      bounds: {
        x:
          0,
        y:
          -10,
        width:
          20,
        height:
          20
      },
      strands: [
        {
          id:
            "ground-indexed:s1",
          localId:
            "s1",
          kind:
            "capture",
          collisionWidthPx:
            2,
          points: [
            {
              x:
                6,
              y:
                -5
            },
            {
              x:
                6,
              y:
                5
            }
          ]
        }
      ],
      perches:
        []
    }
  ]);

  const diagnostics =
    [];

  const runtime = {
    queryStrands(
      bounds,
      options
    ) {
      return index.queryStrands(
        bounds,
        options
      );
    },

    visitStrands(
      bounds,
      options,
      visitor,
      spatialDiagnostics
    ) {
      return index.visitStrands(
        bounds,
        options,
        visitor,
        spatialDiagnostics
      );
    }
  };

  const service =
    new WebMovementInteractionService({
      webRuntimeService:
        runtime
    });

  const hits =
    service.queryMovement({
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
      diagnosticObserver:
        details =>
          diagnostics.push(
            details
          )
    });

  assert.deepEqual(
    hits.map(
      hit =>
        hit.webId
    ),
    [
      "span-indexed"
    ]
  );

  assert.equal(
    diagnostics[0].counters.cellCandidateCount,
    1
  );

  assert.equal(
    diagnostics[0].counters.categoryRejectedCandidateCount,
    0
  );

  assert.equal(
    diagnostics[0].counters.acceptedCandidateCount,
    1
  );
});

test("movement queries collect only intact strands before metadata filtering", () => {
  const index =
    new WebSpatialIndex({
      cellSizePx:
        100
    });

  index.rebuild([
    {
      id:
        "span-intact",
      sceneId:
        "scene",
      populationId:
        "population",
      levelId:
        "level-0",
      elevationBand: {
        bottom:
          0,
        top:
          9
      },
      kind:
        "wall-span",
      bounds: {
        x:
          0,
        y:
          -10,
        width:
          20,
        height:
          20
      },
      strands: [
        {
          id:
            "span-intact:s1",
          localId:
            "s1",
          kind:
            "capture",
          collisionWidthPx:
            2,
          points: [
            {
              x:
                5,
              y:
                -5
            },
            {
              x:
                5,
              y:
                5
            }
          ]
        }
      ],
      perches:
        []
    },
    {
      id:
        "span-destroyed",
      sceneId:
        "scene",
      populationId:
        "population",
      levelId:
        "level-0",
      elevationBand: {
        bottom:
          0,
        top:
          9
      },
      kind:
        "wall-span",
      bounds: {
        x:
          0,
        y:
          -10,
        width:
          20,
        height:
          20
      },
      strands: [
        {
          id:
            "span-destroyed:s1",
          localId:
            "s1",
          kind:
            "capture",
          collisionWidthPx:
            2,
          points: [
            {
              x:
                6,
              y:
                -5
            },
            {
              x:
                6,
              y:
                5
            }
          ]
        }
      ],
      perches:
        []
    }
  ]);

  index.setWebIntact(
    "span-destroyed",
    false
  );

  const diagnostics =
    [];

  const runtime = {
    queryStrands(
      bounds,
      options
    ) {
      return index.queryStrands(
        bounds,
        options
      );
    },

    visitStrands(
      bounds,
      options,
      visitor,
      spatialDiagnostics
    ) {
      return index.visitStrands(
        bounds,
        options,
        visitor,
        spatialDiagnostics
      );
    }
  };

  const service =
    new WebMovementInteractionService({
      webRuntimeService:
        runtime
    });

  const request = {
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
    diagnosticObserver:
      details =>
        diagnostics.push(
          details
        )
  };

  assert.deepEqual(
    service.queryMovement(
      request
    ).map(
      hit =>
        hit.webId
    ),
    [
      "span-intact"
    ]
  );

  assert.equal(
    diagnostics[0].counters.cellCandidateCount,
    1
  );

  assert.equal(
    diagnostics[0].counters.intactStateRejectedCandidateCount,
    0
  );

  index.setWebIntact(
    "span-destroyed",
    true
  );

  assert.deepEqual(
    service.queryMovement({
      ...request,
      diagnosticObserver:
        null
    }).map(
      hit =>
        hit.webId
    ),
    [
      "span-destroyed",
      "span-intact"
    ]
  );
});

test("movement diagnostics aggregate query stages without changing results", () => {
  const diagnostics = [];

  const runtime = {
    queryStrands() {
      throw new Error(
        "public strand snapshots should not be materialised"
      );
    },

    visitStrands(
      _bounds,
      _options,
      visitor,
      spatialDiagnostics
    ) {
      spatialDiagnostics.spatialNormalisationMs =
        0.1;

      spatialDiagnostics.spatialCandidateCollectionMs =
        0.2;

      spatialDiagnostics.spatialCandidateFilterSortMs =
        0.3;

      spatialDiagnostics.spatialTelemetryMs =
        0.05;

      spatialDiagnostics.cellCandidateCount =
        2;

      spatialDiagnostics.metadataRejectedCandidateCount =
        1;

      spatialDiagnostics.categoryRejectedCandidateCount =
        1;

      spatialDiagnostics.levelRejectedCandidateCount =
        0;

      spatialDiagnostics.elevationRejectedCandidateCount =
        0;

      spatialDiagnostics.intactStateRejectedCandidateCount =
        0;

      spatialDiagnostics.regionRejectedCandidateCount =
        0;

      spatialDiagnostics.boundsRejectedCandidateCount =
        0;

      spatialDiagnostics.duplicateRejectedCandidateCount =
        2;

      spatialDiagnostics.acceptedCandidateCount =
        1;

      spatialDiagnostics.candidateStrandVisitCount =
        1;

      visitor({
        webId:
          "span-diagnostic",
        strandId:
          "span-diagnostic:s1",
        sceneId:
          "scene",
        populationId:
          "population",
        levelId:
          "level-0",
        elevationBand: {
          bottom:
            0,
          top:
            9
        },
        webKind:
          "wall-span",
        points: [
          {
            x:
              5,
            y:
              -5
          },
          {
            x:
              5,
            y:
              5
          }
        ],
        interactionWidthPx:
          2,
        intact:
          true
      });

      return 1;
    }
  };

  const service =
    new WebMovementInteractionService({
      webRuntimeService:
        runtime
    });

  const hits =
    service.queryMovement({
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
      diagnosticObserver:
        details =>
          diagnostics.push(
            details
          )
    });

  assert.deepEqual(
    hits.map(
      hit =>
        hit.webId
    ),
    [
      "span-diagnostic"
    ]
  );

  assert.equal(
    diagnostics.length,
    1
  );

  assert.deepEqual(
    diagnostics[0].counters,
    {
      queryCount:
        1,
      zeroDisplacementQueryCount:
        0,
      nonZeroDisplacementQueryCount:
        1,
      zeroCellCandidateQueryCount:
        0,
      cellCandidateCount:
        2,
      metadataRejectedCandidateCount:
        1,
      categoryRejectedCandidateCount:
        1,
      levelRejectedCandidateCount:
        0,
      elevationRejectedCandidateCount:
        0,
      intactStateRejectedCandidateCount:
        0,
      regionRejectedCandidateCount:
        0,
      boundsRejectedCandidateCount:
        0,
      duplicateRejectedCandidateCount:
        2,
      acceptedCandidateCount:
        1,
      candidateStrandVisitCount:
        1,
      preciseStrandTestCount:
        1,
      preciseStrandHitCount:
        1,
      hitQueryCount:
        1,
      hitWebCount:
        1
    }
  );

  assert.equal(
    diagnostics[0].phases.spatialNormalisation,
    0.1
  );

  assert.equal(
    diagnostics[0].phases.spatialCandidateCollection,
    0.2
  );
});

test("movement diagnostics classify stationary requests without changing query behaviour", () => {
  const diagnostics = [];

  const service =
    new WebMovementInteractionService({
      webRuntimeService: {
        queryStrands() {
          return [];
        }
      }
    });

  const first =
    service.queryMovement({
      from: {
        x:
          4,
        y:
          8
      },
      to: {
        x:
          4,
        y:
          8
      },
      diagnosticObserver:
        details =>
          diagnostics.push(
            details
          )
    });

  const second =
    service.queryMovement({
      from: {
        x:
          4,
        y:
          8
      },
      to: {
        x:
          5,
        y:
          8
      },
      diagnosticObserver:
        details =>
          diagnostics.push(
            details
          )
    });

  assert.equal(
    first,
    second
  );

  assert.equal(
    diagnostics[0].counters.zeroDisplacementQueryCount,
    1
  );

  assert.equal(
    diagnostics[0].counters.nonZeroDisplacementQueryCount,
    0
  );

  assert.equal(
    diagnostics[1].counters.zeroDisplacementQueryCount,
    0
  );

  assert.equal(
    diagnostics[1].counters.nonZeroDisplacementQueryCount,
    1
  );
});
