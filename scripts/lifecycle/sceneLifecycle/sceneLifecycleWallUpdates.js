/**
 * Determine whether an updateWall differential changes web eligibility or
 * structural geometry.
 *
 * Door open/closed state is deliberately ignored because all door walls are
 * excluded regardless of current state. Changing whether a wall is a door does
 * require regeneration.
 *
 * @param {unknown} changed - updateWall differential.
 * @returns {boolean} True when webs should be regenerated.
 */
export function doesWallUpdateAffectWebs(
  changed
) {
  const prefixes =
    [
      "c",
      "coords",
      "coordinates",
      "x1",
      "y1",
      "x2",
      "y2",
      "door",
      "doorType"
    ];

  return objectContainsPathPrefix(
    changed,
    prefixes
  );
}

function objectContainsPathPrefix(
  value,
  prefixes,
  parentPath = ""
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

  for (
    const [
      key,
      child
    ] of Object.entries(
      value
    )
  ) {
    const path =
      parentPath
        ? `${parentPath}.${key}`
        : key;

    if (
      prefixes.some(
        (
          prefix
        ) =>
          path ===
            prefix ||
          path.startsWith(
            `${prefix}.`
          )
      )
    ) {
      return true;
    }

    if (
      objectContainsPathPrefix(
        child,
        prefixes,
        path
      )
    ) {
      return true;
    }
  }

  return false;
}
