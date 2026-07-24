const EPSILON =
  0.000001;

const DEFAULT_ENDPOINT_TOLERANCE_PX =
  4;

/**
 * Build a deterministic, transient junction graph from independent Foundry
 * wall segments.
 *
 * Existing endpoint nodes are seeded with the same quantised endpoint model
 * historically used by WallCornerWebGenerator. A uniform-grid broad phase
 * then discovers endpoint-on-segment contacts and interior wall crossings.
 * Each accepted contact becomes a transient junction with one outward ray for
 * every wall direction leaving that point. Collinear overlaps remain excluded.
 *
 * @param {object} [options={}] - Topology inputs.
 * @param {ReadonlyArray<object>} [options.wallSegments=[]] - Plain walls.
 * @param {number} [options.endpointTolerancePx=4] - Contact tolerance.
 * @param {number} [options.gridSize=100] - Scene grid size in pixels.
 * @param {number|null} [options.cellSizePx=null] - Optional broad-phase cell.
 * @returns {Readonly<object>} Frozen junctions and diagnostics.
 */
export function createWallJunctionTopology({
  wallSegments = [],
  endpointTolerancePx =
    DEFAULT_ENDPOINT_TOLERANCE_PX,
  gridSize =
    100,
  cellSizePx =
    null
} = {}) {
  const tolerance =
    requirePositiveNumber(
      endpointTolerancePx,
      "wall-junction endpoint tolerance"
    );

  const resolvedCellSize =
    cellSizePx ===
      null ||
    cellSizePx ===
      undefined
      ? resolveDefaultCellSize(
          gridSize,
          tolerance
        )
      : requirePositiveNumber(
          cellSizePx,
          "wall-junction spatial cell size"
        );

  const segments =
    normaliseWallSegments(
      wallSegments
    );

  const mutableNodes =
    new Map();

  let nextInsertionOrder =
    0;

  for (const segment of segments) {
    addEndpointRay({
      mutableNodes,
      segment,
      endpoint:
        "a",
      target:
        "b",
      tolerance,
      insertionOrder:
        nextInsertionOrder
    });

    nextInsertionOrder +=
      1;

    addEndpointRay({
      mutableNodes,
      segment,
      endpoint:
        "b",
      target:
        "a",
      tolerance,
      insertionOrder:
        nextInsertionOrder
    });

    nextInsertionOrder +=
      1;
  }

  const spatial =
    buildWallPairBroadPhase(
      segments,
      {
        tolerance,
        cellSizePx:
          resolvedCellSize
      }
    );

  let exactEndpointOnSegmentCount =
    0;

  let nearEndpointOnSegmentCount =
    0;

  let endpointEndpointContactCount =
    0;

  let interiorCrossingContactCount =
    0;

  let rejectedCollinearPairCount =
    0;

  let precisePairTestCount =
    0;

  for (const pair of spatial.candidatePairs) {
    const first =
      segments[
        pair.firstIndex
      ];

    const second =
      segments[
        pair.secondIndex
      ];

    if (
      !first ||
      !second ||
      first.levelId !==
        second.levelId
    ) {
      continue;
    }

    precisePairTestCount +=
      1;

    const contact =
      detectWallPairContact(
        first,
        second,
        tolerance
      );

    if (
      contact.kind ===
        "none"
    ) {
      continue;
    }

    if (
      contact.kind ===
        "collinear"
    ) {
      rejectedCollinearPairCount +=
        1;

      continue;
    }

    if (
      contact.kind ===
        "interior-crossing"
    ) {
      interiorCrossingContactCount +=
        1;

      augmentEndpointContactNode({
        mutableNodes,
        first,
        second,
        contact,
        tolerance,
        insertionOrder:
          nextInsertionOrder
      });

      nextInsertionOrder +=
        1;

      continue;
    }

    if (
      contact.kind ===
        "endpoint-endpoint"
    ) {
      endpointEndpointContactCount +=
        1;

      /**
       * Exact shared endpoints are already represented by one seeded node.
       * Near endpoints can fall into adjacent quantisation buckets, so the
       * idempotent augmentation also joins those conservative near contacts.
       */
      augmentEndpointContactNode({
        mutableNodes,
        first,
        second,
        contact,
        tolerance,
        insertionOrder:
          nextInsertionOrder
      });

      nextInsertionOrder +=
        1;

      continue;
    }

    if (
      contact.kind ===
        "endpoint-on-segment"
    ) {
      exactEndpointOnSegmentCount +=
        1;
    } else if (
      contact.kind ===
        "near-endpoint-on-segment"
    ) {
      nearEndpointOnSegmentCount +=
        1;
    }

    augmentEndpointContactNode({
      mutableNodes,
      first,
      second,
      contact,
      tolerance,
      insertionOrder:
        nextInsertionOrder
    });

    nextInsertionOrder +=
      1;
  }

  const junctions =
    Array.from(
      mutableNodes.values()
    )
      .filter(
        node =>
          new Set(
            Array.from(
              node.rays.values()
            ).map(
              ray =>
                ray.wallId
            )
          ).size >=
            2
      )
      .sort(
        (
          first,
          second
        ) =>
          first.insertionOrder -
            second.insertionOrder ||
          first.levelId.localeCompare(
            second.levelId
          ) ||
          first.point.x -
            second.point.x ||
          first.point.y -
            second.point.y ||
          first.key.localeCompare(
            second.key
          )
      )
      .map(
        freezeJunction
      );

  const rayCount =
    junctions.reduce(
      (
        total,
        junction
      ) =>
        total +
        junction.rays.length,
      0
    );

  return deepFreeze({
    junctions,
    diagnostics: {
      wallCount:
        segments.length,
      levelCount:
        new Set(
          segments.map(
            segment =>
              segment.levelId
          )
        ).size,
      endpointTolerancePx:
        tolerance,
      cellSizePx:
        resolvedCellSize,
      occupiedCellCount:
        spatial.occupiedCellCount,
      cellReferenceCount:
        spatial.cellReferenceCount,
      candidatePairCount:
        spatial.candidatePairs.length,
      precisePairTestCount,
      endpointEndpointContactCount,
      exactEndpointOnSegmentCount,
      nearEndpointOnSegmentCount,
      interiorCrossingContactCount,
      /** Retained as an additive compatibility diagnostic. */
      rejectedInteriorCrossingCount:
        0,
      rejectedCollinearPairCount,
      junctionCount:
        junctions.length,
      rayCount
    }
  });
}

