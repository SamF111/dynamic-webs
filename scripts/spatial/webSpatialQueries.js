import {
  normaliseSpatialBounds,
  normaliseSpatialPoint,
  spatialElevationBandContains,
  spatialElevationBandsOverlap
} from "./webSpatialGeometry.js";

export const DEFAULT_SPATIAL_QUERY_LIMIT = 100;
export const MAXIMUM_SPATIAL_QUERY_LIMIT = 1000;
export const DEFAULT_NEARBY_DISTANCE_PX = 100;

/** Normalise shared public spatial-query filters. */
export function normaliseWebSpatialQueryOptions(value = {}, {
  point = null,
  bounds = null,
  requirePoint = false,
  requireBounds = false
} = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

  const resolvedPoint = point ?? source.point ?? null;
  const resolvedBounds = bounds ?? source.bounds ?? null;

  if (requirePoint && !resolvedPoint) {
    throw new TypeError("Dynamic Webs | A point is required for this spatial query.");
  }

  if (requireBounds && !resolvedBounds) {
    throw new TypeError("Dynamic Webs | Bounds are required for this spatial query.");
  }

  const maximumDistancePx = normaliseNonNegativeNumber(
    source.maximumDistancePx ?? source.maxDistancePx ?? DEFAULT_NEARBY_DISTANCE_PX,
    "maximum spatial-query distance"
  );

  const minimumInteractionWidthPx = normaliseNonNegativeNumber(
    source.minimumInteractionWidthPx ??
      source.minimumFunctionalWidthPx ??
      source.minimumCollisionWidthPx ??
      0,
    "minimum functional interaction width"
  );

  return Object.freeze({
    point: resolvedPoint ? normaliseSpatialPoint(resolvedPoint, "query point") : null,
    bounds: resolvedBounds ? normaliseSpatialBounds(resolvedBounds, "query bounds") : null,
    maximumDistancePx,
    minimumInteractionWidthPx,
    limit: normaliseLimit(source.limit),
    intactOnly: source.intactOnly !== false,
    levelIds: normaliseIdentifierSet(source.levelIds ?? source.levelId),
    populationIds: normaliseIdentifierSet(source.populationIds ?? source.populationId),
    webKinds: normaliseIdentifierSet(
      source.webKinds ?? source.webKind ?? source.categories ?? source.category
    ),
    regionIds: normaliseIdentifierSet(source.regionIds ?? source.regionId),
    regionTags: normaliseIdentifierSet(source.regionTags ?? source.regionTag),
    strandKinds: normaliseIdentifierSet(
      source.strandKinds ?? source.strandKind ?? source.strandRoles ?? source.strandRole
    ),
    elevation: normaliseOptionalFiniteNumber(source.elevation),
    elevationBand: source.elevationBand
      ? normaliseElevationBand(source.elevationBand)
      : null
  });
}

/** Return whether one indexed web matches shared query filters. */
export function webEntryMatchesSpatialQuery(
  entry,
  options,
  diagnostics = null
) {
  return diagnostics
    ? webEntryMatchesSpatialQueryWithDiagnostics(
        entry,
        options,
        diagnostics
      )
    : webEntryMatchesSpatialQueryWithoutDiagnostics(
        entry,
        options
      );
}

/** Return whether one indexed strand matches shared query filters. */
export function strandEntryMatchesSpatialQuery(
  entry,
  options,
  diagnostics = null
) {
  if (!diagnostics) {
    return (
      webEntryMatchesSpatialQueryWithoutDiagnostics(
        entry,
        options
      ) &&
      (
        options.strandKinds.size ===
          0 ||
        options.strandKinds.has(
          entry.strandKind
        )
      ) &&
      entry.interactionWidthPx >=
        options.minimumInteractionWidthPx
    );
  }

  if (
    !webEntryMatchesSpatialQueryWithDiagnostics(
      entry,
      options,
      diagnostics
    )
  ) {
    return false;
  }

  if (
    options.strandKinds.size >
      0 &&
    !options.strandKinds.has(
      entry.strandKind
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics
    );
  }

  if (
    entry.interactionWidthPx <
      options.minimumInteractionWidthPx
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics
    );
  }

  return true;
}

function webEntryMatchesSpatialQueryWithoutDiagnostics(
  entry,
  options
) {
  if (!entry || !options) return false;

  if (options.levelIds.size > 0 && !options.levelIds.has(entry.levelId)) return false;
  if (options.populationIds.size > 0 && !options.populationIds.has(entry.populationId)) return false;
  if (options.webKinds.size > 0 && !options.webKinds.has(entry.webKind)) return false;
  if (options.regionIds.size > 0 && !hasAny(entry.regionIds, options.regionIds)) return false;
  if (options.regionTags.size > 0 && !hasAny(entry.regionTags, options.regionTags)) return false;

  if (options.elevation !== null &&
      !spatialElevationBandContains(entry.elevationBand, options.elevation)) return false;

  if (options.elevationBand &&
      !spatialElevationBandsOverlap(entry.elevationBand, options.elevationBand)) return false;

  if (options.intactOnly === true && entry.intact !== true) return false;

  return true;
}

