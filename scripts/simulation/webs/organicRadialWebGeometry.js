import {
  WEB_STRAND_KINDS,
  clamp,
  createWebStrand,
  lerpPoint,
  normaliseVector,
  randomBetween,
  sampleQuadraticBezier
} from "./webGeometry.js";

/**
 * Reusable deterministic geometry builder for organic radial webs.
 *
 * Placement generators remain responsible for finding suitable Scene geometry
 * and supplying real anchor points. This builder only turns a hub and ordered
 * anchor boundary into curved structural radials, partial capture arcs, short
 * anchor supports, and loose decorative threads.
 */
export class OrganicRadialWebBuilder {
  /**
   * @param {object} options - Builder options.
   * @param {number} options.gridSize - Scene grid size in pixels.
   * @param {object} options.configuration - Organic radial configuration.
   * @param {Function} options.random - Deterministic random function.
   */
  constructor({
    gridSize,
    configuration,
    random
  }) {
    if (
      !Number.isFinite(Number(gridSize)) ||
      Number(gridSize) <= 0 ||
      !configuration ||
      typeof configuration !== "object" ||
      typeof random !== "function"
    ) {
      throw new TypeError(
        "Dynamic Webs | OrganicRadialWebBuilder requires a grid size, configuration, and deterministic random function."
      );
    }

    this.gridSize =
      Number(gridSize);

    this.configuration =
      configuration;

    this.random =
      random;
  }

  /**
   * Build reusable organic radial geometry.
   *
   * @param {object} options - Web geometry values.
   * @param {{x:number,y:number}} options.hub - Web hub.
   * @param {object[]} options.anchors - Real attachment points.
   * @param {boolean} [options.closedCaptureRings=true]
   *   Whether the final radial reconnects to the first.
   * @param {{x:number,y:number}|null} [options.angleReference=null]
   *   Reference direction used to unwrap an open radial fan.
   * @param {object[]} [options.supportGroups=[]]
   *   Named anchor groups eligible for short wall-adjacent supports.
   * @param {number} [options.detailScale=0.5]
   *   Normalised size/detail amount from zero to one.
   * @returns {{strands:object[],radials:object[]}} Generated geometry.
   */
  build({
    hub,
    anchors,
    closedCaptureRings = true,
    angleReference = null,
    supportGroups = [],
    detailScale = 0.5
  }) {
    const orderedAnchors =
      orderRadialAnchors({
        hub,
        anchors,
        closedCaptureRings,
        angleReference
      });

    const radials =
      orderedAnchors.map(
        (
          anchor,
          radialIndex
        ) => ({
          ...anchor,
          radialIndex,
          points:
            createCurvedStructuralPath({
              start:
                hub,
              end:
                anchor.point,
              gridSize:
                this.gridSize,
              maximumCurveGridUnits:
                this.configuration.maximumStructuralCurveGridUnits,
              random:
                this.random
            })
        })
      );

    const strands =
      [];

    for (const radial of radials) {
      strands.push(
        createWebStrand({
          id:
            `structural-radial-${radial.radialIndex}`,
          kind:
            WEB_STRAND_KINDS.STRUCTURAL,
          points:
            radial.points,
          random:
            this.random,
          alphaMultiplier:
            randomBetween(
              this.random,
              0.94,
              1
            )
        })
      );
    }

    addPartialAnchorSupports({
      strands,
      supportGroups,
      hub,
      gridSize:
        this.gridSize,
      configuration:
        this.configuration,
      random:
        this.random
    });

    addCaptureArcs({
      strands,
      radials,
      hub,
      gridSize:
        this.gridSize,
      configuration:
        this.configuration,
      random:
        this.random,
      closedCaptureRings,
      detailScale:
        clamp(
          Number(detailScale) || 0,
          0,
          1
        )
    });

    addLooseRadialStrands({
      strands,
      radials,
      hub,
      gridSize:
        this.gridSize,
      configuration:
        this.configuration,
      random:
        this.random
    });

    return {
      strands:
        strands.filter(Boolean),
      radials
    };
  }
}

/**
 * Create stratified deterministic values without evenly paired positions.
 *
 * @param {object} options - Range values.
 * @param {number} options.count - Value count.
 * @param {number} options.minimum - Minimum range value.
 * @param {number} options.maximum - Maximum range value.
 * @param {Function} options.random - Deterministic random function.
 * @param {number} [options.minimumEdgeInsetFraction=0.04]
 * @param {number} [options.maximumEdgeInsetFraction=0.16]
 * @returns {number[]} Sorted values.
 */
