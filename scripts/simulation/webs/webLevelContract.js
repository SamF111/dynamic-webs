import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

export const BASE_WEB_LEVEL_ID =
  "base";

export const WEB_LEVEL_PROVIDER_MODES =
  Object.freeze({
    AUTO:
      "auto",
    NATIVE_V14:
      "native-v14",
    LEVELS_V13:
      "levels-v13",
    BASE:
      "base"
  });

export const WEB_LEVEL_PROVIDER_MODE_VALUES =
  Object.freeze(
    Object.values(
      WEB_LEVEL_PROVIDER_MODES
    )
  );

export function normaliseWebLevelProviderMode(
  value,
  fallback = WEB_LEVEL_PROVIDER_MODES.AUTO
) {
  const candidate =
    typeof value ===
      "string"
      ? value.trim()
      : "";

  const resolved =
    candidate.length >
      0
      ? candidate
      : fallback;

  if (
    !WEB_LEVEL_PROVIDER_MODE_VALUES.includes(
      resolved
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported level provider mode "${String(value)}". Supported modes: ${WEB_LEVEL_PROVIDER_MODE_VALUES.join(", ")}.`
    );
  }

  return resolved;
}

export function createWebElevationBand({
  bottom = null,
  top = null
} = {}) {
  const safeBottom =
    normaliseOptionalElevation(
      bottom
    );

  const safeTop =
    normaliseOptionalElevation(
      top
    );

  if (
    safeBottom !==
      null &&
    safeTop !==
      null &&
    safeTop <
      safeBottom
  ) {
    throw new Error(
      `${MODULE_TITLE} | A web level elevation band cannot end below its bottom elevation.`
    );
  }

  return Object.freeze({
    bottom:
      safeBottom,
    top:
      safeTop
  });
}

export function createWebLevelDescriptor({
  id,
  label = null,
  providerMode,
  elevationBand = null,
  source = null
}) {
  const levelId =
    requireIdentifier(
      id,
      "web level ID"
    );

  const resolvedProviderMode =
    normaliseWebLevelProviderMode(
      providerMode,
      WEB_LEVEL_PROVIDER_MODES.BASE
    );

  const band =
    createWebElevationBand(
      elevationBand ??
      {}
    );

  return Object.freeze({
    id:
      levelId,
    label:
      normaliseOptionalLabel(
        label
      ) ??
      formatWebLevelLabel(
        levelId,
        band
      ),
    providerMode:
      resolvedProviderMode,
    elevationBand:
      band,
    source:
      normaliseOptionalLabel(
        source
      )
  });
}

export function createBaseWebLevel() {
  return createWebLevelDescriptor({
    id:
      BASE_WEB_LEVEL_ID,
    label:
      "Base level",
    providerMode:
      WEB_LEVEL_PROVIDER_MODES.BASE,
    elevationBand: {
      bottom:
        null,
      top:
        null
    },
    source:
      "base"
  });
}

export function createElevationBandLevelId(
  bottom,
  top
) {
  const band =
    createWebElevationBand({
      bottom,
      top
    });

  return [
    "elevation",
    formatElevationIdentifier(
      band.bottom
    ),
    formatElevationIdentifier(
      band.top
    )
  ].join(":");
}

export function elevationBandsEqual(
  first,
  second
) {
  const firstBand =
    createWebElevationBand(
      first ??
      {}
    );

  const secondBand =
    createWebElevationBand(
      second ??
      {}
    );

  return firstBand.bottom ===
    secondBand.bottom &&
    firstBand.top ===
      secondBand.top;
}

export function elevationBandsOverlap(
  first,
  second
) {
  const firstBand =
    createWebElevationBand(
      first ??
      {}
    );

  const secondBand =
    createWebElevationBand(
      second ??
      {}
    );

  if (
    firstBand.bottom ===
      null ||
    firstBand.top ===
      null ||
    secondBand.bottom ===
      null ||
    secondBand.top ===
      null
  ) {
    return false;
  }

  return firstBand.bottom <=
    secondBand.top &&
    secondBand.bottom <=
      firstBand.top;
}

export function assertWebLevelMetadata(
  value,
  contextLabel = "web level metadata"
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} must be an object.`
    );
  }

  const descriptor =
    createWebLevelDescriptor({
      id:
        value.id ??
        value.levelId,
      label:
        value.label ??
        value.levelLabel,
      providerMode:
        value.providerMode ??
        value.levelProviderMode,
      elevationBand:
        value.elevationBand,
      source:
        value.source
    });

  return descriptor;
}

function normaliseOptionalElevation(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      "" ||
    value ===
      Infinity ||
    value ===
      -Infinity
  ) {
    return null;
  }

  const numericValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return null;
  }

  return Object.is(
    numericValue,
    -0
  )
    ? 0
    : numericValue;
}

function formatWebLevelLabel(
  levelId,
  band
) {
  if (
    levelId ===
      BASE_WEB_LEVEL_ID
  ) {
    return "Base level";
  }

  if (
    band.bottom !==
      null ||
    band.top !==
      null
  ) {
    return `${formatElevationLabel(band.bottom)} to ${formatElevationLabel(band.top)}`;
  }

  return levelId;
}

function formatElevationIdentifier(
  value
) {
  if (
    value ===
      null
  ) {
    return "open";
  }

  return String(
    value
  ).replaceAll(
    ".",
    "_"
  );
}

function formatElevationLabel(
  value
) {
  return value ===
    null
    ? "open"
    : String(
        value
      );
}

function normaliseOptionalLabel(
  value
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const text =
    value.trim();

  return text.length >
    0
    ? text
    : null;
}

function requireIdentifier(
  value,
  contextLabel
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} is required.`
    );
  }

  const identifier =
    String(
      value
    ).trim();

  if (
    identifier.length ===
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} cannot be empty.`
    );
  }

  return identifier;
}
