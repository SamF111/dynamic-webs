import {
  getRegionTags
} from "../config/regionTagConfiguration.js";

import {
  BASE_WEB_LEVEL_ID
} from "../simulation/webs/webLevelContract.js";

const WEB_REGION_NATIVE_DOCUMENT =
  Symbol.for(
    "dynamic-webs.web-region-native-document"
  );

const REGION_NATIVE_SAMPLE_SPACING_PX =
  2;

export function resolveRegionConfigClass() {
  const sheets = globalThis.foundry?.applications?.sheets;
  for (const candidate of [
    sheets?.RegionConfig,
    sheets?.RegionSheet,
    sheets?.RegionDocumentConfig
  ]) {
    if (typeof candidate === "function") return candidate;
  }
  return null;
}

export function resolveRegionDocumentLike(value) {
  if (!value || typeof value !== "object") return null;

  for (const candidate of [
    value.document,
    value.object,
    value.region,
    value.options?.document,
    value.options?.object,
    value
  ]) {
    const document = candidate?.document && typeof candidate.document === "object"
      ? candidate.document
      : candidate;

    if (isRegionDocumentLike(document)) return document;
  }

  return null;
}

export function collectSceneRegionDocuments(
  scene = globalThis.canvas?.scene
) {
  const sources = [
    scene?.regions,
    scene?._source?.regions,
    scene?.data?.regions,
    globalThis.canvas?.scene === scene
      ? globalThis.canvas?.regions?.placeables
      : null,
    globalThis.canvas?.scene === scene
      ? globalThis.canvas?.regions?.children
      : null
  ];

  const byId = new Map();

  for (const source of sources) {
    for (const candidate of iterateValues(source)) {
      const document = resolveRegionDocumentLike(candidate);
      if (!document) continue;
      const id = firstIdentifier(
        document.id,
        document._id,
        document.documentId,
        document._source?._id
      ) ?? `region-${byId.size}`;
      if (!byId.has(id)) byId.set(id, document);
    }
  }

  return Object.freeze(Array.from(byId.values()));
}

export function collectWebRegionRecords({
  scene = globalThis.canvas?.scene,
  providerResolution
} = {}) {
  const records = [];

  for (const document of collectSceneRegionDocuments(scene)) {
    const id = firstIdentifier(
      document.id,
      document._id,
      document.documentId,
      document._source?._id
    );
    if (!id) continue;

    const levelMetadata = resolveRegionLevelMetadata(
      document,
      providerResolution
    );

    const record = {
      id,
      name: firstIdentifier(document.name, document._source?.name) ?? id,
      tags: getRegionTags(document),
      levelId: String(levelMetadata?.levelId ?? BASE_WEB_LEVEL_ID),
      elevationBand: {
        bottom: finiteOrNull(levelMetadata?.elevationBand?.bottom),
        top: finiteOrNull(levelMetadata?.elevationBand?.top)
      },
      levelMetadataResolved: levelMetadata?.resolved === true,
      levelSource: String(levelMetadata?.source ?? "unknown"),
      shapes: resolveRegionShapeRecords(document)
    };

    /**
     * Preserve the authoritative RegionDocument through the generation-context
     * shallow clone without exposing it through JSON, Object.keys(), or public
     * diagnostics. Object spread copies enumerable symbol keys, while ordinary
     * serialisation ignores them.
     */
    Object.defineProperty(
      record,
      WEB_REGION_NATIVE_DOCUMENT,
      {
        value: document,
        enumerable: true,
        configurable: false,
        writable: false
      }
    );

    records.push(
      deepFreeze(
        record
      )
    );
  }

  return Object.freeze(records.sort((a, b) =>
    a.levelId.localeCompare(b.levelId) || a.id.localeCompare(b.id)
  ));
}


