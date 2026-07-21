import {
  WEB_STRAND_KINDS,
  addScaled,
  clamp,
  createWebBlueprint,
  createWebStrand,
  normaliseVector,
  randomBetween
} from "./webGeometry.js";

import {
  OrganicRadialWebBuilder,
  createCurvedStructuralPath,
  createStratifiedValues,
  randomScaledIntegerInclusive
} from "./organicRadialWebGeometry.js";

import {
  WEB_BLUEPRINT_KINDS,
  createStableWebId
} from "./webBlueprintContract.js";

import {
  evaluateWebRegionRestrictionAtPoint,
  evaluateWebRegionRestrictionForStrands
} from "../../spatial/webRegionRestrictionIndex.js";

/** Generate deterministic organic radial webs at structural wall corners. */
export class WallCornerWebGenerator {
  generate({
    sceneId,
    populationId = "default",
    populationLabel = "Default Web Population",
    thicknessMultiplier = 1,
    level,
    generationSeed,
    wallSegments,
    gridSize,
    configuration,
    random,
    regionRestriction = null
  }) {
    if (
      configuration?.enabled !== true ||
      !Array.isArray(wallSegments) ||
      wallSegments.length === 0 ||
      !Number.isFinite(Number(gridSize)) ||
      Number(gridSize) <= 0 ||
      typeof random !== "function"
    ) {
      return Object.freeze([]);
    }

    const candidates =
      buildCornerCandidates({
        wallSegments,
        configuration,
        gridSize,
        random
      });

    const allowedCandidates = candidates
      .map((candidate) => ({
        ...candidate,
        regionEvaluation: evaluateWebRegionRestrictionAtPoint(
          regionRestriction,
          candidate.corner.x,
          candidate.corner.y
        )
      }))
      .filter((candidate) => candidate.regionEvaluation.allowed);

    const webs = [];

    for (const candidate of allowedCandidates) {
      if (webs.length >= configuration.maximumCount) break;

      const web = createCornerWeb({
        candidate,
        sceneId,
        populationId,
        populationLabel,
        thicknessMultiplier,
        level,
        generationSeed,
        gridSize,
        configuration,
        random,
        regionRestriction
      });

      if (web) webs.push(web);
    }

    return Object.freeze(webs);
  }
}

function buildCornerCandidates({
  wallSegments,
  configuration,
  gridSize,
  random
}) {
  const nodes =
    new Map();

  const tolerance =
    configuration.endpointTolerancePx;

  for (const segment of wallSegments) {
    addRay(
      segment.a,
      segment.b,
      segment
    );

    addRay(
      segment.b,
      segment.a,
      segment
    );
  }

  const candidates =
    [];

  for (const node of nodes.values()) {
    let bestAtNode =
      null;

    for (
      let leftIndex = 0;
      leftIndex < node.rays.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < node.rays.length;
        rightIndex += 1
      ) {
        const left =
          node.rays[leftIndex];

        const right =
          node.rays[rightIndex];

        if (left.wallId === right.wallId) {
          continue;
        }

        const directionDot =
          clamp(
            left.direction.x *
              right.direction.x +
            left.direction.y *
              right.direction.y,
            -1,
            1
          );

        const angleDeg =
          Math.acos(
            directionDot
          ) *
          180 /
          Math.PI;

        const minimumLength =
          Math.min(
            left.availableLength,
            right.availableLength
          );

        if (
          angleDeg < configuration.minimumCornerAngleDeg ||
          angleDeg > configuration.maximumCornerAngleDeg ||
          minimumLength <
            configuration.minimumWallLengthGridUnits *
            gridSize
        ) {
          continue;
        }

        const candidate = {
          corner:
            {
              ...node.point
            },
          left,
          right,
          angleDeg,
          score:
            Math.abs(
              angleDeg -
              90
            ) -
            Math.min(
              minimumLength,
              gridSize
            ) /
            gridSize +
            random() *
            0.2
        };

        if (
          !bestAtNode ||
          candidate.score <
            bestAtNode.score
        ) {
          bestAtNode =
            candidate;
        }
      }
    }

    if (bestAtNode) {
      candidates.push(
        bestAtNode
      );
    }
  }

  return candidates.sort(
    (
      left,
      right
    ) => {
      if (left.score !== right.score) {
        return left.score -
          right.score;
      }

      return createCandidateKey(
        left
      ).localeCompare(
        createCandidateKey(
          right
        )
      );
    }
  );

  function addRay(
    point,
    otherPoint,
    segment
  ) {
    const key =
      [
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

    const node =
      nodes.get(
        key
      ) ??
      {
        point:
          {
            x:
              point.x,
            y:
              point.y
          },
        rays:
          []
      };

    const dx =
      otherPoint.x -
      point.x;

    const dy =
      otherPoint.y -
      point.y;

    const length =
      Math.hypot(
        dx,
        dy
      );

    if (length <= 0) {
      return;
    }

    node.rays.push({
      wallId:
        segment.wallId,
      direction:
        {
          x:
            dx /
            length,
          y:
            dy /
            length
        },
      availableLength:
        length
    });

    node.rays.sort(
      (
        first,
        second
      ) =>
        String(
          first.wallId
        ).localeCompare(
          String(
            second.wallId
          )
        )
    );

    nodes.set(
      key,
      node
    );
  }
}