function webEntryMatchesSpatialQueryWithDiagnostics(
  entry,
  options,
  diagnostics
) {
  if (
    !entry ||
    !options
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics
    );
  }

  if (
    options.levelIds.size >
      0 &&
    !options.levelIds.has(
      entry.levelId
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics,
      "levelRejectedCandidateCount"
    );
  }

  if (
    options.populationIds.size >
      0 &&
    !options.populationIds.has(
      entry.populationId
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics
    );
  }

  if (
    options.webKinds.size >
      0 &&
    !options.webKinds.has(
      entry.webKind
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics,
      "categoryRejectedCandidateCount"
    );
  }

  if (
    options.regionIds.size >
      0 &&
    !hasAny(
      entry.regionIds,
      options.regionIds
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics,
      "regionRejectedCandidateCount"
    );
  }

  if (
    options.regionTags.size >
      0 &&
    !hasAny(
      entry.regionTags,
      options.regionTags
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics,
      "regionRejectedCandidateCount"
    );
  }

  if (
    options.elevation !==
      null &&
    !spatialElevationBandContains(
      entry.elevationBand,
      options.elevation
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics,
      "elevationRejectedCandidateCount"
    );
  }

  if (
    options.elevationBand &&
    !spatialElevationBandsOverlap(
      entry.elevationBand,
      options.elevationBand
    )
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics,
      "elevationRejectedCandidateCount"
    );
  }

  if (
    options.intactOnly ===
      true &&
    entry.intact !==
      true
  ) {
    return rejectSpatialMetadataCandidate(
      diagnostics,
      "intactStateRejectedCandidateCount"
    );
  }

  return true;
}

/** Return whether one indexed perch matches shared query filters. */
export function perchEntryMatchesSpatialQuery(entry, options) {
  return webEntryMatchesSpatialQuery(entry, options);
}

/** Stable sort by distance then opaque identifiers. */
export function compareSpatialResults(first, second) {
  const firstDistance = Number.isFinite(Number(first?.distancePx))
    ? Number(first.distancePx)
    : Number.POSITIVE_INFINITY;
  const secondDistance = Number.isFinite(Number(second?.distancePx))
    ? Number(second.distancePx)
    : Number.POSITIVE_INFINITY;

  return firstDistance - secondDistance ||
    String(first?.webId ?? first?.id ?? "").localeCompare(
      String(second?.webId ?? second?.id ?? "")
    ) ||
    String(first?.strandId ?? first?.perchId ?? "").localeCompare(
      String(second?.strandId ?? second?.perchId ?? "")
    );
}

/** Deeply clone and freeze plain API data. */
export function cloneFrozenSpatialValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFrozenSpatialValue));

  const clone = {};
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneFrozenSpatialValue(entry);
  }
  return Object.freeze(clone);
}

function normaliseIdentifierSet(value) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
      ? []
      : [value];

  return new Set(values
    .map((entry) => String(entry).trim())
    .filter(Boolean));
}

function normaliseLimit(value) {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SPATIAL_QUERY_LIMIT;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new TypeError("Dynamic Webs | Spatial-query limit must be a positive integer.");
  }

  return Math.min(number, MAXIMUM_SPATIAL_QUERY_LIMIT);
}

function normaliseNonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`Dynamic Webs | ${label} must be a non-negative finite number.`);
  }
  return number;
}

function normaliseOptionalFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError("Dynamic Webs | Query elevation must be finite when supplied.");
  }
  return number;
}

function normaliseElevationBand(value) {
  const bottom = normaliseOptionalFiniteNumber(value?.bottom);
  const top = normaliseOptionalFiniteNumber(value?.top);

  if (bottom !== null && top !== null && top < bottom) {
    throw new TypeError("Dynamic Webs | Query elevation band must not be inverted.");
  }

  return Object.freeze({ bottom, top });
}

function rejectSpatialMetadataCandidate(
  diagnostics,
  reasonCounterName = null
) {
  incrementSpatialDiagnosticCounter(
    diagnostics,
    "metadataRejectedCandidateCount"
  );

  if (reasonCounterName) {
    incrementSpatialDiagnosticCounter(
      diagnostics,
      reasonCounterName
    );
  }

  return false;
}

function incrementSpatialDiagnosticCounter(
  diagnostics,
  counterName,
  amount = 1
) {
  if (
    !diagnostics ||
    typeof diagnostics !==
      "object" ||
    typeof counterName !==
      "string"
  ) {
    return;
  }

  const current =
    Number(
      diagnostics[
        counterName
      ]
    );

  diagnostics[
    counterName
  ] =
    (
      Number.isFinite(
        current
      ) &&
      current >
        0
        ? current
        : 0
    ) +
    amount;
}

function hasAny(values, expected) {
  return (Array.isArray(values) ? values : []).some((value) => expected.has(String(value)));
}