export function createStratifiedValues({
  count,
  minimum,
  maximum,
  random,
  minimumEdgeInsetFraction = 0.04,
  maximumEdgeInsetFraction = 0.16
}) {
  const safeCount =
    Math.max(
      1,
      Math.trunc(
        Number(count) || 1
      )
    );

  const range =
    Math.max(
      0,
      Number(maximum) -
      Number(minimum)
    );

  if (
    range <= 0 ||
    typeof random !== "function"
  ) {
    return Array.from(
      {
        length:
          safeCount
      },
      () => Number(minimum) || 0
    );
  }

  const negativeInset =
    range *
    randomBetween(
      random,
      minimumEdgeInsetFraction,
      maximumEdgeInsetFraction
    );

  const positiveInset =
    range *
    randomBetween(
      random,
      minimumEdgeInsetFraction,
      maximumEdgeInsetFraction
    );

  const start =
    Number(minimum) +
    negativeInset;

  const end =
    Number(maximum) -
    positiveInset;

  const usableRange =
    Math.max(
      0,
      end -
      start
    );

  if (usableRange <= 0) {
    return Array.from(
      {
        length:
          safeCount
      },
      () => (
        Number(minimum) +
        Number(maximum)
      ) /
      2
    );
  }

  const values =
    [];

  for (
    let index = 0;
    index < safeCount;
    index += 1
  ) {
    const stratumStart =
      start +
      usableRange *
      index /
      safeCount;

    const stratumEnd =
      start +
      usableRange *
      (
        index +
        1
      ) /
      safeCount;

    const stratumWidth =
      stratumEnd -
      stratumStart;

    values.push(
      randomBetween(
        random,
        stratumStart +
          stratumWidth *
          0.12,
        stratumEnd -
          stratumWidth *
          0.12
      )
    );
  }

  return values.sort(
    (
      first,
      second
    ) =>
      first -
      second
  );
}

/**
 * Choose a deterministic integer while biasing larger webs towards the upper
 * end of the configured detail range.
 */
export function randomScaledIntegerInclusive(
  random,
  minimum,
  maximum,
  detailScale = 0.5
) {
  const safeMinimum =
    Math.ceil(
      Number(minimum) || 0
    );

  const safeMaximum =
    Math.max(
      safeMinimum,
      Math.floor(
        Number(maximum) ||
        safeMinimum
      )
    );

  const range =
    safeMaximum -
    safeMinimum;

  if (range <= 0) {
    return safeMinimum;
  }

  const scale =
    clamp(
      Number(detailScale) || 0,
      0,
      1
    );

  const scaledFloor =
    Math.floor(
      range *
      scale *
      0.55
    );

  const remaining =
    range -
    scaledFloor;

  return safeMinimum +
    scaledFloor +
    Math.floor(
      random() *
      (
        remaining +
        1
      )
    );
}

/**
 * Create a subtly curved structural path. Curvature scales with both Scene
 * grid size and strand length so larger webs do not become visually rigid.
 */
export function createCurvedStructuralPath({
  start,
  end,
  gridSize,
  maximumCurveGridUnits,
  random
}) {
  const direction =
    normaliseVector({
      x:
        end.x -
        start.x,
      y:
        end.y -
        start.y
    });

  const perpendicular = {
    x:
      -direction.y,
    y:
      direction.x
  };

  const strandLength =
    Math.hypot(
      end.x -
        start.x,
      end.y -
        start.y
    );

  const midpoint =
    lerpPoint(
      start,
      end,
      randomBetween(
        random,
        0.42,
        0.58
      )
    );

  const maximumCurvePx =
    Math.max(
      0,
      Math.min(
        Number(gridSize) *
          Number(maximumCurveGridUnits),
        strandLength *
          0.085
      )
    );

  const minimumCurvePx =
    Math.min(
      maximumCurvePx,
      Math.max(
        Number(gridSize) *
          0.008,
        strandLength *
          0.018
      )
    );

  const curveMagnitude =
    randomBetween(
      random,
      minimumCurvePx,
      maximumCurvePx
    );

  const curveSign =
    random() <
      0.5
      ? -1
      : 1;

  const alongStrandJitter =
    strandLength *
    randomBetween(
      random,
      -0.018,
      0.018
    );

  const control = {
    x:
      midpoint.x +
      perpendicular.x *
        curveMagnitude *
        curveSign +
      direction.x *
        alongStrandJitter,

    y:
      midpoint.y +
      perpendicular.y *
        curveMagnitude *
        curveSign +
      direction.y *
        alongStrandJitter
  };

  return sampleQuadraticBezier(
    start,
    control,
    end,
    8
  );
}