function resolveRegionLevelMetadata(document, providerResolution) {
  const levels = Array.isArray(providerResolution?.levels)
    ? providerResolution.levels
    : [];

  const directLevelId = firstIdentifier(
    document?.level?.id,
    document?.levelId,
    document?._source?.levelId,
    document?.flags?.levels?.levelId,
    document?._source?.flags?.levels?.levelId
  );

  if (directLevelId) {
    const direct = levels.find((level) => String(level.id) === directLevelId);
    if (direct) return {
      levelId: direct.id,
      elevationBand: direct.elevationBand,
      resolved: true,
      source: "region-level-id"
    };
  }

  const band = resolveRegionElevationBand(document);
  if (band) {
    const exact = levels.find((level) => elevationBandsEqual(level.elevationBand, band));
    const overlapping = exact ?? levels.find((level) => elevationBandsOverlap(level.elevationBand, band));
    if (overlapping) return {
      levelId: overlapping.id,
      elevationBand: overlapping.elevationBand,
      resolved: true,
      source: "region-elevation-band"
    };
  }

  const fallback = typeof providerResolution?.resolveWallLevelMetadata === "function"
    ? providerResolution.resolveWallLevelMetadata(document)
    : null;

  return fallback ?? {
    levelId: levels[0]?.id ?? BASE_WEB_LEVEL_ID,
    elevationBand: levels[0]?.elevationBand ?? { bottom: null, top: null },
    resolved: false,
    source: "base"
  };
}

function resolveRegionElevationBand(document) {
  const bottom = firstFinite(
    document?.elevation?.bottom,
    document?._source?.elevation?.bottom,
    document?.bottom,
    document?._source?.bottom,
    document?.range?.bottom,
    document?._source?.range?.bottom,
    document?.flags?.levels?.bottom,
    document?._source?.flags?.levels?.bottom,
    document?.flags?.["wall-height"]?.bottom,
    document?._source?.flags?.["wall-height"]?.bottom
  );
  const top = firstFinite(
    document?.elevation?.top,
    document?._source?.elevation?.top,
    document?.top,
    document?._source?.top,
    document?.range?.top,
    document?._source?.range?.top,
    document?.flags?.levels?.top,
    document?._source?.flags?.levels?.top,
    document?.flags?.["wall-height"]?.top,
    document?._source?.flags?.["wall-height"]?.top
  );
  if (bottom === null && top === null) return null;
  return { bottom: bottom ?? top, top: top ?? bottom };
}

function elevationBandsEqual(first, second) {
  return finiteOrNull(first?.bottom) === finiteOrNull(second?.bottom) &&
    finiteOrNull(first?.top) === finiteOrNull(second?.top);
}

function elevationBandsOverlap(first, second) {
  const firstBottom = finiteOrNull(first?.bottom) ?? Number.NEGATIVE_INFINITY;
  const firstTop = finiteOrNull(first?.top) ?? Number.POSITIVE_INFINITY;
  const secondBottom = finiteOrNull(second?.bottom) ?? Number.NEGATIVE_INFINITY;
  const secondTop = finiteOrNull(second?.top) ?? Number.POSITIVE_INFINITY;
  return firstBottom <= secondTop && secondBottom <= firstTop;
}

export function resolveRegionShapeRecords(regionDocument) {
  const document = resolveRegionDocumentLike(regionDocument) ?? regionDocument;
  if (!document || typeof document !== "object") return Object.freeze([]);

  const rawShapes = [];
  for (const source of [
    document.shapes,
    document._source?.shapes,
    document.data?.shapes
  ]) {
    rawShapes.push(...iterateValues(source));
  }

  const records = rawShapes
    .map(normaliseShape)
    .filter(Boolean);

  if (records.length === 0) {
    const fallback = normaliseRectangle(document) ?? normaliseRectangle(document._source);
    if (fallback) records.push(fallback);
  }

  return Object.freeze(records.map(deepFreeze));
}

export function isPointInsideWebRegionRecord(
  region,
  x,
  y,
  options = null
) {
  if (!region || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
    return false;
  }

  const numericX =
    Number(
      x
    );

  const numericY =
    Number(
      y
    );

  const nativeResult =
    testNativeRegionContainment(
      region?.[
        WEB_REGION_NATIVE_DOCUMENT
      ],
      numericX,
      numericY,
      resolveContainmentElevation(
        options,
        region
      )
    );

  if (
    nativeResult !==
      null
  ) {
    return nativeResult;
  }

  return (Array.isArray(region.shapes) ? region.shapes : [])
    .some((shape) => isPointInsideShape(shape, numericX, numericY));
}

function normaliseShape(rawValue) {
  const raw = rawValue?.document ?? rawValue;
  if (!raw || typeof raw !== "object") return null;

  const source = typeof raw.toObject === "function"
    ? safelyToObject(raw) ?? raw
    : raw;

  const type = normaliseShapeType(
    source.type ?? source.shape?.type ?? source.kind ?? raw.constructor?.name,
    source
  );

  if (type === "polygon") return normalisePolygon(source);
  if (type === "ellipse") return normaliseEllipse(source);
  return normaliseRectangle(source);
}