/** Return only the frozen derived junction array. */
export function buildWallJunctionTopology(
  options = {}
) {
  return createWallJunctionTopology(
    options
  ).junctions;
}

/**
 * Resolve the geometrically local angular sectors around one junction.
 *
 * A two-ray endpoint corner retains one historical smaller-angle sector.
 * Junctions with three or more rays return every true adjacent sector around
 * the point, including the wrap-around sector. Consumers may then apply their
 * own angle, wall-role and length policies.
 */
export function createWallJunctionSectors(
  junctionOrRays
) {
  const rays =
    Array.isArray(
      junctionOrRays
    )
      ? junctionOrRays
      : junctionOrRays?.rays;

  const ordered =
    (
      Array.isArray(
        rays
      )
        ? rays
        : []
    )
      .filter(
        ray =>
          Number.isFinite(
            Number(
              ray?.direction?.x
            )
          ) &&
          Number.isFinite(
            Number(
              ray?.direction?.y
            )
          )
      )
      .map(
        ray => ({
          ray,
          angleRadians:
            normalisePositiveAngle(
              Math.atan2(
                Number(
                  ray.direction.y
                ),
                Number(
                  ray.direction.x
                )
              )
            )
        })
      )
      .sort(
        (
          first,
          second
        ) =>
          first.angleRadians -
            second.angleRadians ||
          createRayIdentity(
            first.ray
          ).localeCompare(
            createRayIdentity(
              second.ray
            )
          )
      );

  if (
    ordered.length <
      2
  ) {
    return Object.freeze([]);
  }

  if (
    ordered.length ===
      2
  ) {
    const first =
      ordered[0].ray;

    const second =
      ordered[1].ray;

    const directionDot =
      clamp(
        first.direction.x *
          second.direction.x +
        first.direction.y *
          second.direction.y,
        -1,
        1
      );

    return deepFreeze([
      {
        left:
          first,
        right:
          second,
        angleDeg:
          Math.acos(
            directionDot
          ) *
          180 /
          Math.PI,
        sectorKey:
          null
      }
    ]);
  }

  const sectors =
    [];

  for (
    let index = 0;
    index <
      ordered.length;
    index +=
      1
  ) {
    const first =
      ordered[index];

    const second =
      ordered[
        (
          index +
          1
        ) %
        ordered.length
      ];

    let angleRadians =
      second.angleRadians -
      first.angleRadians;

    if (
      angleRadians <=
        0
    ) {
      angleRadians +=
        Math.PI *
        2;
    }

    sectors.push({
      left:
        first.ray,
      right:
        second.ray,
      angleDeg:
        angleRadians *
        180 /
        Math.PI,
      sectorKey:
        [
          createRayIdentity(
            first.ray
          ),
          createRayIdentity(
            second.ray
          )
        ].join(
          "->"
        )
    });
  }

  return deepFreeze(
    sectors
  );
}

