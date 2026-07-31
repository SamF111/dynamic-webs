import test from "node:test";
import assert from "node:assert/strict";

import {
  WebSpatialIndex
} from "../scripts/spatial/WebSpatialIndex.js";

function createWeb({
  id,
  levelId = "level-0",
  bottom = 0,
  top = 9,
  kind = "ground",
  populationId = "population-a",
  regionIds = [],
  regionTags = [],
  x = 0,
  y = 0,
  strandKind = "structural",
  collisionWidthPx = 4,
  colour = 0xffffff
}) {
  const strandId = `${id}:strand-0`;
  return deepFreeze({
    schemaVersion: 8,
    id,
    sceneId: "scene",
    populationId,
    populationLabel: populationId,
    thicknessMultiplier: 1,
    levelProviderMode: "levels-v13",
    levelId,
    elevationBand: { bottom, top },
    seed: `seed:${id}`,
    sourceKey: id,
    kind,
    colourProfileId: "natural-white",
    hub: { x, y },
    bounds: {
      x,
      y,
      width: 40,
      height: 20,
      right: x + 40,
      bottom: y + 20
    },
    strands: [{
      schemaVersion: 8,
      id: strandId,
      localId: "strand-0",
      kind: strandKind,
      points: [
        { x, y },
        { x: x + 40, y: y + 20 }
      ],
      alpha: 0.7,
      baseAlpha: 0.7,
      colour,
      underColour: 0,
      widthPx: 1,
      collisionWidthPx
    }],
    perches: [{ id: "hub", x, y, rotation: 0 }],
    supportingWallIds: [],
    regionIds,
    regionTags
  });
}

test("spatial index builds immutable web, strand, and perch records", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  const first = createWeb({ id: "web-b", x: 100, y: 100 });
  const second = createWeb({ id: "web-a", x: 0, y: 0 });

  const diagnostics = index.rebuild([first, second], {
    sceneId: "scene",
    generationId: 3
  });

  assert.equal(diagnostics.active, true);
  assert.equal(diagnostics.generationId, 3);
  assert.equal(diagnostics.counts.webs, 2);
  assert.equal(diagnostics.counts.strands, 2);
  assert.equal(diagnostics.counts.perches, 2);
  assert.deepEqual(index.getWebs().map((web) => web.id), ["web-a", "web-b"]);
  assert.equal(index.getWeb("web-a").id, "web-a");
  assert.equal(index.getWeb("missing"), null);
  assert.equal(Object.isFrozen(index.getWebs()), true);
  assert.equal(Object.isFrozen(index.getWeb("web-a")), true);
  assert.notEqual(index.getWeb("web-a"), second);
});

test("nearby strand queries use functional width and explicit level filters", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  index.rebuild([
    createWeb({
      id: "lower",
      levelId: "level-0",
      bottom: 0,
      top: 9,
      x: 0,
      y: 0,
      regionTags: ["crypt"],
      strandKind: "capture",
      collisionWidthPx: 10
    }),
    createWeb({
      id: "upper",
      levelId: "level-10",
      bottom: 10,
      top: 19,
      x: 0,
      y: 0,
      strandKind: "structural"
    })
  ]);

  const results = index.queryNearby({ x: 20, y: 13 }, {
    maximumDistancePx: 0,
    levelId: "level-0",
    regionTag: "crypt",
    strandKind: "capture"
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].webId, "lower");
  assert.equal(results[0].distancePx, 0);
  assert.equal(results[0].interactionWidthPx, 10);
  assert.equal(results[0].intact, true);
  assert.equal(Object.isFrozen(results[0].points), true);

  assert.deepEqual(
    index.queryNearby({ x: 20, y: 13 }, {
      maximumDistancePx: 0,
      levelId: "level-10",
      strandKind: "capture"
    }),
    []
  );
});

test("strand rectangle queries use spatial cells instead of scanning every strand", () => {
  const index = new WebSpatialIndex({ cellSizePx: 40 });
  const webs = [];

  for (let indexValue = 0; indexValue < 400; indexValue += 1) {
    const column = indexValue % 20;
    const row = Math.floor(indexValue / 20);
    webs.push(createWeb({
      id: `web-${String(indexValue).padStart(3, "0")}`,
      x: column * 200,
      y: row * 200
    }));
  }

  index.rebuild(webs, { sceneId: "scene", generationId: 8 });
  const results = index.queryStrands({ x: -5, y: -5, width: 60, height: 40 }, {
    limit: 20
  });
  const diagnostics = index.createDiagnosticSnapshot();

  assert.equal(results.length, 1);
  assert.equal(results[0].webId, "web-000");
  assert.ok(diagnostics.queries.last.candidateCount < diagnostics.counts.strands);
  assert.equal(diagnostics.queries.last.kind, "strands");
});

