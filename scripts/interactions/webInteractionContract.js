import {
  MODULE_ID
} from "../module/moduleConstants.js";

export const WEB_ENTITY_INTERACTION_SCHEMA_VERSION =
  1;

export const WEB_ENTITY_INTERACTION_OUTCOMES =
  Object.freeze({
    NO_INTERACTION:
      "no-interaction",
    ON_WEB:
      "on-web",
    ENTERED_WEB:
      "entered-web",
    LEFT_WEB:
      "left-web",
    INTERSECTED_WEB:
      "intersected-web"
  });

export const WEB_ENTITY_INTERACTION_HOOKS =
  Object.freeze({
    INTERACTION:
      `${MODULE_ID}.entityWebInteraction`,
    ON_WEB:
      `${MODULE_ID}.entityOnWeb`,
    ENTERED_WEB:
      `${MODULE_ID}.entityEnteredWeb`,
    LEFT_WEB:
      `${MODULE_ID}.entityLeftWeb`,
    INTERSECTED_WEB:
      `${MODULE_ID}.entityIntersectedWeb`
  });

export const WEB_CAPTURE_HOOKS =
  Object.freeze({
    SHOWN:
      `${MODULE_ID}.captureShown`,
    REMOVED:
      `${MODULE_ID}.captureRemoved`,
    CLEARED:
      `${MODULE_ID}.capturesCleared`
  });

export function createPublicWebInteractionContract() {
  return deepFreeze({
    schemaVersion:
      WEB_ENTITY_INTERACTION_SCHEMA_VERSION,
    outcomes:
      WEB_ENTITY_INTERACTION_OUTCOMES,
    hooks:
      WEB_ENTITY_INTERACTION_HOOKS,
    captureHooks:
      WEB_CAPTURE_HOOKS,
    functionalWebKinds:
      [
        "wall-corner",
        "wall-span",
        "ground"
      ],
    notes:
      [
        "Entity evaluation is read-only and client-local.",
        "Consumers must supply explicit level or elevation compatibility.",
        "Web carpets do not expose fabricated functional strands and are not included by default.",
        "Captured-web visuals are transient presentation state and are not persisted or socket-synchronised."
      ]
  });
}

function deepFreeze(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object"
  ) {
    return value;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return Object.freeze(
      value.map(
        deepFreeze
      )
    );
  }

  const clone =
    {};

  for (
    const [
      key,
      entry
    ] of Object.entries(
      value
    )
  ) {
    clone[key] =
      deepFreeze(
        entry
      );
  }

  return Object.freeze(
    clone
  );
}
