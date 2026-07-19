// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\data\jsonData.js

import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

/**
 * Clone JSON-compatible data so runtime code never mutates import bindings.
 *
 * @param {unknown} data - JSON-compatible value.
 * @param {string} [contextLabel="JSON data"] - Human-readable error context.
 * @returns {unknown} Cloned JSON value.
 */
export function cloneJsonData(
  data,
  contextLabel = "JSON data"
) {
  const serialisedData =
    JSON.stringify(
      data
    );

  if (
    serialisedData ===
      undefined
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} must be JSON-serialisable.`
    );
  }

  return JSON.parse(
    serialisedData
  );
}

/**
 * Recursively freeze one JSON-compatible value.
 *
 * @param {unknown} value - Plain object, array, or primitive value.
 * @returns {unknown} The same deeply frozen value.
 */
export function deepFreezeJsonData(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Object.isFrozen(
      value
    )
  ) {
    return value;
  }

  for (
    const nestedValue of
    Object.values(
      value
    )
  ) {
    deepFreezeJsonData(
      nestedValue
    );
  }

  return Object.freeze(
    value
  );
}

/**
 * Determine whether one value is a plain JSON object.
 *
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True when the value is a plain object.
 */
export function isJsonObject(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(
      value
    );

  return (
    prototype ===
      Object.prototype ||
    prototype ===
      null
  );
}

/**
 * Assert that one value is a plain JSON object.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {object} The validated object.
 */
export function assertJsonObject(
  value,
  contextLabel
) {
  if (
    !isJsonObject(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} must be an object.`
    );
  }

  return value;
}

/**
 * Assert that one value is an array.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {unknown[]} The validated array.
 */
export function assertJsonArray(
  value,
  contextLabel
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} must be an array.`
    );
  }

  return value;
}

/**
 * Assert that one value is a non-empty string.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {string} Trimmed string.
 */
export function assertRequiredString(
  value,
  contextLabel
) {
  if (
    typeof value !==
      "string"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} must be a string.`
    );
  }

  const normalisedValue =
    value.trim();

  if (
    normalisedValue.length ===
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel} cannot be empty.`
    );
  }

  return normalisedValue;
}

/**
 * Assert that one optional value is nullish or a non-empty string.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {string|null} Trimmed string or null.
 */
export function assertOptionalString(
  value,
  contextLabel
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  return assertRequiredString(
    value,
    contextLabel
  );
}

/**
 * Assert that one value is a boolean.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {boolean} Validated boolean.
 */
export function assertBoolean(
  value,
  contextLabel
) {
  if (
    typeof value !==
      "boolean"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} must be a boolean.`
    );
  }

  return value;
}

/**
 * Assert that one value is a finite number.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {number} Validated number.
 */
export function assertFiniteNumber(
  value,
  contextLabel
) {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${contextLabel} must be a finite number.`
    );
  }

  return value;
}

/**
 * Assert that one value is a positive finite number.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {number} Validated positive number.
 */
export function assertPositiveNumber(
  value,
  contextLabel
) {
  const numberValue =
    assertFiniteNumber(
      value,
      contextLabel
    );

  if (
    numberValue <=
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel} must be greater than 0.`
    );
  }

  return numberValue;
}

/**
 * Assert that one value is a non-negative finite number.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {number} Validated non-negative number.
 */
export function assertNonNegativeNumber(
  value,
  contextLabel
) {
  const numberValue =
    assertFiniteNumber(
      value,
      contextLabel
    );

  if (
    numberValue <
      0
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel} must be greater than or equal to 0.`
    );
  }

  return numberValue;
}

/**
 * Assert that one value is a positive integer.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {number} Validated positive integer.
 */
export function assertPositiveInteger(
  value,
  contextLabel
) {
  const numberValue =
    assertPositiveNumber(
      value,
      contextLabel
    );

  if (
    !Number.isInteger(
      numberValue
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel} must be an integer.`
    );
  }

  return numberValue;
}

/**
 * Assert that one value is a non-negative integer.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @returns {number} Validated non-negative integer.
 */
export function assertNonNegativeInteger(
  value,
  contextLabel
) {
  const numberValue =
    assertNonNegativeNumber(
      value,
      contextLabel
    );

  if (
    !Number.isInteger(
      numberValue
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel} must be an integer.`
    );
  }

  return numberValue;
}

/**
 * Assert that one number falls inside an inclusive range.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @param {object} [options] - Range options.
 * @param {number} [options.minimum=-Infinity] - Inclusive minimum.
 * @param {number} [options.maximum=Infinity] - Inclusive maximum.
 * @returns {number} Validated number.
 */
export function assertNumberInRange(
  value,
  contextLabel,
  {
    minimum = -Infinity,
    maximum = Infinity
  } = {}
) {
  const numberValue =
    assertFiniteNumber(
      value,
      contextLabel
    );

  if (
    numberValue <
      minimum ||
    numberValue >
      maximum
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel} must be between ${String(minimum)} and ${String(maximum)}.`
    );
  }

  return numberValue;
}

/**
 * Assert that one value is an ordered two-number range.
 *
 * @param {unknown} value - Candidate value.
 * @param {string} contextLabel - Human-readable error context.
 * @param {object} [options] - Range options.
 * @param {number} [options.minimum=-Infinity] - Inclusive item minimum.
 * @param {number} [options.maximum=Infinity] - Inclusive item maximum.
 * @returns {number[]} Validated range.
 */
export function assertNumberRange(
  value,
  contextLabel,
  {
    minimum = -Infinity,
    maximum = Infinity
  } = {}
) {
  const range =
    assertJsonArray(
      value,
      contextLabel
    );

  if (
    range.length !==
      2
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel} must contain exactly two numbers.`
    );
  }

  const lower =
    assertNumberInRange(
      range[0],
      `${contextLabel}[0]`,
      {
        minimum,
        maximum
      }
    );

  const upper =
    assertNumberInRange(
      range[1],
      `${contextLabel}[1]`,
      {
        minimum,
        maximum
      }
    );

  if (
    lower >
      upper
  ) {
    throw new Error(
      `${MODULE_TITLE} | ${contextLabel}[0] cannot be greater than ${contextLabel}[1].`
    );
  }

  return range;
}