function createRayIdentity(
  ray
) {
  const explicit =
    typeof ray?.rayId ===
      "string"
      ? ray.rayId.trim()
      : "";

  if (explicit) {
    return explicit;
  }

  return [
    String(
      ray?.wallId ??
      "wall"
    ),
    Math.round(
      Number(
        ray?.direction?.x
      ) *
      1000000
    ),
    Math.round(
      Number(
        ray?.direction?.y
      ) *
      1000000
    )
  ].join(
    ":"
  );
}

function normalisePositiveAngle(
  value
) {
  const fullTurn =
    Math.PI *
    2;

  const result =
    value %
    fullTurn;

  return result <
      0
    ? result +
      fullTurn
    : result;
}

function normaliseWallSegments(
  wallSegments
) {
  if (
    !Array.isArray(
      wallSegments
    )
  ) {
    throw new TypeError(
      "Dynamic Webs | Wall-junction topology requires a wall-segment array."
    );
  }

  const segments =
    [];

  for (
    let index = 0;
    index <
      wallSegments.length;
    index +=
      1
  ) {
    const candidate =
      wallSegments[index];

    const a =
      normalisePoint(
        candidate?.a ??
        {
          x:
            candidate?.x1,
          y:
            candidate?.y1
        }
      );

    const b =
      normalisePoint(
        candidate?.b ??
        {
          x:
            candidate?.x2,
          y:
            candidate?.y2
        }
      );

    if (
      !a ||
      !b
    ) {
      continue;
    }

    const dx =
      b.x -
      a.x;

    const dy =
      b.y -
      a.y;

    const length =
      Math.hypot(
        dx,
        dy
      );

    if (
      length <=
        EPSILON
    ) {
      continue;
    }

    const wallId =
      normaliseIdentifier(
        candidate?.wallId
      ) ??
      `wall-${index}`;

    const levelId =
      normaliseIdentifier(
        candidate?.levelId
      ) ??
      "base";

    segments.push({
      source:
        candidate,
      sourceIndex:
        index,
      wallId,
      levelId,
      a,
      b,
      dx,
      dy,
      length,
      bounds:
        createSegmentBounds(
          a,
          b
        )
    });
  }

  return segments;
}

function addEndpointRay({
  mutableNodes,
  segment,
  endpoint,
  target,
  tolerance,
  insertionOrder
}) {
  const point =
    segment[
      endpoint
    ];

  const node =
    requireMutableEndpointNode({
      mutableNodes,
      levelId:
        segment.levelId,
      point,
      tolerance,
      insertionOrder
    });

  addRayToNode(
    node,
    segment,
    target
  );
}

