// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\foundry\compatibilityNumbers.js

/**
 * Normalise an optional finite number.
 *
 * @param {unknown} value - Candidate numeric value.
 * @returns {number|null} Finite number, or null when absent/invalid.
 */
export function normaliseOptionalFiniteNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue =
    Number(
      value
    );

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : null;
}

/**
 * Return the first finite numeric value.
 *
 * @param {...unknown} values - Candidate values in priority order.
 * @returns {number|null} First finite value, or null.
 */
export function firstFiniteNumber(
  ...values
) {
  for (
    const value of
    values
  ) {
    const numericValue =
      Number(
        value
      );

    if (
      Number.isFinite(
        numericValue
      )
    ) {
      return numericValue;
    }
  }

  return null;
}

/**
 * Return the first finite positive numeric value.
 *
 * @param {...unknown} values - Candidate values in priority order.
 * @returns {number|null} First positive finite value, or null.
 */
export function firstFinitePositiveNumber(
  ...values
) {
  for (
    const value of
    values
  ) {
    const numericValue =
      Number(
        value
      );

    if (
      Number.isFinite(
        numericValue
      ) &&
      numericValue >
        0
    ) {
      return numericValue;
    }
  }

  return null;
}

/**
 * Return a finite number or zero.
 *
 * @param {unknown} value - Candidate numeric value.
 * @returns {number} Finite numeric value, or zero.
 */
export function finiteNumberOrZero(
  value
) {
  const numericValue =
    Number(
      value
    );

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : 0;
}

