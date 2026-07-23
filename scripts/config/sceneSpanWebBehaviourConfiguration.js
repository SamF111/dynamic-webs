import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_PATH
} from "./sceneWebFlagPaths.js";

import {
  readRawSceneWebConfiguration
} from "./sceneWebFlagReading.js";

import {
  DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR
} from "./sceneConfigurationDefaults.js";

import {
  getConfiguredDefaultSpanWebBehaviourSettings,
  getConfiguredMaximumSpanGridUnits,
  normaliseConfiguredMaximumSpanGridUnits
} from "./moduleSettings.js";

import {
  normaliseSpanWebBehaviourBoolean,
  normaliseSpanWebVisionMode
} from "./spanWebBehaviourContract.js";

export const SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION =
  1;

export const SCENE_SPAN_WEB_BEHAVIOUR_FLAG_PATH =
  `${SCENE_WEB_FLAG_PATH}.${SCENE_WEB_FLAG_KEYS.SPAN_WEB_BEHAVIOUR}`;

/** Resolve one Scene's span generation and wall behaviour. */
export function getSceneSpanWebBehaviourConfiguration(
  scene,
  {
    worldMaximumSpanGridUnits =
      getConfiguredMaximumSpanGridUnits(),
    worldBehaviour =
      getConfiguredDefaultSpanWebBehaviourSettings()
  } = {}
) {
  validateScene(
    scene
  );

  const raw =
    readRawSceneWebConfiguration(
      scene
    )?.[
      SCENE_WEB_FLAG_KEYS.SPAN_WEB_BEHAVIOUR
    ];

  const hasPersistedConfiguration =
    raw !==
      null &&
    raw !==
      undefined &&
    raw !==
      "";

  const normalised =
    normaliseSceneSpanWebBehaviour(
      raw,
      {
        worldMaximumSpanGridUnits,
        worldBehaviour
      }
    );

  return Object.freeze({
    ...normalised,
    source:
      hasPersistedConfiguration
        ? "scene"
        : "world-default",
    hasPersistedConfiguration,
    usesWorldMaximumSpanWidth:
      normalised.maximumSpanGridUnitsOverride ===
        null,
    maximumSpanWidthSource:
      normalised.maximumSpanGridUnitsOverride ===
        null
        ? "world-default"
        : "scene-override",
    worldMaximumSpanGridUnits:
      normaliseConfiguredMaximumSpanGridUnits(
        worldMaximumSpanGridUnits
      )
  });
}

/**
 * Normalise the compact Scene-owned span behaviour flag.
 *
 * A null maximum width means that the Scene continues to follow the current
 * world default. Other missing fields inherit world defaults until the Scene
 * form is explicitly saved.
 */
export function normaliseSceneSpanWebBehaviour(
  value,
  {
    worldMaximumSpanGridUnits =
      getConfiguredMaximumSpanGridUnits(),
    worldBehaviour =
      getConfiguredDefaultSpanWebBehaviourSettings()
  } = {}
) {
  const source =
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
      ? {}
      : parseBehaviourValue(
          value
        );

  const maximumSpanGridUnitsOverride =
    normaliseOptionalMaximumSpanGridUnits(
      source.maximumSpanGridUnits
    );

  const resolvedWorldBehaviour =
    normaliseWorldBehaviour(
      worldBehaviour
    );

  return Object.freeze({
    schemaVersion:
      SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION,
    maximumSpanGridUnitsOverride,
    maximumSpanGridUnits:
      maximumSpanGridUnitsOverride ??
      normaliseConfiguredMaximumSpanGridUnits(
        worldMaximumSpanGridUnits
      ),
    visionMode:
      normaliseSpanWebVisionMode(
        source.visionMode,
        resolvedWorldBehaviour.visionMode
      ),
    secretDoor:
      normaliseSpanWebBehaviourBoolean(
        source.secretDoor,
        resolvedWorldBehaviour.secretDoor
      ),
    destructible:
      normaliseSpanWebBehaviourBoolean(
        source.destructible,
        resolvedWorldBehaviour.destructible
      )
  });
}

/** Create the exact JSON-friendly value persisted to the Scene flag. */
export function createSceneSpanWebBehaviourFlagValue(
  value,
  options = {}
) {
  const normalised =
    normaliseSceneSpanWebBehaviour(
      value,
      options
    );

  return Object.freeze({
    schemaVersion:
      SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION,
    maximumSpanGridUnits:
      normalised.maximumSpanGridUnitsOverride,
    visionMode:
      normalised.visionMode,
    secretDoor:
      normalised.secretDoor,
    destructible:
      normalised.destructible
  });
}

export function spanWebBehaviourCreatesWalls(
  behaviour
) {
  const resolved =
    normaliseSceneSpanWebBehaviour(
      behaviour
    );

  return resolved.secretDoor ===
    true ||
    resolved.visionMode !==
      "none";
}

function parseBehaviourValue(
  value
) {
  let parsed =
    value;

  if (
    typeof value ===
      "string"
  ) {
    try {
      parsed =
        JSON.parse(
          value
        );
    } catch (error) {
      throw new Error(
        `${MODULE_TITLE} | ${SCENE_SPAN_WEB_BEHAVIOUR_FLAG_PATH} contains invalid JSON.`,
        {
          cause:
            error
        }
      );
    }
  }

  if (
    !parsed ||
    typeof parsed !==
      "object" ||
    Array.isArray(
      parsed
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${SCENE_SPAN_WEB_BEHAVIOUR_FLAG_PATH} must be a plain object.`
    );
  }

  const schemaVersion =
    parsed.schemaVersion ===
      undefined
      ? SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION
      : Number(
          parsed.schemaVersion
        );

  if (
    !Number.isInteger(
      schemaVersion
    ) ||
    schemaVersion !==
      SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION
  ) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported Scene span-web behaviour schema version.`
    );
  }

  return parsed;
}

function normaliseOptionalMaximumSpanGridUnits(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  return normaliseConfiguredMaximumSpanGridUnits(
    value
  );
}

function normaliseWorldBehaviour(
  value
) {
  const source =
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
      ? value
      : DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR;

  return Object.freeze({
    visionMode:
      normaliseSpanWebVisionMode(
        source.visionMode,
        DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.visionMode
      ),
    secretDoor:
      normaliseSpanWebBehaviourBoolean(
        source.secretDoor,
        DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.secretDoor
      ),
    destructible:
      normaliseSpanWebBehaviourBoolean(
        source.destructible,
        DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.destructible
      )
  });
}

function validateScene(
  scene
) {
  if (
    !scene ||
    typeof scene !==
      "object" ||
    Array.isArray(
      scene
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A Scene document is required to read span-web behaviour.`
    );
  }
}
