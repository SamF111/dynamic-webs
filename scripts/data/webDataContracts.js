import {
  WEB_RENDER_LAYER_MODES
} from "../module/moduleConstants.js";

import {
  assertBoolean,
  assertFiniteNumber,
  assertJsonObject,
  assertNonNegativeInteger,
  assertNonNegativeNumber,
  assertNumberInRange,
  assertPositiveInteger,
  assertPositiveNumber,
  assertRequiredString,
  deepFreezeJsonData
} from "./jsonData.js";

const WEB_GENERATION_DEFAULTS_CONTEXT =
  "web generation defaults";

export const WEB_GENERATION_DEFAULTS_SCHEMA_VERSION =
  2;

const BOOLEAN =
  (value, contextLabel) =>
    assertBoolean(
      value,
      contextLabel
    );

const POSITIVE_NUMBER =
  (value, contextLabel) =>
    assertPositiveNumber(
      value,
      contextLabel
    );

const NON_NEGATIVE_NUMBER =
  (value, contextLabel) =>
    assertNonNegativeNumber(
      value,
      contextLabel
    );

const NON_NEGATIVE_INTEGER =
  (value, contextLabel) =>
    assertNonNegativeInteger(
      value,
      contextLabel
    );

const INTEGER_AT_LEAST_TWO =
  (value, contextLabel) =>
    assertIntegerAtLeast(
      value,
      contextLabel,
      2
    );

const PROBABILITY =
  (value, contextLabel) =>
    assertNumberInRange(
      value,
      contextLabel,
      {
        minimum:
          0,
        maximum:
          1
      }
    );

const FRACTION_UP_TO_045 =
  (value, contextLabel) =>
    assertNumberInRange(
      value,
      contextLabel,
      {
        minimum:
          0,
        maximum:
          0.45
      }
    );

const CAPTURE_GAP_CHANCE =
  (value, contextLabel) =>
    assertNumberInRange(
      value,
      contextLabel,
      {
        minimum:
          0,
        maximum:
          0.95
      }
    );

const CORNER_ANGLE =
  (value, contextLabel) =>
    assertNumberInRange(
      value,
      contextLabel,
      {
        minimum:
          1,
        maximum:
          179
      }
    );

const TANGENT_DIFFERENCE =
  (value, contextLabel) =>
    assertNumberInRange(
      value,
      contextLabel,
      {
        minimum:
          0,
        maximum:
          89
      }
    );

const CORNER_WEB_SCHEMA =
  Object.freeze({
    enabled:
      BOOLEAN,
    maximumCount:
      NON_NEGATIVE_INTEGER,
    endpointTolerancePx:
      POSITIVE_NUMBER,
    minimumCornerAngleDeg:
      CORNER_ANGLE,
    maximumCornerAngleDeg:
      CORNER_ANGLE,
    minimumWallLengthGridUnits:
      POSITIVE_NUMBER,
    minimumSizeGridUnits:
      POSITIVE_NUMBER,
    maximumSizeGridUnits:
      POSITIVE_NUMBER,
    minimumAnchorCountPerSide:
      INTEGER_AT_LEAST_TWO,
    maximumAnchorCountPerSide:
      INTEGER_AT_LEAST_TWO,
    minimumCaptureRingCount:
      INTEGER_AT_LEAST_TWO,
    maximumCaptureRingCount:
      INTEGER_AT_LEAST_TWO,
    minimumHubDistanceGridUnits:
      POSITIVE_NUMBER,
    maximumHubDistanceGridUnits:
      POSITIVE_NUMBER,
    hubAsymmetryFraction:
      FRACTION_UP_TO_045,
    maximumStructuralCurveGridUnits:
      POSITIVE_NUMBER,
    maximumCaptureCurveGridUnits:
      POSITIVE_NUMBER,
    outerCaptureGapChance:
      CAPTURE_GAP_CHANCE,
    wallSupportChance:
      PROBABILITY,
    cornerSupportChance:
      PROBABILITY,
    maximumLooseStrands:
      NON_NEGATIVE_INTEGER
  });