function requireMutableEndpointNode({
  mutableNodes,
  levelId,
  point,
  tolerance,
  insertionOrder
}) {
  const key =
    createEndpointNodeKey(
      levelId,
      point,
      tolerance
    );

  let node =
    mutableNodes.get(
      key
    );

  if (!node) {
    node = {
      key,
      levelId,
      point: {
        x:
          point.x,
        y:
          point.y
      },
      insertionOrder,
      rays:
        new Map(),
      contactKinds:
        new Set([
          "endpoint-node"
        ])
    };

    mutableNodes.set(
      key,
      node
    );
  }

  return node;
}

function augmentEndpointContactNode({
  mutableNodes,
  first,
  second,
  contact,
  tolerance,
  insertionOrder
}) {
  const endpointReference =
    chooseContactEndpointReference(
      first,
      second,
      contact
    );

  const node =
    endpointReference
      ? requireMutableEndpointNode({
          mutableNodes,
          levelId:
            endpointReference.segment.levelId,
          point:
            endpointReference.point,
          tolerance,
          insertionOrder
        })
      : requireMutableEndpointNode({
          mutableNodes,
          levelId:
            first.levelId,
          point:
            contact.point,
          tolerance,
          insertionOrder
        });

  node.contactKinds.add(
    contact.kind
  );

  addContactRays(
    node,
    first,
    contact.firstRole
  );

  addContactRays(
    node,
    second,
    contact.secondRole
  );
}

function chooseContactEndpointReference(
  first,
  second,
  contact
) {
  const references =
    [];

  appendEndpointReference(
    references,
    first,
    contact.firstRole
  );

  appendEndpointReference(
    references,
    second,
    contact.secondRole
  );

  return references.sort(
    (
      left,
      right
    ) =>
      left.segment.wallId.localeCompare(
        right.segment.wallId
      ) ||
      left.endpoint.localeCompare(
        right.endpoint
      )
  )[0] ??
    null;
}

function appendEndpointReference(
  target,
  segment,
  role
) {
  if (
    role ===
      "endpoint-a"
  ) {
    target.push({
      segment,
      endpoint:
        "a",
      point:
        segment.a
    });
  } else if (
    role ===
      "endpoint-b"
  ) {
    target.push({
      segment,
      endpoint:
        "b",
      point:
        segment.b
    });
  }
}

function addContactRays(
  node,
  segment,
  role
) {
  if (
    role ===
      "endpoint-a"
  ) {
    addRayToNode(
      node,
      segment,
      "b"
    );

    return;
  }

  if (
    role ===
      "endpoint-b"
  ) {
    addRayToNode(
      node,
      segment,
      "a"
    );

    return;
  }

  if (
    role ===
      "interior"
  ) {
    addRayToNode(
      node,
      segment,
      "a"
    );

    addRayToNode(
      node,
      segment,
      "b"
    );
  }
}

function addRayToNode(
  node,
  segment,
  targetEndpoint
) {
  const target =
    segment[
      targetEndpoint
    ];

  const dx =
    target.x -
    node.point.x;

  const dy =
    target.y -
    node.point.y;

  const availableLength =
    Math.hypot(
      dx,
      dy
    );

  if (
    availableLength <=
      EPSILON
  ) {
    return;
  }

  const rayId =
    `${segment.wallId}:toward-${targetEndpoint}`;

  if (
    node.rays.has(
      rayId
    )
  ) {
    return;
  }

  node.rays.set(
    rayId,
    {
      rayId,
      wallId:
        segment.wallId,
      direction: {
        x:
          dx /
          availableLength,
        y:
          dy /
          availableLength
      },
      availableLength
    }
  );
}

