import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

const QUAD_POINT_NAMES =
  Object.freeze([
    "firstWallStart",
    "firstWallEnd",
    "secondWallEnd",
    "secondWallStart"
  ]);

/**
 * Resolve the source UV quad and target world-space quad used by the span mesh.
 */
export function createWebSpanAssetQuadMapping(
  presentation
) {
  const source =
    requireQuad(
      presentation?.source,
      "span asset source"
    );

  const target =
    requireQuad(
      presentation?.target,
      "span asset target"
    );

  assertNonDegenerateQuad(
    source,
    "span asset source"
  );

  assertNonDegenerateQuad(
    target,
    "span asset target"
  );

  return Object.freeze({
    source,
    target,
    vertices:
      Object.freeze(
        QUAD_POINT_NAMES.map(
          (
            name
          ) =>
            target[name]
        )
      ),
    uvs:
      Object.freeze(
        QUAD_POINT_NAMES.map(
          (
            name
          ) =>
            source[name]
        )
      ),
    indices:
      Object.freeze([
        0,
        1,
        2,
        0,
        2,
        3
      ])
  });
}

/**
 * Bilinearly map an authored texture point through the four-anchor target.
 * This is diagnostic geometry; runtime rendering uses two affine triangles.
 */
export function transformWebSpanAssetPoint(
  presentation,
  point
) {
  const mapping =
    createWebSpanAssetQuadMapping(
      presentation
    );

  const value =
    requirePoint(
      point,
      "span asset point"
    );

  const sourceStart =
    mapping.source.firstWallStart;

  const sourceEnd =
    mapping.source.firstWallEnd;

  const sourceSecondStart =
    mapping.source.secondWallStart;

  const sourceWidth =
    Math.hypot(
      sourceEnd.x -
        sourceStart.x,
      sourceEnd.y -
        sourceStart.y
    );

  const sourceHeight =
    Math.hypot(
      sourceSecondStart.x -
        sourceStart.x,
      sourceSecondStart.y -
        sourceStart.y
    );

  if (
    sourceWidth <=
      0 ||
    sourceHeight <=
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | Span asset source quad cannot be transformed.`
    );
  }

  const u =
    clamp(
      projectFraction(
        value,
        sourceStart,
        sourceEnd
      ),
      0,
      1
    );

  const v =
    clamp(
      projectFraction(
        value,
        sourceStart,
        sourceSecondStart
      ),
      0,
      1
    );

  const firstEdge =
    lerpPoint(
      mapping.target.firstWallStart,
      mapping.target.firstWallEnd,
      u
    );

  const secondEdge =
    lerpPoint(
      mapping.target.secondWallStart,
      mapping.target.secondWallEnd,
      u
    );

  return Object.freeze(
    lerpPoint(
      firstEdge,
      secondEdge,
      v
    )
  );
}

function requireQuad(
  value,
  label
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be an object.`
    );
  }

  return Object.freeze({
    firstWallStart:
      requirePoint(
        value.firstWallStart,
        `${label} firstWallStart`
      ),
    firstWallEnd:
      requirePoint(
        value.firstWallEnd,
        `${label} firstWallEnd`
      ),
    secondWallStart:
      requirePoint(
        value.secondWallStart,
        `${label} secondWallStart`
      ),
    secondWallEnd:
      requirePoint(
        value.secondWallEnd,
        `${label} secondWallEnd`
      )
  });
}

function assertNonDegenerateQuad(
  quad,
  label
) {
  const firstArea =
    triangleArea(
      quad.firstWallStart,
      quad.firstWallEnd,
      quad.secondWallEnd
    );

  const secondArea =
    triangleArea(
      quad.firstWallStart,
      quad.secondWallEnd,
      quad.secondWallStart
    );

  if (
    Math.abs(
      firstArea
    ) <
      0.000000001 ||
    Math.abs(
      secondArea
    ) <
      0.000000001 ||
    firstArea *
      secondArea <=
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${label} quadrilateral is degenerate.`
    );
  }
}

function triangleArea(
  first,
  second,
  third
) {
  return (
    (
      second.x -
      first.x
    ) *
    (
      third.y -
      first.y
    ) -
    (
      second.y -
      first.y
    ) *
    (
      third.x -
      first.x
    )
  ) /
    2;
}

function projectFraction(
  point,
  start,
  end
) {
  const dx =
    end.x -
    start.x;

  const dy =
    end.y -
    start.y;

  const lengthSquared =
    dx *
      dx +
    dy *
      dy;

  if (
    lengthSquared <=
      0
  ) {
    return 0;
  }

  return (
    (
      point.x -
      start.x
    ) *
      dx +
    (
      point.y -
      start.y
    ) *
      dy
  ) /
    lengthSquared;
}

function lerpPoint(
  first,
  second,
  amount
) {
  return {
    x:
      first.x +
      (
        second.x -
        first.x
      ) *
      amount,
    y:
      first.y +
      (
        second.y -
        first.y
      ) *
      amount
  };
}

function requirePoint(
  value,
  label
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
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must contain finite x and y values.`
    );
  }

  return Object.freeze({
    x,
    y
  });
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
