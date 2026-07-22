/**
 * PIXI-version-tolerant alpha dilation for corner-web asset underlays.
 *
 * The filter expands only the alpha fringe outside the source fibre. The crisp
 * source sprite remains separate above it, so thickness widens fibres without
 * offset ghost copies or Gaussian blur.
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

const V8_VERTEX_SHADER = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const V8_FRAGMENT_SHADER = `
in vec2 vTextureCoord;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uDilationRadius;
uniform float uDilationStrength;

vec4 chooseHigherAlpha(vec4 currentValue, vec4 candidate)
{
    return candidate.a > currentValue.a ? candidate : currentValue;
}

void main(void)
{
    vec4 centre = texture2D(uTexture, vTextureCoord);
    vec4 best = centre;
    vec2 fullStep = uInputSize.zw * uDilationRadius;
    vec2 halfStep = fullStep * 0.5;

    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2( fullStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(-fullStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(0.0,  fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(0.0, -fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2( fullStep.x,  fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(-fullStep.x,  fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2( fullStep.x, -fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(-fullStep.x, -fullStep.y)));

    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2( halfStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(-halfStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(0.0,  halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(0.0, -halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2( halfStep.x,  halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(-halfStep.x,  halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2( halfStep.x, -halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uTexture, vTextureCoord + vec2(-halfStep.x, -halfStep.y)));

    float fringeAlpha = max(0.0, best.a - centre.a) * uDilationStrength;
    vec3 straightColour = best.a > 0.00001 ? best.rgb / best.a : vec3(0.0);
    gl_FragColor = vec4(straightColour * fringeAlpha, fringeAlpha);
}
`;

const V7_FRAGMENT_SHADER = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform float uDilationRadius;
uniform float uDilationStrength;

vec4 chooseHigherAlpha(vec4 currentValue, vec4 candidate)
{
    return candidate.a > currentValue.a ? candidate : currentValue;
}

void main(void)
{
    vec4 centre = texture2D(uSampler, vTextureCoord);
    vec4 best = centre;
    vec2 fullStep = inputSize.zw * uDilationRadius;
    vec2 halfStep = fullStep * 0.5;

    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2( fullStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(-fullStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(0.0,  fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(0.0, -fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2( fullStep.x,  fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(-fullStep.x,  fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2( fullStep.x, -fullStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(-fullStep.x, -fullStep.y)));

    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2( halfStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(-halfStep.x, 0.0)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(0.0,  halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(0.0, -halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2( halfStep.x,  halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(-halfStep.x,  halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2( halfStep.x, -halfStep.y)));
    best = chooseHigherAlpha(best, texture2D(uSampler, vTextureCoord + vec2(-halfStep.x, -halfStep.y)));

    float fringeAlpha = max(0.0, best.a - centre.a) * uDilationStrength;
    vec3 straightColour = best.a > 0.00001 ? best.rgb / best.a : vec3(0.0);
    gl_FragColor = vec4(straightColour * fringeAlpha, fringeAlpha);
}
`;

/** Resolve one discrete 1-4 thickness into a dilation recipe. */
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
 * Create one alpha-fringe dilation filter for PIXI v8 or the v7-compatible
 * constructor retained by unusual Foundry-compatible clients.
 */
export function createWebCornerAssetDilationFilter({
  pixi,
  radiusPx,
  strength
}) {
  const FilterClass =
    pixi?.Filter ??
    null;

  if (
    typeof FilterClass !==
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

  if (
    typeof pixi?.GlProgram ===
      "function"
  ) {
    const v8Filter =
      createPixiV8DilationFilter({
        pixi,
        FilterClass,
        radiusPx:
          resolvedRadius,
        strength:
          resolvedStrength
      });

    return v8Filter
      ? configureDilationFilter(
          v8Filter,
          resolvedRadius,
          "pixi-v8-gl-program"
        )
      : null;
  }

  const v7Filter =
    createPixiV7DilationFilter({
      FilterClass,
      radiusPx:
        resolvedRadius,
      strength:
        resolvedStrength
    });

  return v7Filter
    ? configureDilationFilter(
        v7Filter,
        resolvedRadius,
        "pixi-v7-filter-constructor"
      )
    : null;
}

function createPixiV8DilationFilter({
  pixi,
  FilterClass,
  radiusPx,
  strength
}) {
  const GlProgramClass =
    pixi?.GlProgram ??
    null;

  if (
    typeof GlProgramClass !==
      "function"
  ) {
    return null;
  }

  try {
    const programOptions = {
      vertex:
        V8_VERTEX_SHADER,
      fragment:
        V8_FRAGMENT_SHADER
    };

    const glProgram =
      typeof GlProgramClass.from ===
        "function"
        ? GlProgramClass.from(
            programOptions
          )
        : new GlProgramClass(
            programOptions
          );

    return new FilterClass({
      glProgram,
      resources: {
        webCornerDilationUniforms: {
          uDilationRadius: {
            value:
              radiusPx,
            type:
              "f32"
          },
          uDilationStrength: {
            value:
              strength,
            type:
              "f32"
          }
        }
      }
    });
  } catch (_error) {
    return null;
  }
}

function createPixiV7DilationFilter({
  FilterClass,
  radiusPx,
  strength
}) {
  try {
    return new FilterClass(
      undefined,
      V7_FRAGMENT_SHADER,
      {
        uDilationRadius:
          radiusPx,
        uDilationStrength:
          strength
      }
    );
  } catch (_error) {
    return null;
  }
}

function configureDilationFilter(
  filter,
  radiusPx,
  implementation
) {
  try {
    filter.padding =
      Math.ceil(
        radiusPx
      ) +
      1;
  } catch (_error) {
    // Filter padding is an optimisation, not a correctness precondition.
  }

  try {
    if (
      "antialias" in
      filter
    ) {
      filter.antialias =
        "on";
    }
  } catch (_error) {
    // Older compatible filters may expose a read-only antialias property.
  }

  filter.dynamicWebsDilationRadiusPx =
    radiusPx;

  filter.dynamicWebsDilationImplementation =
    implementation;

  return filter;
}