function createCornerWeb({
  candidate,
  sceneId,
  populationId,
  populationLabel,
  thicknessMultiplier,
  level,
  generationSeed,
  gridSize,
  configuration,
  random,
  regionRestriction
}) {
  const minimumSize =
    configuration.minimumSizeGridUnits *
    gridSize;

  const maximumSize =
    configuration.maximumSizeGridUnits *
    gridSize;

  const sizeLimit =
    Math.min(
      candidate.left.availableLength,
      candidate.right.availableLength
    ) *
    0.82;

  const lengthLeft =
    Math.min(
      sizeLimit,
      randomBetween(
        random,
        minimumSize,
        maximumSize
      )
    );

  const lengthRight =
    Math.min(
      sizeLimit,
      randomBetween(
        random,
        minimumSize,
        maximumSize
      )
    );

  const corner =
    candidate.corner;

  const bisector =
    normaliseVector({
      x:
        candidate.left.direction.x +
        candidate.right.direction.x,
      y:
        candidate.left.direction.y +
        candidate.right.direction.y
    });

  const bisectorPerpendicular = {
    x:
      -bisector.y,
    y:
      bisector.x
  };

  const maximumHubDistance =
    Math.min(
      configuration.maximumHubDistanceGridUnits *
        gridSize,
      Math.min(
        lengthLeft,
        lengthRight
      ) *
        0.48
    );

  const minimumHubDistance =
    Math.min(
      maximumHubDistance,
      configuration.minimumHubDistanceGridUnits *
        gridSize
    );

  const hubDistance =
    randomBetween(
      random,
      minimumHubDistance,
      maximumHubDistance
    );

  const hubAsymmetry =
    hubDistance *
    randomBetween(
      random,
      -configuration.hubAsymmetryFraction,
      configuration.hubAsymmetryFraction
    );

  const hub = {
    x:
      corner.x +
      bisector.x *
        hubDistance +
      bisectorPerpendicular.x *
        hubAsymmetry,

    y:
      corner.y +
      bisector.y *
        hubDistance +
      bisectorPerpendicular.y *
        hubAsymmetry
  };

  const sizeFraction =
    maximumSize > minimumSize
      ? clamp(
        (
          Math.max(
            lengthLeft,
            lengthRight
          ) -
          minimumSize
        ) /
        (
          maximumSize -
          minimumSize
        ),
        0,
        1
      )
      : 1;

  const leftAnchorCount =
    randomScaledIntegerInclusive(
      random,
      configuration.minimumAnchorCountPerSide,
      configuration.maximumAnchorCountPerSide,
      sizeFraction
    );

  const rightAnchorCount =
    randomScaledIntegerInclusive(
      random,
      configuration.minimumAnchorCountPerSide,
      configuration.maximumAnchorCountPerSide,
      sizeFraction
    );

  const leftAnchors =
    createCornerRayAnchors({
      corner,
      direction:
        candidate.left.direction,
      length:
        lengthLeft,
      hubDistance,
      count:
        leftAnchorCount,
      side:
        "left",
      random
    });

  const rightAnchors =
    createCornerRayAnchors({
      corner,
      direction:
        candidate.right.direction,
      length:
        lengthRight,
      hubDistance,
      count:
        rightAnchorCount,
      side:
        "right",
      random
    });

  const builder =
    new OrganicRadialWebBuilder({
      gridSize,
      configuration,
      random
    });

  const geometry =
    builder.build({
      hub,
      anchors:
        [
          ...leftAnchors,
          ...rightAnchors
        ],
      closedCaptureRings:
        false,
      angleReference:
        bisector,
      supportGroups:
        [
          {
            id:
              "left",
            anchors:
              leftAnchors
          },
          {
            id:
              "right",
            anchors:
              rightAnchors
          }
        ],
      detailScale:
        sizeFraction
    });

  const strands =
    [
      ...geometry.strands
    ];

  if (
    random() <
      configuration.cornerSupportChance
  ) {
    strands.push(
      createWebStrand({
        id:
          "structural-corner-support",
        kind:
          WEB_STRAND_KINDS.STRUCTURAL,
        points:
          createCurvedStructuralPath({
            start:
              hub,
            end:
              corner,
            gridSize,
            maximumCurveGridUnits:
              configuration.maximumStructuralCurveGridUnits *
              0.65,
            random
          }),
        random,
        alphaMultiplier:
          randomBetween(
            random,
            0.88,
            0.98
          )
      })
    );
  }

  const regionEvaluation = evaluateWebRegionRestrictionForStrands(
    regionRestriction,
    strands
  );

  if (!regionEvaluation.allowed) return null;

  const wallIds =
    [
      candidate.left.wallId,
      candidate.right.wallId
    ].sort();

  const sourceKey =
    createCandidateKey(
      candidate
    );

  return createWebBlueprint({
    id:
      createStableWebId({
        sceneId,
        populationId,
        levelId:
          level.id,
        kind:
          WEB_BLUEPRINT_KINDS.WALL_CORNER,
        sourceKey
      }),
    sceneId,
    populationId,
    populationLabel,
    thicknessMultiplier,
    levelProviderMode:
      level.providerMode,
    levelId:
      level.id,
    elevationBand:
      level.elevationBand,
    seed:
      generationSeed,
    sourceKey,
    kind:
      WEB_BLUEPRINT_KINDS.WALL_CORNER,
    hub,
    strands,
    regionIds: regionEvaluation.regionIds,
    regionTags: regionEvaluation.regionTags,
    perches:
      [
        {
          id:
            "hub",
          x:
            hub.x,
          y:
            hub.y,
          rotation:
            Math.atan2(
              bisector.y,
              bisector.x
            )
        }
      ],
    supportingWallIds:
      wallIds
  });
}

function createCornerRayAnchors({
  corner,
  direction,
  length,
  hubDistance,
  count,
  side,
  random
}) {
  const minimumDistance =
    Math.min(
      length *
        0.7,
      Math.max(
        hubDistance *
          1.25,
        length *
          0.14
      )
    );

  const distances =
    createStratifiedValues({
      count,
      minimum:
        minimumDistance,
      maximum:
        length,
      random,
      minimumEdgeInsetFraction:
        0.025,
      maximumEdgeInsetFraction:
        0.12
    });

  return distances.map(
    (
      distance,
      anchorIndex
    ) => ({
      id:
        `${side}-${anchorIndex}`,
      side,
      order:
        anchorIndex,
      distance,
      point:
        addScaled(
          corner,
          direction,
          distance
        )
    })
  );
}

function createCandidateKey(
  candidate
) {
  return [
    ...[
      candidate.left.wallId,
      candidate.right.wallId
    ].sort(),
    Math.round(
      candidate.corner.x
    ),
    Math.round(
      candidate.corner.y
    )
  ].join(
    ":"
  );
}
