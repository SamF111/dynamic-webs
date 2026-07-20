import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

const PANEL_ID =
  `${MODULE_ID}-baseline-diagnostic`;

/**
 * Display one diagnostic report in a large copyable textarea.
 *
 * @param {object} report - Frozen diagnostic report.
 * @returns {object} The same report.
 */
export function showDiagnosticTextarea(
  report
) {
  const document =
    globalThis.document;

  if (
    !document ||
    typeof document.createElement !==
      "function" ||
    !document.body
  ) {
    globalThis.console?.log?.(
      `${MODULE_TITLE} | Baseline diagnostic`,
      report
    );

    return report;
  }

  document
    .getElementById?.(
      PANEL_ID
    )
    ?.remove?.();

  const panel =
    document.createElement(
      "section"
    );

  panel.id =
    PANEL_ID;

  panel.setAttribute(
    "aria-label",
    `${MODULE_TITLE} baseline diagnostic`
  );

  Object.assign(
    panel.style,
    {
      position:
        "fixed",
      inset:
        "4%",
      zIndex:
        "100000",
      display:
        "flex",
      flexDirection:
        "column",
      gap:
        "8px",
      padding:
        "12px",
      background:
        "#111",
      border:
        "2px solid #888",
      boxShadow:
        "0 8px 32px rgba(0,0,0,0.6)"
    }
  );

  const controls =
    document.createElement(
      "div"
    );

  Object.assign(
    controls.style,
    {
      display:
        "flex",
      gap:
        "8px",
      alignItems:
        "center"
    }
  );

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    `${MODULE_TITLE} baseline diagnostic`;

  title.style.flex =
    "1";

  const copyButton =
    document.createElement(
      "button"
    );

  copyButton.type =
    "button";

  copyButton.textContent =
    "Copy JSON";

  const closeButton =
    document.createElement(
      "button"
    );

  closeButton.type =
    "button";

  closeButton.textContent =
    "Close";

  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value =
    JSON.stringify(
      report,
      null,
      2
    );

  textarea.readOnly =
    true;

  Object.assign(
    textarea.style,
    {
      flex:
        "1",
      width:
        "100%",
      minHeight:
        "0",
      resize:
        "none",
      fontFamily:
        "monospace",
      fontSize:
        "13px",
      lineHeight:
        "1.35"
    }
  );

  copyButton.addEventListener(
    "click",
    async () => {
      textarea.focus();
      textarea.select();

      try {
        const writeText =
          globalThis.navigator
            ?.clipboard
            ?.writeText;

        if (
          typeof writeText !==
            "function"
        ) {
          throw new Error(
            "Clipboard API unavailable."
          );
        }

        await writeText.call(
          globalThis.navigator.clipboard,
          textarea.value
        );

        copyButton.textContent =
          "Copied";
      } catch (_error) {
        globalThis.document
          ?.execCommand?.(
            "copy"
          );

        copyButton.textContent =
          "Selected";
      }
    }
  );

  closeButton.addEventListener(
    "click",
    () =>
      panel.remove()
  );

  controls.append(
    title,
    copyButton,
    closeButton
  );

  panel.append(
    controls,
    textarea
  );

  document.body.append(
    panel
  );

  textarea.focus();
  textarea.select();

  globalThis.console?.log?.(
    `${MODULE_TITLE} | Baseline diagnostic`,
    report
  );

  return report;
}
