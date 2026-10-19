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
  SPAN_WEB_CROSSING_ACTIONS,
  normaliseSpanWebBehaviourBoolean,
  normaliseSpanWebCrossingAction,
  normaliseSpanWebVisionMode
} from "./spanWebBehaviourContract.js";

export const SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION =
  2;

const LEGACY_SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION =
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
 * Schema v1 stored `destructible`; schema v2 stores the future token-crossing
 * policy independently from persistent whole-span destruction state.
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

  const secretDoor =
    normaliseSpanWebBehaviourBoolean(
      source.secretDoor,
      resolvedWorldBehaviour.secretDoor
    );

  const crossingAction =
    normaliseSourceCrossingAction(
      source,
      resolvedWorldBehaviour.crossingAction
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
    secretDoor,
    crossingAction:
      crossingAction ===
          SPAN_WEB_CROSSING_ACTIONS.OPEN_SECRET_DOOR &&
        secretDoor !==
          true
        ? SPAN_WEB_CROSSING_ACTIONS.NONE
        : crossingAction
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
    crossingAction:
      normalised.crossingAction
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

  const inferredSchemaVersion =
    Object.prototype.hasOwnProperty.call(
      parsed,
      "destructible"
    ) &&
    !Object.prototype.hasOwnProperty.call(
      parsed,
      "crossingAction"
    )
      ? LEGACY_SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION
      : SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION;

  const schemaVersion =
    parsed.schemaVersion ===
      undefined
      ? inferredSchemaVersion
      : Number(
          parsed.schemaVersion
        );

  if (
    !Number.isInteger(
      schemaVersion
    ) ||
    ![
      LEGACY_SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION,
      SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION
    ].includes(
      schemaVersion
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Unsupported Scene span-web behaviour schema version.`
    );
  }

  return Object.freeze({
    ...parsed,
    schemaVersion
  });
}

function normaliseSourceCrossingAction(
  source,
  fallback
) {
  if (
    source?.schemaVersion ===
      LEGACY_SCENE_SPAN_WEB_BEHAVIOUR_SCHEMA_VERSION
  ) {
    return normaliseSpanWebBehaviourBoolean(
      source.destructible,
      fallback ===
        SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB
    )
      ? SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB
      : SPAN_WEB_CROSSING_ACTIONS.NONE;
  }

  return normaliseSpanWebCrossingAction(
    source?.crossingAction,
    fallback
  );
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

  const legacyCrossingAction =
    Object.prototype.hasOwnProperty.call(
      source,
      "destructible"
    )
      ? normaliseSpanWebBehaviourBoolean(
          source.destructible,
          true
        )
        ? SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB
        : SPAN_WEB_CROSSING_ACTIONS.NONE
      : DEFAULT_SCENE_SPAN_WEB_BEHAVIOUR.crossingAction;

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
    crossingAction:
      normaliseSpanWebCrossingAction(
        source.crossingAction,
        legacyCrossingAction
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
