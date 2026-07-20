/** Stable hidden IDs for modular Scene web populations. */

const WEB_POPULATION_ID_PREFIX =
  "web-";

const WEB_POPULATION_RANDOM_ID_LENGTH =
  16;

const FALLBACK_RANDOM_ID_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const MAXIMUM_ID_GENERATION_ATTEMPTS =
  128;

/**
 * Create one new opaque population ID.
 *
 * Foundry's randomID helper is preferred. Browser cryptography is used as the
 * compatibility fallback, with Math.random retained only for test harnesses
 * and unusual clients that expose neither API.
 *
 * @param {object} [options={}] - ID generation options.
 * @param {Set<string>} [options.usedIds=new Set()] - IDs already in use.
 * @param {Function|null} [options.randomIdFactory=null] - Optional test hook.
 * @returns {string} Unique opaque population ID.
 */
export function createWebPopulationId({
  usedIds = new Set(),
  randomIdFactory = null
} = {}) {
  const occupiedIds =
    usedIds instanceof Set
      ? usedIds
      : new Set(
          Array.isArray(usedIds)
            ? usedIds.map(String)
            : []
        );

  for (
    let attempt = 0;
    attempt < MAXIMUM_ID_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const token =
      normaliseRandomToken(
        typeof randomIdFactory === "function"
          ? randomIdFactory(
              WEB_POPULATION_RANDOM_ID_LENGTH
            )
          : createRandomToken(
              WEB_POPULATION_RANDOM_ID_LENGTH
            )
      );

    if (!token) {
      continue;
    }

    const candidate =
      `${WEB_POPULATION_ID_PREFIX}${token}`;

    if (!occupiedIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Dynamic Webs | Unable to create a unique web-population ID."
  );
}

/**
 * Preserve a valid existing ID or create a new opaque unique ID.
 *
 * @param {object} [options={}] - ID values.
 * @param {unknown} [options.preferredId=null] - Existing persisted ID.
 * @param {Set<string>} [options.usedIds=new Set()] - IDs already in use.
 * @param {Function|null} [options.randomIdFactory=null] - Optional test hook.
 * @returns {string} Stable or newly generated unique ID.
 */
export function createUniqueWebPopulationId({
  preferredId = null,
  usedIds = new Set(),
  randomIdFactory = null
} = {}) {
  const occupiedIds =
    usedIds instanceof Set
      ? usedIds
      : new Set(
          Array.isArray(usedIds)
            ? usedIds.map(String)
            : []
        );

  const preferred =
    normaliseWebPopulationId(
      preferredId
    );

  if (
    preferred &&
    !occupiedIds.has(preferred)
  ) {
    return preferred;
  }

  return createWebPopulationId({
    usedIds: occupiedIds,
    randomIdFactory
  });
}

/**
 * Normalise one optional persisted population ID.
 *
 * Existing pre-release IDs are preserved rather than rewritten. New UI-created
 * IDs always use the web-<random-id> format.
 *
 * @param {unknown} value - Candidate ID.
 * @returns {string|null} Trimmed ID or null.
 */
export function normaliseWebPopulationId(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const id =
    String(value).trim();

  return id.length > 0
    ? id
    : null;
}

function createRandomToken(
  length
) {
  const foundryRandomId =
    globalThis.foundry
      ?.utils
      ?.randomID;

  if (
    typeof foundryRandomId ===
      "function"
  ) {
    return foundryRandomId(
      length
    );
  }

  const cryptoObject =
    globalThis.crypto;

  if (
    typeof cryptoObject?.getRandomValues ===
      "function"
  ) {
    const randomValues =
      new Uint32Array(
        length
      );

    cryptoObject.getRandomValues(
      randomValues
    );

    return Array.from(
      randomValues,
      (
        value
      ) =>
        FALLBACK_RANDOM_ID_CHARACTERS[
          value %
            FALLBACK_RANDOM_ID_CHARACTERS.length
        ]
    ).join("");
  }

  let token =
    "";

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    token +=
      FALLBACK_RANDOM_ID_CHARACTERS[
        Math.floor(
          Math.random() *
            FALLBACK_RANDOM_ID_CHARACTERS.length
        )
      ];
  }

  return token;
}

function normaliseRandomToken(
  value
) {
  const token =
    String(value ?? "")
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        ""
      )
      .slice(
        0,
        WEB_POPULATION_RANDOM_ID_LENGTH
      );

  return token.length ===
    WEB_POPULATION_RANDOM_ID_LENGTH
    ? token
    : null;
}