function normaliseShapeType(value, source) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("polygon") || Array.isArray(source?.points)) return "polygon";
  if (text.includes("ellipse") || text.includes("circle") || source?.radiusX !== undefined || source?.radius !== undefined) return "ellipse";
  return "rectangle";
}

function normaliseRectangle(source) {
  if (!source || typeof source !== "object") return null;
  const x = firstFinite(source.x, source.bounds?.x, source.position?.x);
  const y = firstFinite(source.y, source.bounds?.y, source.position?.y);
  const width = firstFinite(source.width, source.w, source.bounds?.width);
  const height = firstFinite(source.height, source.h, source.bounds?.height);
  if ([x, y, width, height].some((value) => value === null)) return null;

  return {
    type: "rectangle",
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    rotation: firstFinite(source.rotation, source.angle) ?? 0
  };
}

function normaliseEllipse(source) {
  if (!source || typeof source !== "object") return null;
  const x = firstFinite(source.x, source.bounds?.x, source.position?.x);
  const y = firstFinite(source.y, source.bounds?.y, source.position?.y);
  const radiusX = firstFinite(
    source.radiusX,
    source.radius,
    source.width !== undefined ? Number(source.width) / 2 : null,
    source.bounds?.width !== undefined ? Number(source.bounds.width) / 2 : null
  );
  const radiusY = firstFinite(
    source.radiusY,
    source.radius,
    source.height !== undefined ? Number(source.height) / 2 : null,
    source.bounds?.height !== undefined ? Number(source.bounds.height) / 2 : null
  );
  if ([x, y, radiusX, radiusY].some((value) => value === null)) return null;

  const centreMode = source.radiusX !== undefined || source.radiusY !== undefined || source.radius !== undefined;
  return {
    type: "ellipse",
    centreX: centreMode ? x : x + radiusX,
    centreY: centreMode ? y : y + radiusY,
    radiusX: Math.abs(radiusX),
    radiusY: Math.abs(radiusY),
    rotation: firstFinite(source.rotation, source.angle) ?? 0
  };
}

function normalisePolygon(source) {
  const values = Array.isArray(source?.points) ? source.points : [];
  const offsetX = firstFinite(source.x, source.position?.x) ?? 0;
  const offsetY = firstFinite(source.y, source.position?.y) ?? 0;
  const points = [];

  if (values.length > 0 && typeof values[0] === "object") {
    for (const point of values) {
      const x = firstFinite(point?.x, point?.[0]);
      const y = firstFinite(point?.y, point?.[1]);
      if (x !== null && y !== null) points.push({ x: x + offsetX, y: y + offsetY });
    }
  } else {
    for (let index = 0; index + 1 < values.length; index += 2) {
      const x = firstFinite(values[index]);
      const y = firstFinite(values[index + 1]);
      if (x !== null && y !== null) points.push({ x: x + offsetX, y: y + offsetY });
    }
  }

  if (points.length < 3) return null;
  return { type: "polygon", points };
}

function isPointInsideShape(shape, x, y) {
  if (shape?.type === "polygon") return isPointInsidePolygon(shape.points, x, y);

  if (shape?.type === "ellipse") {
    const point = unrotatePoint(x, y, shape.centreX, shape.centreY, shape.rotation);
    if (shape.radiusX <= 0 || shape.radiusY <= 0) return false;
    const dx = (point.x - shape.centreX) / shape.radiusX;
    const dy = (point.y - shape.centreY) / shape.radiusY;
    return dx * dx + dy * dy <= 1;
  }

  if (shape?.type === "rectangle") {
    const centreX = shape.x + shape.width / 2;
    const centreY = shape.y + shape.height / 2;
    const point = unrotatePoint(x, y, centreX, centreY, shape.rotation);
    return point.x >= shape.x && point.x <= shape.x + shape.width &&
      point.y >= shape.y && point.y <= shape.y + shape.height;
  }

  return false;
}