test("compatible web and perch queries support metadata and elevation filters", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  index.rebuild([
    createWeb({
      id: "corner-lower",
      kind: "wall-corner",
      levelId: "level-0",
      bottom: 0,
      top: 9,
      x: 0,
      y: 0,
      regionIds: ["region-a"],
      regionTags: ["crypt"]
    }),
    createWeb({
      id: "span-upper",
      kind: "wall-span",
      levelId: "level-10",
      bottom: 10,
      top: 19,
      x: 200,
      y: 200,
      regionIds: ["region-b"],
      regionTags: ["tower"]
    })
  ]);

  const webs = index.findCompatibleWebs({
    category: "wall-corner",
    elevation: 5,
    regionId: "region-a"
  });

  assert.deepEqual(webs.map((web) => web.id), ["corner-lower"]);

  const perches = index.findPerches({
    point: { x: 0, y: 0 },
    maximumDistancePx: 5,
    levelId: "level-0",
    regionTag: "crypt"
  });

  assert.equal(perches.length, 1);
  assert.equal(perches[0].webId, "corner-lower");
  assert.equal(perches[0].perchId, "hub");
  assert.equal(perches[0].distancePx, 0);
});

test("category-filtered strand queries collect only matching web-kind partitions", () => {
  const index =
    new WebSpatialIndex({
      cellSizePx:
        100
    });

  index.rebuild([
    createWeb({
      id:
        "span",
      kind:
        "wall-span",
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "ground",
      kind:
        "ground",
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "corner",
      kind:
        "wall-corner",
      x:
        0,
      y:
        0
    })
  ]);

  const spanOnly =
    index.queryStrands(
      {
        x:
          -5,
        y:
          -5,
        width:
          60,
        height:
          40
      },
      {
        categories: [
          "wall-span"
        ],
        limit:
          20
      }
    );

  assert.deepEqual(
    spanOnly.map(
      strand =>
        strand.webId
    ),
    [
      "span"
    ]
  );

  assert.equal(
    index.createDiagnosticSnapshot()
      .queries.last.candidateCount,
    1
  );

  const twoKinds =
    index.queryStrands(
      {
        x:
          -5,
        y:
          -5,
        width:
          60,
        height:
          40
      },
      {
        categories: [
          "wall-span",
          "ground"
        ],
        limit:
          20
      }
    );

  assert.deepEqual(
    twoKinds.map(
      strand =>
        strand.webId
    ),
    [
      "ground",
      "span"
    ]
  );

  assert.equal(
    index.createDiagnosticSnapshot()
      .queries.last.candidateCount,
    2
  );

  const unfiltered =
    index.queryStrands(
      {
        x:
          -5,
        y:
          -5,
        width:
          60,
        height:
          40
      },
      {
        limit:
          20
      }
    );

  assert.equal(
    unfiltered.length,
    3
  );

  const diagnostics =
    index.createDiagnosticSnapshot();

  assert.equal(
    diagnostics.queries.last.candidateCount,
    3
  );

  assert.equal(
    diagnostics.counts.strandWebKindPartitions,
    3
  );

  assert.equal(
    diagnostics.counts.strandWebKindCellReferences,
    diagnostics.counts.strandCellReferences
  );

  assert.equal(
    diagnostics.counts.intactStrandWebKindCellReferences,
    diagnostics.counts.strandWebKindCellReferences
  );
});

