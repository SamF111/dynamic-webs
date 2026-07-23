import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

export const SPAN_WEB_VISION_MODES =
  Object.freeze({
    NONE:
      "none",
    LIMITED:
      "limited",
    BLOCKED:
      "blocked"
  });

export const SPAN_WEB_VISION_MODE_VALUES =
  Object.freeze(
    Object.values(
      SPAN_WEB_VISION_MODES
    )
  );

export const SPAN_WEB_VISION_OPTIONS =
  Object.freeze([
    Object.freeze({
      id:
        SPAN_WEB_VISION_MODES.NONE,
      label:
        "None"
    }),
    Object.freeze({
      id:
        SPAN_WEB_VISION_MODES.LIMITED,
      label:
        "Limited"
    }),
    Object.freeze({
      id:
        SPAN_WEB_VISION_MODES.BLOCKED,
      label:
        "Blocked"
    })
  ]);

/** Resolve one supported span-web vision mode. */
export function normaliseSpanWebVisionMode(
  value,
  fallback = SPAN_WEB_VISION_MODES.LIMITED
) {
  const candidate =
    typeof value ===
      "string"
      ? value.trim()
      : "";

  const resolved =
    candidate ||
    fallback;

  if (
    !SPAN_WEB_VISION_MODE_VALUES.includes(
      resolved
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported wall-span vision mode "${String(value)}". Supported modes: ${SPAN_WEB_VISION_MODE_VALUES.join(", ")}.`
    );
  }

  return resolved;
}

/** Strictly resolve one boolean-like persisted value. */
export function normaliseSpanWebBehaviourBoolean(
  value,
  fallback
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return fallback ===
      true;
  }

  if (
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    value ===
      1 ||
    value ===
      "1" ||
    value ===
      "true" ||
    value ===
      "on"
  ) {
    return true;
  }

  if (
    value ===
      0 ||
    value ===
      "0" ||
    value ===
      "false" ||
    value ===
      "off"
  ) {
    return false;
  }

  throw new TypeError(
    `${MODULE_TITLE} | Span-web behaviour values must be boolean.`
  );
}