function isPointInsidePolygon(points, x, y) {
  for (let index = 0; index < points.length; index += 1) {
    const first = points[index];
    const second = points[(index + 1) % points.length];
    if (isPointOnSegment({ x, y }, first, second)) return true;
  }

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const first = points[i];
    const second = points[j];
    const intersects = ((first.y > y) !== (second.y > y)) &&
      (x < (second.x - first.x) * (y - first.y) / ((second.y - first.y) || Number.EPSILON) + first.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function unrotatePoint(x, y, centreX, centreY, rotationDegrees) {
  const radians = -(Number(rotationDegrees) || 0) * Math.PI / 180;
  if (radians === 0) return { x, y };
  const dx = x - centreX;
  const dy = y - centreY;
  return {
    x: centreX + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: centreY + dx * Math.sin(radians) + dy * Math.cos(radians)
  };
}


/**
 * Determine whether every segment of one polyline remains inside the union of
 * the supplied Region records. Region boundaries are treated as inside.
 *
 * @param {readonly object[]} regions - Compatible Region records.
 * @param {readonly object[]} points - Polyline points.
 * @returns {boolean} True when the complete polyline is covered.
 */
export function isPolylineFullyInsideWebRegionRecords(
  regions,
  points,
  options = null
) {
  const safeRegions = Array.isArray(regions) ? regions : [];
  const safePoints = normalisePolylinePoints(points);

  if (safeRegions.length === 0 || safePoints.length === 0) return false;
  if (safePoints.length === 1) {
    return safeRegions.some((region) =>
      isPointInsideWebRegionRecord(
        region,
        safePoints[0].x,
        safePoints[0].y,
        options
      )
    );
  }

  const useNativeSampling =
    safeRegions.some(
      hasNativeRegionContainment
    );

  for (let index = 0; index + 1 < safePoints.length; index += 1) {
    const covered =
      useNativeSampling
        ? isSegmentCoveredByRegionUnionSampling(
            safeRegions,
            safePoints[index],
            safePoints[index + 1],
            options
          )
        : isSegmentFullyCoveredByRegionUnion(
            safeRegions,
            safePoints[index],
            safePoints[index + 1]
          );

    if (!covered) {
      return false;
    }
  }

  return true;
}

/** Determine whether a polyline touches or crosses any supplied Region. */
export function doesPolylineIntersectWebRegionRecords(
  regions,
  points,
  options = null
) {
  const safeRegions = Array.isArray(regions) ? regions : [];
  const safePoints = normalisePolylinePoints(points);

  if (safeRegions.length === 0 || safePoints.length === 0) return false;

  return safeRegions.some((region) =>
    doesPolylineIntersectWebRegionRecord(
      region,
      safePoints,
      options
    )
  );
}

/** Determine whether a polyline touches or crosses one Region record. */
export function doesPolylineIntersectWebRegionRecord(
  region,
  points,
  options = null
) {
  const safePoints = normalisePolylinePoints(points);
  const shapes = Array.isArray(region?.shapes) ? region.shapes : [];
  const hasNative =
    hasNativeRegionContainment(
      region
    );

  if (
    safePoints.length ===
      0 ||
    (
      shapes.length ===
        0 &&
      !hasNative
    )
  ) {
    return false;
  }

  if (safePoints.length === 1) {
    return isPointInsideWebRegionRecord(
      region,
      safePoints[0].x,
      safePoints[0].y,
      options
    );
  }

  for (let index = 0; index + 1 < safePoints.length; index += 1) {
    const start = safePoints[index];
    const end = safePoints[index + 1];

    if (hasNative) {
      if (
        doesSegmentEnterRegionSampling(
          region,
          start,
          end,
          options
        )
      ) {
        return true;
      }

      /**
       * Native Region containment is authoritative. A serialised shape can be
       * stale, transformed, or expressed in document-local coordinates under
       * Levels. Falling through to it after an authoritative false result can
       * incorrectly turn the entire Scene into an Exclude Region.
       */
      continue;
    }

    if (
      shapes.some(
        (
          shape
        ) =>
          segmentIntersectsShape(
            shape,
            start,
            end
          )
      )
    ) {
      return true;
    }
  }

  return false;
}

function hasNativeRegionContainment(
  region
) {
  const document =
    region?.[
      WEB_REGION_NATIVE_DOCUMENT
    ];

  return Boolean(
    document &&
    (
      typeof document.testPoint ===
        "function" ||
      typeof document.containsPoint ===
        "function" ||
      typeof document.contains ===
        "function"
    )
  );
}

function isSegmentCoveredByRegionUnionSampling(
  regions,
  start,
  end,
  options
) {
  for (
    const point of
    sampleSegmentPoints(
      start,
      end
    )
  ) {
    if (
      !regions.some(
        (
          region
        ) =>
          isPointInsideWebRegionRecord(
            region,
            point.x,
            point.y,
            options
          )
      )
    ) {
      return false;
    }
  }

  return true;
}

function doesSegmentEnterRegionSampling(
  region,
  start,
  end,
  options
) {
  return sampleSegmentPoints(
    start,
    end
  ).some(
    (
      point
    ) =>
      isPointInsideWebRegionRecord(
        region,
        point.x,
        point.y,
        options
      )
  );
}

function sampleSegmentPoints(
  start,
  end
) {
  const length =
    Math.hypot(
      end.x -
        start.x,
      end.y -
        start.y
    );

  const steps =
    Math.max(
      1,
      Math.min(
        4096,
        Math.ceil(
          length /
          REGION_NATIVE_SAMPLE_SPACING_PX
        )
      )
    );

  return Array.from(
    {
      length:
        steps +
        1
    },
    (
      _entry,
      index
    ) =>
      interpolateSegment(
        start,
        end,
        index /
          steps
      )
  );
}

function resolveContainmentElevation(
  options,
  region
) {
  const direct =
    firstFinite(
      typeof options ===
        "number" ||
      typeof options ===
        "string"
        ? options
        : null,
      options?.elevation,
      options?.pointElevation,
      options?.z
    );

  if (
    direct !==
      null
  ) {
    return direct;
  }

  const band =
    options?.elevationBand ??
    options?.level?.elevationBand ??
    region?.elevationBand ??
    null;

  return firstFinite(
    band?.bottom,
    band?.top
  );
}

function testNativeRegionContainment(
  document,
  x,
  y,
  elevation
) {
  if (
    !document ||
    typeof document !==
      "object"
  ) {
    return null;
  }

  const pointCandidates =
    createNativePointCandidates(
      x,
      y,
      elevation
    );

  let answeredFalse =
    false;

  for (
    const methodName of
    [
      "testPoint",
      "containsPoint",
      "contains"
    ]
  ) {
    const method =
      document?.[
        methodName
      ];

    if (
      typeof method !==
        "function"
    ) {
      continue;
    }

    const argumentSets =
      [];

    for (
      const point of
      pointCandidates
    ) {
      if (
        elevation !==
          null
      ) {
        argumentSets.push([
          point,
          elevation
        ]);
      }

      argumentSets.push([
        point
      ]);
    }

    if (
      methodName !==
        "testPoint"
    ) {
      argumentSets.push([
        x,
        y
      ]);
    }

    if (
      elevation !==
        null
    ) {
      argumentSets.push([
        x,
        y,
        elevation
      ]);
    }

    for (
      const args of
      argumentSets
    ) {
      try {
        const result =
          method.call(
            document,
            ...args
          );

        if (
          result ===
            true
        ) {
          return true;
        }

        if (
          result ===
            false
        ) {
          answeredFalse =
            true;
        }
      } catch (_error) {
        // Continue through the supported v13/v14 call shapes.
      }
    }
  }

  return answeredFalse
    ? false
    : null;
}

function createNativePointCandidates(
  x,
  y,
  elevation
) {
  const points =
    [];

  const Point =
    globalThis.PIXI?.Point;

  if (
    typeof Point ===
      "function"
  ) {
    try {
      const point =
        new Point(
          x,
          y
        );

      if (
        elevation !==
          null
      ) {
        point.elevation =
          elevation;
      }

      points.push(
        point
      );
    } catch (_error) {
      // Fall through to the plain point below.
    }
  }

  points.push(
    elevation ===
      null
      ? {
          x,
          y
        }
      : {
          x,
          y,
          elevation
        }
  );

  return points;
}

function isSegmentFullyCoveredByRegionUnion(
  regions,
  start,
  end
) {
  if (pointsEqual(start, end)) {
    return regions.some((region) =>
      isPointInsideWebRegionRecord(region, start.x, start.y)
    );
  }

  const intervals = [];
  for (const region of regions) {
    for (const shape of Array.isArray(region?.shapes) ? region.shapes : []) {
      intervals.push(...resolveSegmentShapeIntervals(shape, start, end));
    }
  }

  const merged = mergeIntervals(intervals);
  if (merged.length === 0 || merged[0].start > GEOMETRY_EPSILON) return false;

  let coveredUntil = merged[0].end;
  for (let index = 1; index < merged.length; index += 1) {
    const interval = merged[index];
    if (interval.start > coveredUntil + GEOMETRY_EPSILON) return false;
    coveredUntil = Math.max(coveredUntil, interval.end);
  }

  return coveredUntil >= 1 - GEOMETRY_EPSILON;
}

function segmentIntersectsShape(shape, start, end) {
  if (shape?.type === "polygon") {
    if (isPointInsideShape(shape, start.x, start.y) ||
        isPointInsideShape(shape, end.x, end.y)) return true;

    const points = Array.isArray(shape.points) ? shape.points : [];
    for (let index = 0; index < points.length; index += 1) {
      if (segmentsIntersect(
        start,
        end,
        points[index],
        points[(index + 1) % points.length]
      )) return true;
    }
    return false;
  }

  return resolveSegmentShapeIntervals(shape, start, end).length > 0;
}

function resolveSegmentShapeIntervals(shape, start, end) {
  if (shape?.type === "rectangle") {
    const centreX = shape.x + shape.width / 2;
    const centreY = shape.y + shape.height / 2;
    return resolveAxisAlignedRectangleInterval(
      unrotatePoint(start.x, start.y, centreX, centreY, shape.rotation),
      unrotatePoint(end.x, end.y, centreX, centreY, shape.rotation),
      shape.x,
      shape.y,
      shape.x + shape.width,
      shape.y + shape.height
    );
  }

  if (shape?.type === "ellipse") {
    const localStart = unrotatePoint(
      start.x, start.y, shape.centreX, shape.centreY, shape.rotation
    );
    const localEnd = unrotatePoint(
      end.x, end.y, shape.centreX, shape.centreY, shape.rotation
    );
    return resolveEllipseInterval(shape, localStart, localEnd);
  }

  if (shape?.type === "polygon") {
    return resolvePolygonIntervals(shape.points, start, end);
  }

  return [];
}

function resolveAxisAlignedRectangleInterval(start, end, left, top, right, bottom) {
  let minimum = 0;
  let maximum = 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  for (const [p, q] of [
    [-dx, start.x - left],
    [dx, right - start.x],
    [-dy, start.y - top],
    [dy, bottom - start.y]
  ]) {
    if (Math.abs(p) <= GEOMETRY_EPSILON) {
      if (q < -GEOMETRY_EPSILON) return [];
      continue;
    }

    const ratio = q / p;
    if (p < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum + GEOMETRY_EPSILON) return [];
  }

  return [{ start: clampUnit(minimum), end: clampUnit(maximum) }];
}

function resolveEllipseInterval(shape, start, end) {
  if (shape.radiusX <= 0 || shape.radiusY <= 0) return [];

  const startX = (start.x - shape.centreX) / shape.radiusX;
  const startY = (start.y - shape.centreY) / shape.radiusY;
  const deltaX = (end.x - start.x) / shape.radiusX;
  const deltaY = (end.y - start.y) / shape.radiusY;
  const a = deltaX * deltaX + deltaY * deltaY;
  const b = 2 * (startX * deltaX + startY * deltaY);
  const c = startX * startX + startY * startY - 1;

  if (a <= GEOMETRY_EPSILON) return c <= GEOMETRY_EPSILON
    ? [{ start: 0, end: 1 }]
    : [];

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -GEOMETRY_EPSILON) return c <= 0
    ? [{ start: 0, end: 1 }]
    : [];

  const root = Math.sqrt(Math.max(0, discriminant));
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const minimum = Math.max(0, Math.min(first, second));
  const maximum = Math.min(1, Math.max(first, second));

  return minimum <= maximum + GEOMETRY_EPSILON
    ? [{ start: clampUnit(minimum), end: clampUnit(maximum) }]
    : [];
}

function resolvePolygonIntervals(points, start, end) {
  if (!Array.isArray(points) || points.length < 3) return [];

  const parameters = [0, 1];
  for (let index = 0; index < points.length; index += 1) {
    parameters.push(...resolveSegmentIntersectionParameters(
      start,
      end,
      points[index],
      points[(index + 1) % points.length]
    ));
  }

  const sorted = uniqueSortedParameters(parameters);
  const intervals = [];

  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const intervalStart = sorted[index];
    const intervalEnd = sorted[index + 1];
    const midpoint = interpolateSegment(start, end, (intervalStart + intervalEnd) / 2);
    if (isPointInsidePolygon(points, midpoint.x, midpoint.y)) {
      intervals.push({ start: intervalStart, end: intervalEnd });
    }
  }

  return mergeIntervals(intervals);
}

