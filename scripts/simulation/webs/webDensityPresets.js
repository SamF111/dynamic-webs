import webDensityPresetsData from "../../../data/webs/presets.json" with {
  type:
    "json"
};

import {
  validateWebDensityPresets
} from "../../data/webDataContracts.js";

export const DISABLED_WEB_DENSITY_ID =
  "disabled";

const VALIDATED_WEB_DENSITY_DATA =
  validateWebDensityPresets(
    webDensityPresetsData
  );

export const WEB_DENSITY_PRESETS =
  VALIDATED_WEB_DENSITY_DATA.presets;

const WEB_DENSITY_PRESETS_BY_ID =
  new Map(
    WEB_DENSITY_PRESETS.map(
      (
        preset
      ) => [
        preset.id,
        preset
      ]
    )
  );

export const WEB_DENSITY_ORDER =
  Object.freeze([
    DISABLED_WEB_DENSITY_ID,
    ...WEB_DENSITY_PRESETS.map(
      (
        preset
      ) => preset.id
    )
  ]);

export const WEB_DENSITY_OPTIONS =
  Object.freeze([
    Object.freeze({
      id:
        DISABLED_WEB_DENSITY_ID,
      label:
        "Disabled"
    }),
    ...WEB_DENSITY_PRESETS.map(
      (
        preset
      ) => Object.freeze({
        id:
          preset.id,
        label:
          preset.label
      })
    )
  ]);

/** @returns {boolean} True when the identifier is a supported Scene density. */
export function isSupportedWebDensityId(
  value
) {
  return (
    typeof value ===
      "string" &&
    WEB_DENSITY_ORDER.includes(
      value.trim()
    )
  );
}

/**
 * Resolve one active density preset.
 *
 * Disabled is not an active generation preset and therefore resolves to null.
 * Unknown values throw rather than silently changing Scene presentation.
 *
 * @param {unknown} densityId - Candidate density identifier.
 * @returns {Readonly<object>|null} Preset or null for disabled.
 */
export function getWebDensityPreset(
  densityId
) {
  if (
    typeof densityId !==
      "string"
  ) {
    throw new TypeError(
      "Dynamic Webs | Web density must be a string."
    );
  }

  const id =
    densityId.trim();

  if (
    id ===
      DISABLED_WEB_DENSITY_ID
  ) {
    return null;
  }

  const preset =
    WEB_DENSITY_PRESETS_BY_ID.get(
      id
    );

  if (!preset) {
    throw new Error(
      `Dynamic Webs | Unsupported web density "${id}". Supported densities: ${WEB_DENSITY_ORDER.join(", ")}.`
    );
  }

  return preset;
}

/** @returns {readonly Readonly<object>[]} Immutable density options. */
export function getWebDensityOptions() {
  return WEB_DENSITY_OPTIONS;
}