const SPAN_WEB_SCHEMA =
  Object.freeze({
    enabled:
      BOOLEAN,
    maximumCount:
      NON_NEGATIVE_INTEGER,
    minimumSpanGridUnits:
      POSITIVE_NUMBER,
    maximumSpanGridUnits:
      POSITIVE_NUMBER,
    minimumWallLengthGridUnits:
      POSITIVE_NUMBER,
    sampleSpacingGridUnits:
      POSITIVE_NUMBER,
    endpointInsetGridUnits:
      NON_NEGATIVE_NUMBER,
    minimumSpacingGridUnits:
      NON_NEGATIVE_NUMBER,
    maximumTangentDifferenceDeg:
      TANGENT_DIFFERENCE,
    minimumLengthGridUnits:
      POSITIVE_NUMBER,
    maximumLengthGridUnits:
      POSITIVE_NUMBER,
    minimumLengthToSpanRatio:
      POSITIVE_NUMBER,
    maximumLengthToSpanRatio:
      POSITIVE_NUMBER,
    minimumAnchorCountPerSide:
      INTEGER_AT_LEAST_TWO,
    maximumAnchorCountPerSide:
      INTEGER_AT_LEAST_TWO,
    minimumCaptureRingCount:
      INTEGER_AT_LEAST_TWO,
    maximumCaptureRingCount:
      INTEGER_AT_LEAST_TWO,
    hubTangentOffsetFraction:
      FRACTION_UP_TO_045,
    hubSpanOffsetFraction:
      FRACTION_UP_TO_045,
    maximumStructuralCurveGridUnits:
      POSITIVE_NUMBER,
    maximumCaptureCurveGridUnits:
      POSITIVE_NUMBER,
    outerCaptureGapChance:
      CAPTURE_GAP_CHANCE,
    wallSupportChance:
      PROBABILITY,
    maximumLooseStrands:
      NON_NEGATIVE_INTEGER
  });

const GROUND_WEB_SCHEMA =
  Object.freeze({
    enabled:
      BOOLEAN,
    count:
      NON_NEGATIVE_INTEGER,
    minimumRadiusGridUnits:
      POSITIVE_NUMBER,
    maximumRadiusGridUnits:
      POSITIVE_NUMBER,
    edgeMarginGridUnits:
      NON_NEGATIVE_NUMBER
  });

const CARPET_WEB_SCHEMA =
  Object.freeze({
    enabled:
      BOOLEAN,
    patchesPerGridSquare:
      NON_NEGATIVE_NUMBER,
    minimumPatchCountPerRegion:
      NON_NEGATIVE_INTEGER,
    maximumPatchCountPerRegion:
      NON_NEGATIVE_INTEGER,
    basePatchSizeGridUnits:
      POSITIVE_NUMBER,
    placementAttemptsPerPatch:
      POSITIVE_NUMBER,
    minimumPatchSeparationGridUnits:
      NON_NEGATIVE_NUMBER,
    maskResolutionPx:
      POSITIVE_NUMBER
  });

const RENDERING_SCHEMA =
  Object.freeze({
    layerMode:
      validateRenderLayerMode,
    zIndex:
      (value, contextLabel) =>
        assertFiniteNumber(
          value,
          contextLabel
        ),
    underAlphaMultiplier:
      PROBABILITY,
    underWidthAdditionPx:
      NON_NEGATIVE_NUMBER
  });

/**
 * Validate checked-in web-generation defaults and convert JSON-friendly values
 * into the runtime representation expected by generators and PIXI rendering.
 *
 * @param {unknown} data - Candidate defaults JSON.
 * @returns {Readonly<object>} Deeply frozen runtime defaults.
 */
