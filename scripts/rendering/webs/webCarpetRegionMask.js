import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

const LEGACY_MASK_COLOUR =
  0xffffff;

const ELLIPSE_SEGMENT_COUNT =
  64;

/**
 * Cache immutable Region mask plans while creating a fresh PIXI.Graphics mask
 * for each rendered carpet display.
 *
 * Graphics objects cannot be shared safely between separate display trees, but
 * the normalised shape plan can be reused across presentation redraws.
 */
export class WebCarpetRegionMaskService {
  constructor() {
    this.entries =
      new Map();

    this.planBuildCount =
      0;

    this.vectorDrawCount =
      0;

    this.cacheHitCount =
      0;
  }

  createMaskSprite({
    pixi,
    carpet
  }) {
    const candidatePlan =
      createWebCarpetRegionMaskPlan(
        carpet
      );

    let plan =
      this.entries.get(
        candidatePlan.cacheKey
      );

    if (!plan) {
      plan =
        candidatePlan;

      this.entries.set(
        plan.cacheKey,
        plan
      );

      this.planBuildCount +=
        1;
    } else {
      this.cacheHitCount +=
        1;
    }

    const sprite =
      createWebCarpetRegionMaskGraphics({
        pixi,
        plan
      });

    this.vectorDrawCount +=
      1;

    return {
      cacheKey:
        plan.cacheKey,
      sprite,
      graphics:
        sprite,
      texture:
        null,
      plan,
      textureOwnedByCache:
        false
    };
  }

  clear() {
    const hadEntries =
      this.entries.size >
      0;

    this.entries.clear();

    return hadEntries;
  }

  createDiagnosticSnapshot() {
    return Object.freeze({
      entryCount:
        this.entries.size,
      planBuildCount:
        this.planBuildCount,
      vectorDrawCount:
        this.vectorDrawCount,
      cacheHitCount:
        this.cacheHitCount,
      rasterCount:
        0
    });
  }
}

/**
 * Apply one direct PIXI.Graphics Region mask to the final carpet clipping
 * container. Colour filters and thickness layers remain descendants of this
 * target, so their composed pixels are clipped after all presentation effects.
 */
export function applyWebCarpetRegionMask({
  target,
  resource
}) {
  if (
    !target ||
    typeof target !==
      "object"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A display-object target is required for web-carpet clipping.`
    );
  }

  const mask =
    resource?.sprite;

  const plan =
    resource?.plan;

  if (
    !mask ||
    !plan?.bounds
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A complete web-carpet mask resource is required for clipping.`
    );
  }

  const previousOwner =
    mask.dynamicWebsWebCarpetMaskOwner ??
    null;

  if (
    previousOwner &&
    previousOwner !==
      target &&
    previousOwner.mask ===
      mask
  ) {
    previousOwner.mask =
      null;
  }

  target.mask =
    mask;

  target.dynamicWebsWebCarpetMask =
    mask;

  mask.dynamicWebsWebCarpetMaskOwner =
    target;

  target.webCarpetMaskCacheKey =
    String(
      resource.cacheKey ??
      plan.cacheKey ??
      ""
    );

  target.webCarpetMaskBounds =
    plan.bounds;

  return true;
}

