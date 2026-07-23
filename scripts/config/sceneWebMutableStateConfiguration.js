import {
  MODULE_TITLE,
  WEB_MUTABLE_STATE_SCHEMA_VERSION
} from "../module/moduleConstants.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_NAMESPACE,
  SCENE_WEB_FLAG_PATH
} from "./sceneWebFlagPaths.js";

import {
  readRawSceneWebConfiguration
} from "./sceneWebFlagReading.js";

export const SCENE_WEB_MUTABLE_STATE_FLAG_PATH =
  `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.MUTABLE_STATE}`;

/** Create one empty persistent whole-span state value. */
export function createEmptySceneWebMutableState() {
  return Object.freeze({
    schemaVersion:
      WEB_MUTABLE_STATE_SCHEMA_VERSION,
    revision:
      0,
    destroyedWebIds:
      Object.freeze([])
  });
}

/**
 * Strictly normalise one persisted Scene-owned whole-span state value.
 *
 * Only compact deviations from deterministic geometry are accepted. Runtime
 * generation identifiers, timestamps, PIXI state and blueprint geometry are
 * deliberately excluded from the Scene flag.
 */
export function normaliseSceneWebMutableState(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return createEmptySceneWebMutableState();
  }

  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Scene mutable web state must be a plain object.`
    );
  }

  const schemaVersion =
    value.schemaVersion ===
      undefined
      ? WEB_MUTABLE_STATE_SCHEMA_VERSION
      : Number(
          value.schemaVersion
        );

  if (
    !Number.isInteger(
      schemaVersion
    ) ||
    schemaVersion !==
      WEB_MUTABLE_STATE_SCHEMA_VERSION
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Unsupported Scene mutable web-state schema version.`
    );
  }

  const revision =
    value.revision ===
      undefined
      ? 0
      : Number(
          value.revision
        );

  if (
    !Number.isInteger(
      revision
    ) ||
    revision <
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Scene mutable web-state revision must be a non-negative integer.`
    );
  }

  return Object.freeze({
    schemaVersion,
    revision,
    destroyedWebIds:
      Object.freeze(
        normaliseIdentifierList(
          value.destroyedWebIds
        )
      )
  });
}

/** Read one Scene's persistent whole-span state without breaking Scene load. */
export function getSceneWebMutableStateConfiguration(
  scene
) {
  const raw =
    readRawSceneWebConfiguration(
      scene
    )?.[
      SCENE_WEB_FLAG_KEYS.MUTABLE_STATE
    ];

  try {
    return Object.freeze({
      ...normaliseSceneWebMutableState(
        raw
      ),
      source:
        raw ===
          null ||
        raw ===
          undefined
          ? "missing"
          : "scene-flag",
      valid:
        true,
      error:
        null
    });
  } catch (error) {
    return Object.freeze({
      ...createEmptySceneWebMutableState(),
      source:
        "invalid-scene-flag",
      valid:
        false,
      error:
        Object.freeze({
          name:
            String(
              error?.name ??
              "Error"
            ),
          message:
            String(
              error?.message ??
              error
            )
        })
    });
  }
}

/** Create the compact Scene flag value from a runtime mutable-state snapshot. */
export function createSceneWebMutableStateFlagValue(
  snapshot
) {
  return normaliseSceneWebMutableState({
    schemaVersion:
      WEB_MUTABLE_STATE_SCHEMA_VERSION,
    revision:
      snapshot?.revision,
    destroyedWebIds:
      snapshot?.destroyedWebIds
  });
}

/** Persist one compact whole-span state value through Foundry's flag API. */
export async function persistSceneWebMutableState(
  scene,
  snapshot
) {
  if (
    !scene ||
    typeof scene.setFlag !==
      "function"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A writable Scene document is required to persist destroyed spans.`
    );
  }

  const value =
    createSceneWebMutableStateFlagValue(
      snapshot
    );

  await scene.setFlag(
    SCENE_WEB_FLAG_NAMESPACE,
    SCENE_WEB_FLAG_KEYS.MUTABLE_STATE,
    value
  );

  return value;
}

function normaliseIdentifierList(
  values
) {
  if (
    values ===
      null ||
    values ===
      undefined
  ) {
    return [];
  }

  if (
    !Array.isArray(
      values
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | destroyedWebIds must be an array.`
    );
  }

  const identifiers =
    [];

  for (
    const value of
    values
  ) {
    if (
      typeof value !==
        "string"
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | Every destroyed web ID must be a string.`
      );
    }

    const identifier =
      value.trim();

    if (!identifier) {
      throw new TypeError(
        `${MODULE_TITLE} | Destroyed web IDs must not be empty.`
      );
    }

    identifiers.push(
      identifier
    );
  }

  return Array.from(
    new Set(
      identifiers
    )
  ).sort();
}