function buildWallPairBroadPhase(
  segments,
  {
    tolerance,
    cellSizePx
  }
) {
  const cells =
    new Map();

  let cellReferenceCount =
    0;

  for (
    let index = 0;
    index <
      segments.length;
    index +=
      1
  ) {
    const segment =
      segments[index];

    const bounds = {
      x:
        segment.bounds.x -
        tolerance,
      y:
        segment.bounds.y -
        tolerance,
      right:
        segment.bounds.right +
        tolerance,
      bottom:
        segment.bounds.bottom +
        tolerance
    };

    for (
      const cellKey of
      createCellKeys(
        segment.levelId,
        bounds,
        cellSizePx
      )
    ) {
      let entries =
        cells.get(
          cellKey
        );

      if (!entries) {
        entries =
          [];

        cells.set(
          cellKey,
          entries
        );
      }

      entries.push(
        index
      );

      cellReferenceCount +=
        1;
    }
  }

  const pairKeys =
    new Set();

  for (const indices of cells.values()) {
    for (
      let firstOffset = 0;
      firstOffset <
        indices.length;
      firstOffset +=
        1
    ) {
      for (
        let secondOffset =
          firstOffset +
          1;
        secondOffset <
          indices.length;
        secondOffset +=
          1
      ) {
        const firstIndex =
          Math.min(
            indices[firstOffset],
            indices[secondOffset]
          );

        const secondIndex =
          Math.max(
            indices[firstOffset],
            indices[secondOffset]
          );

        if (
          firstIndex ===
            secondIndex ||
          segments[firstIndex]?.levelId !==
            segments[secondIndex]?.levelId
        ) {
          continue;
        }

        pairKeys.add(
          `${firstIndex}:${secondIndex}`
        );
      }
    }
  }

  const candidatePairs =
    Array.from(
      pairKeys
    )
      .map(
        key => {
          const [
            firstIndex,
            secondIndex
          ] =
            key
              .split(
                ":"
              )
              .map(
                Number
              );

          return {
            firstIndex,
            secondIndex
          };
        }
      )
      .sort(
        (
          first,
          second
        ) =>
          first.firstIndex -
            second.firstIndex ||
          first.secondIndex -
            second.secondIndex
      );

  return {
    candidatePairs,
    occupiedCellCount:
      cells.size,
    cellReferenceCount
  };
}

function detectWallPairContact(
  first,
  second,
  tolerance
) {
  const crossDirection =
    cross(
      first.dx,
      first.dy,
      second.dx,
      second.dy
    );

  const offsetX =
    second.a.x -
    first.a.x;

  const offsetY =
    second.a.y -
    first.a.y;

  const crossOffsetFirst =
    cross(
      offsetX,
      offsetY,
      first.dx,
      first.dy
    );

  if (
    Math.abs(
      crossDirection
    ) <=
      EPSILON
  ) {
    if (
      Math.abs(
        crossOffsetFirst
      ) <=
        EPSILON
    ) {
      return {
        kind:
          "collinear"
      };
    }

    return detectNearEndpointContact(
      first,
      second,
      tolerance
    );
  }

  const firstParameter =
    cross(
      offsetX,
      offsetY,
      second.dx,
      second.dy
    ) /
    crossDirection;

  const secondParameter =
    cross(
      offsetX,
      offsetY,
      first.dx,
      first.dy
    ) /
    crossDirection;

  if (
    firstParameter >=
      -EPSILON &&
    firstParameter <=
      1 +
        EPSILON &&
    secondParameter >=
      -EPSILON &&
    secondParameter <=
      1 +
        EPSILON
  ) {
    const firstRole =
      classifySegmentParameter(
        firstParameter
      );

    const secondRole =
      classifySegmentParameter(
        secondParameter
      );

    const point = {
      x:
        first.a.x +
        first.dx *
          clamp(
            firstParameter,
            0,
            1
          ),
      y:
        first.a.y +
        first.dy *
          clamp(
            firstParameter,
            0,
            1
          )
    };

    if (
      firstRole ===
        "interior" &&
      secondRole ===
        "interior"
    ) {
      return {
        kind:
          "interior-crossing",
        point,
        firstRole,
        secondRole
      };
    }

    if (
      firstRole !==
        "interior" &&
      secondRole !==
        "interior"
    ) {
      return {
        kind:
          "endpoint-endpoint",
        point,
        firstRole,
        secondRole
      };
    }

    return {
      kind:
        "endpoint-on-segment",
      point,
      firstRole,
      secondRole
    };
  }

  return detectNearEndpointContact(
    first,
    second,
    tolerance
  );
}