/** Return one point along a sampled polyline using distance-weighted progress. */
export function samplePolylineAtFraction(
  points,
  fraction
) {
  if (
    !Array.isArray(points) ||
    points.length === 0
  ) {
    return {
      x:
        0,
      y:
        0
    };
  }

  if (points.length === 1) {
    return {
      x:
        points[0].x,
      y:
        points[0].y
    };
  }

  const lengths =
    [];

  let totalLength =
    0;

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const length =
      Math.hypot(
        points[index].x -
          points[index - 1].x,
        points[index].y -
          points[index - 1].y
      );

    lengths.push(
      length
    );

    totalLength +=
      length;
  }

  if (totalLength <= 0) {
    return {
      x:
        points[0].x,
      y:
        points[0].y
    };
  }

  const targetDistance =
    clamp(
      Number(fraction) || 0,
      0,
      1
    ) *
    totalLength;

  let traversed =
    0;

  for (
    let index = 0;
    index < lengths.length;
    index += 1
  ) {
    const segmentLength =
      lengths[index];

    if (
      traversed +
        segmentLength >=
      targetDistance
    ) {
      const localFraction =
        segmentLength >
          0
          ? (
            targetDistance -
            traversed
          ) /
          segmentLength
          : 0;

      return lerpPoint(
        points[index],
        points[index + 1],
        localFraction
      );
    }

    traversed +=
      segmentLength;
  }

  const lastPoint =
    points[
      points.length -
      1
    ];

  return {
    x:
      lastPoint.x,
    y:
      lastPoint.y
  };
}

function orderRadialAnchors({
  hub,
  anchors,
  closedCaptureRings,
  angleReference
}) {
  const safeAnchors =
    (Array.isArray(anchors)
      ? anchors
      : [])
      .filter(
        (anchor) =>
          Number.isFinite(
            Number(anchor?.point?.x)
          ) &&
          Number.isFinite(
            Number(anchor?.point?.y)
          )
      )
      .map(
        (anchor) => {
          const direction =
            normaliseVector({
              x:
                anchor.point.x -
                hub.x,
              y:
                anchor.point.y -
                hub.y
            });

          return {
            ...anchor,
            direction,
            angle:
              Math.atan2(
                direction.y,
                direction.x
              )
          };
        }
      );

  if (
    closedCaptureRings ||
    !angleReference
  ) {
    return safeAnchors.sort(
      (
        first,
        second
      ) =>
        first.angle -
        second.angle
    );
  }

  const reference =
    normaliseVector(
      angleReference
    );

  return safeAnchors
    .map(
      (anchor) => ({
        ...anchor,
        relativeAngle:
          Math.atan2(
            cross(
              reference,
              anchor.direction
            ),
            dot(
              reference,
              anchor.direction
            )
          )
      })
    )
    .sort(
      (
        first,
        second
      ) =>
        first.relativeAngle -
        second.relativeAngle
    );
}

function addPartialAnchorSupports({
  strands,
  supportGroups,
  hub,
  gridSize,
  configuration,
  random
}) {
  for (const group of Array.isArray(supportGroups) ? supportGroups : []) {
    const anchors =
      Array.isArray(group?.anchors)
        ? group.anchors
        : [];

    if (
      anchors.length < 2 ||
      random() >=
        configuration.wallSupportChance
    ) {
      continue;
    }

    const startIndex =
      Math.floor(
        random() *
        (
          anchors.length -
          1
        )
      );

    const start =
      anchors[startIndex].point;

    const end =
      anchors[startIndex + 1].point;

    const midpoint =
      lerpPoint(
        start,
        end,
        0.5
      );

    const towardHub =
      normaliseVector({
        x:
          hub.x -
          midpoint.x,
        y:
          hub.y -
          midpoint.y
      });

    const control = {
      x:
        midpoint.x +
        towardHub.x *
          gridSize *
          randomBetween(
            random,
            0.015,
            0.05
          ),

      y:
        midpoint.y +
        towardHub.y *
          gridSize *
          randomBetween(
            random,
            0.015,
            0.05
          )
    };

    strands.push(
      createWebStrand({
        id:
          `structural-wall-support-${String(group?.id ?? "group")}`,
        kind:
          WEB_STRAND_KINDS.STRUCTURAL,
        points:
          sampleQuadraticBezier(
            start,
            control,
            end,
            6
          ),
        random,
        alphaMultiplier:
          randomBetween(
            random,
            0.88,
            1
          )
      })
    );
  }
}

