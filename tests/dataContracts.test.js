import test from "node:test";
import assert from "node:assert/strict";

import {
  validateWebDensityPresets,
  validateWebGenerationDefaults
} from "../scripts/data/webDataContracts.js";

const VALID_DEFAULTS =
  Object.freeze({
    schemaVersion:
      1,
    cornerWebs: {
      enabled:
        true,
      maximumCount:
        1,
      endpointTolerancePx:
        4,
      minimumCornerAngleDeg:
        35,
      maximumCornerAngleDeg:
        145,
      minimumWallLengthGridUnits:
        0.45,
      minimumSizeGridUnits:
        0.35,
      maximumSizeGridUnits:
        0.85,
      minimumAnchorCountPerSide:
        2,
      maximumAnchorCountPerSide:
        4,
      minimumCaptureRingCount:
        4,
      maximumCaptureRingCount:
        7,
      minimumHubDistanceGridUnits:
        0.1,
      maximumHubDistanceGridUnits:
        0.22,
      hubAsymmetryFraction:
        0.18,
      maximumStructuralCurveGridUnits:
        0.065,
      maximumCaptureCurveGridUnits:
        0.04,
      outerCaptureGapChance:
        0.5,
      wallSupportChance:
        0.3,
      cornerSupportChance:
        0.72,
      maximumLooseStrands:
        2
    },
    spanWebs: {
      enabled:
        true,
      maximumCount:
        1,
      minimumSpanGridUnits:
        0.35,
      maximumSpanGridUnits:
        1.5,
      minimumWallLengthGridUnits:
        0.35,
      sampleSpacingGridUnits:
        0.25,
      endpointInsetGridUnits:
        0.12,
      minimumSpacingGridUnits:
        1.25,
      maximumTangentDifferenceDeg:
        35,
      minimumLengthGridUnits:
        0.8,
      maximumLengthGridUnits:
        1.6,
      minimumLengthToSpanRatio:
        0.9,
      maximumLengthToSpanRatio:
        1.35,
      minimumAnchorCountPerSide:
        3,
      maximumAnchorCountPerSide:
        5,
      minimumCaptureRingCount:
        5,
      maximumCaptureRingCount:
        8,
      hubTangentOffsetFraction:
        0.24,
      hubSpanOffsetFraction:
        0.18,
      maximumStructuralCurveGridUnits:
        0.075,
      maximumCaptureCurveGridUnits:
        0.045,
      outerCaptureGapChance:
        0.55,
      wallSupportChance:
        0.35,
      maximumLooseStrands:
        2
    },
    groundWebs: {
      enabled:
        true,
      count:
        1,
      minimumRadiusGridUnits:
        0.35,
      maximumRadiusGridUnits:
        0.75,
      edgeMarginGridUnits:
        0.9
    },
    rendering: {
      layerMode:
        "under-tokens",
      zIndex:
        -100,
      silkColour:
        "#e8edf2",
      underColour:
        "#111827",
      underAlphaMultiplier:
        0.42,
      underWidthAdditionPx:
        1.1
    }
  });

function clone(
  value
) {
  return JSON.parse(
    JSON.stringify(
      value
    )
  );
}

test(
  "generation defaults are validated, converted and deeply frozen",
  () => {
    const validated =
      validateWebGenerationDefaults(
        clone(
          VALID_DEFAULTS
        )
      );

    assert.equal(
      validated.seed,
      null
    );

    assert.equal(
      validated.rendering.silkColour,
      0xe8edf2
    );

    assert.equal(
      Object.isFrozen(
        validated
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        validated.cornerWebs
      ),
      true
    );
  }
);

test(
  "generation defaults reject unknown fields, invalid colours and reversed ranges",
  () => {
    const unknownField =
      clone(
        VALID_DEFAULTS
      );

    unknownField.extra =
      true;

    assert.throws(
      () =>
        validateWebGenerationDefaults(
          unknownField
        ),
      /unsupported field/u
    );

    const invalidColour =
      clone(
        VALID_DEFAULTS
      );

    invalidColour.rendering.silkColour =
      "white";

    assert.throws(
      () =>
        validateWebGenerationDefaults(
          invalidColour
        ),
      /six-digit CSS hex colour/u
    );

    const reversedRange =
      clone(
        VALID_DEFAULTS
      );

    reversedRange.groundWebs.minimumRadiusGridUnits =
      2;

    reversedRange.groundWebs.maximumRadiusGridUnits =
      1;

    assert.throws(
      () =>
        validateWebGenerationDefaults(
          reversedRange
        ),
      /must be greater than or equal/u
    );
  }
);

test(
  "density presets reject duplicate and reserved identifiers",
  () => {
    const basePreset = {
      id:
        "standard",
      label:
        "Standard",
      configuration: {
        cornerWebs: {
          maximumCount:
            2
        },
        spanWebs: {
          maximumCount:
            2,
          minimumSpacingGridUnits:
            1
        },
        groundWebs: {
          count:
            2
        }
      }
    };

    assert.throws(
      () =>
        validateWebDensityPresets({
          schemaVersion:
            1,
          presets: [
            clone(
              basePreset
            ),
            clone(
              basePreset
            )
          ]
        }),
      /Duplicate web density preset id/u
    );

    const reserved =
      clone(
        basePreset
      );

    reserved.id =
      "disabled";

    assert.throws(
      () =>
        validateWebDensityPresets({
          schemaVersion:
            1,
          presets: [
            reserved
          ]
        }),
      /reserved/u
    );
  }
);