function resolveSegmentIntersectionParameters(start, end, edgeStart, edgeEnd) {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const edge = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
  const offset = { x: edgeStart.x - start.x, y: edgeStart.y - start.y };
  const denominator = crossVectors(segment, edge);

  if (Math.abs(denominator) > GEOMETRY_EPSILON) {
    const t = crossVectors(offset, edge) / denominator;
    const u = crossVectors(offset, segment) / denominator;
    return t >= -GEOMETRY_EPSILON && t <= 1 + GEOMETRY_EPSILON &&
      u >= -GEOMETRY_EPSILON && u <= 1 + GEOMETRY_EPSILON
      ? [clampUnit(t)]
      : [];
  }

  if (Math.abs(crossVectors(offset, segment)) > GEOMETRY_EPSILON) return [];

  const lengthSquared = segment.x * segment.x + segment.y * segment.y;
  if (lengthSquared <= GEOMETRY_EPSILON) return [];

  return [edgeStart, edgeEnd]
    .map((point) => ((point.x - start.x) * segment.x +
      (point.y - start.y) * segment.y) / lengthSquared)
    .filter((value) => value >= -GEOMETRY_EPSILON && value <= 1 + GEOMETRY_EPSILON)
    .map(clampUnit);
}

function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  if (resolveSegmentIntersectionParameters(
    firstStart, firstEnd, secondStart, secondEnd
  ).length > 0) return true;

  return isPointOnSegment(firstStart, secondStart, secondEnd) ||
    isPointOnSegment(firstEnd, secondStart, secondEnd) ||
    isPointOnSegment(secondStart, firstStart, firstEnd) ||
    isPointOnSegment(secondEnd, firstStart, firstEnd);
}

