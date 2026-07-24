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

import {
  createWebCornerAssetPresentation
} from "../../data/webCornerAssetCatalog.js";

import {
  buildWallJunctionTopology,
  createWallJunctionSectors
} from "./wallJunctionTopology.js";

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
    regionRestriction = null,
    wallJunctions = null
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
        wallJunctions,
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
  wallJunctions,
  configuration,
  gridSize,
  random
}) {
  const nodes =
    Array.isArray(
      wallJunctions
    )
      ? wallJunctions
      : buildWallJunctionTopology({
          wallSegments,
          endpointTolerancePx:
            configuration.endpointTolerancePx,
          gridSize
        });

  const candidates =
    [];

  for (const node of nodes) {
    for (
      const sector of
      createWallJunctionSectors(
        node
      )
    ) {
      const left =
        sector.left;

      const right =
        sector.right;

      if (
        left.wallId ===
          right.wallId
      ) {
        continue;
      }

      const angleDeg =
        sector.angleDeg;

      const minimumLength =
        Math.min(
          left.availableLength,
          right.availableLength
        );

      if (
        angleDeg <
          configuration.minimumCornerAngleDeg ||
        angleDeg >
          configuration.maximumCornerAngleDeg ||
        minimumLength <
          configuration.minimumWallLengthGridUnits *
          gridSize
      ) {
        continue;
      }

      candidates.push({
        corner:
          {
            ...node.point
          },
        left,
        right,
        angleDeg,
        sectorKey:
          sector.sectorKey,
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
      });
    }
  }

  return candidates.sort(
    (
      left,
      right
    ) => {
      if (
        left.score !==
          right.score
      ) {
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

  const leftTargetAnchor =
    addScaled(
      corner,
      candidate.left.direction,
      lengthLeft
    );

  const rightTargetAnchor =
    addScaled(
      corner,
      candidate.right.direction,
      lengthRight
    );

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

  const cornerAsset =
    createWebCornerAssetPresentation({
      targetAngleDeg:
        candidate.angleDeg,
      selectionKey:
        `${generationSeed}:${sourceKey}`,
      corner,
      firstAnchor:
        leftTargetAnchor,
      secondAnchor:
        rightTargetAnchor
    });

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
    cornerAsset,
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
  const baseKey =
    [
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

  const sectorKey =
    typeof candidate.sectorKey ===
      "string"
      ? candidate.sectorKey.trim()
      : "";

  return sectorKey
    ? `${baseKey}:sector:${encodeURIComponent(sectorKey)}`
    : baseKey;
}

