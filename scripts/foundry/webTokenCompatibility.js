const WEB_TOKEN_ARRIVAL_TOLERANCE_PX =
  0.75;

/** Resolve one immutable movement snapshot from a TokenDocument/placeable. */
export function createWebTokenMovementSnapshot({
  token,
  scene = globalThis.canvas?.scene,
  levels = [],
  changed = null
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
      document?.parentId ??
      document?.scene?.id ??
      scene?.id
    );

  const x =
    changedFiniteOr(
      changed,
      "x",
      /**
       * Foundry v13 may keep the public getter at the rendered animation
       * origin after _source has accepted the destination. The canonical
       * source therefore precedes the animated getter when no differential
       * value is available.
       */
      document?._source?.x ??
      document?.x,
      0
    );

  const y =
    changedFiniteOr(
      changed,
      "y",
      document?._source?.y ??
      document?.y,
      0
    );

  const widthGrid =
    Math.max(
      0.01,
      changedFiniteOr(
        changed,
        "width",
        document?.width ??
        document?._source?.width,
        1
      )
    );

  const heightGrid =
    Math.max(
      0.01,
      changedFiniteOr(
        changed,
        "height",
        document?.height ??
        document?._source?.height,
        1
      )
    );

  const size =
    resolveTokenPixelSize({
      document,
      scene,
      widthGrid,
      heightGrid
    });

  const elevation =
    changedFiniteOrNull(
      changed,
      "elevation",
      document?.elevation ??
      document?._source?.elevation
    );

  const levelId =
    resolveTokenWebLevelId({
      document,
      changed,
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
          size.widthPx /
          2,
        y:
          y +
          size.heightPx /
          2
      }),
    widthPx:
      size.widthPx,
    heightPx:
      size.heightPx,
    collisionRadiusPx:
      Math.max(
        1,
        Math.min(
          size.widthPx,
          size.heightPx
        ) /
        2
      ),
    elevation,
    levelId
  });
}

/**
 * Capture the authoritative pre-update movement endpoints and token footprint.
 *
 * The TokenDocument still contains the old position when preUpdateToken runs;
 * `changed` supplies the requested destination. This prevents the later
 * updateToken hook from losing the true movement origin.
 */
export function createWebTokenMovementTransition({
  token,
  changed,
  scene = globalThis.canvas?.scene,
  levels = [],
  userId = null
}) {
  if (
    !hasWebTokenMovementChange(
      changed
    )
  ) {
    return null;
  }

  const from =
    createWebTokenMovementSnapshot({
      token,
      scene,
      levels
    });

  const to =
    createWebTokenMovementSnapshot({
      token,
      scene,
      levels,
      changed
    });

  if (
    !from.tokenId ||
    !from.sceneId ||
    from.tokenId !==
      to.tokenId ||
    from.sceneId !==
      to.sceneId
  ) {
    return null;
  }

  return freezeMovementTransition({
    from,
    to,
    userId
  });
}

/** Create a movement transition from already-resolved endpoint snapshots. */
export function createWebTokenMovementTransitionFromSnapshots({
  from,
  to,
  userId = null
}) {
  if (
    !from?.tokenId ||
    !from?.sceneId ||
    from.tokenId !==
      to?.tokenId ||
    from.sceneId !==
      to?.sceneId
  ) {
    return null;
  }

  return freezeMovementTransition({
    from,
    to,
    userId
  });
}

/** Determine whether one TokenDocument differential contains movement. */
export function hasWebTokenMovementChange(
  changed
) {
  return changed &&
    typeof changed ===
      "object" &&
    (
      Object.prototype.hasOwnProperty.call(
        changed,
        "x"
      ) ||
      Object.prototype.hasOwnProperty.call(
        changed,
        "y"
      )
    );
}

/** Return the active canvas Token placeable for one TokenDocument ID. */
export function getWebTokenPlaceable(
  tokenId
) {
  const id =
    normaliseIdentifier(
      tokenId
    );

  if (!id) {
    return null;
  }

  const tokenLayer =
    globalThis.canvas?.tokens;

  if (
    typeof tokenLayer?.get ===
      "function"
  ) {
    const token =
      tokenLayer.get(
        id
      );

    if (token) {
      return token;
    }
  }

  const placeables =
    Array.isArray(
      tokenLayer?.placeables
    )
      ? tokenLayer.placeables
      : [];

  return placeables.find(
    token =>
      normaliseIdentifier(
        token?.id ??
        token?.document?.id
      ) ===
        id
  ) ??
    null;
}

/**
 * Return a Token placeable's current rendered centre in canvas world space.
 *
 * PIXI position is preferred because it advances while Foundry animates the
 * visible token. Token.center is only a defensive compatibility fallback.
 */
