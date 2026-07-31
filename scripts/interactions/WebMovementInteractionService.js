import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  createSweptMovementBounds,
  sweptMovementIntersectsPolyline
} from "./spanWebMovementGeometry.js";

const EMPTY_MOVEMENT_INTERACTION_RESULT =
  Object.freeze([]);

const MOVEMENT_DIAGNOSTIC_PHASE_NAMES =
  Object.freeze([
    "requestNormalisation",
    "spatialNormalisation",
    "spatialCandidateCollection",
    "spatialCandidateFilterSort",
    "preciseGeometry",
    "resultConstruction",
    "spatialTelemetry",
    "queryTotal"
  ]);

const MOVEMENT_DIAGNOSTIC_COUNTER_NAMES =
  Object.freeze([
    "queryCount",
    "zeroDisplacementQueryCount",
    "nonZeroDisplacementQueryCount",
    "zeroCellCandidateQueryCount",
    "cellCandidateCount",
    "metadataRejectedCandidateCount",
    "categoryRejectedCandidateCount",
    "levelRejectedCandidateCount",
    "elevationRejectedCandidateCount",
    "intactStateRejectedCandidateCount",
    "regionRejectedCandidateCount",
    "boundsRejectedCandidateCount",
    "duplicateRejectedCandidateCount",
    "acceptedCandidateCount",
    "candidateStrandVisitCount",
    "preciseStrandTestCount",
    "preciseStrandHitCount",
    "hitQueryCount",
    "hitWebCount"
  ]);

const MOVEMENT_SPATIAL_DIAGNOSTIC_COUNTER_NAMES =
  Object.freeze([
    "cellCandidateCount",
    "metadataRejectedCandidateCount",
    "categoryRejectedCandidateCount",
    "levelRejectedCandidateCount",
    "elevationRejectedCandidateCount",
    "intactStateRejectedCandidateCount",
    "regionRejectedCandidateCount",
    "boundsRejectedCandidateCount",
    "duplicateRejectedCandidateCount",
    "acceptedCandidateCount",
    "candidateStrandVisitCount"
  ]);

