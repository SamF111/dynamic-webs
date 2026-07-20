import {
  SCENE_WEB_FLAG_KEYS,
  SCENE_WEB_FLAG_NAMESPACE
} from "./sceneWebFlagPaths.js";

/** Read raw Dynamic Webs flags from one Scene. */
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
        ),
      [SCENE_WEB_FLAG_KEYS.WEB_COLOUR]:
        scene.getFlag(
          SCENE_WEB_FLAG_NAMESPACE,
          SCENE_WEB_FLAG_KEYS.WEB_COLOUR
        ),
      [SCENE_WEB_FLAG_KEYS.WEB_THICKNESS]:
        scene.getFlag(
          SCENE_WEB_FLAG_NAMESPACE,
          SCENE_WEB_FLAG_KEYS.WEB_THICKNESS
        ),
      [SCENE_WEB_FLAG_KEYS.CORNER_WEB_DENSITY]:
        scene.getFlag(
          SCENE_WEB_FLAG_NAMESPACE,
          SCENE_WEB_FLAG_KEYS.CORNER_WEB_DENSITY
        ),
      [SCENE_WEB_FLAG_KEYS.SPAN_WEB_DENSITY]:
        scene.getFlag(
          SCENE_WEB_FLAG_NAMESPACE,
          SCENE_WEB_FLAG_KEYS.SPAN_WEB_DENSITY
        ),
      [SCENE_WEB_FLAG_KEYS.GROUND_WEB_DENSITY]:
        scene.getFlag(
          SCENE_WEB_FLAG_NAMESPACE,
          SCENE_WEB_FLAG_KEYS.GROUND_WEB_DENSITY
        ),
      [SCENE_WEB_FLAG_KEYS.CARPET_WEB_DENSITY]:
        scene.getFlag(
          SCENE_WEB_FLAG_NAMESPACE,
          SCENE_WEB_FLAG_KEYS.CARPET_WEB_DENSITY
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