/** Create a plain immutable mask plan for one carpet blueprint. */
export function createWebCarpetRegionMaskPlan(
  carpet
) {
  const mask =
    carpet?.mask;

  const bounds =
    normaliseBounds(
      mask?.bounds
    );

  if (!bounds) {
    throw new TypeError(
      `${MODULE_TITLE} | Web-carpet mask requires finite bounds.`
    );
  }

  const resolutionPx =
    Math.max(
      64,
      Math.min(
        1024,
        Math.round(
          Number(
            mask?.resolutionPx
          ) ||
          512
        )
      )
    );

  const longest =
    Math.max(
      bounds.width,
      bounds.height,
      1
    );

  const widthPx =
    Math.max(
      1,
      Math.round(
        resolutionPx *
        bounds.width /
        longest
      )
    );

  const heightPx =
    Math.max(
      1,
      Math.round(
        resolutionPx *
        bounds.height /
        longest
      )
    );

  const confineShapes =
    cloneShapes(
      mask?.confineShapes
    );

  if (
    confineShapes.length ===
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Web-carpet mask requires at least one Confine Region shape.`
    );
  }

  return deepFreeze({
    cacheKey:
      requireMaskCacheKey(
        mask?.cacheKey,
        {
          bounds,
          resolutionPx,
          confineShapes,
          excludeShapes:
            mask?.excludeShapes
        }
      ),
    bounds,
    widthPx,
    heightPx,
    resolutionPx,
    confineShapes,
    excludeShapes:
      cloneShapes(
        mask?.excludeShapes
      )
  });
}

/**
 * Backwards-compatible one-off resource creator. The mask is now a direct
 * vector Graphics object rather than a raster Texture-backed Sprite.
 */
export function createWebCarpetRegionMaskSprite({
  pixi,
  carpet
}) {
  const plan =
    createWebCarpetRegionMaskPlan(
      carpet
    );

  const sprite =
    createWebCarpetRegionMaskGraphics({
      pixi,
      plan
    });

  return {
    cacheKey:
      plan.cacheKey,
    sprite,
    graphics:
      sprite,
    texture:
      null,
    plan,
    textureOwnedByCache:
      false
  };
}

/**
 * Retained compatibility export for earlier internal callers. It now returns a
 * vector mask resource and deliberately owns no Texture.
 */
export function createWebCarpetRegionMaskTexture({
  pixi,
  carpet
}) {
  return createWebCarpetRegionMaskSprite({
    pixi,
    carpet
  });
}

/** Destroy one transient vector mask resource. */
export function destroyWebCarpetRegionMaskResource(
  resource
) {
  const mask =
    resource?.sprite ??
    resource?.graphics ??
    null;

  if (
    !mask ||
    mask.destroyed ===
      true
  ) {
    return;
  }

  const owner =
    mask.dynamicWebsWebCarpetMaskOwner ??
    null;

  if (
    owner?.mask ===
      mask
  ) {
    owner.mask =
      null;
  }

  if (
    owner?.dynamicWebsWebCarpetMask ===
      mask
  ) {
    owner.dynamicWebsWebCarpetMask =
      null;
  }

  mask.dynamicWebsWebCarpetMaskOwner =
    null;

  if (
    typeof mask.clear ===
      "function"
  ) {
    try {
      mask.clear();
    } catch (_error) {
      // Continue with parent detachment and destruction.
    }
  }

  if (
    mask.parent &&
    typeof mask.parent.removeChild ===
      "function"
  ) {
    mask.parent.removeChild(
      mask
    );
  }

  if (
    typeof mask.destroy ===
      "function"
  ) {
    try {
      mask.destroy();
    } catch (_error) {
      // The containing PIXI tree retains final cleanup ownership.
    }
  }
}

function createWebCarpetRegionMaskGraphics({
  pixi,
  plan
}) {
  const PixiGraphics =
    pixi?.Graphics;

  if (
    typeof PixiGraphics !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | PIXI.Graphics is required for web-carpet Region masks.`
    );
  }

  const graphics =
    new PixiGraphics();

  configureMaskGraphics(
    graphics
  );

  drawPositiveRegionMask({
    graphics,
    confineShapes:
      plan.confineShapes,
    excludeShapes:
      plan.excludeShapes
  });

  graphics.dynamicWebsMaskCacheKey =
    plan.cacheKey;

  graphics.dynamicWebsMaskBounds =
    plan.bounds;

  return graphics;
}

function configureMaskGraphics(
  graphics
) {
  graphics.name =
    "dynamic-webs.web-carpet-mask";

  if (
    "visible" in
    graphics
  ) {
    graphics.visible =
      true;
  }

  if (
    "renderable" in
    graphics
  ) {
    graphics.renderable =
      false;
  }

  if (
    "eventMode" in
    graphics
  ) {
    graphics.eventMode =
      "none";
  }

  if (
    "interactive" in
    graphics
  ) {
    graphics.interactive =
      false;
  }

  if (
    "interactiveChildren" in
    graphics
  ) {
    graphics.interactiveChildren =
      false;
  }
}

