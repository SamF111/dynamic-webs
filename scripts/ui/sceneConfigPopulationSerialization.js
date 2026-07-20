import {
  WEB_DENSITY_ORDER
} from "../simulation/webs/webDensityPresets.js";

import {
  normaliseSceneWebThickness
} from "../config/sceneWebThicknessConfiguration.js";

export function readWebPopulationEntriesFromPart(partElement) {
  return Array.from(
    partElement?.querySelectorAll?.("[data-dynamic-webs-population]") ?? []
  ).map(readWebPopulationEntryFromCard);
}

export function readWebPopulationEntryFromCard(card) {
  const read = (field) => card.querySelector(
    `[data-dynamic-webs-population-field="${field}"]`
  );

  const categoryDensities = {};
  for (const control of card.querySelectorAll("[data-dynamic-webs-population-density]")) {
    const categoryId = String(control.dataset.webCategory ?? "").trim();
    const index = Math.max(0, Math.min(
      WEB_DENSITY_ORDER.length - 1,
      Math.round(Number(control.value) || 0)
    ));
    if (categoryId) categoryDensities[categoryId] = WEB_DENSITY_ORDER[index];
  }

  return {
    id: String(read("id")?.value ?? card.dataset.populationId ?? "").trim(),
    enabled: read("enabled")?.checked === true,
    levelId: String(read("levelId")?.value ?? "base").trim(),
    categoryDensities,
    colourProfileId: String(read("colourProfileId")?.value ?? "natural-white").trim(),
    thicknessMultiplier: normaliseSceneWebThickness(
      read("thicknessMultiplier")?.value
    )
  };
}

export function writeWebPopulationEntryToCard(card, entry) {
  const write = (field, value) => {
    const control = card.querySelector(
      `[data-dynamic-webs-population-field="${field}"]`
    );
    if (!control) return;
    if (field === "enabled") control.checked = value === true;
    else control.value = String(value ?? "");
  };

  card.dataset.populationId = entry.id;
  write("id", entry.id);
  write("enabled", entry.enabled);
  write("levelId", entry.levelId);
  write("colourProfileId", entry.colourProfileId);
  write("thicknessMultiplier", entry.thicknessMultiplier);

  for (const control of card.querySelectorAll("[data-dynamic-webs-population-density]")) {
    const categoryId = String(control.dataset.webCategory ?? "").trim();
    const densityId = entry.categoryDensities?.[categoryId] ?? "standard";
    control.value = String(Math.max(0, WEB_DENSITY_ORDER.indexOf(densityId)));
  }
}
