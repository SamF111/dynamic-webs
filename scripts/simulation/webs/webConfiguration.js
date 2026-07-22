import {
  MODULE_ID
} from "../../module/moduleConstants.js";

import {
  deepFreezeJsonData
} from "../../data/jsonData.js";

import {
  DEFAULT_WEB_GENERATION_CONFIGURATION
} from "./webConfigurationDefaults.js";

export {
  DEFAULT_WEB_GENERATION_CONFIGURATION
} from "./webConfigurationDefaults.js";

/**
 * Normalise one API-supplied web-generation configuration.
 *
 * @param {object} [options={}] - Candidate options.
 * @param {string|null} [sceneId=null] - Active Scene identifier.
 * @returns {Readonly<object>} Frozen resolved configuration.
 */
export function normaliseWebGenerationConfiguration(
  options = {},
  sceneId = null
) {
  const candidate =
    isObject(options)
      ? options
      : {};

  const cornerCandidate =
    isObject(candidate.cornerWebs)
      ? candidate.cornerWebs
      : {};

  const spanCandidate =
    isObject(candidate.spanWebs)
      ? candidate.spanWebs
      : {};

  const groundCandidate =
    isObject(candidate.groundWebs)
      ? candidate.groundWebs
      : {};

  const carpetCandidate =
    isObject(candidate.carpetWebs)
      ? candidate.carpetWebs
      : {};

  const renderingCandidate =
    isObject(candidate.rendering)
      ? candidate.rendering
      : {};

  const defaults =
    DEFAULT_WEB_GENERATION_CONFIGURATION;

  const minimumSpanGridUnits =
    normalisePositiveNumber(
      spanCandidate.minimumSpanGridUnits,
      defaults.spanWebs.minimumSpanGridUnits
    );

  const maximumSpanGridUnits =
    Math.max(
      minimumSpanGridUnits,
      normalisePositiveNumber(
        spanCandidate.maximumSpanGridUnits,
        defaults.spanWebs.maximumSpanGridUnits
      )
    );

  const legacyMinimumLengthGridUnits =
    normaliseOptionalPositiveNumber(
      spanCandidate.minimumHalfLengthGridUnits
    ) !==
      null
      ? normaliseOptionalPositiveNumber(
        spanCandidate.minimumHalfLengthGridUnits
      ) *
        2
      : null;

  const legacyMaximumLengthGridUnits =
    normaliseOptionalPositiveNumber(
      spanCandidate.maximumHalfLengthGridUnits
    ) !==
      null
      ? normaliseOptionalPositiveNumber(
        spanCandidate.maximumHalfLengthGridUnits
      ) *
        2
      : null;

  const minimumLengthGridUnits =
    normalisePositiveNumber(
      spanCandidate.minimumLengthGridUnits ??
        legacyMinimumLengthGridUnits,
      defaults.spanWebs.minimumLengthGridUnits
    );

  const maximumLengthGridUnits =
    Math.max(
      minimumLengthGridUnits,
      normalisePositiveNumber(
        spanCandidate.maximumLengthGridUnits ??
          legacyMaximumLengthGridUnits,
        defaults.spanWebs.maximumLengthGridUnits
      )
    );

  const minimumLengthToSpanRatio =
    normalisePositiveNumber(
      spanCandidate.minimumLengthToSpanRatio,
      defaults.spanWebs.minimumLengthToSpanRatio
    );

  const maximumLengthToSpanRatio =
    Math.max(
      minimumLengthToSpanRatio,
      normalisePositiveNumber(
        spanCandidate.maximumLengthToSpanRatio,
        defaults.spanWebs.maximumLengthToSpanRatio
      )
    );

  const minimumAnchorCountPerSide =
    Math.max(
      2,
      normalisePositiveInteger(
        spanCandidate.minimumAnchorCountPerSide,
        defaults.spanWebs.minimumAnchorCountPerSide
      )
    );

  const maximumAnchorCountPerSide =
    Math.max(
      minimumAnchorCountPerSide,
      normalisePositiveInteger(
        spanCandidate.maximumAnchorCountPerSide,
        defaults.spanWebs.maximumAnchorCountPerSide
      )
    );

  const minimumCaptureRingCount =
    Math.max(
      2,
      normalisePositiveInteger(
        spanCandidate.minimumCaptureRingCount,
        defaults.spanWebs.minimumCaptureRingCount
      )
    );

  const maximumCaptureRingCount =
    Math.max(
      minimumCaptureRingCount,
      normalisePositiveInteger(
        spanCandidate.maximumCaptureRingCount,
        defaults.spanWebs.maximumCaptureRingCount
      )
    );

  const cornerMinimumSizeGridUnits =
    normalisePositiveNumber(
      cornerCandidate.minimumSizeGridUnits,
      defaults.cornerWebs.minimumSizeGridUnits
    );

  const cornerMaximumSizeGridUnits =
    Math.max(
      cornerMinimumSizeGridUnits,
      normalisePositiveNumber(
        cornerCandidate.maximumSizeGridUnits,
        defaults.cornerWebs.maximumSizeGridUnits
      )
    );

  const cornerMinimumAnchorCountPerSide =
    Math.max(
      2,
      normalisePositiveInteger(
        cornerCandidate.minimumAnchorCountPerSide,
        defaults.cornerWebs.minimumAnchorCountPerSide
      )
    );

  const cornerMaximumAnchorCountPerSide =
    Math.max(
      cornerMinimumAnchorCountPerSide,
      normalisePositiveInteger(
        cornerCandidate.maximumAnchorCountPerSide,
        defaults.cornerWebs.maximumAnchorCountPerSide
      )
    );

  const cornerMinimumCaptureRingCount =
    Math.max(
      2,
      normalisePositiveInteger(
        cornerCandidate.minimumCaptureRingCount,
        defaults.cornerWebs.minimumCaptureRingCount
      )
    );

  const cornerMaximumCaptureRingCount =
    Math.max(
      cornerMinimumCaptureRingCount,
      normalisePositiveInteger(
        cornerCandidate.maximumCaptureRingCount,
        defaults.cornerWebs.maximumCaptureRingCount
      )
    );

  const cornerMinimumHubDistanceGridUnits =
    normalisePositiveNumber(
      cornerCandidate.minimumHubDistanceGridUnits,
      defaults.cornerWebs.minimumHubDistanceGridUnits
    );

  const cornerMaximumHubDistanceGridUnits =
    Math.max(
      cornerMinimumHubDistanceGridUnits,
      normalisePositiveNumber(
        cornerCandidate.maximumHubDistanceGridUnits,
        defaults.cornerWebs.maximumHubDistanceGridUnits
      )
    );

  const carpetMinimumPatchCountPerRegion =
    normaliseNonNegativeInteger(
      carpetCandidate.minimumPatchCountPerRegion,
      defaults.carpetWebs.minimumPatchCountPerRegion
    );

  const carpetMaximumPatchCountPerRegion =
    Math.max(
      carpetMinimumPatchCountPerRegion,
      normaliseNonNegativeInteger(
        carpetCandidate.maximumPatchCountPerRegion,
        defaults.carpetWebs.maximumPatchCountPerRegion
      )
    );

  return deepFreezeJsonData({
    seed:
      normaliseSeed(
        candidate.seed,
        sceneId
      ),

    cornerWebs: {
      enabled:
        normaliseBoolean(
          cornerCandidate.enabled,
          defaults.cornerWebs.enabled
        ),
      maximumCount:
        normaliseNonNegativeInteger(
          cornerCandidate.maximumCount,
          defaults.cornerWebs.maximumCount
        ),
      endpointTolerancePx:
        normalisePositiveNumber(
          cornerCandidate.endpointTolerancePx,
          defaults.cornerWebs.endpointTolerancePx
        ),
      minimumCornerAngleDeg:
        normaliseBoundedNumber(
          cornerCandidate.minimumCornerAngleDeg,
          defaults.cornerWebs.minimumCornerAngleDeg,
          1,
          179
        ),
      maximumCornerAngleDeg:
        normaliseBoundedNumber(
          cornerCandidate.maximumCornerAngleDeg,
          defaults.cornerWebs.maximumCornerAngleDeg,
          1,
          179
        ),
      minimumWallLengthGridUnits:
        normalisePositiveNumber(
          cornerCandidate.minimumWallLengthGridUnits,
          defaults.cornerWebs.minimumWallLengthGridUnits
        ),
      minimumSizeGridUnits:
        cornerMinimumSizeGridUnits,
      maximumSizeGridUnits:
        cornerMaximumSizeGridUnits,
      minimumAnchorCountPerSide:
        cornerMinimumAnchorCountPerSide,
      maximumAnchorCountPerSide:
        cornerMaximumAnchorCountPerSide,
      minimumCaptureRingCount:
        cornerMinimumCaptureRingCount,
      maximumCaptureRingCount:
        cornerMaximumCaptureRingCount,
      minimumHubDistanceGridUnits:
        cornerMinimumHubDistanceGridUnits,
      maximumHubDistanceGridUnits:
        cornerMaximumHubDistanceGridUnits,
      hubAsymmetryFraction:
        normaliseBoundedNumber(
          cornerCandidate.hubAsymmetryFraction,
          defaults.cornerWebs.hubAsymmetryFraction,
          0,
          0.45
        ),
      maximumStructuralCurveGridUnits:
        normalisePositiveNumber(
          cornerCandidate.maximumStructuralCurveGridUnits,
          defaults.cornerWebs.maximumStructuralCurveGridUnits
        ),
      maximumCaptureCurveGridUnits:
        normalisePositiveNumber(
          cornerCandidate.maximumCaptureCurveGridUnits,
          defaults.cornerWebs.maximumCaptureCurveGridUnits
        ),
      outerCaptureGapChance:
        normaliseBoundedNumber(
          cornerCandidate.outerCaptureGapChance,
          defaults.cornerWebs.outerCaptureGapChance,
          0,
          0.95
        ),
      wallSupportChance:
        normaliseBoundedNumber(
          cornerCandidate.wallSupportChance,
          defaults.cornerWebs.wallSupportChance,
          0,
          1
        ),
      cornerSupportChance:
        normaliseBoundedNumber(
          cornerCandidate.cornerSupportChance,
          defaults.cornerWebs.cornerSupportChance,
          0,
          1
        ),
      maximumLooseStrands:
        normaliseNonNegativeInteger(
          cornerCandidate.maximumLooseStrands,
          defaults.cornerWebs.maximumLooseStrands
        )
    },

    spanWebs: {
      enabled:
        normaliseBoolean(
          spanCandidate.enabled,
          defaults.spanWebs.enabled
        ),
      maximumCount:
        normaliseNonNegativeInteger(
          spanCandidate.maximumCount,
          defaults.spanWebs.maximumCount
        ),
      minimumSpanGridUnits,
      maximumSpanGridUnits,
      minimumWallLengthGridUnits:
        normalisePositiveNumber(
          spanCandidate.minimumWallLengthGridUnits,
          defaults.spanWebs.minimumWallLengthGridUnits
        ),
      sampleSpacingGridUnits:
        normalisePositiveNumber(
          spanCandidate.sampleSpacingGridUnits,
          defaults.spanWebs.sampleSpacingGridUnits
        ),
      endpointInsetGridUnits:
        normaliseNonNegativeNumber(
          spanCandidate.endpointInsetGridUnits,
          defaults.spanWebs.endpointInsetGridUnits
        ),
      minimumSpacingGridUnits:
        normaliseNonNegativeNumber(
          spanCandidate.minimumSpacingGridUnits,
          defaults.spanWebs.minimumSpacingGridUnits
        ),
      maximumTangentDifferenceDeg:
        normaliseBoundedNumber(
          spanCandidate.maximumTangentDifferenceDeg,
          defaults.spanWebs.maximumTangentDifferenceDeg,
          0,
          89
        ),
      minimumLengthGridUnits,
      maximumLengthGridUnits,
      minimumLengthToSpanRatio,
      maximumLengthToSpanRatio,
      minimumAnchorCountPerSide,
      maximumAnchorCountPerSide,
      minimumCaptureRingCount,
      maximumCaptureRingCount,
      hubTangentOffsetFraction:
        normaliseBoundedNumber(
          spanCandidate.hubTangentOffsetFraction,
          defaults.spanWebs.hubTangentOffsetFraction,
          0,
          0.45
        ),
      hubSpanOffsetFraction:
        normaliseBoundedNumber(
          spanCandidate.hubSpanOffsetFraction,
          defaults.spanWebs.hubSpanOffsetFraction,
          0,
          0.45
        ),
      maximumStructuralCurveGridUnits:
        normalisePositiveNumber(
          spanCandidate.maximumStructuralCurveGridUnits,
          defaults.spanWebs.maximumStructuralCurveGridUnits
        ),
      maximumCaptureCurveGridUnits:
        normalisePositiveNumber(
          spanCandidate.maximumCaptureCurveGridUnits,
          defaults.spanWebs.maximumCaptureCurveGridUnits
        ),
      outerCaptureGapChance:
        normaliseBoundedNumber(
          spanCandidate.outerCaptureGapChance,
          defaults.spanWebs.outerCaptureGapChance,
          0,
          0.95
        ),
      wallSupportChance:
        normaliseBoundedNumber(
          spanCandidate.wallSupportChance,
          defaults.spanWebs.wallSupportChance,
          0,
          1
        ),
      maximumLooseStrands:
        normaliseNonNegativeInteger(
          spanCandidate.maximumLooseStrands,
          defaults.spanWebs.maximumLooseStrands
        )
    },

    groundWebs: {
      enabled:
        normaliseBoolean(
          groundCandidate.enabled,
          defaults.groundWebs.enabled
        ),
      count:
        normaliseNonNegativeInteger(
          groundCandidate.count,
          defaults.groundWebs.count
        ),
      minimumRadiusGridUnits:
        normalisePositiveNumber(
          groundCandidate.minimumRadiusGridUnits,
          defaults.groundWebs.minimumRadiusGridUnits
        ),
      maximumRadiusGridUnits:
        normalisePositiveNumber(
          groundCandidate.maximumRadiusGridUnits,
          defaults.groundWebs.maximumRadiusGridUnits
        ),
      edgeMarginGridUnits:
        normaliseNonNegativeNumber(
          groundCandidate.edgeMarginGridUnits,
          defaults.groundWebs.edgeMarginGridUnits
        )
    },

    carpetWebs: {
      enabled:
        normaliseBoolean(
          carpetCandidate.enabled,
          defaults.carpetWebs.enabled
        ),
      patchesPerGridSquare:
        normaliseNonNegativeNumber(
          carpetCandidate.patchesPerGridSquare,
          defaults.carpetWebs.patchesPerGridSquare
        ),
      minimumPatchCountPerRegion:
        carpetMinimumPatchCountPerRegion,
      maximumPatchCountPerRegion:
        carpetMaximumPatchCountPerRegion,
      basePatchSizeGridUnits:
        normalisePositiveNumber(
          carpetCandidate.basePatchSizeGridUnits,
          defaults.carpetWebs.basePatchSizeGridUnits
        ),
      placementAttemptsPerPatch:
        Math.max(
          1,
          normalisePositiveInteger(
            carpetCandidate.placementAttemptsPerPatch,
            defaults.carpetWebs.placementAttemptsPerPatch
          )
        ),
      minimumPatchSeparationGridUnits:
        normaliseNonNegativeNumber(
          carpetCandidate.minimumPatchSeparationGridUnits,
          defaults.carpetWebs.minimumPatchSeparationGridUnits
        ),
      maskResolutionPx:
        Math.max(
          64,
          Math.min(
            1024,
            normalisePositiveInteger(
              carpetCandidate.maskResolutionPx,
              defaults.carpetWebs.maskResolutionPx
            )
          )
        )
    },

    rendering: {
      layerMode:
        normaliseOptionalIdentifier(
          renderingCandidate.layerMode
        ) ??
        defaults.rendering.layerMode,
      zIndex:
        normaliseFiniteNumber(
          renderingCandidate.zIndex,
          defaults.rendering.zIndex
        ),
      underAlphaMultiplier:
        normaliseBoundedNumber(
          renderingCandidate.underAlphaMultiplier,
          defaults.rendering.underAlphaMultiplier,
          0,
          1
        ),
      underWidthAdditionPx:
        normaliseNonNegativeNumber(
          renderingCandidate.underWidthAdditionPx,
          defaults.rendering.underWidthAdditionPx
        )
    }
  });
}

function normaliseSeed(value, sceneId) {
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const text = String(value).trim();
    if (text.length > 0) return text;
  }

  return [
    MODULE_ID,
    "web-generation",
    "v3",
    normaliseOptionalIdentifier(sceneId) ?? "no-scene"
  ].join(":");
}

function normaliseBoolean(value, fallback) {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function normaliseNonNegativeInteger(value, fallback) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue >= 0
    ? numericValue
    : fallback;
}

function normalisePositiveInteger(value, fallback) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

function normaliseOptionalPositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

function normalisePositiveNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : fallback;
}

function normaliseNonNegativeNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0
    ? numericValue
    : fallback;
}

function normaliseFiniteNumber(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

function normaliseBoundedNumber(value, fallback, minimum, maximum) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(minimum, Math.min(maximum, numericValue));
}

function normaliseOptionalIdentifier(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
