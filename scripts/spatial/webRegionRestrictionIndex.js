import {
  doesRegionTagMatchConfiguredTag,
  normaliseRegionRoleTags,
  validateRegionTagListsAreUnique
} from "../config/regionTagConfiguration.js";

import {
  doesPolylineIntersectWebRegionRecord,
  isPointInsideWebRegionRecord,
  isPolylineFullyInsideWebRegionRecords
} from "../foundry/webRegionCompatibility.js";

export function buildWebRegionRestrictionIndex({
  regions = [],
  population = {},
  level
} = {}) {
  const confineTags = normaliseRegionRoleTags(population.confineRegionTags);
  const excludeTags = normaliseRegionRoleTags(population.excludeRegionTags);

  validateRegionTagListsAreUnique({
    confine: confineTags,
    exclude: excludeTags
  });

  const levelId = String(level?.id ?? population.levelId ?? "base");
  const allRegions = Array.isArray(regions) ? regions : [];
  const levelRegions = allRegions.filter((region) => String(region?.levelId ?? "base") === levelId);
  const confineRegions = matchRegions(levelRegions, confineTags);
  const excludeRegions = matchRegions(levelRegions, excludeTags);
  const allMatchedRegions = uniqueRegions([...confineRegions, ...excludeRegions]);

  const missingConfineTags = findMissingPatterns(confineTags, allRegions);
  const missingExcludeTags = findMissingPatterns(excludeTags, allRegions);
  const incompatibleRegionIds = uniqueRegions([
    ...matchRegions(allRegions, confineTags),
    ...matchRegions(allRegions, excludeTags)
  ])
    .filter((region) => String(region.levelId ?? "base") !== levelId)
    .map((region) => region.id);

  return deepFreeze({
    active: confineTags.length > 0 || excludeTags.length > 0,
    levelId,
    pointElevation:
      resolveRestrictionPointElevation(
        level
      ),
    confineTags,
    excludeTags,
    confineRegions,
    excludeRegions,
    matchedRegionIds: allMatchedRegions.map((region) => region.id),
    missingConfineTags,
    missingExcludeTags,
    incompatibleRegionIds
  });
}

export function evaluateWebRegionRestrictionAtPoint(index, x, y) {
  if (!index?.active) return createAllowedEvaluation();

  const confineHits = containingRegions(
    index.confineRegions,
    x,
    y,
    index.pointElevation
  );

  const excludeHits = containingRegions(
    index.excludeRegions,
    x,
    y,
    index.pointElevation
  );
  const allowedByConfine = index.confineTags.length === 0 || confineHits.length > 0;
  const excluded = excludeHits.length > 0;
  const regionIds = uniqueStrings(confineHits.map((region) => region.id));
  const regionTags = uniqueStrings(confineHits.flatMap((region) =>
    (region.tags ?? []).filter((tag) =>
      index.confineTags.some((pattern) =>
        doesRegionTagMatchConfiguredTag(tag, pattern)
      )
    )
  ));

  return deepFreeze({
    allowed: allowedByConfine && !excluded,
    confineRegionIds: confineHits.map((region) => region.id),
    excludeRegionIds: excludeHits.map((region) => region.id),
    regionIds,
    regionTags
  });
}

/**
 * Evaluate one complete generated web against population Region rules.
 * Confine covers the union of matching Regions; every visible strand segment
 * must remain covered. Any contact with an Exclude Region rejects the web.
 */
