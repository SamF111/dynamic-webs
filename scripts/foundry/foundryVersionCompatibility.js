import {
  firstFiniteNumber
} from "./compatibilityNumbers.js";

/**
 * Detect the active Foundry major version.
 *
 * Missing version data returns zero so callers can fall back to the base-level
 * provider without importing Foundry classes.
 *
 * @param {object} [options] - Optional compatibility inputs.
 * @returns {number} Foundry major version or zero.
 */
export function detectFoundryMajorVersion({
  game = globalThis.game,
  config = globalThis.CONFIG,
  constants = globalThis.CONST
} = {}) {
  const releaseGeneration =
    firstFiniteNumber(
      game?.release?.generation
    );

  if (
    Number.isInteger(
      releaseGeneration
    )
  ) {
    return releaseGeneration;
  }

  const versionText =
    String(
      game?.version ??
      game?.data?.version ??
      config?.version ??
      constants?.FOUNDRY_VERSION ??
      ""
    );

  const majorVersion =
    Number.parseInt(
      versionText.split(
        "."
      )[0],
      10
    );

  return Number.isInteger(
    majorVersion
  )
    ? majorVersion
    : 0;
}

/**
 * Determine whether theripper93's Levels appears active for Foundry v13.
 *
 * This mirrors Ambient Critters' provider-availability test so both modules
 * expose the same provider choices in Foundry's Settings Configuration.
 *
 * @param {object} [options] - Optional compatibility inputs.
 * @returns {boolean} True when the Levels provider appears available.
 */
export function detectLevelsModuleSupport({
  game = globalThis.game,
  canvas = globalThis.canvas,
  levelsGlobal = globalThis.Levels
} = {}) {
  if (
    detectFoundryMajorVersion({
      game
    }) >=
      14
  ) {
    return false;
  }

  const modules =
    game?.modules;

  const moduleRecord =
    typeof modules?.get ===
      "function"
      ? modules.get(
          "levels"
        )
      : null;

  return Boolean(
    moduleRecord?.active ===
      true ||
    levelsGlobal ||
    canvas?.levels
  );
}
