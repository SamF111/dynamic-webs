import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  DynamicWebsRuntime
} from "./DynamicWebsRuntime.js";

let runtimeReference =
  null;

/** @returns {DynamicWebsRuntime} Shared runtime owner. */
export function initialiseRuntime() {
  if (runtimeReference) {
    return runtimeReference;
  }

  runtimeReference =
    new DynamicWebsRuntime();

  return runtimeReference;
}

/** @returns {DynamicWebsRuntime|null} Runtime owner or null. */
export function getDynamicWebsRuntime() {
  return runtimeReference;
}

/** @returns {DynamicWebsRuntime} Runtime owner. */
export function requireDynamicWebsRuntime() {
  const runtime =
    getDynamicWebsRuntime();

  if (runtime) {
    return runtime;
  }

  throw new Error(
    `${MODULE_TITLE} | Runtime has not been initialised.`
  );
}

/**
 * Clear the module-local runtime reference.
 *
 * @returns {boolean} True when a runtime existed.
 */
export function clearDynamicWebsRuntime() {
  const runtime =
    runtimeReference;

  runtimeReference =
    null;

  if (!runtime) {
    return false;
  }

  runtime.resetState();

  return true;
}
