export function createWebLevelVisibilityState({
  policy = null,
  activeViewedLevelId = null,
  visibleLevelIds = []
} = {}) {
  return Object.freeze({
    policy:
      normaliseOptionalString(
        policy
      ),
    activeViewedLevelId:
      normaliseOptionalString(
        activeViewedLevelId
      ),
    visibleLevelIds:
      Object.freeze(
        Array.from(
          new Set(
            (
              Array.isArray(
                visibleLevelIds
              )
                ? visibleLevelIds
                : []
            )
              .map(
                String
              )
              .map(
                (
                  value
                ) =>
                  value.trim()
              )
              .filter(
                Boolean
              )
          )
        )
      )
  });
}

function normaliseOptionalString(
  value
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const text =
    value.trim();

  return text.length >
    0
    ? text
    : null;
}