export function getRenderedWebTokenCentre(
  tokenPlaceable,
  movementSnapshot
) {
  if (
    !tokenPlaceable ||
    tokenPlaceable.destroyed ===
      true
  ) {
    return null;
  }

  const renderedX =
    Number(
      tokenPlaceable?.position?.x ??
      tokenPlaceable?.x
    );

  const renderedY =
    Number(
      tokenPlaceable?.position?.y ??
      tokenPlaceable?.y
    );

  const fallbackSnapshot =
    movementSnapshot?.to ??
    movementSnapshot?.from ??
    movementSnapshot;

  const renderedWidth =
    positiveFiniteOrNull(
      tokenPlaceable?.w
    ) ??
    positiveFiniteOrNull(
      tokenPlaceable?.width
    ) ??
    positiveFiniteOrNull(
      fallbackSnapshot?.widthPx
    );

  const renderedHeight =
    positiveFiniteOrNull(
      tokenPlaceable?.h
    ) ??
    positiveFiniteOrNull(
      tokenPlaceable?.height
    ) ??
    positiveFiniteOrNull(
      fallbackSnapshot?.heightPx
    );

  if (
    Number.isFinite(
      renderedX
    ) &&
    Number.isFinite(
      renderedY
    ) &&
    renderedWidth !==
      null &&
    renderedHeight !==
      null
  ) {
    return Object.freeze({
      x:
        renderedX +
        renderedWidth /
        2,
      y:
        renderedY +
        renderedHeight /
        2
    });
  }

  try {
    const centre =
      tokenPlaceable.center;

    const x =
      Number(
        centre?.x
      );

    const y =
      Number(
        centre?.y
      );

    if (
      Number.isFinite(
        x
      ) &&
      Number.isFinite(
        y
      )
    ) {
      return Object.freeze({
        x,
        y
      });
    }
  } catch (_error) {
    // A missing rendered sample is non-fatal; the tracker retains its last
    // centre and performs a final destination sweep when it expires.
  }

  return null;
}

/** Determine whether a rendered token has reached its captured destination. */
export function hasRenderedWebTokenArrived(
  movementSnapshot,
  renderedCentre,
  tolerancePx = WEB_TOKEN_ARRIVAL_TOLERANCE_PX
) {
  const destination =
    movementSnapshot?.to?.centre ??
    movementSnapshot?.toCentre ??
    null;

  if (
    !destination ||
    !renderedCentre
  ) {
    return false;
  }

  const tolerance =
    Math.max(
      0,
      finiteOr(
        tolerancePx,
        WEB_TOKEN_ARRIVAL_TOLERANCE_PX
      )
    );

  return Math.hypot(
    Number(
      renderedCentre.x
    ) -
      Number(
        destination.x
      ),
    Number(
      renderedCentre.y
    ) -
      Number(
        destination.y
      )
  ) <=
    tolerance;
}

export function resolveTokenWebLevelId({
  document,
  changed = null,
  elevation = null,
  levels = []
}) {
  const directId =
    firstIdentifier(
      changed?.level?.id,
      changed?.levelId,
      changed?.flags?.levels?.levelId,
      changed?.flags?.levels?.id,
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
      level =>
        String(
          level?.id
        ) ===
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
        level =>
          elevationInsideBand(
            value,
            level?.elevationBand
          )
      );

    if (matching) {
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

function freezeMovementTransition({
  from,
  to,
  userId
}) {
  return Object.freeze({
    tokenId:
      from.tokenId,
    sceneId:
      from.sceneId,
    userId:
      normaliseIdentifier(
        userId
      ),
    from,
    to,
    levelId:
      to.levelId ??
      from.levelId,
    elevation:
      to.elevation ??
      from.elevation,
    collisionRadiusPx:
      Math.max(
        Number(
          from.collisionRadiusPx
        ) ||
          0,
        Number(
          to.collisionRadiusPx
        ) ||
          0
      ),
    capturedAt:
      Date.now()
  });
}

function resolveTokenPixelSize({
  document,
  scene,
  widthGrid,
  heightGrid
}) {
  if (
    typeof document?.getSize ===
      "function"
  ) {
    try {
      const size =
        document.getSize({
          width:
            widthGrid,
          height:
            heightGrid
        });

      const widthPx =
        positiveFiniteOrNull(
          size?.width
        );

      const heightPx =
        positiveFiniteOrNull(
          size?.height
        );

      if (
        widthPx !==
          null &&
        heightPx !==
          null
      ) {
        return {
          widthPx,
          heightPx
        };
      }
    } catch (_error) {
      // Foundry's grid-size fallback below remains authoritative enough for
      // interaction geometry when getSize is unavailable or rejects options.
    }
  }

  const gridSize =
    resolveGridSize(
      scene
    );

  return {
    widthPx:
      widthGrid *
      gridSize,
    heightPx:
      heightGrid *
      gridSize
  };
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

function changedFiniteOr(
  changed,
  propertyName,
  currentValue,
  fallback
) {
  if (
    changed &&
    typeof changed ===
      "object" &&
    Object.prototype.hasOwnProperty.call(
      changed,
      propertyName
    )
  ) {
    return finiteOr(
      changed[propertyName],
      finiteOr(
        currentValue,
        fallback
      )
    );
  }

  return finiteOr(
    currentValue,
    fallback
  );
}

function changedFiniteOrNull(
  changed,
  propertyName,
  currentValue
) {
  if (
    changed &&
    typeof changed ===
      "object" &&
    Object.prototype.hasOwnProperty.call(
      changed,
      propertyName
    )
  ) {
    return finiteOrNull(
      changed[propertyName]
    );
  }

  return finiteOrNull(
    currentValue
  );
}

function positiveFiniteOrNull(
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
    : null;
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
