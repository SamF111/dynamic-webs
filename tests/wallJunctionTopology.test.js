import test from "node:test";
import assert from "node:assert/strict";

import {
  createWallJunctionTopology,
  createWallJunctionSectors
} from "../scripts/simulation/webs/wallJunctionTopology.js";

function wall(
  wallId,
  ax,
  ay,
  bx,
  by,
  levelId =
    "base"
) {
  return Object.freeze({
    wallId,
    levelId,
    a:
      Object.freeze({
        x:
          ax,
        y:
          ay
      }),
    b:
      Object.freeze({
        x:
          bx,
        y:
          by
      })
  });
}

test(
  "shared wall endpoints retain one two-ray corner junction",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "horizontal",
            100,
            100,
            500,
            100
          ),
          wall(
            "vertical",
            100,
            100,
            100,
            500
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    assert.equal(
      topology.junctions.length,
      1
    );

    assert.deepEqual(
      topology.junctions[0].point,
      {
        x:
          100,
        y:
          100
      }
    );

    assert.deepEqual(
      topology.junctions[0].rays.map(
        ray =>
          ray.wallId
      ),
      [
        "horizontal",
        "vertical"
      ]
    );

    assert.equal(
      topology.diagnostics.endpointEndpointContactCount,
      1
    );

    assert.equal(
      Object.isFrozen(
        topology
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        topology.junctions[0].rays
      ),
      true
    );
  }
);


test(
  "near shared endpoints in adjacent quantisation buckets still join",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "horizontal",
            100,
            100,
            198.1,
            100
          ),
          wall(
            "vertical",
            201.9,
            100,
            201.9,
            400
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    assert.equal(
      topology.junctions.length,
      1
    );

    assert.equal(
      topology.junctions[0].rays.length,
      2
    );

    assert.equal(
      topology.diagnostics.endpointEndpointContactCount,
      1
    );
  }
);

test(
  "an endpoint on the interior of a continuing wall creates a three-ray T junction",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "continuing",
            100,
            100,
            900,
            100
          ),
          wall(
            "terminating",
            500,
            500,
            500,
            100
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    assert.equal(
      topology.junctions.length,
      1
    );

    const junction =
      topology.junctions[0];

    assert.deepEqual(
      junction.point,
      {
        x:
          500,
        y:
          100
      }
    );

    assert.equal(
      junction.rays.length,
      3
    );

    assert.deepEqual(
      junction.rays.map(
        ray =>
          ray.wallId
      ),
      [
        "continuing",
        "continuing",
        "terminating"
      ]
    );

    const continuingDirections =
      junction.rays
        .filter(
          ray =>
            ray.wallId ===
              "continuing"
        )
        .map(
          ray =>
            Math.sign(
              ray.direction.x
            )
        )
        .sort();

    assert.deepEqual(
      continuingDirections,
      [
        -1,
        1
      ]
    );

    assert.equal(
      topology.diagnostics.exactEndpointOnSegmentCount,
      1
    );

    assert.equal(
      topology.diagnostics.rejectedInteriorCrossingCount,
      0
    );
  }
);

test(
  "a small endpoint-to-segment authoring gap is accepted within tolerance",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "continuing",
            100,
            100,
            900,
            100
          ),
          wall(
            "terminating",
            500,
            500,
            500,
            103
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    assert.equal(
      topology.junctions.length,
      1
    );

    assert.equal(
      topology.junctions[0].rays.length,
      3
    );

    assert.equal(
      topology.diagnostics.nearEndpointOnSegmentCount,
      1
    );
  }
);

