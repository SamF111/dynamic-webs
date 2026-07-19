import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

/**
 * Report one structured Dynamic Webs diagnostic.
 *
 * @param {object} options - Diagnostic values.
 * @returns {Readonly<object>} Frozen diagnostic snapshot.
 */
export function reportDiagnostic({
  code,
  severity = "error",
  message,
  context = {},
  nextAction = null,
  error = null
}) {
  const diagnostic =
    deepFreeze({
      moduleId:
        MODULE_ID,
      code:
        String(
          code ??
          "unknown"
        ),
      severity:
        normaliseSeverity(
          severity
        ),
      message:
        String(
          message ??
          "Dynamic Webs diagnostic."
        ),
      context:
        normaliseContext(
          context
        ),
      nextAction:
        nextAction ===
          null
          ? null
          : String(
              nextAction
            ),
      error:
        error
          ? {
              name:
                String(
                  error.name ??
                  "Error"
                ),
              message:
                String(
                  error.message ??
                  error
                ),
              stack:
                typeof error.stack ===
                  "string"
                  ? error.stack
                  : null
            }
          : null
    });

  const consoleMethod =
    diagnostic.severity ===
      "warn"
      ? "warn"
      : diagnostic.severity ===
        "info"
        ? "info"
        : "error";

  globalThis.console?.[
    consoleMethod
  ]?.(
    `${MODULE_TITLE} | ${diagnostic.code}: ${diagnostic.message}`,
    diagnostic
  );

  globalThis.Hooks?.callAll?.(
    `${MODULE_ID}.diagnostic`,
    diagnostic
  );

  return diagnostic;
}

function normaliseSeverity(
  value
) {
  return [
    "error",
    "warn",
    "info"
  ].includes(
    value
  )
    ? value
    : "error";
}

function normaliseContext(
  value
) {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  )
    ? value
    : {};
}

function deepFreeze(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object" ||
    Object.isFrozen(
      value
    )
  ) {
    return value;
  }

  for (
    const child of
    Object.values(
      value
    )
  ) {
    deepFreeze(
      child
    );
  }

  return Object.freeze(
    value
  );
}
