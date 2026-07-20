import {
  getConfiguredWebLevelProviderMode
} from "../config/moduleSettings.js";

import {
  WEB_LEVEL_PROVIDER_MODES,
  normaliseWebLevelProviderMode
} from "../simulation/webs/webLevelContract.js";

import {
  BaseWebLevelProvider
} from "./webLevelProviderBase.js";

import {
  FoundryV14NativeWebLevelProvider
} from "./webLevelProviderV14Native.js";

import {
  LevelsV13WebLevelProvider
} from "./webLevelProviderV13Levels.js";

export {
  WEB_LEVEL_PROVIDER_MODES
} from "../simulation/webs/webLevelContract.js";

export function resolveWebLevelProvider({
  requestedMode = null,
  scene = globalThis.canvas?.scene,
  game = globalThis.game,
  canvas = globalThis.canvas,
  levelsApi = globalThis.CONFIG?.Levels
} = {}) {
  const requested =
    normaliseWebLevelProviderMode(
      requestedMode ??
      getConfiguredWebLevelProviderMode()
    );

  const baseProvider =
    new BaseWebLevelProvider();

  const nativeProvider =
    new FoundryV14NativeWebLevelProvider({
      game,
      canvas
    });

  const levelsProvider =
    new LevelsV13WebLevelProvider({
      game,
      canvas,
      levelsApi
    });

  const nativeAvailable =
    nativeProvider.isAvailable(
      scene
    );

  const levelsAvailable =
    levelsProvider.isAvailable(
      scene
    );

  let provider =
    baseProvider;

  let fallbackUsed =
    false;

  let fallbackReason =
    null;

  if (
    requested ===
      WEB_LEVEL_PROVIDER_MODES.AUTO
  ) {
    provider =
      nativeAvailable
        ? nativeProvider
        : levelsAvailable
          ? levelsProvider
          : baseProvider;
  } else if (
    requested ===
      WEB_LEVEL_PROVIDER_MODES.NATIVE_V14
  ) {
    if (nativeAvailable) {
      provider =
        nativeProvider;
    } else {
      fallbackUsed =
        true;
      fallbackReason =
        "Foundry native levels are unavailable for the active Scene.";
    }
  } else if (
    requested ===
      WEB_LEVEL_PROVIDER_MODES.LEVELS_V13
  ) {
    if (levelsAvailable) {
      provider =
        levelsProvider;
    } else {
      fallbackUsed =
        true;
      fallbackReason =
        "theripper93's Levels is unavailable or is not the supported provider for this Foundry generation.";
    }
  }

  const levels =
    provider.resolveLevels(
      scene
    );

  const activeViewedLevelId =
    provider.resolveActiveViewedLevel(
      scene,
      levels
    );

  return Object.freeze({
    requestedMode:
      requested,
    resolvedMode:
      provider.mode,
    providerAvailable:
      fallbackUsed !==
        true,
    nativeAvailable,
    levelsAvailable,
    fallbackUsed,
    fallbackReason,
    levels,
    activeViewedLevelId,
    resolveWallLevelMetadata:
      (
        candidate
      ) =>
        provider.resolveWallLevelMetadata(
          candidate,
          levels
        )
  });
}

export function createWebLevelProviderSnapshot(
  resolution
) {
  return Object.freeze({
    requestedMode:
      resolution?.requestedMode ??
      WEB_LEVEL_PROVIDER_MODES.AUTO,
    resolvedMode:
      resolution?.resolvedMode ??
      WEB_LEVEL_PROVIDER_MODES.BASE,
    providerAvailable:
      resolution?.providerAvailable ===
        true,
    nativeAvailable:
      resolution?.nativeAvailable ===
        true,
    levelsAvailable:
      resolution?.levelsAvailable ===
        true,
    fallbackUsed:
      resolution?.fallbackUsed ===
        true,
    fallbackReason:
      resolution?.fallbackReason ??
      null,
    activeViewedLevelId:
      resolution?.activeViewedLevelId ??
      null,
    levels:
      Object.freeze(
        Array.isArray(
          resolution?.levels
        )
          ? [
              ...resolution.levels
            ]
          : []
      )
  });
}
