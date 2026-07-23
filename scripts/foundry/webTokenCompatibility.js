/** Resolve one immutable movement snapshot from a TokenDocument/placeable. */
export function createWebTokenMovementSnapshot({
  token,
  scene = globalThis.canvas?.scene,
  levels = []
}) {
  const document =
    token?.document ??
    token;

  const tokenId =
    normaliseIdentifier(
      document?.id ??
      document?._id ??
      token?.id
    );

  const sceneId =
    normaliseIdentifier(
      document?.parent?.id ??
      document?.scene?.id ??
      scene?.id
    );

  const x =
    finiteOr(
      document?.x ??
      document?._source?.x,
      0
    );

  const y =
    finiteOr(
      document?.y ??
      document?._source?.y,
      0
    );

  const gridSize =
    resolveGridSize(
      scene
    );

  const widthGrid =
    Math.max(
      0.01,
      finiteOr(
        document?.width ??
        document?._source?.width,
        1
      )
    );

  const heightGrid =
    Math.max(
      0.01,
      finiteOr(
        document?.height ??
        document?._source?.height,
        1
      )
    );

  const widthPx =
    widthGrid *
    gridSize;

  const heightPx =
    heightGrid *
    gridSize;

  const elevation =
    finiteOrNull(
      document?.elevation ??
      document?._source?.elevation
    );

  const levelId =
    resolveTokenWebLevelId({
      document,
      elevation,
      levels
    });

  return Object.freeze({
    tokenId,
    sceneId,
    x,
    y,
    centre:
      Object.freeze({
        x:
          x +
          widthPx /
          2,
        y:
          y +
          heightPx /
          2
      }),
    widthPx,
    heightPx,
    collisionRadiusPx:
      Math.max(
        1,
        Math.min(
          widthPx,
          heightPx
        ) /
        2
      ),
    elevation,
    levelId
  });
}

export function resolveTokenWebLevelId({
  document,
  elevation = null,
  levels = []
}) {
  const directId =
    firstIdentifier(
      document?.level?.id,
      document?.levelId,
      document?._source?.levelId,
      document?.flags?.levels?.levelId,
      document?._source?.flags?.levels?.levelId,
      document?.flags?.levels?.id,
      document?._source?.flags?.levels?.id
    );

  const availableLevels =
    Array.isArray(
      levels
    )
      ? levels
      : [];

  if (
    directId &&
    availableLevels.some(
      (
        level
      ) =>
        level?.id ===
          directId
    )
  ) {
    return directId;
  }

  const value =
    finiteOrNull(
      elevation
    );

  if (
    value !==
      null
  ) {
    const matching =
      availableLevels.find(
        (
          level
        ) =>
          elevationInsideBand(
            value,
            level?.elevationBand
          )
      );

    if (
      matching
    ) {
      return String(
        matching.id
      );
    }
  }

  return availableLevels.length ===
    1
    ? String(
        availableLevels[0].id
      )
    : directId;
}

function resolveGridSize(
  scene
) {
  return Math.max(
    1,
    finiteOr(
      globalThis.canvas?.dimensions?.size ??
      globalThis.canvas?.grid?.size ??
      scene?.grid?.size,
      100
    )
  );
}

function elevationInsideBand(
  elevation,
  band
) {
  const bottom =
    finiteOrNull(
      band?.bottom
    ) ??
    Number.NEGATIVE_INFINITY;

  const top =
    finiteOrNull(
      band?.top
    ) ??
    Number.POSITIVE_INFINITY;

  return elevation >=
    bottom &&
    elevation <=
      top;
}

function firstIdentifier(
  ...values
) {
  for (
    const value of
    values
  ) {
    const id =
      normaliseIdentifier(
        value
      );

    if (
      id &&
      id !==
        "[object Object]"
    ) {
      return id;
    }
  }

  return null;
}

function normaliseIdentifier(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  return text ||
    null;
}

function finiteOr(
  value,
  fallback
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function finiteOrNull(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}
