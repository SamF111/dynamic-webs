import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  requireCurrentUserIsGM
} from "./foundryAccess.js";

export function queryPublicWebMovementIntersections(
  runtime,
  request
) {
  return requireInteractionRuntimeService(
    runtime
  ).queryMovementIntersections(
    request
  );
}

export function destroyPublicWebs(
  runtime,
  webIds,
  options = {}
) {
  requireCurrentUserIsGM();

  return requireInteractionRuntimeService(
    runtime
  ).destroyWebs(
    webIds,
    {
      ...options,
      cause:
        options?.cause ??
        "public-api-destroy-webs",
      userId:
        options?.userId ??
        globalThis.game?.user?.id ??
        null
    }
  );
}

export function restorePublicWeb(
  runtime,
  webId,
  options = {}
) {
  requireCurrentUserIsGM();

  return requireInteractionRuntimeService(
    runtime
  ).restoreWeb(
    webId,
    {
      ...options,
      cause:
        options?.cause ??
        "public-api-restore-web",
      userId:
        options?.userId ??
        globalThis.game?.user?.id ??
        null
    }
  );
}

export function resetPublicWebInteractionState(
  runtime,
  options = {}
) {
  requireCurrentUserIsGM();

  return requireInteractionRuntimeService(
    runtime
  ).resetMutableState({
    ...options,
    cause:
      options?.cause ??
      "public-api-reset-web-state",
    userId:
      options?.userId ??
      globalThis.game?.user?.id ??
      null
  });
}

export function getPublicWebInteractionState(
  runtime
) {
  return requireInteractionRuntimeService(
    runtime
  ).getMutableState();
}

function requireInteractionRuntimeService(
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
      "queryMovementIntersections",
      "destroyWebs",
      "restoreWeb",
      "resetMutableState",
      "getMutableState"
    ];

  if (
    !service ||
    requiredMethods.some(
      (
        method
      ) =>
        typeof service[method] !==
          "function"
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | The web interaction runtime is unavailable.`
    );
  }

  return service;
}
