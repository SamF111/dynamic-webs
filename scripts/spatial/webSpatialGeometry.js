const EPSILON = 0.000001;

/** Normalise one finite world-space point. */
export function normaliseSpatialPoint(value, label = "spatial point") {
  const x = Number(value?.x);
  const y = Number(value?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`Dynamic Webs | ${label} requires finite x and y coordinates.`);
  }

  return Object.freeze({ x, y });
}

/** Normalise one axis-aligned world-space bounds object. */
export function normaliseSpatialBounds(value, label = "spatial bounds") {
  const x = Number(value?.x ?? value?.left);
  const y = Number(value?.y ?? value?.top);
  const explicitRight = Number(value?.right);
  const explicitBottom = Number(value?.bottom);
  const width = Number(value?.width);
  const height = Number(value?.height);

  const right = Number.isFinite(explicitRight)
    ? explicitRight
    : Number.isFinite(width)
      ? x + width
      : Number.NaN;

  const bottom = Number.isFinite(explicitBottom)
    ? explicitBottom
    : Number.isFinite(height)
      ? y + height
      : Number.NaN;

  if (![x, y, right, bottom].every(Number.isFinite)) {
    throw new TypeError(`Dynamic Webs | ${label} requires finite x, y, width and height or right and bottom values.`);
  }

  const left = Math.min(x, right);
  const top = Math.min(y, bottom);
  const resolvedRight = Math.max(x, right);
  const resolvedBottom = Math.max(y, bottom);

  return Object.freeze({
    x: left,
    y: top,
    width: resolvedRight - left,
    height: resolvedBottom - top,
    right: resolvedRight,
    bottom: resolvedBottom
  });
}

/** Calculate immutable bounds for one polyline. */
export function calculatePolylineBounds(points, paddingPx = 0) {
  const safePoints = Array.isArray(points)
    ? points.map((point) => normaliseSpatialPoint(point, "polyline point"))
    : [];

  if (safePoints.length === 0) {
    throw new TypeError("Dynamic Webs | A spatial polyline requires at least one finite point.");
  }

  let minimumX = Number.POSITIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;

  for (const point of safePoints) {
    minimumX = Math.min(minimumX, point.x);
    minimumY = Math.min(minimumY, point.y);
    maximumX = Math.max(maximumX, point.x);
    maximumY = Math.max(maximumY, point.y);
  }

  return expandSpatialBounds({
    x: minimumX,
    y: minimumY,
    right: maximumX,
    bottom: maximumY
  }, paddingPx);
}

/** Expand bounds by one non-negative world-space padding. */
export function expandSpatialBounds(bounds, paddingPx = 0) {
  const safe = normaliseSpatialBounds(bounds);
  const padding = normaliseNonNegativeNumber(paddingPx, "bounds padding");

  return Object.freeze({
    x: safe.x - padding,
    y: safe.y - padding,
    width: safe.width + padding * 2,
    height: safe.height + padding * 2,
    right: safe.right + padding,
    bottom: safe.bottom + padding
  });
}

/** Return whether two axis-aligned bounds overlap or touch. */
export function spatialBoundsOverlap(first, second) {
  const a = normaliseSpatialBounds(first, "first spatial bounds");
  const b = normaliseSpatialBounds(second, "second spatial bounds");

  return a.x <= b.right + EPSILON &&
    b.x <= a.right + EPSILON &&
    a.y <= b.bottom + EPSILON &&
    b.y <= a.bottom + EPSILON;
}

/** Return the shortest distance from a point to an axis-aligned bounds object. */
export function pointToSpatialBoundsDistance(point, bounds) {
  const safePoint = normaliseSpatialPoint(point);
  const safeBounds = normaliseSpatialBounds(bounds);
  const dx = Math.max(safeBounds.x - safePoint.x, 0, safePoint.x - safeBounds.right);
  const dy = Math.max(safeBounds.y - safePoint.y, 0, safePoint.y - safeBounds.bottom);
  return Math.hypot(dx, dy);
}

/** Return the shortest distance from a point to one sampled polyline. */
export function pointToPolylineDistance(point, points) {
  const safePoint = normaliseSpatialPoint(point);
  const safePoints = Array.isArray(points)
    ? points.map((entry) => normaliseSpatialPoint(entry, "polyline point"))
    : [];

  if (safePoints.length === 0) return Number.POSITIVE_INFINITY;
  if (safePoints.length === 1) {
    return Math.hypot(safePoint.x - safePoints[0].x, safePoint.y - safePoints[0].y);
  }

  let distance = Number.POSITIVE_INFINITY;

  for (let index = 0; index + 1 < safePoints.length; index += 1) {
    distance = Math.min(
      distance,
      pointToSegmentDistance(safePoint, safePoints[index], safePoints[index + 1])
    );
  }

  return distance;
}

/** Return stable spatial-hash cell keys touched by bounds. */
export function createSpatialCellKeys(bounds, cellSizePx) {
  const safeBounds = normaliseSpatialBounds(bounds);
  const cellSize = normalisePositiveNumber(cellSizePx, "spatial cell size");
  const minimumCellX = Math.floor(safeBounds.x / cellSize);
  const maximumCellX = Math.floor(safeBounds.right / cellSize);
  const minimumCellY = Math.floor(safeBounds.y / cellSize);
  const maximumCellY = Math.floor(safeBounds.bottom / cellSize);
  const keys = [];

  for (let cellY = minimumCellY; cellY <= maximumCellY; cellY += 1) {
    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      keys.push(`${cellX}:${cellY}`);
    }
  }

  return Object.freeze(keys);
}

/** Return whether two optional elevation bands overlap. */
export function spatialElevationBandsOverlap(first, second) {
  const firstBottom = optionalFinite(first?.bottom) ?? Number.NEGATIVE_INFINITY;
  const firstTop = optionalFinite(first?.top) ?? Number.POSITIVE_INFINITY;
  const secondBottom = optionalFinite(second?.bottom) ?? Number.NEGATIVE_INFINITY;
  const secondTop = optionalFinite(second?.top) ?? Number.POSITIVE_INFINITY;
  return firstBottom <= secondTop && secondBottom <= firstTop;
}

/** Return whether one optional elevation band contains a point elevation. */
export function spatialElevationBandContains(band, elevation) {
  const value = Number(elevation);
  if (!Number.isFinite(value)) return false;
  const bottom = optionalFinite(band?.bottom) ?? Number.NEGATIVE_INFINITY;
  const top = optionalFinite(band?.top) ?? Number.POSITIVE_INFINITY;
  return value >= bottom && value <= top;
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= EPSILON) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const parameter = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  ));

  const closestX = start.x + dx * parameter;
  const closestY = start.y + dy * parameter;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function normaliseNonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`Dynamic Webs | ${label} must be a non-negative finite number.`);
  }
  return number;
}

function normalisePositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new TypeError(`Dynamic Webs | ${label} must be a positive finite number.`);
  }
  return number;
}

function optionalFinite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