test(
  "interior-to-interior X crossings create one four-ray junction",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "horizontal",
            100,
            300,
            900,
            300
          ),
          wall(
            "vertical",
            500,
            100,
            500,
            900
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    assert.equal(
      topology.junctions.length,
      1
    );

    const junction =
      topology.junctions[0];

    assert.deepEqual(
      junction.point,
      {
        x:
          500,
        y:
          300
      }
    );

    assert.deepEqual(
      junction.rays.map(
        ray =>
          ray.wallId
      ),
      [
        "horizontal",
        "horizontal",
        "vertical",
        "vertical"
      ]
    );

    assert.equal(
      new Set(
        junction.rays.map(
          ray =>
            ray.rayId
        )
      ).size,
      4
    );

    assert.ok(
      junction.contactKinds.includes(
        "interior-crossing"
      )
    );

    assert.equal(
      topology.diagnostics.interiorCrossingContactCount,
      1
    );

    assert.equal(
      topology.diagnostics.rejectedInteriorCrossingCount,
      0
    );
  }
);

test(
  "collinear overlaps do not become corner junctions",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "first",
            100,
            100,
            600,
            100
          ),
          wall(
            "second",
            400,
            100,
            900,
            100
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    assert.equal(
      topology.junctions.length,
      0
    );

    assert.equal(
      topology.diagnostics.rejectedCollinearPairCount,
      1
    );
  }
);

test(
  "walls on different levels never share a junction",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "base-wall",
            100,
            100,
            500,
            100,
            "base"
          ),
          wall(
            "upper-wall",
            100,
            100,
            100,
            500,
            "upper"
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    assert.equal(
      topology.junctions.length,
      0
    );

    assert.equal(
      topology.diagnostics.candidatePairCount,
      0
    );
  }
);



test(
  "a T junction exposes two valid right-angle corner sectors and one straight sector",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "continuing",
            100,
            100,
            900,
            100
          ),
          wall(
            "terminating",
            500,
            500,
            500,
            100
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    const sectors =
      createWallJunctionSectors(
        topology.junctions[0]
      );

    assert.deepEqual(
      sectors.map(
        sector =>
          Math.round(
            sector.angleDeg
          )
      ).sort(
        (
          first,
          second
        ) =>
          first -
          second
      ),
      [
        90,
        90,
        180
      ]
    );

    assert.equal(
      sectors.filter(
        sector =>
          sector.angleDeg <=
            145
      ).length,
      2
    );

    assert.equal(
      new Set(
        sectors.map(
          sector =>
            sector.sectorKey
        )
      ).size,
      3
    );
  }
);


test(
  "an X junction exposes four distinct right-angle sectors",
  () => {
    const topology =
      createWallJunctionTopology({
        wallSegments: [
          wall(
            "horizontal",
            100,
            300,
            900,
            300
          ),
          wall(
            "vertical",
            500,
            100,
            500,
            900
          )
        ],
        endpointTolerancePx:
          4,
        gridSize:
          100
      });

    const sectors =
      createWallJunctionSectors(
        topology.junctions[0]
      );

    assert.equal(
      sectors.length,
      4
    );

    assert.ok(
      sectors.every(
        sector =>
          Math.abs(
            sector.angleDeg -
            90
          ) <
            0.000001
      )
    );

    assert.ok(
      sectors.every(
        sector =>
          sector.left.wallId !==
            sector.right.wallId
      )
    );

    assert.equal(
      new Set(
        sectors.map(
          sector =>
            sector.sectorKey
        )
      ).size,
      4
    );
  }
);

test(
  "the wall broad phase avoids an all-pairs scan for separated wall clusters",
  () => {
    const walls =
      [];

    for (
      let index = 0;
      index <
        100;
      index +=
        1
    ) {
      const x =
        index *
        1000;

      walls.push(
        wall(
          `wall-${index}`,
          x,
          0,
          x +
            100,
          0
        )
      );
    }

    const topology =
      createWallJunctionTopology({
        wallSegments:
          walls,
        endpointTolerancePx:
          4,
        gridSize:
          100,
        cellSizePx:
          200
      });

    const allPairCount =
      walls.length *
      (
        walls.length -
        1
      ) /
      2;

    assert.equal(
      topology.diagnostics.precisePairTestCount,
      0
    );

    assert.ok(
      topology.diagnostics.candidatePairCount <
        allPairCount /
          100
    );
  }
);

