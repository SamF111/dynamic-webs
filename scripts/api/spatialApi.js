import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

/** Return every immutable generated web snapshot in stable ID order. */
export function getPublicWebs(runtime) {
  return requireSpatialRuntimeService(runtime).getWebs();
}

/** Return one immutable generated web snapshot or null. */
export function getPublicWeb(runtime, webId) {
  return requireSpatialRuntimeService(runtime).getWeb(webId);
}

/** Query functional strand geometry near one point. */
export function queryPublicNearbyWebGeometry(runtime, point, options = {}) {
  return requireSpatialRuntimeService(runtime).queryNearby(point, options);
}

/** Query strands whose functional bounds overlap one rectangle. */
export function queryPublicWebStrands(runtime, bounds, options = {}) {
  return requireSpatialRuntimeService(runtime).queryStrands(bounds, options);
}

/** Find web blueprints compatible with metadata and optional spatial filters. */
export function findPublicCompatibleWebs(runtime, options = {}) {
  return requireSpatialRuntimeService(runtime).findCompatibleWebs(options);
}

/** Find immutable compatible perch snapshots. */
export function findPublicWebPerches(runtime, options = {}) {
  return requireSpatialRuntimeService(runtime).findPerches(options);
}

/** Return frozen spatial-index build and query diagnostics. */
export function getPublicSpatialDiagnostics(runtime) {
  return requireSpatialRuntimeService(runtime).createSpatialDiagnosticSnapshot();
}

function requireSpatialRuntimeService(runtime) {
  if (!runtime || runtime.runtimeOwnerType !== "DynamicWebsRuntime") {
    throw new TypeError(`${MODULE_TITLE} | A valid Dynamic Webs runtime is required.`);
  }

  const service = runtime.getWebRuntimeService?.();
  const requiredMethods = [
    "getWebs",
    "getWeb",
    "queryNearby",
    "queryStrands",
    "findCompatibleWebs",
    "findPerches",
    "createSpatialDiagnosticSnapshot"
  ];

  if (!service || requiredMethods.some((method) => typeof service[method] !== "function")) {
    throw new Error(`${MODULE_TITLE} | The web spatial-query runtime is unavailable.`);
  }

  return service;
}
