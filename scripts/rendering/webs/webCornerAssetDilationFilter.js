/**
 * PIXI-version-tolerant thickness underlay for corner and span WebP assets.
 *
 * The former implementation used a custom fragment shader. Foundry defers
 * custom shader compilation until the first filtered display is rendered, so
 * an otherwise successful module load could still fail later with PixiJS'
 * generic "Could not initialize shader" error. This implementation uses only
 * PIXI's built-in BlurFilter. A crisp unfiltered sprite or mesh remains above
 * the softened underlay, producing a controlled bloom-like widening without
 * directional offset copies or module-authored GLSL.
 */

export const WEB_CORNER_ASSET_DILATION_LEVELS =
  Object.freeze({
    1:
      Object.freeze({
        enabled:
          false,
        radiusPx:
          0,
        strength:
          0
      }),
    2:
      Object.freeze({
        enabled:
          true,
        radiusPx:
          0.75,
        strength:
          0.72
      }),
    3:
      Object.freeze({
        enabled:
          true,
        radiusPx:
          1.35,
        strength:
          0.82
      }),
    4:
      Object.freeze({
        enabled:
          true,
        radiusPx:
          2,
        strength:
          0.9
      })
  });

/** Resolve one discrete 1-4 thickness into a bounded underlay recipe. */
export function resolveWebCornerAssetDilation(
  thicknessMultiplier
) {
  const numericValue =
    Number(
      thicknessMultiplier
    );

  const level =
    Math.max(
      1,
      Math.min(
        4,
        Math.round(
          Number.isFinite(
            numericValue
          )
            ? numericValue
            : 1
        )
      )
    );

  return WEB_CORNER_ASSET_DILATION_LEVELS[
    level
  ];
}

/**
 * Create a built-in PIXI blur filter for the thickness underlay.
 *
 * The export name is retained for compatibility with the existing corner and
 * span texture services. No custom Filter, GlProgram, fragment source, or
 * module-authored shader is created here.
 */
export function createWebCornerAssetDilationFilter({
  pixi,
  radiusPx,
  strength
}) {
  const BlurFilterClass =
    pixi?.BlurFilter ??
    pixi?.filters?.BlurFilter ??
    null;

  if (
    typeof BlurFilterClass !==
      "function"
  ) {
    return null;
  }

  const resolvedRadius =
    Number(
      radiusPx
    );

  const resolvedStrength =
    Number(
      strength
    );

  if (
    !Number.isFinite(
      resolvedRadius
    ) ||
    resolvedRadius <=
      0 ||
    !Number.isFinite(
      resolvedStrength
    ) ||
    resolvedStrength <=
      0
  ) {
    return null;
  }

  const blurStrength =
    Math.max(
      0.5,
      resolvedRadius *
        1.35
    );

  const quality =
    resolvedRadius >=
      1.25
      ? 2
      : 1;

  const pixiMajorVersion =
    resolvePixiMajorVersion(
      pixi
    );

  let filter =
    null;

  let implementation =
    null;

  if (
    pixiMajorVersion ===
      null ||
    pixiMajorVersion >=
      8
  ) {
    try {
      filter =
        new BlurFilterClass({
          strength:
            blurStrength,
          quality,
          kernelSize:
            5
        });

      implementation =
        "pixi-built-in-blur-v8";
    } catch (_error) {
      filter =
        null;
    }
  }

  if (!filter) {
    try {
      filter =
        new BlurFilterClass(
          blurStrength,
          quality
        );

      implementation =
        "pixi-built-in-blur-v7";
    } catch (_error) {
      return null;
    }
  }

  return configureThicknessUnderlayFilter(
    filter,
    {
      radiusPx:
        resolvedRadius,
      strength:
        resolvedStrength,
      blurStrength,
      implementation
    }
  );
}

/**
 * Resolve the alpha applied to the softened underlay display object.
 *
 * The crisp source remains at full presentation alpha. Keeping the underlay
 * below half opacity prevents the built-in blur from whitening the fibre core
 * while still increasing its apparent width.
 */
export function resolveWebAssetThicknessUnderlayAlpha(
  strength
) {
  const numericStrength =
    Number(
      strength
    );

  if (
    !Number.isFinite(
      numericStrength
    ) ||
    numericStrength <=
      0
  ) {
    return 0;
  }

  return Math.max(
    0.32,
    Math.min(
      0.5,
      numericStrength *
        0.55
    )
  );
}

function configureThicknessUnderlayFilter(
  filter,
  {
    radiusPx,
    strength,
    blurStrength,
    implementation
  }
) {
  try {
    filter.padding =
      Math.ceil(
        blurStrength *
          2
      ) +
      2;
  } catch (_error) {
    // Padding is an optimisation rather than a correctness precondition.
  }

  filter.dynamicWebsDilationRadiusPx =
    radiusPx;

  filter.dynamicWebsDilationStrength =
    strength;

  filter.dynamicWebsBloomStrength =
    blurStrength;

  filter.dynamicWebsDilationImplementation =
    implementation;

  filter.dynamicWebsUsesCustomShader =
    false;

  return filter;
}

function resolvePixiMajorVersion(
  pixi
) {
  const text =
    String(
      pixi?.VERSION ??
      pixi?.version ??
      ""
    ).trim();

  const match =
    /^(\d+)/u.exec(
      text
    );

  if (!match) {
    return null;
  }

  const major =
    Number(
      match[1]
    );

  return Number.isInteger(
    major
  )
    ? major
    : null;
}
