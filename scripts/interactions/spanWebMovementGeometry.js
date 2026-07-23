const EPSILON =
  0.000001;

export function createSweptMovementBounds({
  from,
  to,
  collisionRadiusPx = 0
}) {
  const start =
    requirePoint(
      from,
      "movement start"
    );

  const end =
    requirePoint(
      to,
      "movement end"
    );

  const radius =
    requireNonNegativeNumber(
      collisionRadiusPx,
      "movement collision radius"
    );

  const minimumX =
    Math.min(
      start.x,
      end.x
    ) -
    radius;

  const minimumY =
    Math.min(
      start.y,
      end.y
    ) -
    radius;

  const maximumX =
    Math.max(
      start.x,
      end.x
    ) +
    radius;

  const maximumY =
    Math.max(
      start.y,
      end.y
    ) +
    radius;

  return Object.freeze({
    x:
      minimumX,
    y:
      minimumY,
    width:
      maximumX -
      minimumX,
    height:
      maximumY -
      minimumY,
    right:
      maximumX,
    bottom:
      maximumY
  });
}

export function sweptMovementIntersectsPolyline({
  from,
  to,
  collisionRadiusPx = 0,
  points,
  interactionWidthPx = 0
}) {
  const start =
    requirePoint(
      from,
      "movement start"
    );

  const end =
    requirePoint(
      to,
      "movement end"
    );

  const safePoints =
    Array.isArray(
      points
    )
      ? points.map(
          (
            point
          ) =>
            requirePoint(
              point,
              "span strand point"
            )
        )
      : [];

  if (
    safePoints.length <
      2
  ) {
    return false;
  }

  const threshold =
    requireNonNegativeNumber(
      collisionRadiusPx,
      "movement collision radius"
    ) +
    requireNonNegativeNumber(
      interactionWidthPx,
      "strand interaction width"
    ) /
    2;

  for (
    let index = 0;
    index +
      1 <
      safePoints.length;
    index +=
      1
  ) {
    const distance =
      segmentToSegmentDistance(
        start,
        end,
        safePoints[index],
        safePoints[
          index +
          1
        ]
      );

    if (
      distance <=
        threshold +
        EPSILON
    ) {
      return true;
    }
  }

  return false;
}

export function segmentToSegmentDistance(
  firstStart,
  firstEnd,
  secondStart,
  secondEnd
) {
  const a =
    requirePoint(
      firstStart,
      "first segment start"
    );

  const b =
    requirePoint(
      firstEnd,
      "first segment end"
    );

  const c =
    requirePoint(
      secondStart,
      "second segment start"
    );

  const d =
    requirePoint(
      secondEnd,
      "second segment end"
    );

  if (
    segmentsIntersect(
      a,
      b,
      c,
      d
    )
  ) {
    return 0;
  }

  return Math.min(
    pointToSegmentDistance(
      a,
      c,
      d
    ),
    pointToSegmentDistance(
      b,
      c,
      d
    ),
    pointToSegmentDistance(
      c,
      a,
      b
    ),
    pointToSegmentDistance(
      d,
      a,
      b
    )
  );
}

function segmentsIntersect(
  a,
  b,
  c,
  d
) {
  const orientationA =
    orientation(
      a,
      b,
      c
    );

  const orientationB =
    orientation(
      a,
      b,
      d
    );

  const orientationC =
    orientation(
      c,
      d,
      a
    );

  const orientationD =
    orientation(
      c,
      d,
      b
    );

  if (
    orientationA *
      orientationB <
      0 &&
    orientationC *
      orientationD <
      0
  ) {
    return true;
  }

  return (
    Math.abs(
      orientationA
    ) <=
      EPSILON &&
    pointOnSegment(
      c,
      a,
      b
    )
  ) ||
    (
      Math.abs(
        orientationB
      ) <=
        EPSILON &&
      pointOnSegment(
        d,
        a,
        b
      )
    ) ||
    (
      Math.abs(
        orientationC
      ) <=
        EPSILON &&
      pointOnSegment(
        a,
        c,
        d
      )
    ) ||
    (
      Math.abs(
        orientationD
      ) <=
        EPSILON &&
      pointOnSegment(
        b,
        c,
        d
      )
    );
}

function orientation(
  a,
  b,
  c
) {
  return (
    b.x -
    a.x
  ) *
    (
      c.y -
      a.y
    ) -
    (
      b.y -
      a.y
    ) *
    (
      c.x -
      a.x
    );
}

function pointOnSegment(
  point,
  start,
  end
) {
  return point.x >=
      Math.min(
        start.x,
        end.x
      ) -
        EPSILON &&
    point.x <=
      Math.max(
        start.x,
        end.x
      ) +
        EPSILON &&
    point.y >=
      Math.min(
        start.y,
        end.y
      ) -
        EPSILON &&
    point.y <=
      Math.max(
        start.y,
        end.y
      ) +
        EPSILON;
}

function pointToSegmentDistance(
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
      EPSILON
  ) {
    return Math.hypot(
      point.x -
        start.x,
      point.y -
        start.y
    );
  }

  const parameter =
    Math.max(
      0,
      Math.min(
        1,
        (
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
          lengthSquared
      )
    );

  return Math.hypot(
    point.x -
      (
        start.x +
        dx *
          parameter
      ),
    point.y -
      (
        start.y +
        dy *
          parameter
      )
  );
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
      `Dynamic Webs | ${label} requires finite x and y coordinates.`
    );
  }

  return {
    x,
    y
  };
}

function requireNonNegativeNumber(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <
      0
  ) {
    throw new TypeError(
      `Dynamic Webs | ${label} must be a non-negative finite number.`
    );
  }

  return number;
}