function drawPositiveRegionMask({
  graphics,
  confineShapes,
  excludeShapes
}) {
  if (
    typeof graphics.clear ===
      "function"
  ) {
    graphics.clear();
  }

  const operations =
    createPositiveMaskOperations({
      confineShapes,
      excludeShapes
    });

  if (
    !operations.some(
      (
        operation
      ) =>
        operation.operation ===
          "fill"
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | No drawable Confine Region geometry was available for the web-carpet mask.`
    );
  }

  if (
    supportsLegacyMaskDrawing(
      graphics
    )
  ) {
    drawLegacyPositiveRegionMask({
      graphics,
      operations
    });

    return;
  }

  if (
    supportsModernMaskDrawing(
      graphics
    )
  ) {
    drawModernPositiveRegionMask({
      graphics,
      operations
    });

    return;
  }

  throw new Error(
    `${MODULE_TITLE} | The active PIXI.Graphics API cannot draw Region mask fills and holes.`
  );
}

function supportsLegacyMaskDrawing(
  graphics
) {
  return Boolean(
    graphics &&
    typeof graphics.beginFill ===
      "function" &&
    typeof graphics.drawPolygon ===
      "function" &&
    typeof graphics.beginHole ===
      "function" &&
    typeof graphics.endHole ===
      "function"
  );
}

function supportsModernMaskDrawing(
  graphics
) {
  return Boolean(
    graphics &&
    typeof graphics.poly ===
      "function" &&
    typeof graphics.fill ===
      "function" &&
    typeof graphics.cut ===
      "function"
  );
}

function drawLegacyPositiveRegionMask({
  graphics,
  operations
}) {
  graphics.beginFill(
    LEGACY_MASK_COLOUR,
    1
  );

  for (const operation of operations) {
    if (
      operation.operation ===
        "cut"
    ) {
      graphics.beginHole();

      graphics.drawPolygon(
        flattenPoints(
          operation.points
        )
      );

      graphics.endHole();

      continue;
    }

    graphics.drawPolygon(
      flattenPoints(
        operation.points
      )
    );
  }

  if (
    typeof graphics.endFill ===
      "function"
  ) {
    graphics.endFill();
  }
}

function drawModernPositiveRegionMask({
  graphics,
  operations
}) {
  for (const operation of operations) {
    graphics.poly(
      flattenPoints(
        operation.points
      )
    );

    if (
      operation.operation ===
        "cut"
    ) {
      graphics.cut();

      continue;
    }

    graphics.fill({
      color:
        LEGACY_MASK_COLOUR,
      alpha:
        1
    });
  }
}

function createPositiveMaskOperations({
  confineShapes,
  excludeShapes
}) {
  return [
    ...resolveShapeMaskOperations({
      shapes:
        confineShapes,
      invert:
        false
    }),
    ...resolveShapeMaskOperations({
      shapes:
        excludeShapes,
      invert:
        true
    })
  ];
}

function resolveShapeMaskOperations({
  shapes,
  invert
}) {
  const operations = [];

  for (const shape of Array.isArray(
    shapes
  )
    ? shapes
    : []) {
    if (
      shape?.type ===
        "polygon-tree"
    ) {
      for (const operation of Array.isArray(
        shape.operations
      )
        ? shape.operations
        : []) {
        const points =
          normalisePoints(
            operation?.points
          );

        if (
          points.length <
            3
        ) {
          continue;
        }

        operations.push({
          operation:
            invertMaskOperation(
              normaliseMaskOperation(
                operation?.operation
              ),
              invert
            ),
          points
        });
      }

      continue;
    }

    const points =
      createShapePolygon(
        shape
      );

    if (
      points.length <
        3
    ) {
      continue;
    }

    const operation =
      shape?.isHole ===
        true
        ? "cut"
        : "fill";

    operations.push({
      operation:
        invertMaskOperation(
          operation,
          invert
        ),
      points
    });
  }

  return operations;
}

function normaliseMaskOperation(
  value
) {
  return value ===
    "cut"
    ? "cut"
    : "fill";
}

function invertMaskOperation(
  operation,
  invert
) {
  if (
    invert !==
      true
  ) {
    return operation;
  }

  return operation ===
    "cut"
    ? "fill"
    : "cut";
}

function createShapePolygon(
  shape
) {
  if (
    shape?.type ===
      "polygon"
  ) {
    return normalisePoints(
      shape.points
    );
  }

  if (
    shape?.type ===
      "ellipse"
  ) {
    return createEllipsePolygon(
      shape
    );
  }

  if (
    shape?.type ===
      "rectangle"
  ) {
    return createRectanglePolygon(
      shape
    );
  }

  return [];
}

function createRectanglePolygon(
  shape
) {
  const x =
    Number(
      shape?.x
    );

  const y =
    Number(
      shape?.y
    );

  const width =
    Math.abs(
      Number(
        shape?.width
      )
    );

  const height =
    Math.abs(
      Number(
        shape?.height
      )
    );

  if (
    ![
      x,
      y,
      width,
      height
    ].every(
      Number.isFinite
    ) ||
    width <=
      0 ||
    height <=
      0
  ) {
    return [];
  }

  const centreX =
    x +
    width /
      2;

  const centreY =
    y +
    height /
      2;

  const radians =
    degreesToRadians(
      shape?.rotation
    );

  return [
    {
      x:
        -width /
        2,
      y:
        -height /
        2
    },
    {
      x:
        width /
        2,
      y:
        -height /
        2
    },
    {
      x:
        width /
        2,
      y:
        height /
        2
    },
    {
      x:
        -width /
        2,
      y:
        height /
        2
    }
  ].map(
    (
      point
    ) =>
      rotateAndTranslatePoint({
        point,
        centreX,
        centreY,
        radians
      })
  );
}

function createEllipsePolygon(
  shape
) {
  const centreX =
    Number(
      shape?.centreX
    );

  const centreY =
    Number(
      shape?.centreY
    );

  const radiusX =
    Math.abs(
      Number(
        shape?.radiusX
      )
    );

  const radiusY =
    Math.abs(
      Number(
        shape?.radiusY
      )
    );

  if (
    ![
      centreX,
      centreY,
      radiusX,
      radiusY
    ].every(
      Number.isFinite
    ) ||
    radiusX <=
      0 ||
    radiusY <=
      0
  ) {
    return [];
  }

  const radians =
    degreesToRadians(
      shape?.rotation
    );

  const points =
    [];

  for (
    let index = 0;
    index <
      ELLIPSE_SEGMENT_COUNT;
    index +=
      1
  ) {
    const angle =
      index /
      ELLIPSE_SEGMENT_COUNT *
      Math.PI *
      2;

    points.push(
      rotateAndTranslatePoint({
        point: {
          x:
            Math.cos(
              angle
            ) *
            radiusX,
          y:
            Math.sin(
              angle
            ) *
            radiusY
        },
        centreX,
        centreY,
        radians
      })
    );
  }

  return points;
}

function rotateAndTranslatePoint({
  point,
  centreX,
  centreY,
  radians
}) {
  const cosine =
    Math.cos(
      radians
    );

  const sine =
    Math.sin(
      radians
    );

  return {
    x:
      centreX +
      point.x *
      cosine -
      point.y *
      sine,
    y:
      centreY +
      point.x *
      sine +
      point.y *
      cosine
  };
}

function normalisePoints(
  value
) {
  return (
    Array.isArray(
      value
    )
      ? value
      : []
  )
    .map(
      (
        point
      ) => ({
        x:
          Number(
            point?.x
          ),
        y:
          Number(
            point?.y
          )
      })
    )
    .filter(
      (
        point
      ) =>
        Number.isFinite(
          point.x
        ) &&
        Number.isFinite(
          point.y
        )
    );
}

function flattenPoints(
  points
) {
  const output =
    [];

  for (const point of points) {
    output.push(
      point.x,
      point.y
    );
  }

  return output;
}

function degreesToRadians(
  value
) {
  return (
    Number(
      value
    ) ||
    0
  ) *
    Math.PI /
    180;
}

function normaliseBounds(
  value
) {
  const x =
    Number(
      value?.x
    );

  const y =
    Number(
      value?.y
    );

  const width =
    Number(
      value?.width
    );

  const height =
    Number(
      value?.height
    );

  if (
    ![
      x,
      y,
      width,
      height
    ].every(
      Number.isFinite
    ) ||
    width <=
      0 ||
    height <=
      0
  ) {
    return null;
  }

  return {
    x,
    y,
    width,
    height,
    right:
      Number.isFinite(
        Number(
          value.right
        )
      )
        ? Number(
            value.right
          )
        : x +
          width,
    bottom:
      Number.isFinite(
        Number(
          value.bottom
        )
      )
        ? Number(
            value.bottom
          )
        : y +
          height
  };
}

function cloneShapes(
  value
) {
  return (
    Array.isArray(
      value
    )
      ? value
      : []
  ).map(
    (
      shape
    ) => {
      if (
        shape?.type ===
          "polygon"
      ) {
        return {
          ...shape,
          points:
            normalisePoints(
              shape.points
            )
        };
      }

      if (
        shape?.type ===
          "polygon-tree"
      ) {
        return {
          ...shape,
          operations:
            (
              Array.isArray(
                shape.operations
              )
                ? shape.operations
                : []
            ).map(
              (
                operation
              ) => ({
                operation:
                  normaliseMaskOperation(
                    operation?.operation
                  ),
                points:
                  normalisePoints(
                    operation?.points
                  )
              })
            )
        };
      }

      return {
        ...shape
      };
    }
  );
}

function requireMaskCacheKey(
  value,
  fallbackPayload
) {
  const text =
    String(
      value ??
      ""
    ).trim();

  if (
    text.length >
      0
  ) {
    return text;
  }

  return `dynamic-webs-mask-${hashText(JSON.stringify(fallbackPayload))}`;
}

function hashText(
  text
) {
  let hash =
    0x811c9dc5;

  for (
    let index = 0;
    index <
      text.length;
    index +=
      1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        0x01000193
      ) >>>
      0;
  }

  return hash.toString(
    16
  ).padStart(
    8,
    "0"
  );
}

function deepFreeze(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object" ||
    Object.isFrozen(
      value
    )
  ) {
    return value;
  }

  for (
    const child of
    Object.values(
      value
    )
  ) {
    deepFreeze(
      child
    );
  }

  return Object.freeze(
    value
  );
}