function detectNearEndpointContact(
  first,
  second,
  tolerance
) {
  const candidates =
    [];

  appendEndpointProjectionCandidate({
    candidates,
    sourceSegment:
      first,
    sourceRole:
      "endpoint-a",
    sourcePoint:
      first.a,
    targetSegment:
      second,
    targetIsFirst:
      false,
    tolerance
  });

  appendEndpointProjectionCandidate({
    candidates,
    sourceSegment:
      first,
    sourceRole:
      "endpoint-b",
    sourcePoint:
      first.b,
    targetSegment:
      second,
    targetIsFirst:
      false,
    tolerance
  });

  appendEndpointProjectionCandidate({
    candidates,
    sourceSegment:
      second,
    sourceRole:
      "endpoint-a",
    sourcePoint:
      second.a,
    targetSegment:
      first,
    targetIsFirst:
      true,
    tolerance
  });

  appendEndpointProjectionCandidate({
    candidates,
    sourceSegment:
      second,
    sourceRole:
      "endpoint-b",
    sourcePoint:
      second.b,
    targetSegment:
      first,
    targetIsFirst:
      true,
    tolerance
  });

  const best =
    candidates.sort(
      (
        left,
        right
      ) =>
        left.distance -
          right.distance ||
        left.sortKey.localeCompare(
          right.sortKey
        )
    )[0];

  if (!best) {
    return {
      kind:
        "none"
    };
  }

  const firstRole =
    best.targetIsFirst
      ? best.targetRole
      : best.sourceRole;

  const secondRole =
    best.targetIsFirst
      ? best.sourceRole
      : best.targetRole;

  const bothEndpoints =
    firstRole !==
      "interior" &&
    secondRole !==
      "interior";

  return {
    kind:
      bothEndpoints
        ? "endpoint-endpoint"
        : "near-endpoint-on-segment",
    point:
      best.projectedPoint,
    firstRole,
    secondRole,
    distance:
      best.distance
  };
}

function appendEndpointProjectionCandidate({
  candidates,
  sourceSegment,
  sourceRole,
  sourcePoint,
  targetSegment,
  targetIsFirst,
  tolerance
}) {
  const projection =
    projectPointToSegment(
      sourcePoint,
      targetSegment
    );

  if (
    projection.distance >
      tolerance +
        EPSILON
  ) {
    return;
  }

  const targetRole =
    classifySegmentParameterWithTolerance(
      projection.parameter,
      targetSegment.length,
      tolerance
    );

  candidates.push({
    sourceRole,
    targetRole,
    targetIsFirst,
    projectedPoint:
      projection.point,
    distance:
      projection.distance,
    sortKey:
      [
        sourceSegment.wallId,
        sourceRole,
        targetSegment.wallId,
        targetRole
      ].join(
        ":"
      )
  });
}

function projectPointToSegment(
  point,
  segment
) {
  const lengthSquared =
    segment.length *
    segment.length;

  const parameter =
    clamp(
      (
        (
          point.x -
          segment.a.x
        ) *
          segment.dx +
        (
          point.y -
          segment.a.y
        ) *
          segment.dy
      ) /
        lengthSquared,
      0,
      1
    );

  const projectedPoint = {
    x:
      segment.a.x +
      segment.dx *
        parameter,
    y:
      segment.a.y +
      segment.dy *
        parameter
  };

  return {
    parameter,
    point:
      projectedPoint,
    distance:
      Math.hypot(
        point.x -
          projectedPoint.x,
        point.y -
          projectedPoint.y
      )
  };
}

function classifySegmentParameter(
  parameter
) {
  if (
    parameter <=
      EPSILON
  ) {
    return "endpoint-a";
  }

  if (
    parameter >=
      1 -
        EPSILON
  ) {
    return "endpoint-b";
  }

  return "interior";
}

