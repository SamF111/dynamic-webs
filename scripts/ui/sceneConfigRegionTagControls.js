import {
  normaliseRegionRoleTags
} from "../config/regionTagConfiguration.js";

export function updateSceneConfigRegionTagValidity(partElement) {
  const cards = Array.from(
    partElement?.querySelectorAll?.("[data-dynamic-webs-population]") ?? []
  );

  for (const card of cards) {
    const confine = card.querySelector('[data-dynamic-webs-population-field="confineRegionTags"]');
    const exclude = card.querySelector('[data-dynamic-webs-population-field="excludeRegionTags"]');
    if (!confine || !exclude) continue;

    const confineTags = normaliseRegionRoleTags(confine.value);
    const excludeTags = normaliseRegionRoleTags(exclude.value);
    const reused = confineTags.find((tag) => excludeTags.includes(tag)) ?? null;
    const message = reused
      ? `Region tag "${reused}" cannot be used for both Confine and Exclude.`
      : "";

    confine.setCustomValidity?.(message);
    exclude.setCustomValidity?.(message);

    const output = card.querySelector("[data-dynamic-webs-region-role-error]");
    if (output) {
      output.textContent = message;
      output.hidden = !message;
    }
  }

  return cards.length;
}
