/** Generic geometry helpers shared by deterministic web generators. */

export const WEB_STRAND_KINDS =
  Object.freeze({
    STRUCTURAL:
      "structural",
    CAPTURE:
      "capture",
    DECORATIVE:
      "decorative"
  });

const STRAND_VISUAL_RANGES =
  Object.freeze({
    [WEB_STRAND_KINDS.STRUCTURAL]:
      Object.freeze({
        minimumAlpha: 0.58,
        maximumAlpha: 0.78,
        minimumWidthPx: 1.0,
        maximumWidthPx: 1.4,
        collisionWidthPx: 2.25
      }),
    [WEB_STRAND_KINDS.CAPTURE]:
      Object.freeze({
        minimumAlpha: 0.28,
        maximumAlpha: 0.52,
        minimumWidthPx: 0.65,
        maximumWidthPx: 1.0,
        collisionWidthPx: 2
      }),
    [WEB_STRAND_KINDS.DECORATIVE]:
      Object.freeze({
        minimumAlpha: 0.16,
        maximumAlpha: 0.36,
        minimumWidthPx: 0.5,
        maximumWidthPx: 0.8,
        collisionWidthPx: 1.5
      })
  });

export function createWebStrand({
  id,
  kind,
  points,
  random,
  alphaMultiplier = 1
}) {
  const range =
    STRAND_VISUAL_RANGES[kind] ??
    STRAND_VISUAL_RANGES[WEB_STRAND_KINDS.CAPTURE];

  const safePoints =
    Array.isArray(points)
      ? points
          .filter(isFinitePoint)
          .map((point) => Object.freeze({
            x: Number(point.x),
            y: Number(point.y)
          }))
      : [];

  if (safePoints.length < 2) return null;

  const randomNumber =
    typeof random === "function"
      ? random
      : Math.random;

  return Object.freeze({
    id:
      String(id),
    kind:
      kind ?? WEB_STRAND_KINDS.CAPTURE,
    points:
      Object.freeze(safePoints),
    alpha:
      clamp(
        randomBetween(randomNumber, range.minimumAlpha, range.maximumAlpha) *
          alphaMultiplier,
        0.05,
        1
      ),
    widthPx:
      randomBetween(randomNumber, range.minimumWidthPx, range.maximumWidthPx),
    collisionWidthPx:
      range.collisionWidthPx
  });
}

export function createWebBlueprint({
  id,
  kind,
  hub,
  strands,
  perches = [],
  supportingWallIds = []
}) {
  const safeStrands =
    Object.freeze(
      (Array.isArray(strands) ? strands : [])
        .filter(Boolean)
    );

  const safeHub =
    Object.freeze({
      x: Number(hub?.x ?? 0),
      y: Number(hub?.y ?? 0)
    });

  const safePerches =
    Object.freeze(
      (Array.isArray(perches) ? perches : [])
        .filter((perch) => isFinitePoint(perch))
        .map((perch) => Object.freeze({
          id: String(perch.id),
          x: Number(perch.x),
          y: Number(perch.y),
          rotation: Number.isFinite(Number(perch.rotation))
            ? Number(perch.rotation)
            : 0
        }))
    );

  return Object.freeze({
    id:
      String(id),
    kind:
      String(kind),
    hub:
      safeHub,
    bounds:
      Object.freeze(calculatePointBounds([
        safeHub,
        ...safeStrands.flatMap((strand) => strand.points)
      ])),
    strands:
      safeStrands,
    perches:
      safePerches,
    supportingWallIds:
      Object.freeze(
        [...new Set(
          supportingWallIds
            .filter((wallId) => wallId !== null && wallId !== undefined)
            .map(String)
        )]
      )
  });
}

export function sampleQuadraticBezier(start, control, end, steps = 8) {
  const points = [];
  const safeSteps = Math.max(1, Math.trunc(Number(steps) || 1));

  for (let index = 0; index <= safeSteps; index += 1) {
    const t = index / safeSteps;
    const inverse = 1 - t;
    points.push({
      x:
        inverse * inverse * start.x +
        2 * inverse * t * control.x +
        t * t * end.x,
      y:
        inverse * inverse * start.y +
        2 * inverse * t * control.y +
        t * t * end.y
    });
  }

  return points;
}

export function lerpPoint(start, end, t) {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t
  };
}

export function addScaled(point, direction, length) {
  return {
    x: point.x + direction.x * length,
    y: point.y + direction.y * length
  };
}

export function normaliseVector(vector) {
  const length = Math.hypot(Number(vector?.x), Number(vector?.y));
  if (!Number.isFinite(length) || length <= 0.000001) return { x: 0, y: 0 };
  return {
    x: Number(vector.x) / length,
    y: Number(vector.y) / length
  };
}

export function randomBetween(random, minimum, maximum) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return 0;
  if (maximum <= minimum) return minimum;
  return minimum + random() * (maximum - minimum);
}

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function calculatePointBounds(points) {
  const safePoints = (Array.isArray(points) ? points : []).filter(isFinitePoint);
  if (safePoints.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  const xs = safePoints.map((point) => Number(point.x));
  const ys = safePoints.map((point) => Number(point.y));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    right,
    bottom
  };
}

function isFinitePoint(point) {
  return Boolean(
    point &&
    Number.isFinite(Number(point.x)) &&
    Number.isFinite(Number(point.y))
  );
}