export function validateWebGenerationDefaults(
  data
) {
  const root =
    assertJsonObject(
      data,
      WEB_GENERATION_DEFAULTS_CONTEXT
    );

  assertExactKeys(
    root,
    [
      "schemaVersion",
      "cornerWebs",
      "spanWebs",
      "groundWebs",
      "carpetWebs",
      "rendering"
    ],
    WEB_GENERATION_DEFAULTS_CONTEXT
  );

  const schemaVersion =
    assertPositiveInteger(
      root.schemaVersion,
      `${WEB_GENERATION_DEFAULTS_CONTEXT}.schemaVersion`
    );

  if (
    schemaVersion !==
      WEB_GENERATION_DEFAULTS_SCHEMA_VERSION
  ) {
    throw new Error(
      `Dynamic Webs | ${WEB_GENERATION_DEFAULTS_CONTEXT}.schemaVersion must be ${WEB_GENERATION_DEFAULTS_SCHEMA_VERSION}.`
    );
  }

  const cornerWebs =
    validateFields(
      root.cornerWebs,
      `${WEB_GENERATION_DEFAULTS_CONTEXT}.cornerWebs`,
      CORNER_WEB_SCHEMA
    );

  assertOrderedFields(
    cornerWebs,
    "minimumCornerAngleDeg",
    "maximumCornerAngleDeg",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.cornerWebs`
  );

  assertOrderedFields(
    cornerWebs,
    "minimumSizeGridUnits",
    "maximumSizeGridUnits",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.cornerWebs`
  );

  assertOrderedFields(
    cornerWebs,
    "minimumAnchorCountPerSide",
    "maximumAnchorCountPerSide",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.cornerWebs`
  );

  assertOrderedFields(
    cornerWebs,
    "minimumCaptureRingCount",
    "maximumCaptureRingCount",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.cornerWebs`
  );

  assertOrderedFields(
    cornerWebs,
    "minimumHubDistanceGridUnits",
    "maximumHubDistanceGridUnits",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.cornerWebs`
  );

  const spanWebs =
    validateFields(
      root.spanWebs,
      `${WEB_GENERATION_DEFAULTS_CONTEXT}.spanWebs`,
      SPAN_WEB_SCHEMA
    );

  assertOrderedFields(
    spanWebs,
    "minimumSpanGridUnits",
    "maximumSpanGridUnits",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.spanWebs`
  );

  assertOrderedFields(
    spanWebs,
    "minimumLengthGridUnits",
    "maximumLengthGridUnits",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.spanWebs`
  );

  assertOrderedFields(
    spanWebs,
    "minimumLengthToSpanRatio",
    "maximumLengthToSpanRatio",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.spanWebs`
  );

  assertOrderedFields(
    spanWebs,
    "minimumAnchorCountPerSide",
    "maximumAnchorCountPerSide",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.spanWebs`
  );

  assertOrderedFields(
    spanWebs,
    "minimumCaptureRingCount",
    "maximumCaptureRingCount",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.spanWebs`
  );

  const groundWebs =
    validateFields(
      root.groundWebs,
      `${WEB_GENERATION_DEFAULTS_CONTEXT}.groundWebs`,
      GROUND_WEB_SCHEMA
    );

  assertOrderedFields(
    groundWebs,
    "minimumRadiusGridUnits",
    "maximumRadiusGridUnits",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.groundWebs`
  );

  const carpetWebs =
    validateFields(
      root.carpetWebs,
      `${WEB_GENERATION_DEFAULTS_CONTEXT}.carpetWebs`,
      CARPET_WEB_SCHEMA
    );

  assertOrderedFields(
    carpetWebs,
    "minimumPatchCountPerRegion",
    "maximumPatchCountPerRegion",
    `${WEB_GENERATION_DEFAULTS_CONTEXT}.carpetWebs`
  );

  return deepFreezeJsonData({
    seed:
      null,
    cornerWebs,
    spanWebs,
    groundWebs,
    carpetWebs,
    rendering:
      validateFields(
        root.rendering,
        `${WEB_GENERATION_DEFAULTS_CONTEXT}.rendering`,
        RENDERING_SCHEMA
      )
  });
}

function validateFields(
  value,
  contextLabel,
  schema
) {
  const data =
    assertJsonObject(
      value,
      contextLabel
    );

  assertExactKeys(
    data,
    Object.keys(
      schema
    ),
    contextLabel
  );

  return Object.fromEntries(
    Object.entries(
      schema
    ).map(
      ([
        fieldName,
        validator
      ]) =>
        [
          fieldName,
          validator(
            data[fieldName],
            `${contextLabel}.${fieldName}`
          )
        ]
    )
  );
}

function assertExactKeys(
  value,
  expectedKeys,
  contextLabel
) {
  const expected =
    new Set(
      expectedKeys
    );

  const unexpected =
    Object.keys(
      value
    ).filter(
      (
        key
      ) =>
        !expected.has(
          key
        )
    );

  if (
    unexpected.length >
      0
  ) {
    throw new Error(
      `Dynamic Webs | ${contextLabel} contains unsupported field${unexpected.length === 1 ? "" : "s"}: ${unexpected.join(", ")}.`
    );
  }

  const missing =
    expectedKeys.filter(
      (
        key
      ) =>
        !Object.prototype.hasOwnProperty.call(
          value,
          key
        )
    );

  if (
    missing.length >
      0
  ) {
    throw new Error(
      `Dynamic Webs | ${contextLabel} is missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`
    );
  }
}

function assertOrderedFields(
  value,
  minimumField,
  maximumField,
  contextLabel
) {
  if (
    value[maximumField] <
      value[minimumField]
  ) {
    throw new Error(
      `Dynamic Webs | ${contextLabel}.${maximumField} must be greater than or equal to ${contextLabel}.${minimumField}.`
    );
  }
}

function assertIntegerAtLeast(
  value,
  contextLabel,
  minimum
) {
  const numberValue =
    assertPositiveInteger(
      value,
      contextLabel
    );

  if (
    numberValue <
      minimum
  ) {
    throw new Error(
      `Dynamic Webs | ${contextLabel} must be greater than or equal to ${minimum}.`
    );
  }

  return numberValue;
}

function validateRenderLayerMode(
  value,
  contextLabel
) {
  const layerMode =
    assertRequiredString(
      value,
      contextLabel
    );

  if (
    !Object.values(
      WEB_RENDER_LAYER_MODES
    ).includes(
      layerMode
    )
  ) {
    throw new Error(
      `Dynamic Webs | ${contextLabel} must be a supported web render-layer mode.`
    );
  }

  return layerMode;
}

function parseHexColour(
  value,
  contextLabel
) {
  const text =
    assertRequiredString(
      value,
      contextLabel
    ).toLowerCase();

  const match =
    /^#([0-9a-f]{6})$/u.exec(
      text
    );

  if (!match) {
    throw new TypeError(
      `Dynamic Webs | ${contextLabel} must be a six-digit CSS hex colour.`
    );
  }

  return Number.parseInt(
    match[1],
    16
  );
}

const WEB_DENSITY_PRESETS_CONTEXT =
  "web density presets";

export const WEB_DENSITY_PRESETS_SCHEMA_VERSION =
  3;

const WEB_DENSITY_CORNER_CONFIGURATION_SCHEMA =
  Object.freeze({
    maximumCount:
      NON_NEGATIVE_INTEGER
  });

const WEB_DENSITY_SPAN_CONFIGURATION_SCHEMA =
  Object.freeze({
    maximumCount:
      NON_NEGATIVE_INTEGER,
    minimumSpacingGridUnits:
      NON_NEGATIVE_NUMBER
  });

const WEB_DENSITY_GROUND_CONFIGURATION_SCHEMA =
  Object.freeze({
    count:
      NON_NEGATIVE_INTEGER
  });

const WEB_DENSITY_CARPET_CONFIGURATION_SCHEMA =
  Object.freeze({
    patchesPerGridSquare:
      NON_NEGATIVE_NUMBER,
    minimumPatchCountPerRegion:
      NON_NEGATIVE_INTEGER,
    maximumPatchCountPerRegion:
      NON_NEGATIVE_INTEGER,
    minimumPatchSeparationGridUnits:
      NON_NEGATIVE_NUMBER
  });


function validateCarpetDensityConfiguration(
  value,
  contextLabel
) {
  const configuration =
    validateFields(
      value,
      contextLabel,
      WEB_DENSITY_CARPET_CONFIGURATION_SCHEMA
    );

  assertOrderedFields(
    configuration,
    "minimumPatchCountPerRegion",
    "maximumPatchCountPerRegion",
    contextLabel
  );

  return configuration;
}

/**
 * Validate JSON-backed Scene web-density presets.
 *
 * Density presets deliberately own only abundance and spacing values. Detailed
 * geometry and rendering remain authoritative in data/webs/defaults.json.
 *
 * @param {unknown} data - Candidate density-preset JSON.
 * @returns {Readonly<object>} Deeply frozen validated preset collection.
 */
export function validateWebDensityPresets(
  data
) {
  const root =
    assertJsonObject(
      data,
      WEB_DENSITY_PRESETS_CONTEXT
    );

  assertExactKeys(
    root,
    [
      "schemaVersion",
      "presets"
    ],
    WEB_DENSITY_PRESETS_CONTEXT
  );

  const schemaVersion =
    assertPositiveInteger(
      root.schemaVersion,
      `${WEB_DENSITY_PRESETS_CONTEXT}.schemaVersion`
    );

  if (
    schemaVersion !==
      WEB_DENSITY_PRESETS_SCHEMA_VERSION
  ) {
    throw new Error(
      `Dynamic Webs | ${WEB_DENSITY_PRESETS_CONTEXT}.schemaVersion must be ${WEB_DENSITY_PRESETS_SCHEMA_VERSION}.`
    );
  }

  if (
    !Array.isArray(
      root.presets
    ) ||
    root.presets.length ===
      0
  ) {
    throw new TypeError(
      `Dynamic Webs | ${WEB_DENSITY_PRESETS_CONTEXT}.presets must be a non-empty array.`
    );
  }

  const usedIds =
    new Set();

  const presets =
    root.presets.map(
      (
        value,
        index
      ) => {
        const contextLabel =
          `${WEB_DENSITY_PRESETS_CONTEXT}.presets.${index}`;

        const preset =
          assertJsonObject(
            value,
            contextLabel
          );

        assertExactKeys(
          preset,
          [
            "id",
            "label",
            "configuration"
          ],
          contextLabel
        );

        const id =
          assertRequiredString(
            preset.id,
            `${contextLabel}.id`
          );

        if (
          id ===
            "disabled"
        ) {
          throw new Error(
            `Dynamic Webs | ${contextLabel}.id "disabled" is reserved for the no-web Scene mode.`
          );
        }

        if (
          usedIds.has(
            id
          )
        ) {
          throw new Error(
            `Dynamic Webs | Duplicate web density preset id "${id}".`
          );
        }

        usedIds.add(
          id
        );

        const configuration =
          assertJsonObject(
            preset.configuration,
            `${contextLabel}.configuration`
          );

        assertExactKeys(
          configuration,
          [
            "cornerWebs",
            "spanWebs",
            "groundWebs",
            "carpetWebs"
          ],
          `${contextLabel}.configuration`
        );

        return {
          id,
          label:
            assertRequiredString(
              preset.label,
              `${contextLabel}.label`
            ),
          configuration: {
            cornerWebs:
              validateFields(
                configuration.cornerWebs,
                `${contextLabel}.configuration.cornerWebs`,
                WEB_DENSITY_CORNER_CONFIGURATION_SCHEMA
              ),
            spanWebs:
              validateFields(
                configuration.spanWebs,
                `${contextLabel}.configuration.spanWebs`,
                WEB_DENSITY_SPAN_CONFIGURATION_SCHEMA
              ),
            groundWebs:
              validateFields(
                configuration.groundWebs,
                `${contextLabel}.configuration.groundWebs`,
                WEB_DENSITY_GROUND_CONFIGURATION_SCHEMA
              ),
            carpetWebs:
              validateCarpetDensityConfiguration(
                configuration.carpetWebs,
                `${contextLabel}.configuration.carpetWebs`
              )
          }
        };
      }
    );

  return deepFreezeJsonData({
    schemaVersion,
    presets
  });
}




const WEB_COLOUR_PROFILES_CONTEXT =
  "web colour profiles";

export const WEB_COLOUR_PROFILES_SCHEMA_VERSION =
  1;

const WEB_COLOUR_PROFILE_CONFIGURATION_SCHEMA =
  Object.freeze({
    structuralColour:
      parseHexColour,
    captureColour:
      parseHexColour,
    decorativeColour:
      parseHexColour,
    underColour:
      parseHexColour,
    alphaMultiplier:
      PROBABILITY
  });

/** Validate JSON-authored web-colour profiles. */
export function validateWebColourProfiles(
  data
) {
  const root =
    assertJsonObject(
      data,
      WEB_COLOUR_PROFILES_CONTEXT
    );

  assertExactKeys(
    root,
    [
      "schemaVersion",
      "defaultProfileId",
      "profiles"
    ],
    WEB_COLOUR_PROFILES_CONTEXT
  );

  const schemaVersion =
    assertPositiveInteger(
      root.schemaVersion,
      `${WEB_COLOUR_PROFILES_CONTEXT}.schemaVersion`
    );

  if (
    schemaVersion !==
      WEB_COLOUR_PROFILES_SCHEMA_VERSION
  ) {
    throw new Error(
      `Dynamic Webs | ${WEB_COLOUR_PROFILES_CONTEXT}.schemaVersion must be ${WEB_COLOUR_PROFILES_SCHEMA_VERSION}.`
    );
  }

  const defaultProfileId =
    assertRequiredString(
      root.defaultProfileId,
      `${WEB_COLOUR_PROFILES_CONTEXT}.defaultProfileId`
    );

  if (
    !Array.isArray(
      root.profiles
    ) ||
    root.profiles.length ===
      0
  ) {
    throw new TypeError(
      `Dynamic Webs | ${WEB_COLOUR_PROFILES_CONTEXT}.profiles must be a non-empty array.`
    );
  }

  const usedIds =
    new Set();

  const profiles =
    root.profiles.map(
      (
        value,
        index
      ) => {
        const contextLabel =
          `${WEB_COLOUR_PROFILES_CONTEXT}.profiles.${index}`;

        const profile =
          assertJsonObject(
            value,
            contextLabel
          );

        assertExactKeys(
          profile,
          [
            "id",
            "label",
            "configuration"
          ],
          contextLabel
        );

        const id =
          assertRequiredString(
            profile.id,
            `${contextLabel}.id`
          );

        if (
          usedIds.has(
            id
          )
        ) {
          throw new Error(
            `Dynamic Webs | Duplicate web colour profile id "${id}".`
          );
        }

        usedIds.add(
          id
        );

        return {
          id,
          label:
            assertRequiredString(
              profile.label,
              `${contextLabel}.label`
            ),
          configuration:
            validateFields(
              profile.configuration,
              `${contextLabel}.configuration`,
              WEB_COLOUR_PROFILE_CONFIGURATION_SCHEMA
            )
        };
      }
    );

  if (
    !usedIds.has(
      defaultProfileId
    )
  ) {
    throw new Error(
      `Dynamic Webs | Default web colour profile "${defaultProfileId}" is not defined.`
    );
  }

  return deepFreezeJsonData({
    schemaVersion,
    defaultProfileId,
    profiles
  });
}