export function evaluateWebRegionRestrictionForStrands(
  index,
  strands
) {
  if (!index?.active) return createAllowedEvaluation();

  const polylines = (Array.isArray(strands) ? strands : [])
    .map((strand) => strand?.points)
    .filter((points) => Array.isArray(points) && points.length >= 2);

  if (polylines.length === 0) {
    return deepFreeze({
      allowed: false,
      confineRegionIds: [],
      excludeRegionIds: [],
      regionIds: [],
      regionTags: []
    });
  }

  const confineHits = (index.confineRegions ?? []).filter((region) =>
    polylines.some((points) =>
      doesPolylineIntersectWebRegionRecord(
        region,
        points,
        {
          elevation:
            index.pointElevation
        }
      )
    )
  );

  const excludeHits = (index.excludeRegions ?? []).filter((region) =>
    polylines.some((points) =>
      doesPolylineIntersectWebRegionRecord(
        region,
        points,
        {
          elevation:
            index.pointElevation
        }
      )
    )
  );

  const allowedByConfine = index.confineTags.length === 0 ||
    polylines.every((points) =>
      isPolylineFullyInsideWebRegionRecords(
        index.confineRegions,
        points,
        {
          elevation:
            index.pointElevation
        }
      )
    );

  const regionIds = uniqueStrings(confineHits.map((region) => region.id));
  const regionTags = uniqueStrings(confineHits.flatMap((region) =>
    (region.tags ?? []).filter((tag) =>
      index.confineTags.some((pattern) =>
        doesRegionTagMatchConfiguredTag(tag, pattern)
      )
    )
  ));

  return deepFreeze({
    allowed: allowedByConfine && excludeHits.length === 0,
    confineRegionIds: confineHits.map((region) => region.id),
    excludeRegionIds: excludeHits.map((region) => region.id),
    regionIds,
    regionTags
  });
}

export function createWebRegionRestrictionDiagnostics(index) {
  return deepFreeze({
    active: index?.active === true,
    levelId: index?.levelId ?? null,
    pointElevation:
      index?.pointElevation ??
      null,
    confineTags: index?.confineTags ?? [],
    excludeTags: index?.excludeTags ?? [],
    matchedConfineRegionIds: (index?.confineRegions ?? []).map((region) => region.id),
    matchedExcludeRegionIds: (index?.excludeRegions ?? []).map((region) => region.id),
    missingConfineTags: index?.missingConfineTags ?? [],
    missingExcludeTags: index?.missingExcludeTags ?? [],
    incompatibleRegionIds: index?.incompatibleRegionIds ?? []
  });
}

function createAllowedEvaluation() {
  return deepFreeze({
    allowed: true,
    confineRegionIds: [],
    excludeRegionIds: [],
    regionIds: [],
    regionTags: []
  });
}

function matchRegions(regions, patterns) {
  if (patterns.length === 0) return Object.freeze([]);
  return Object.freeze(regions.filter((region) =>
    (Array.isArray(region?.tags) ? region.tags : []).some((tag) =>
      patterns.some((pattern) => doesRegionTagMatchConfiguredTag(tag, pattern))
    )
  ));
}

function findMissingPatterns(patterns, regions) {
  return Object.freeze(patterns.filter((pattern) =>
    !regions.some((region) =>
      (Array.isArray(region?.tags) ? region.tags : [])
        .some((tag) => doesRegionTagMatchConfiguredTag(tag, pattern))
    )
  ));
}

function containingRegions(
  regions,
  x,
  y,
  elevation
) {
  return regions.filter(
    (
      region
    ) =>
      isPointInsideWebRegionRecord(
        region,
        x,
        y,
        {
          elevation
        }
      )
  );
}

function resolveRestrictionPointElevation(
  level
) {
  for (
    const value of
    [
      level?.elevationBand?.bottom,
      level?.elevationBand?.top,
      level?.elevation,
      0
    ]
  ) {
    const numericValue =
      Number(
        value
      );

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(
        numericValue
      )
    ) {
      return numericValue;
    }
  }

  return 0;
}

function uniqueRegions(regions) {
  const byId = new Map();
  for (const region of regions) {
    if (region?.id && !byId.has(region.id)) byId.set(region.id, region);
  }
  return Object.freeze(Array.from(byId.values()));
}

function uniqueStrings(values) {
  return Object.freeze(Array.from(new Set(values.map(String))).sort());
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
