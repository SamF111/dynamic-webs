// D:/FoundryVTT/Data/modules/dynamic-webs/scripts/ui/optionalCompanion.js
// Purpose: Offer the optional companion on this module's settings page without requiring it.
export const COMPANION = Object.freeze({
  owner: "dynamic-webs", id: "ambient-critters", title: "Ambient Critters",
  url: "https://github.com/SamF111/ambient-critters",
  description: "Add small creatures that can become caught in webs and spiders that interact with them. Dynamic Webs works independently; Ambient Critters is optional."
});

export function activateOptionalCompanionLink(root) {
  const marker = `data-${COMPANION.owner}-companion`;
  const existing = root?.querySelector?.(`[${marker}]`);
  if (globalThis.game?.modules?.get?.(COMPANION.id)) {
    existing?.remove?.();
    return false;
  }
  if (existing) return false;
  const row = root?.querySelector?.(`[name^="${COMPANION.owner}."]`)?.closest?.(".form-group");
  const doc = row?.ownerDocument;
  if (!row?.parentNode || !doc?.createElement) return false;
  const group = doc.createElement("div");
  group.className = "form-group stacked";
  group.setAttribute(marker, "true");
  const link = doc.createElement("a");
  link.href = COMPANION.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `Explore ${COMPANION.title} (optional)`;
  const hint = doc.createElement("p");
  hint.className = "hint";
  hint.textContent = COMPANION.description;
  group.append(link, hint);
  const anchor = row.closest?.(`[data-${COMPANION.owner}-settings-groups]`) ?? row;
  anchor.parentNode.insertBefore(group, anchor);
  return true;
}
