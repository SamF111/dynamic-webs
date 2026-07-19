import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_NAMESPACE
} from "./sceneWebFlagPaths.js";

/**
 * Read raw Dynamic Webs flags from one Scene.
 *
 * @param {object} scene - Scene document or Scene-like object.
 * @returns {object} Raw flag values.
 */
export function readRawSceneWebConfiguration(
  scene
) {
  if (
    typeof scene?.getFlag ===
      "function"
  ) {
    return {
      [SCENE_WEB_FLAG_KEYS.WEB_DENSITY]:
        scene.getFlag(
          SCENE_WEB_FLAG_NAMESPACE,
          SCENE_WEB_FLAG_KEYS.WEB_DENSITY
        )
    };
  }

  const namespaceValues =
    scene?.flags?.[
      SCENE_WEB_FLAG_NAMESPACE
    ];

  return (
    namespaceValues &&
    typeof namespaceValues ===
      "object" &&
    !Array.isArray(
      namespaceValues
    )
  )
    ? namespaceValues
    : {};
}