function addCaptureArcs({
  strands,
  radials,
  hub,
  gridSize,
  configuration,
  random,
  closedCaptureRings,
  detailScale
}) {
  const minimumRadials =
    closedCaptureRings
      ? 3
      : 2;

  if (radials.length < minimumRadials) {
    return;
  }

  const ringCount =
    randomScaledIntegerInclusive(
      random,
      configuration.minimumCaptureRingCount,
      configuration.maximumCaptureRingCount,
      detailScale
    );

  for (
    let ringIndex = 1;
    ringIndex <= ringCount;
    ringIndex += 1
  ) {
    const baseFraction =
      ringIndex /
      (
        ringCount +
        1
      );

    const ringFraction =
      clamp(
        baseFraction +
        randomBetween(
          random,
          -0.025,
          0.025
        ),
        0.12,
        0.94
      );

    const ringPoints =
      radials.map(
        (radial) => {
          const localFraction =
            clamp(
              ringFraction *
              randomBetween(
                random,
                0.88,
                1.12
              ),
              0.08,
              0.97
            );

          const point =
            samplePolylineAtFraction(
              radial.points,
              localFraction
            );

          const radialDirection =
            normaliseVector({
              x:
                point.x -
                hub.x,
              y:
                point.y -
                hub.y
            });

          const tangentToRing = {
            x:
              -radialDirection.y,
            y:
              radialDirection.x
          };

          const jitter =
            gridSize *
            0.008 *
            ringFraction;

          return {
            x:
              point.x +
              tangentToRing.x *
                randomBetween(
                  random,
                  -jitter,
                  jitter
                ),

            y:
              point.y +
              tangentToRing.y *
                randomBetween(
                  random,
                  -jitter,
                  jitter
                )
          };
        }
      );

    const arcCount =
      closedCaptureRings
        ? ringPoints.length
        : Math.max(
          0,
          ringPoints.length -
          1
        );

    const arcRolls =
      Array.from(
        {
          length:
            arcCount
        },
        (
          _entry,
          arcIndex
        ) => ({
          arcIndex,
          roll:
            random()
        })
      );

    const existenceChance =
      clamp(
        0.96 -
        ringFraction *
          configuration.outerCaptureGapChance,
        0.24,
        0.96
      );

    const included =
      new Set(
        arcRolls
          .filter(
            (entry) =>
              entry.roll <
              existenceChance
          )
          .map(
            (entry) =>
              entry.arcIndex
          )
      );

    const minimumArcCount =
      Math.min(
        arcCount,
        ringFraction <
          0.62
          ? 2
          : 1
      );

    for (const entry of [...arcRolls].sort(
      (
        first,
        second
      ) =>
        first.roll -
        second.roll
    )) {
      if (included.size >= minimumArcCount) {
        break;
      }

      included.add(
        entry.arcIndex
      );
    }

    for (
      let arcIndex = 0;
      arcIndex < arcCount;
      arcIndex += 1
    ) {
      if (!included.has(arcIndex)) {
        continue;
      }

      const start =
        ringPoints[arcIndex];

      const end =
        ringPoints[
          closedCaptureRings
            ? (
              arcIndex +
              1
            ) %
              ringPoints.length
            : arcIndex +
              1
        ];

      const midpoint =
        lerpPoint(
          start,
          end,
          0.5
        );

      const outward =
        normaliseVector({
          x:
            midpoint.x -
            hub.x,
          y:
            midpoint.y -
            hub.y
        });

      const chordDirection =
        normaliseVector({
          x:
            end.x -
            start.x,
          y:
            end.y -
            start.y
        });

      const chordPerpendicular = {
        x:
          -chordDirection.y,
        y:
          chordDirection.x
      };

      const chordLength =
        Math.hypot(
          end.x -
            start.x,
          end.y -
            start.y
        );

      const outwardCurve =
        Math.min(
          gridSize *
            randomBetween(
              random,
              0.008,
              configuration.maximumCaptureCurveGridUnits
            ) *
            (
              0.65 +
              ringFraction *
                0.5
            ),
          chordLength *
            0.18
        );

      const sidewaysJitter =
        Math.min(
          gridSize *
            randomBetween(
              random,
              -0.008,
              0.008
            ),
          chordLength *
            0.05
        );

      const control = {
        x:
          midpoint.x +
          outward.x *
            outwardCurve +
          chordPerpendicular.x *
            sidewaysJitter,

        y:
          midpoint.y +
          outward.y *
            outwardCurve +
          chordPerpendicular.y *
            sidewaysJitter
      };

      strands.push(
        createWebStrand({
          id:
            `capture-${ringIndex}-${arcIndex}`,
          kind:
            WEB_STRAND_KINDS.CAPTURE,
          points:
            sampleQuadraticBezier(
              start,
              control,
              end,
              6
            ),
          random,
          alphaMultiplier:
            (
              1 -
              ringFraction *
                0.2
            ) *
            randomBetween(
              random,
              0.9,
              1
            )
        })
      );
    }
  }
}