test("intact-only strand partitions update incrementally across destroy and restore", () => {
  const index =
    new WebSpatialIndex({
      cellSizePx:
        100
    });

  index.rebuild([
    createWeb({
      id:
        "span-a",
      kind:
        "wall-span",
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "span-b",
      kind:
        "wall-span",
      x:
        0,
      y:
        0
    })
  ]);

  const bounds = {
    x:
      -5,
    y:
      -5,
    width:
      60,
    height:
      40
  };

  assert.deepEqual(
    index.queryStrands(
      bounds,
      {
        categories: [
          "wall-span"
        ],
        limit:
          20
      }
    ).map(
      strand =>
        strand.webId
    ),
    [
      "span-a",
      "span-b"
    ]
  );

  assert.equal(
    index.setWebIntact(
      "span-a",
      false
    ),
    true
  );

  assert.deepEqual(
    index.queryStrands(
      bounds,
      {
        categories: [
          "wall-span"
        ],
        limit:
          20
      }
    ).map(
      strand =>
        strand.webId
    ),
    [
      "span-b"
    ]
  );

  assert.equal(
    index.createDiagnosticSnapshot()
      .queries.last.candidateCount,
    1
  );

  const includingDestroyed =
    index.queryStrands(
      bounds,
      {
        categories: [
          "wall-span"
        ],
        intactOnly:
          false,
        limit:
          20
      }
    );

  assert.deepEqual(
    includingDestroyed.map(
      strand =>
        [
          strand.webId,
          strand.intact
        ]
    ),
    [
      [
        "span-a",
        false
      ],
      [
        "span-b",
        true
      ]
    ]
  );

  assert.equal(
    index.createDiagnosticSnapshot()
      .queries.last.candidateCount,
    2
  );

  assert.deepEqual(
    index.findPerches({
      bounds,
      category:
        "wall-span"
    }).map(
      perch =>
        perch.webId
    ),
    [
      "span-b"
    ]
  );

  const destroyedDiagnostics =
    index.createDiagnosticSnapshot();

  assert.equal(
    destroyedDiagnostics.counts.intactWebs,
    1
  );

  assert.equal(
    destroyedDiagnostics.counts.destroyedWebs,
    1
  );

  assert.equal(
    destroyedDiagnostics.counts.intactStrandWebKindCellReferences <
      destroyedDiagnostics.counts.strandWebKindCellReferences,
    true
  );

  assert.equal(
    index.setWebIntact(
      "span-a",
      true
    ),
    true
  );

  assert.deepEqual(
    index.queryStrands(
      bounds,
      {
        categories: [
          "wall-span"
        ],
        limit:
          20
      }
    ).map(
      strand =>
        strand.webId
    ),
    [
      "span-a",
      "span-b"
    ]
  );

  const restoredDiagnostics =
    index.createDiagnosticSnapshot();

  assert.equal(
    restoredDiagnostics.counts.intactStrandWebKindCellReferences,
    restoredDiagnostics.counts.strandWebKindCellReferences
  );

  assert.equal(
    index.applyDestroyedWebIds([
      "span-b"
    ]),
    true
  );

  assert.deepEqual(
    index.queryStrands(
      bounds,
      {
        categories: [
          "wall-span"
        ],
        limit:
          20
      }
    ).map(
      strand =>
        strand.webId
    ),
    [
      "span-a"
    ]
  );

  assert.equal(
    index.applyDestroyedWebIds([]),
    true
  );

  assert.deepEqual(
    index.queryStrands(
      bounds,
      {
        categories: [
          "wall-span"
        ],
        limit:
          20
      }
    ).map(
      strand =>
        strand.webId
    ),
    [
      "span-a",
      "span-b"
    ]
  );
});

test("presentation snapshot refresh does not rebuild spatial geometry", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  const web = createWeb({ id: "web", colour: 0xffffff });
  index.rebuild([web], { sceneId: "scene", generationId: 1 });
  const before = index.createDiagnosticSnapshot();

  const recoloured = createWeb({ id: "web", colour: 0xff0000 });
  assert.equal(index.refreshSnapshots([recoloured]), true);
  const after = index.createDiagnosticSnapshot();

  assert.equal(after.revision, before.revision);
  assert.equal(after.snapshotRevision, before.snapshotRevision + 1);
  assert.equal(index.getWeb("web").strands[0].colour, 0xff0000);
});

test("clear removes all indexed geometry", () => {
  const index = new WebSpatialIndex();
  index.rebuild([createWeb({ id: "web" })], { sceneId: "scene" });

  assert.equal(index.clear(), true);
  assert.deepEqual(index.getWebs(), []);
  assert.equal(index.createDiagnosticSnapshot().active, false);
  assert.equal(index.clear(), false);
});

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