/** Generic movement query over currently intact wall-span web geometry. */
export class WebMovementInteractionService {
  constructor({
    webRuntimeService
  }) {
    if (
      !webRuntimeService ||
      typeof webRuntimeService.queryStrands !==
        "function"
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | WebMovementInteractionService requires the web runtime service.`
      );
    }

    this.webRuntimeService =
      webRuntimeService;
  }

  queryMovement({
    from,
    to,
    levelId = null,
    elevation = null,
    elevationBand = null,
    collisionRadiusPx = 0,
    categories =
      [
        "wall-span"
      ],
    strandKinds = [],
    limit = 1000,
    diagnosticObserver = null
  }) {
    const diagnostics =
      typeof diagnosticObserver ===
        "function"
        ? createMovementQueryDiagnostics()
        : null;

    const queryStartedAt =
      diagnostics
        ? readMovementDiagnosticTime()
        : 0;

    let phaseStartedAt =
      queryStartedAt;

    const bounds =
      createSweptMovementBounds({
        from,
        to,
        collisionRadiusPx
      });

    if (diagnostics) {
      const zeroDisplacement =
        isZeroMovementDisplacement(
          from,
          to
        );

      diagnostics.counters[
        zeroDisplacement
          ? "zeroDisplacementQueryCount"
          : "nonZeroDisplacementQueryCount"
      ] =
        1;
    }

    const queryOptions = {
      levelId,
      elevation,
      elevationBand,
      categories,
      ...(
        Array.isArray(
          strandKinds
        ) &&
        strandKinds.length >
          0
          ? {
              strandKinds
            }
          : {}
      ),
      intactOnly:
        true,
      limit
    };

    if (diagnostics) {
      diagnostics.phases.requestNormalisation =
        readMovementDiagnosticTime() -
        phaseStartedAt;
    }

    /*
     * The overwhelming majority of movement queries produce no web hit. Keep
     * hit aggregation completely unallocated until the first precise contact.
     */
    let hitsByWebId =
      null;

    const visitStrand =
      (
        strand
      ) => {
        let preciseStartedAt =
          0;

        if (diagnostics) {
          diagnostics.counters.preciseStrandTestCount +=
            1;

          preciseStartedAt =
            readMovementDiagnosticTime();
        }

        const intersects =
          sweptMovementIntersectsPolyline({
            from,
            to,
            collisionRadiusPx,
            points:
              strand.points,
            interactionWidthPx:
              strand.interactionWidthPx
          });

        if (diagnostics) {
          diagnostics.phases.preciseGeometry +=
            readMovementDiagnosticTime() -
            preciseStartedAt;
        }

        if (!intersects) {
          return;
        }

        if (diagnostics) {
          diagnostics.counters.preciseStrandHitCount +=
            1;
        }

        if (!hitsByWebId) {
          hitsByWebId =
            new Map();
        }

        const current =
          hitsByWebId.get(
            strand.webId
          );

        if (
          current
        ) {
          current.strandIds.add(
            strand.strandId
          );

          return;
        }

        hitsByWebId.set(
          strand.webId,
          {
            webId:
              strand.webId,
            sceneId:
              strand.sceneId,
            populationId:
              strand.populationId,
            levelId:
              strand.levelId,
            elevationBand:
              strand.elevationBand,
            webKind:
              strand.webKind,
            strandIds:
              new Set([
                strand.strandId
              ])
          }
        );
      };

    const spatialDiagnostics =
      diagnostics
        ? Object.create(
            null
          )
        : null;

    if (
      typeof this.webRuntimeService.visitStrands ===
        "function"
    ) {
      this.webRuntimeService.visitStrands(
        bounds,
        queryOptions,
        visitStrand,
        spatialDiagnostics
      );
    } else {
      phaseStartedAt =
        diagnostics
          ? readMovementDiagnosticTime()
          : 0;

      const strands =
        this.webRuntimeService.queryStrands(
          bounds,
          queryOptions
        );

      if (diagnostics) {
        diagnostics.phases.spatialCandidateCollection =
          readMovementDiagnosticTime() -
          phaseStartedAt;

        diagnostics.counters.cellCandidateCount =
          strands.length;

        diagnostics.counters.acceptedCandidateCount =
          strands.length;

        diagnostics.counters.candidateStrandVisitCount =
          strands.length;
      }

      for (
        const strand of
        strands
      ) {
        visitStrand(
          strand
        );
      }
    }

    if (diagnostics) {
      mergeSpatialDiagnostics(
        diagnostics,
        spatialDiagnostics
      );

      phaseStartedAt =
        readMovementDiagnosticTime();
    }

    const result =
      hitsByWebId?.size >
        0
        ? Object.freeze(
            Array.from(
              hitsByWebId.values()
            )
              .sort(
                (
                  first,
                  second
                ) =>
                  first.webId.localeCompare(
                    second.webId
                  )
              )
              .map(
                (
                  hit
                ) =>
                  Object.freeze({
                    ...hit,
                    strandIds:
                      Object.freeze(
                        Array.from(
                          hit.strandIds
                        ).sort()
                      )
                  })
              )
          )
        : EMPTY_MOVEMENT_INTERACTION_RESULT;

    if (diagnostics) {
      const completedAt =
        readMovementDiagnosticTime();

      diagnostics.phases.resultConstruction =
        completedAt -
        phaseStartedAt;

      diagnostics.counters.queryCount =
        1;

      diagnostics.counters.zeroCellCandidateQueryCount =
        diagnostics.counters.cellCandidateCount ===
          0
          ? 1
          : 0;

      diagnostics.counters.hitWebCount =
        result.length;

      diagnostics.counters.hitQueryCount =
        result.length >
          0
          ? 1
          : 0;

      diagnostics.phases.queryTotal =
        completedAt -
        queryStartedAt;

      emitMovementQueryDiagnostics(
        diagnosticObserver,
        diagnostics
      );
    }

    return result;
  }
}

function createMovementQueryDiagnostics() {
  const phases =
    Object.create(
      null
    );

  for (
    const phaseName of
    MOVEMENT_DIAGNOSTIC_PHASE_NAMES
  ) {
    phases[
      phaseName
    ] =
      0;
  }

  const counters =
    Object.create(
      null
    );

  for (
    const counterName of
    MOVEMENT_DIAGNOSTIC_COUNTER_NAMES
  ) {
    counters[
      counterName
    ] =
      0;
  }

  return {
    phases,
    counters
  };
}

function mergeSpatialDiagnostics(
  diagnostics,
  spatialDiagnostics
) {
  if (
    !diagnostics ||
    !spatialDiagnostics ||
    typeof spatialDiagnostics !==
      "object"
  ) {
    return;
  }

  diagnostics.phases.spatialNormalisation =
    normaliseMovementDiagnosticNumber(
      spatialDiagnostics.spatialNormalisationMs
    );

  diagnostics.phases.spatialCandidateCollection =
    normaliseMovementDiagnosticNumber(
      spatialDiagnostics.spatialCandidateCollectionMs
    );

  diagnostics.phases.spatialCandidateFilterSort =
    normaliseMovementDiagnosticNumber(
      spatialDiagnostics.spatialCandidateFilterSortMs
    );

  diagnostics.phases.spatialTelemetry =
    normaliseMovementDiagnosticNumber(
      spatialDiagnostics.spatialTelemetryMs
    );

  for (
    const counterName of
    MOVEMENT_SPATIAL_DIAGNOSTIC_COUNTER_NAMES
  ) {
    diagnostics.counters[
      counterName
    ] =
      normaliseMovementDiagnosticInteger(
        spatialDiagnostics[
          counterName
        ]
      );
  }
}

function isZeroMovementDisplacement(
  from,
  to
) {
  return (
    Number(
      from?.x
    ) ===
      Number(
        to?.x
      ) &&
    Number(
      from?.y
    ) ===
      Number(
        to?.y
      )
  );
}

function emitMovementQueryDiagnostics(
  observer,
  diagnostics
) {
  try {
    observer(
      Object.freeze({
        phases:
          Object.freeze({
            ...diagnostics.phases
          }),
        counters:
          Object.freeze({
            ...diagnostics.counters
          })
      })
    );
  } catch (_error) {
    /*
     * Profiling is strictly observational. A diagnostic consumer must never
     * alter movement-query behaviour or suppress a valid interaction result.
     */
  }
}

function readMovementDiagnosticTime() {
  const now =
    globalThis.performance?.now;

  return typeof now ===
    "function"
    ? now.call(
        globalThis.performance
      )
    : Date.now();
}

function normaliseMovementDiagnosticNumber(
  value
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  ) &&
    number >
      0
    ? number
    : 0;
}

function normaliseMovementDiagnosticInteger(
  value
) {
  const number =
    Number(
      value
    );

  return Number.isInteger(
    number
  ) &&
    number >
      0
    ? number
    : 0;
}


