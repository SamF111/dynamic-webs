import {
  SceneWebLifecycleController
} from "./SceneWebLifecycleController.js";

let lifecycleController =
  null;

/**
 * Register Dynamic Webs lifecycle hooks.
 *
 * @param {object} runtime - Dynamic Webs runtime.
 * @returns {SceneWebLifecycleController} Shared controller.
 */
export function registerLifecycleHooks(
  runtime
) {
  if (!lifecycleController) {
    lifecycleController =
      new SceneWebLifecycleController({
        runtime,
        debounceMs:
          200
      });
  }

  lifecycleController.registerHooks();

  return lifecycleController;
}

/** @returns {SceneWebLifecycleController|null} Current controller. */
export function getSceneWebLifecycleController() {
  return lifecycleController;
}

/**
 * Dispose lifecycle hooks and local web state.
 */
export function disposeLifecycleHooks() {
  lifecycleController
    ?.dispose();

  lifecycleController =
    null;
}