test("internal strand visits expose aggregate diagnostic timing and counts", () => {
  const index =
    new WebSpatialIndex({
      cellSizePx:
        50
    });

  index.rebuild([
    createWeb({
      id:
        "diagnostic-web",
      kind:
        "wall-span",
      strandKind:
        "capture",
      x:
        0,
      y:
        0
    })
  ]);

  const diagnostics = {};

  const visited =
    index.visitStrands(
      {
        x:
          0,
        y:
          0,
        width:
          40,
        height:
          20
      },
      {
        categories: [
          "wall-span"
        ],
        intactOnly:
          true,
        limit:
          100
      },
      () => {},
      diagnostics
    );

  assert.equal(
    visited,
    1
  );

  assert.equal(
    diagnostics.cellCandidateCount,
    1
  );

  assert.equal(
    diagnostics.candidateStrandVisitCount,
    1
  );

  assert.equal(
    diagnostics.metadataRejectedCandidateCount,
    0
  );

  assert.equal(
    diagnostics.boundsRejectedCandidateCount,
    0
  );

  assert.equal(
    diagnostics.acceptedCandidateCount,
    1
  );

  for (const key of [
    "spatialNormalisationMs",
    "spatialCandidateCollectionMs",
    "spatialCandidateFilterSortMs",
    "spatialTelemetryMs"
  ]) {
    assert.equal(
      Number.isFinite(
        diagnostics[
          key
        ]
      ),
      true
    );

    assert.equal(
      diagnostics[
        key
      ] >=
        0,
      true
    );
  }
});

test("internal strand diagnostics classify candidates remaining after static partitions", () => {
  const index =
    new WebSpatialIndex({
      cellSizePx:
        200
    });

  index.rebuild([
    createWeb({
      id:
        "accepted",
      kind:
        "wall-span",
      levelId:
        "level-0",
      bottom:
        0,
      top:
        9,
      regionTags: [
        "allowed"
      ],
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "category-rejected",
      kind:
        "ground",
      levelId:
        "level-0",
      bottom:
        0,
      top:
        9,
      regionTags: [
        "allowed"
      ],
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "level-rejected",
      kind:
        "wall-span",
      levelId:
        "level-10",
      bottom:
        0,
      top:
        9,
      regionTags: [
        "allowed"
      ],
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "elevation-rejected",
      kind:
        "wall-span",
      levelId:
        "level-0",
      bottom:
        10,
      top:
        19,
      regionTags: [
        "allowed"
      ],
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "region-rejected",
      kind:
        "wall-span",
      levelId:
        "level-0",
      bottom:
        0,
      top:
        9,
      regionTags: [
        "blocked"
      ],
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "intact-rejected",
      kind:
        "wall-span",
      levelId:
        "level-0",
      bottom:
        0,
      top:
        9,
      regionTags: [
        "allowed"
      ],
      x:
        0,
      y:
        0
    }),
    createWeb({
      id:
        "bounds-rejected",
      kind:
        "wall-span",
      levelId:
        "level-0",
      bottom:
        0,
      top:
        9,
      regionTags: [
        "allowed"
      ],
      x:
        100,
      y:
        0
    })
  ]);

  index.setWebIntact(
    "intact-rejected",
    false
  );

  const diagnostics =
    {};

  const visited =
    index.visitStrands(
      {
        x:
          -5,
        y:
          -5,
        width:
          25,
        height:
          25
      },
      {
        categories: [
          "wall-span"
        ],
        levelId:
          "level-0",
        elevation:
          5,
        regionTag:
          "allowed",
        intactOnly:
          true,
        limit:
          100
      },
      () => {},
      diagnostics
    );

  assert.equal(
    diagnostics.cellCandidateCount,
    5
  );

  assert.equal(
    diagnostics.metadataRejectedCandidateCount,
    3
  );

  assert.equal(
    diagnostics.categoryRejectedCandidateCount,
    0
  );

  assert.equal(
    diagnostics.levelRejectedCandidateCount,
    1
  );

  assert.equal(
    diagnostics.elevationRejectedCandidateCount,
    1
  );

  assert.equal(
    diagnostics.regionRejectedCandidateCount,
    1
  );

  assert.equal(
    diagnostics.intactStateRejectedCandidateCount,
    0
  );

  assert.equal(
    diagnostics.boundsRejectedCandidateCount,
    1
  );

  assert.equal(
    diagnostics.acceptedCandidateCount,
    1
  );

  assert.equal(
    diagnostics.metadataRejectedCandidateCount +
      diagnostics.boundsRejectedCandidateCount +
      diagnostics.acceptedCandidateCount,
    diagnostics.cellCandidateCount
  );

  assert.equal(
    diagnostics.duplicateRejectedCandidateCount >
      0,
    true
  );

  assert.equal(
    visited,
    1
  );
});
