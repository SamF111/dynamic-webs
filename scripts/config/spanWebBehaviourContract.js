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

export const SPAN_WEB_CROSSING_ACTIONS =
  Object.freeze({
    NONE:
      "none",
    DESTROY_WEB:
      "destroy-web",
    OPEN_SECRET_DOOR:
      "open-secret-door"
  });

export const SPAN_WEB_CROSSING_ACTION_VALUES =
  Object.freeze(
    Object.values(
      SPAN_WEB_CROSSING_ACTIONS
    )
  );

export const SPAN_WEB_CROSSING_ACTION_OPTIONS =
  Object.freeze([
    Object.freeze({
      id:
        SPAN_WEB_CROSSING_ACTIONS.OPEN_SECRET_DOOR,
      label:
        "Open Secret Door",
      requiresSecretDoor:
        true
    }),
    Object.freeze({
      id:
        SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB,
      label:
        "Destroy Web",
      requiresSecretDoor:
        false
    }),
    Object.freeze({
      id:
        SPAN_WEB_CROSSING_ACTIONS.NONE,
      label:
        "No Action",
      requiresSecretDoor:
        false
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

/** Resolve one supported token-crossing action. */
export function normaliseSpanWebCrossingAction(
  value,
  fallback = SPAN_WEB_CROSSING_ACTIONS.NONE
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
    !SPAN_WEB_CROSSING_ACTION_VALUES.includes(
      resolved
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported wall-span crossing action "${String(value)}". Supported actions: ${SPAN_WEB_CROSSING_ACTION_VALUES.join(", ")}.`
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