function isPointOnSegment(point, start, end) {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const offset = { x: point.x - start.x, y: point.y - start.y };
  if (Math.abs(crossVectors(segment, offset)) > GEOMETRY_EPSILON) return false;

  const dot = offset.x * segment.x + offset.y * segment.y;
  const lengthSquared = segment.x * segment.x + segment.y * segment.y;
  return dot >= -GEOMETRY_EPSILON && dot <= lengthSquared + GEOMETRY_EPSILON;
}

function mergeIntervals(intervals) {
  const safe = (Array.isArray(intervals) ? intervals : [])
    .map((interval) => ({
      start: clampUnit(Math.min(Number(interval?.start), Number(interval?.end))),
      end: clampUnit(Math.max(Number(interval?.start), Number(interval?.end)))
    }))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end))
    .sort((first, second) => first.start - second.start || first.end - second.end);

  const merged = [];
  for (const interval of safe) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end + GEOMETRY_EPSILON) {
      merged.push({ ...interval });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged;
}

function uniqueSortedParameters(values) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .map(clampUnit)
    .sort((first, second) => first - second);
  const unique = [];
  for (const value of sorted) {
    if (unique.length === 0 || Math.abs(value - unique.at(-1)) > GEOMETRY_EPSILON) {
      unique.push(value);
    }
  }
  return unique;
}

function normalisePolylinePoints(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function interpolateSegment(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };
}

function pointsEqual(first, second) {
  return Math.abs(first.x - second.x) <= GEOMETRY_EPSILON &&
    Math.abs(first.y - second.y) <= GEOMETRY_EPSILON;
}

function crossVectors(first, second) {
  return first.x * second.y - first.y * second.x;
}

function clampUnit(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

const GEOMETRY_EPSILON = 0.000001;

function iterateValues(collection) {
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (Array.isArray(collection)) return collection;
  if (collection && typeof collection.values === "function") return Array.from(collection.values());
  if (collection && typeof collection === "object") return Object.values(collection);
  return [];
}

function isRegionDocumentLike(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const name = String(value.documentName ?? value.constructor?.documentName ?? value.constructor?.name ?? "");
  return name === "Region" || name === "RegionDocument" ||
    value.shapes !== undefined || value._source?.shapes !== undefined;
}

function firstIdentifier(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }
  return null;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(number)) return number;
  }
  return null;
}

function finiteOrNull(value) {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(number)
    ? number
    : null;
}

function safelyToObject(value) {
  try {
    return value.toObject(false);
  } catch (_error) {
    try {
      return value.toObject();
    } catch (_nestedError) {
      return null;
    }
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
