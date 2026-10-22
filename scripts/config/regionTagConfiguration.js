import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

export const REGION_TAG_FLAG_NAMESPACE = MODULE_ID;
export const REGION_TAG_FLAG_KEYS = Object.freeze({ TAGS: "regionTags" });
export const REGION_TAG_FLAG_PATH =
  `flags.${REGION_TAG_FLAG_NAMESPACE}.${REGION_TAG_FLAG_KEYS.TAGS}`;
export const AMBIENT_CRITTERS_REGION_TAG_FLAG_NAMESPACE = "ambient-critters";

export const REGION_TAG_LIMITS = Object.freeze({
  MAXIMUM_TAGS: 64,
  MAXIMUM_TAG_LENGTH: 64
});

export function getDynamicWebRegionTags(regionDocument) {
  const document = resolveRegionDocumentLike(regionDocument);
  if (!document) return Object.freeze([]);

  return normaliseStoredRegionTags(
    readRegionTagFlag(document, REGION_TAG_FLAG_NAMESPACE)
  );
}

export function getRegionTags(regionDocument) {
  const document = resolveRegionDocumentLike(regionDocument);
  if (!document) return Object.freeze([]);

  return Object.freeze(Array.from(new Set([
    ...getDynamicWebRegionTags(document),
    ...normaliseStoredRegionTags(readRegionTagFlag(document, AMBIENT_CRITTERS_REGION_TAG_FLAG_NAMESPACE))
  ])));
}

export function normaliseRegionTags(
  value,
  { allowWildcards = false, preserveInternalTags = false } = {}
) {
  const tags = [];
  const seen = new Set();

  for (const rawValue of collectRawValues(value)) {
    const tag = normaliseRegionTag(rawValue, { allowWildcards, preserveInternalTags });
    if (!tag || seen.has(tag)) continue;

    if (tag.length > REGION_TAG_LIMITS.MAXIMUM_TAG_LENGTH) {
      throw new RangeError(
        `${MODULE_TITLE} | Region tag "${tag}" exceeds ${REGION_TAG_LIMITS.MAXIMUM_TAG_LENGTH} characters.`
      );
    }

    seen.add(tag);
    tags.push(tag);
  }

  if (tags.length > REGION_TAG_LIMITS.MAXIMUM_TAGS) {
    throw new RangeError(
      `${MODULE_TITLE} | A Region tag collection may contain at most ${REGION_TAG_LIMITS.MAXIMUM_TAGS} tags.`
    );
  }

  return Object.freeze(tags);
}

export function normaliseRegionRoleTags(value) {
  return normaliseRegionTags(parseJsonArrayStringIfPresent(value), {
    allowWildcards: true
  });
}

export function normaliseStoredRegionTags(value) {
  return normaliseRegionTags(value, { preserveInternalTags: true });
}

export function formatRegionTagsForInput(value) {
  return normaliseRegionTags(value).join("\n");
}

export function formatRegionRoleTagsForInput(value) {
  return normaliseRegionRoleTags(value).join("\n");
}

export function createRegionTagsFormValue(value) {
  return JSON.stringify(normaliseRegionTags(value));
}

export function doesRegionTagMatchConfiguredTag(regionTag, configuredTag) {
  if (
    typeof regionTag !== "string" ||
    typeof configuredTag !== "string" ||
    !regionTag ||
    !configuredTag
  ) return false;

  if (!configuredTag.includes("*")) return regionTag === configuredTag;

  const expression = configuredTag
    .split("*")
    .map(escapeRegExp)
    .join(".*");

  return new RegExp(`^${expression}$`, "u").test(regionTag);
}

export function intersectRegionTagMatches(regionTags, configuredTags) {
  const actual = normaliseStoredRegionTags(regionTags);
  const configured = normaliseRegionRoleTags(configuredTags);

  return Object.freeze(actual.filter((tag) =>
    configured.some((configuredTag) =>
      doesRegionTagMatchConfiguredTag(tag, configuredTag)
    )
  ));
}

export function validateRegionTagListsAreUnique({
  confine = [],
  exclude = []
} = {}) {
  const confineTags = normaliseRegionRoleTags(confine);
  const excludeTags = normaliseRegionRoleTags(exclude);
  const reused = confineTags.find((tag) => excludeTags.includes(tag));

  if (reused) {
    throw new Error(
      `${MODULE_TITLE} | Region tag "${reused}" cannot be reused for both Confine and Exclude.`
    );
  }

  return true;
}

export function doesRegionUpdateAffectWebs(changed) {
  return objectContainsRelevantPath(changed, [
    "shapes",
    "elevation",
    "elevationBand",
    "level",
    "levelId",
    "flags.levels",
    "flags.wall-height",
    `flags.${REGION_TAG_FLAG_NAMESPACE}`,
    `flags.${AMBIENT_CRITTERS_REGION_TAG_FLAG_NAMESPACE}.regionTags`
  ]);
}

function readRegionTagFlag(document, namespace) {
  if (typeof document?.getFlag === "function") {
    try {
      const value = document.getFlag(namespace, REGION_TAG_FLAG_KEYS.TAGS);
      if (value !== undefined) return value;
    } catch (_error) {
      // Foundry rejects scopes of inactive or missing packages; read raw flags below.
    }
  }

  return (
    document?.flags?.[namespace]?.[REGION_TAG_FLAG_KEYS.TAGS] ??
    document?._source?.flags?.[namespace]?.[REGION_TAG_FLAG_KEYS.TAGS]
  );
}

function resolveRegionDocumentLike(value) {
  const document = value?.document && typeof value.document === "object"
    ? value.document
    : value;

  return document && typeof document === "object" && !Array.isArray(document)
    ? document
    : null;
}

function collectRawValues(value) {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") return value.split(/[\n,]+/u);
  if (Array.isArray(value)) return value;
  if (typeof value?.values === "function") return Array.from(value.values());
  return [value];
}

function normaliseRegionTag(
  value,
  { allowWildcards, preserveInternalTags }
) {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim().toLowerCase();
  const internal = preserveInternalTags === true && raw.startsWith("_");
  const body = raw.replace(/^_+/u, "");

  const text = body
    .replace(/[_\s]+/gu, "-")
    .replace(
      allowWildcards
        ? /[^a-z0-9.:*-]+/gu
        : /[^a-z0-9.:-]+/gu,
      "-"
    )
    .replace(/\*+/gu, "*")
    .replace(/-+/gu, "-")
    .replace(/^[.:-]+|[.:-]+$/gu, "");

  if (!text) return null;
  return internal ? `_${text}` : text;
}

function parseJsonArrayStringIfPresent(value) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text.startsWith("[")) return value;

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : value;
  } catch (_error) {
    return value;
  }
}

function objectContainsRelevantPath(value, prefixes, parentPath = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  for (const [key, child] of Object.entries(value)) {
    const path = parentPath ? `${parentPath}.${key}` : key;

    if (prefixes.some((prefix) =>
      path === prefix || path.startsWith(`${prefix}.`)
    )) return true;

    if (objectContainsRelevantPath(child, prefixes, path)) return true;
  }

  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
