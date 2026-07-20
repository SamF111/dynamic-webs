import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getSceneWebLifecycleController
} from "../lifecycle/sceneLifecycle.js";

import {
  createBaselineDiagnosticReport
} from "../diagnostics/baselineDiagnosticReport.js";

import {
  showDiagnosticTextarea
} from "../diagnostics/diagnosticTextarea.js";

/** Return the comprehensive immutable v0.1 baseline report. */
export function getPublicBaselineDiagnosticReport(
  runtime
) {
  validateRuntime(
    runtime
  );

  return createBaselineDiagnosticReport({
    runtime,
    lifecycleController:
      getSceneWebLifecycleController()
  });
}

/** Open the comprehensive v0.1 baseline report in a copyable textarea. */
export function showPublicBaselineDiagnosticReport(
  runtime
) {
  const report =
    getPublicBaselineDiagnosticReport(
      runtime
    );

  showDiagnosticTextarea(
    report
  );

  return report;
}

function validateRuntime(
  runtime
) {
  if (
    !runtime ||
    runtime.runtimeOwnerType !==
      "DynamicWebsRuntime"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | A valid Dynamic Webs runtime is required.`
    );
  }
}