function classifySegmentParameterWithTolerance(
  parameter,
  length,
  tolerance
) {
  const parameterTolerance =
    Math.min(
      0.25,
      tolerance /
        Math.max(
          length,
          EPSILON
        )
    );

  if (
    parameter <=
      parameterTolerance
  ) {
    return "endpoint-a";
  }

  if (
    parameter >=
      1 -
        parameterTolerance
  ) {
    return "endpoint-b";
  }

  return "interior";
}

function freezeJunction(
  node
) {
  const rays =
    Array.from(
      node.rays.values()
    )
      .sort(
        (
          first,
          second
        ) =>
          first.wallId.localeCompare(
            second.wallId
          ) ||
          first.rayId.localeCompare(
            second.rayId
          )
      )
      .map(
        ray => ({
          rayId:
            ray.rayId,
          wallId:
            ray.wallId,
          direction:
            ray.direction,
          availableLength:
            ray.availableLength
        })
      );

  return deepFreeze({
    key:
      node.key,
    levelId:
      node.levelId,
    point:
      node.point,
    rays,
    contactKinds:
      Array.from(
        node.contactKinds
      ).sort()
  });
}

function createEndpointNodeKey(
  levelId,
  point,
  tolerance
) {
  return [
    levelId,
    Math.round(
      point.x /
      tolerance
    ),
    Math.round(
      point.y /
      tolerance
    )
  ].join(
    ":"
  );
}

function createCellKeys(
  levelId,
  bounds,
  cellSizePx
) {
  const minimumColumn =
    Math.floor(
      bounds.x /
      cellSizePx
    );

  const maximumColumn =
    Math.floor(
      bounds.right /
      cellSizePx
    );

  const minimumRow =
    Math.floor(
      bounds.y /
      cellSizePx
    );

  const maximumRow =
    Math.floor(
      bounds.bottom /
      cellSizePx
    );

  const keys =
    [];

  for (
    let column =
      minimumColumn;
    column <=
      maximumColumn;
    column +=
      1
  ) {
    for (
      let row =
        minimumRow;
      row <=
        maximumRow;
      row +=
        1
    ) {
      keys.push(
        `${levelId}:${column}:${row}`
      );
    }
  }

  return keys;
}

function createSegmentBounds(
  a,
  b
) {
  return {
    x:
      Math.min(
        a.x,
        b.x
      ),
    y:
      Math.min(
        a.y,
        b.y
      ),
    right:
      Math.max(
        a.x,
        b.x
      ),
    bottom:
      Math.max(
        a.y,
        b.y
      )
  };
}

function resolveDefaultCellSize(
  gridSize,
  tolerance
) {
  const numericGridSize =
    Number(
      gridSize
    );

  const base =
    Number.isFinite(
      numericGridSize
    ) &&
    numericGridSize >
      0
      ? numericGridSize *
        2
      : 200;

  return Math.max(
    tolerance *
      4,
    64,
    Math.min(
      512,
      base
    )
  );
}

function normalisePoint(
  value
) {
  const x =
    Number(
      value?.x
    );

  const y =
    Number(
      value?.y
    );

  if (
    !Number.isFinite(
      x
    ) ||
    !Number.isFinite(
      y
    )
  ) {
    return null;
  }

  return {
    x,
    y
  };
}

function normaliseIdentifier(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  return text ||
    null;
}

function requirePositiveNumber(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <=
      0
  ) {
    throw new TypeError(
      `Dynamic Webs | ${label} must be a positive finite number.`
    );
  }

  return number;
}

function cross(
  firstX,
  firstY,
  secondX,
  secondY
) {
  return firstX *
      secondY -
    firstY *
      secondX;
}

function clamp(
  value,
  minimum,
  maximum
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  );
}

function deepFreeze(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object"
  ) {
    return value;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return Object.freeze(
      value.map(
        deepFreeze
      )
    );
  }

  const clone =
    {};

  for (
    const [
      key,
      entry
    ] of Object.entries(
      value
    )
  ) {
    clone[key] =
      deepFreeze(
        entry
      );
  }

  return Object.freeze(
    clone
  );
}

