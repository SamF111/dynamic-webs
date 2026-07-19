import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

/** Require an active canvas Scene. */
export function requireCurrentCanvasScene() {
  const scene =
    globalThis.canvas?.scene;

  if (
    !scene ||
    typeof scene.id !==
      "string" ||
    scene.id.trim().length ===
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | An active canvas Scene is required.`
    );
  }

  return scene;
}

/** Require GM permissions for one administrative operation. */
export function requireCurrentUserIsGM() {
  if (
    globalThis.game?.user?.isGM ===
      true
  ) {
    return;
  }

  throw new Error(
    `${MODULE_TITLE} | This operation may only be performed by a GM.`
  );
}

/**
 * Resolve a Scene by ID or use the current canvas Scene.
 *
 * @param {string|null} sceneId - Optional Scene ID.
 * @returns {object} Scene document.
 */
export function resolveSceneDocument(
  sceneId = null
) {
  const normalisedSceneId =
    typeof sceneId ===
      "string" &&
    sceneId.trim().length >
      0
      ? sceneId.trim()
      : null;

  if (!normalisedSceneId) {
    return requireCurrentCanvasScene();
  }

  const scene =
    globalThis.game?.scenes?.get?.(
      normalisedSceneId
    ) ??
    (
      globalThis.canvas?.scene?.id ===
        normalisedSceneId
        ? globalThis.canvas.scene
        : null
    );

  if (!scene) {
    throw new Error(
      `${MODULE_TITLE} | Scene "${normalisedSceneId}" is unavailable.`
    );
  }

  return scene;
}
