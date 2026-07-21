import {
  WEB_DENSITY_OPTIONS,
  WEB_DENSITY_ORDER
} from "../simulation/webs/webDensityPresets.js";

const LABELS = new Map(WEB_DENSITY_OPTIONS.map((option) => [option.id, option.label]));

export function updateWebPopulationCardPresentation(partElement) {
  const cards = Array.from(
    partElement?.querySelectorAll?.("[data-dynamic-webs-population]") ?? []
  );

  cards.forEach((card, index) => {
    card.dataset.populationIndex = String(index);
    const title = card.querySelector("[data-dynamic-webs-population-summary-title]");
    const detail = card.querySelector("[data-dynamic-webs-population-summary-detail]");
    const titleLabel = `Web Population ${index + 1}`;
    const levelSelect = card.querySelector('[data-dynamic-webs-population-field="levelId"]');
    const levelLabel = levelSelect?.selectedOptions?.[0]?.textContent?.trim()
      || levelSelect?.value
      || "No level";
    const colourSelect = card.querySelector('[data-dynamic-webs-population-field="colourProfileId"]');
    const colourLabel = colourSelect?.selectedOptions?.[0]?.textContent?.trim()
      || colourSelect?.value
      || "No colour";
    const enabled = card.querySelector('[data-dynamic-webs-population-field="enabled"]')?.checked === true;

    if (title) title.textContent = titleLabel;
    if (detail) detail.textContent = `${enabled ? levelLabel : "Disabled"} · ${colourLabel}`;

    const confineTags = normaliseTagInput(
      card.querySelector('[data-dynamic-webs-population-field="confineRegionTags"]')?.value
    );
    const excludeTags = normaliseTagInput(
      card.querySelector('[data-dynamic-webs-population-field="excludeRegionTags"]')?.value
    );
    const regionSummary = card.querySelector("[data-dynamic-webs-region-summary]");
    if (regionSummary) regionSummary.textContent = createRegionSummary(confineTags, excludeTags);

    for (const slider of card.querySelectorAll("[data-dynamic-webs-population-density]")) {
      const densityId = WEB_DENSITY_ORDER[Math.max(0, Math.min(
        WEB_DENSITY_ORDER.length - 1,
        Math.round(Number(slider.value) || 0)
      ))];
      const output = slider.closest("[data-dynamic-webs-density-row]")
        ?.querySelector("[data-dynamic-webs-density-output]");
      if (output) output.textContent = LABELS.get(densityId) ?? densityId;
    }
  });

  const empty = partElement?.querySelector?.("[data-dynamic-webs-population-empty]");
  if (empty) empty.hidden = cards.length > 0;
}


function normaliseTagInput(value) {
  return String(value ?? "")
    .split(/[\n,]+/u)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function createRegionSummary(confineTags, excludeTags) {
  if (confineTags.length === 0 && excludeTags.length === 0) return "Unrestricted";
  const parts = [];
  if (confineTags.length > 0) parts.push(`Confine: ${confineTags.length}`);
  if (excludeTags.length > 0) parts.push(`Exclude: ${excludeTags.length}`);
  return parts.join(" · ");
}
