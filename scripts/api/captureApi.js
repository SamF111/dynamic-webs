import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

export function showPublicCapturedWeb(
  runtime,
  request
) {
  return requireCaptureRuntimeService(
    runtime
  ).showCapturedWeb(
    request
  );
}

export function removePublicCapturedWeb(
  runtime,
  captureId,
  options = {}
) {
  return requireCaptureRuntimeService(
    runtime
  ).removeCapturedWeb(
    captureId,
    options
  );
}

export function clearPublicCapturedWebsByEntity(
  runtime,
  entityId,
  options = {}
) {
  return requireCaptureRuntimeService(
    runtime
  ).clearCapturedWebsByEntity(
    entityId,
    options
  );
}

export function clearPublicCapturedWebs(
  runtime,
  options = {}
) {
  return requireCaptureRuntimeService(
    runtime
  ).clearCapturedWebs(
    options
  );
}

export function getPublicCapturedWeb(
  runtime,
  captureId
) {
  return requireCaptureRuntimeService(
    runtime
  ).getCapturedWeb(
    captureId
  );
}

export function getPublicCapturedWebState(
  runtime
) {
  return requireCaptureRuntimeService(
    runtime
  ).getCapturedWebState();
}

function requireCaptureRuntimeService(
  runtime
) {
  if (
    !runtime ||
    runtime.runtimeOwnerType !==
      "DynamicWebsRuntime"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A valid Dynamic Webs runtime is required.`
    );
  }

  const service =
    runtime.getWebRuntimeService?.();

  const requiredMethods =
    [
      "showCapturedWeb",
      "removeCapturedWeb",
      "clearCapturedWebsByEntity",
      "clearCapturedWebs",
      "getCapturedWeb",
      "getCapturedWebState"
    ];

  if (
    !service ||
    requiredMethods.some(
      method =>
        typeof service[method] !==
          "function"
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | The captured-web runtime is unavailable.`
    );
  }

  return service;
}
