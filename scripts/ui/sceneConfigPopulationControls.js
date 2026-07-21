import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  createUniqueWebPopulationId
} from "../config/sceneWebPopulationIds.js";

import {
  DEFAULT_WEB_POPULATION_DENSITY
} from "../config/sceneWebPopulationConfiguration.js";

import {
  readWebPopulationEntriesFromPart,
  readWebPopulationEntryFromCard,
  writeWebPopulationEntryToCard
} from "./sceneConfigPopulationSerialization.js";

import {
  updateWebPopulationCardPresentation
} from "./sceneConfigPopulationSummaries.js";

import {
  updateSceneConfigRegionTagValidity
} from "./sceneConfigRegionTagControls.js";

export function activateSceneConfigPopulationControls(application, partElement) {
  if (!partElement?.querySelector) {
    throw new TypeError(`${MODULE_TITLE} | Scene Configuration population part did not render an HTMLElement.`);
  }

  const hidden = partElement.querySelector("[data-dynamic-webs-populations-value]");
  const list = partElement.querySelector("[data-dynamic-webs-population-list]");
  const template = partElement.querySelector("template[data-dynamic-webs-population-template]");
  if (!hidden || !list || !template) {
    throw new Error(`${MODULE_TITLE} | Scene Configuration population controls could not be resolved.`);
  }

  const editable = application?.isEditable !== false;

  const sync = () => {
    const entries = readWebPopulationEntriesFromPart(partElement);
    hidden.value = JSON.stringify(entries);
    updateWebPopulationCardPresentation(partElement);
    updateSceneConfigRegionTagValidity(partElement);
    updateDisabledStates(partElement, editable);
  };

  partElement.addEventListener("input", (event) => {
    if (event.target?.closest?.("[data-dynamic-webs-population]")) sync();
  });

  partElement.addEventListener("change", (event) => {
    if (event.target?.closest?.("[data-dynamic-webs-population]")) sync();
  });

  partElement.addEventListener("click", (event) => {
    const target = event.target;
    const summary = target?.closest?.("[data-dynamic-webs-population-summary]");
    if (summary) {
      const card = summary.closest("[data-dynamic-webs-population]");
      globalThis.setTimeout?.(() => {
        if (card?.open) collapseOtherCards(partElement, card);
      }, 0);
      return;
    }

    const add = target?.closest?.("[data-dynamic-webs-add-population]");
    if (add) {
      event.preventDefault();
      const card = appendCard({ partElement, list, template, source: null });
      if (card) {
        collapseOtherCards(partElement, card);
        card.open = true;
      }
      sync();
      return;
    }

    const duplicate = target?.closest?.("[data-dynamic-webs-duplicate-population]");
    if (duplicate) {
      event.preventDefault();
      const sourceCard = duplicate.closest("[data-dynamic-webs-population]");
      const source = sourceCard ? readWebPopulationEntryFromCard(sourceCard) : null;
      const card = appendCard({ partElement, list, template, source });
      if (card) {
        collapseOtherCards(partElement, card);
        card.open = true;
      }
      sync();
      return;
    }

    const remove = target?.closest?.("[data-dynamic-webs-remove-population]");
    if (remove) {
      event.preventDefault();
      remove.closest("[data-dynamic-webs-population]")?.remove?.();
      sync();
    }
  });

  updateWebPopulationCardPresentation(partElement);
  updateDisabledStates(partElement, editable);
  sync();
}

function appendCard({ partElement, list, template, source }) {
  const fragment = template.content?.cloneNode?.(true);
  const card = fragment?.querySelector?.("[data-dynamic-webs-population]")
    ?? fragment?.firstElementChild
    ?? null;
  if (!card) return null;

  const existing = readWebPopulationEntriesFromPart(partElement);
  const usedIds = new Set(existing.map((entry) => entry.id));
  const id = createUniqueWebPopulationId({
    usedIds
  });

  const defaultLevel = card.querySelector('[data-dynamic-webs-population-field="levelId"]')?.value || "base";
  writeWebPopulationEntryToCard(card, source
    ? { ...source, id, populationId: id }
    : {
        id,
        populationId: id,
        enabled: true,
        levelId: defaultLevel,
        confineRegionTags: [],
        excludeRegionTags: [],
        categoryDensities: {
          "wall-corner": DEFAULT_WEB_POPULATION_DENSITY,
          "wall-span": DEFAULT_WEB_POPULATION_DENSITY,
          ground: DEFAULT_WEB_POPULATION_DENSITY,
          "web-carpet": DEFAULT_WEB_POPULATION_DENSITY
        },
        colourProfileId: "natural-white",
        thicknessMultiplier: 1
      });

  list.appendChild(fragment);
  return list.querySelector(`[data-population-id="${escapeSelector(id)}"]`)
    ?? Array.from(list.querySelectorAll("[data-dynamic-webs-population]")).at(-1)
    ?? null;
}

function collapseOtherCards(partElement, activeCard) {
  for (const card of partElement.querySelectorAll("[data-dynamic-webs-population]")) {
    if (card !== activeCard) card.open = false;
  }
}

function updateDisabledStates(partElement, editable) {
  for (const control of partElement.querySelectorAll("[data-dynamic-webs-population-control], [data-dynamic-webs-add-population], [data-dynamic-webs-duplicate-population], [data-dynamic-webs-remove-population]")) {
    control.disabled = !editable;
  }
}

function escapeSelector(value) {
  return globalThis.CSS?.escape?.(value) ?? String(value).replace(/["\\]/g, "\\$&");
}