function addLooseRadialStrands({
  strands,
  radials,
  hub,
  gridSize,
  configuration,
  random
}) {
  if (
    radials.length === 0 ||
    configuration.maximumLooseStrands <= 0
  ) {
    return;
  }

  const looseCount =
    randomIntegerInclusive(
      random,
      0,
      configuration.maximumLooseStrands
    );

  for (
    let looseIndex = 0;
    looseIndex < looseCount;
    looseIndex += 1
  ) {
    const radial =
      radials[
        Math.floor(
          random() *
          radials.length
        )
      ];

    const start =
      samplePolylineAtFraction(
        radial.points,
        randomBetween(
          random,
          0.58,
          0.92
        )
      );

    const outward =
      normaliseVector({
        x:
          start.x -
          hub.x,
        y:
          start.y -
          hub.y
      });

    const sideways = {
      x:
        -outward.y,
      y:
        outward.x
    };

    const end = {
      x:
        start.x +
        outward.x *
          gridSize *
          randomBetween(
            random,
            0.08,
            0.24
          ) +
        sideways.x *
          gridSize *
          randomBetween(
            random,
            -0.12,
            0.12
          ),

      y:
        start.y +
        outward.y *
          gridSize *
          randomBetween(
            random,
            0.08,
            0.24
          ) +
        sideways.y *
          gridSize *
          randomBetween(
            random,
            -0.12,
            0.12
          )
    };

    const midpoint =
      lerpPoint(
        start,
        end,
        0.5
      );

    const control = {
      x:
        midpoint.x +
        sideways.x *
          gridSize *
          randomBetween(
            random,
            -0.05,
            0.05
          ),

      y:
        midpoint.y +
        sideways.y *
          gridSize *
          randomBetween(
            random,
            -0.05,
            0.05
          )
    };

    strands.push(
      createWebStrand({
        id:
          `decorative-${looseIndex}`,
        kind:
          WEB_STRAND_KINDS.DECORATIVE,
        points:
          sampleQuadraticBezier(
            start,
            control,
            end,
            6
          ),
        random,
        alphaMultiplier:
          randomBetween(
            random,
            0.78,
            1
          )
      })
    );
  }
}

function randomIntegerInclusive(
  random,
  minimum,
  maximum
) {
  const safeMinimum =
    Math.ceil(
      Number(minimum) || 0
    );

  const safeMaximum =
    Math.max(
      safeMinimum,
      Math.floor(
        Number(maximum) ||
        safeMinimum
      )
    );

  return safeMinimum +
    Math.floor(
      random() *
      (
        safeMaximum -
        safeMinimum +
        1
      )
    );
}

function dot(
  first,
  second
) {
  return first.x *
    second.x +
    first.y *
    second.y;
}

function cross(
  first,
  second
) {
  return first.x *
    second.y -
    first.y *
    second.x;
}

