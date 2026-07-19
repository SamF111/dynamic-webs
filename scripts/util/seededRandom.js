// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\util\seededRandom.js

/**
 * Convert a value into a stable unsigned 32-bit integer.
 *
 * @param {unknown} value - Value to hash.
 * @returns {number} Unsigned 32-bit hash.
 */
export function hashString(
  value
) {
  const text =
    String(
      value ??
      ""
    );

  let hash =
    2166136261;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        16777619
      );
  }

  return hash >>>
    0;
}

/**
 * Create an isolated deterministic pseudo-random number generator.
 *
 * @param {number|string} seed - Numeric or string seed.
 * @returns {Function} Function returning 0 <= value < 1.
 */
export function createSeededRandom(
  seed
) {
  let state =
    normaliseSeed(
      seed
    );

  return function seededRandom() {
    state +=
      0x6D2B79F5;

    state >>>=
      0;

    let value =
      state;

    value =
      Math.imul(
        value ^
          (
            value >>>
            15
          ),
        value |
          1
      );

    value ^=
      value +
      Math.imul(
        value ^
          (
            value >>>
            7
          ),
        value |
          61
      );

    return (
      (
        value ^
        (
          value >>>
          14
        )
      ) >>>
      0
    ) /
    4294967296;
  };
}

function normaliseSeed(
  seed
) {
  const numericSeed =
    typeof seed ===
      "number" &&
    Number.isFinite(
      seed
    )
      ? Math.trunc(
          seed
        ) >>>
        0
      : hashString(
          seed
        );

  return numericSeed ===
    0
    ? 0x9E3779B9
    : numericSeed;
}
