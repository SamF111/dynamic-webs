import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getSceneWebPopulationConfiguration,
  normaliseSceneWebPopulations
} from "../config/sceneWebPopulationConfiguration.js";

import {
  requireCurrentUserIsGM,
  resolveSceneDocument
} from "./foundryAccess.js";

export function getPublicSceneWebPopulations(sceneId = null) {
  const scene = resolveSceneDocument(sceneId);
  return Object.freeze(
    getSceneWebPopulationConfiguration(scene).populations.map(toPublicPopulation)
  );
}

export function getPublicSceneWebPopulation(populationId, sceneId = null) {
  const id = String(populationId ?? "").trim();
  if (!id) throw new TypeError(`${MODULE_TITLE} | A web-population ID is required.`);
  return getPublicSceneWebPopulations(sceneId).find((population) => population.id === id) ?? null;
}

export async function setPublicSceneWebPopulations(populations, sceneId = null) {
  requireCurrentUserIsGM();
  const scene = resolveSceneDocument(sceneId);
  const current = getSceneWebPopulationConfiguration(scene);
  const normalised = normaliseSceneWebPopulations(populations, {
    levels: current.levels,
    generateMissingIds: true
  }).map(toPublicPopulation);

  if (typeof scene.setFlag !== "function") {
    throw new Error(`${MODULE_TITLE} | Scene.setFlag() is unavailable.`);
  }

  return scene.setFlag(MODULE_ID, "webPopulations", normalised);
}

function toPublicPopulation(population) {
  return deepFreeze({
    id: population.id,
    enabled: population.enabled,
    levelId: population.levelId,
    categoryDensities: population.categoryDensities,
    colourProfileId: population.colourProfileId,
    thicknessMultiplier: population.thicknessMultiplier
  });
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
