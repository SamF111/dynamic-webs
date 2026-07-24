import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

const CONTROLS_ATTRIBUTE =
  "data-dynamic-webs-world-maintenance-controls";

export const SETTINGS_CONFIG_MAINTENANCE_CONTROLS_SELECTOR =
  `[${CONTROLS_ATTRIBUTE}]`;

const UNINSTALL_CONFIRMATION_TEXT =
  "UNINSTALL";

/** Add immediate maintenance buttons to Foundry's standard Configure Settings form. */
export function activateSettingsConfigMaintenanceControls(
  root,
  {
    onRestoreDestroyedSpanWebsRequested = null,
    onCleanupLingeringWebWallsRequested = null,
    onPrepareUninstallRequested = null
  } = {}
) {
  if (
    globalThis.game?.user?.isGM !== true ||
    typeof root?.querySelector !== "function" ||
    root.querySelector(SETTINGS_CONFIG_MAINTENANCE_CONTROLS_SELECTOR)
  ) {
    return false;
  }

  const cacheControl = root.querySelector(
    `[name="${MODULE_ID}.clearCarpetTextureCache"]`
  );

  const cacheRow = cacheControl?.closest?.(".form-group") ?? cacheControl?.parentElement;
  const parent = cacheRow?.parentNode;
  const documentObject = cacheRow?.ownerDocument ?? globalThis.document;

  if (!cacheRow || !parent || typeof documentObject?.createElement !== "function") {
    return false;
  }

  const group = documentObject.createElement("div");
  group.className = "form-group stacked";
  group.setAttribute(CONTROLS_ATTRIBUTE, "true");

  const label = documentObject.createElement("label");
  label.textContent = "World Maintenance";

  const fields = documentObject.createElement("div");
  fields.className = "form-fields";

  const restoreButton = createButton(documentObject, {
    action: "restore-destroyed-spans",
    icon: "fa-undo",
    label: "Restore Destroyed Span Webs in All Scenes"
  });

  const cleanupButton = createButton(documentObject, {
    action: "cleanup",
    icon: "fa-broom",
    label: "Destroy All Lingering Web Walls"
  });

  const uninstallButton = createButton(documentObject, {
    action: "uninstall",
    icon: "fa-trash",
    label: "Clear All Webs and Prepare for Uninstall"
  });

  const buttons = [
    restoreButton,
    cleanupButton,
    uninstallButton
  ];

  fields.append(...buttons);

  const hint = documentObject.createElement("p");
  hint.className = "hint";
  hint.textContent = "Restore clears persistent destroyed-span state in every Scene. The active Scene is restored immediately; inactive Scenes restore without generating geometry and complete their derived-wall reconciliation when next opened. Clean-up deletes invalid, duplicate, and destroyed-span generated walls only. Prepare for Uninstall deletes every generated web wall, clears Dynamic Webs Region flags, and resets every Scene to an explicit empty web-population array.";

  group.append(label, fields, hint);

  if (cacheRow.nextSibling) {
    parent.insertBefore(group, cacheRow.nextSibling);
  } else {
    parent.appendChild(group);
  }

  restoreButton.addEventListener("click", async event => {
    event.preventDefault();

    if (await confirmRestoreAllDestroyedSpanWebsAction() !== true) {
      return;
    }

    await runButtonAction({
      buttons,
      action: onRestoreDestroyedSpanWebsRequested,
      successMessage: summary => `Dynamic Webs restored ${summary?.restoredWebCount ?? 0} destroyed span web(s) across ${summary?.restoredSceneCount ?? 0} Scene(s).`
    });
  });

  cleanupButton.addEventListener("click", async event => {
    event.preventDefault();

    if (await confirmCleanupAction() !== true) {
      return;
    }

    await runButtonAction({
      buttons,
      action: onCleanupLingeringWebWallsRequested,
      successMessage: summary => `Dynamic Webs cleaned ${summary?.deletedWallCount ?? 0} lingering web wall(s) across ${summary?.sceneCount ?? 0} Scene(s).`
    });
  });

  uninstallButton.addEventListener("click", async event => {
    event.preventDefault();

    if (await confirmUninstallAction() !== true) {
      return;
    }

    await runButtonAction({
      buttons,
      action: onPrepareUninstallRequested,
      successMessage: summary => `Dynamic Webs cleared ${summary?.clearedSceneCount ?? 0} Scene(s) and deleted ${summary?.deletedWallCount ?? 0} generated wall(s). The world is ready for module removal.`
    });
  });

  return true;
}

/** Confirm the world-wide restorative mutable-state action. */
export async function confirmRestoreAllDestroyedSpanWebsAction() {
  return confirmWithDialogV2({
    title: "Restore Destroyed Span Webs",
    content: "<p>Restore every persistently destroyed wall-span web in every Scene?</p><p>The active Scene updates immediately. Inactive Scenes do not generate geometry now; their restored spans and any required generated walls appear when those Scenes are next opened.</p>",
    yesLabel: "Restore All Destroyed Spans",
    yesIcon: "fa-undo"
  });
}

/** Ask for ordinary destructive-action confirmation through Foundry's V2 dialog API. */
export async function confirmCleanupAction() {
  return confirmWithDialogV2({
    title: "Destroy Lingering Web Walls",
    content: "<p>Delete lingering, duplicate, and malformed Dynamic Webs generated walls from every Scene?</p><p><strong>Valid walls for intact spans will remain.</strong></p>",
    yesLabel: "Destroy Lingering Walls",
    yesIcon: "fa-broom"
  });
}

/** Require the GM to type UNINSTALL through Foundry's V2 input dialog. */
export async function confirmUninstallAction() {
  const DialogV2 = resolveDialogV2();

  if (!DialogV2 || typeof DialogV2.input !== "function") {
    notify(
      "error",
      `${MODULE_TITLE} | Foundry's DialogV2 input API is unavailable.`
    );

    return false;
  }

  const result = await DialogV2.input({
    window: {
      title: "Prepare Dynamic Webs for Uninstall"
    },
    content: [
      "<p>This removes every Dynamic Webs generated wall, clears Dynamic Webs Region flags, and resets every Scene to no web populations.</p>",
      `<p>Type <strong>${UNINSTALL_CONFIRMATION_TEXT}</strong> to continue.</p>`,
      `<input type="text" name="confirmation" autocomplete="off" spellcheck="false" autofocus placeholder="${UNINSTALL_CONFIRMATION_TEXT}">`
    ].join(""),
    ok: {
      label: "Prepare for Uninstall",
      icon: "<i class=\"fas fa-trash\"></i>"
    },
    rejectClose: false,
    modal: true
  });

  const response = readDialogInputValue(
    result,
    "confirmation"
  );

  if (response === UNINSTALL_CONFIRMATION_TEXT) {
    return true;
  }

  if (result !== null && result !== undefined) {
    notify(
      "warn",
      `${MODULE_TITLE} | Uninstall preparation was cancelled because the confirmation text did not match ${UNINSTALL_CONFIRMATION_TEXT}.`
    );
  }

  return false;
}

function createButton(documentObject, { action, icon, label }) {
  const button = documentObject.createElement("button");
  button.type = "button";
  button.dataset.dynamicWebsMaintenanceAction = action;
  button.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
  return button;
}

async function runButtonAction({
  buttons,
  action,
  successMessage
}) {
  if (typeof action !== "function") {
    notify("error", `${MODULE_TITLE} | The requested maintenance action is unavailable.`);
    return;
  }

  const priorDisabledStates = new Map(
    buttons.map(button => [button, button.disabled])
  );

  for (const button of buttons) {
    button.disabled = true;
  }

  try {
    const summary = await action();

    if (summary?.failedSceneCount > 0) {
      notify("warn", `${successMessage(summary)} ${summary.failedSceneCount} Scene(s) could not be processed; inspect the console report.`);
      console.warn(`${MODULE_TITLE} | Maintenance completed with Scene failures.`, summary);
    } else {
      notify("info", successMessage(summary));
      console.log(`${MODULE_TITLE} | Maintenance completed.`, summary);
    }
  } catch (error) {
    notify("error", `${MODULE_TITLE} | Maintenance failed: ${String(error?.message ?? error)}`);
    console.error(`${MODULE_TITLE} | Maintenance failed.`, error);
  } finally {
    for (const [button, disabled] of priorDisabledStates) {
      button.disabled = disabled;
    }
  }
}

async function confirmWithDialogV2({
  title,
  content,
  yesLabel,
  yesIcon
}) {
  const DialogV2 = resolveDialogV2();

  if (!DialogV2 || typeof DialogV2.confirm !== "function") {
    notify(
      "error",
      `${MODULE_TITLE} | Foundry's DialogV2 confirmation API is unavailable.`
    );

    return false;
  }

  const result = await DialogV2.confirm({
    window: {
      title
    },
    content,
    yes: {
      label: yesLabel,
      icon: `<i class="fas ${yesIcon}"></i>`
    },
    no: {
      label: "Cancel"
    },
    rejectClose: false,
    modal: true
  });

  return result === true;
}

function resolveDialogV2() {
  return globalThis.foundry
    ?.applications
    ?.api
    ?.DialogV2 ??
    null;
}

function readDialogInputValue(
  result,
  fieldName
) {
  if (!result) {
    return "";
  }

  const directValue =
    result?.[fieldName];

  if (
    directValue !== undefined &&
    directValue !== null
  ) {
    return String(directValue).trim();
  }

  if (typeof result?.get === "function") {
    const formDataValue =
      result.get(fieldName);

    if (
      formDataValue !== undefined &&
      formDataValue !== null
    ) {
      return String(formDataValue).trim();
    }
  }

  const objectValue =
    result?.object?.[fieldName];

  return objectValue === undefined ||
    objectValue === null
    ? ""
    : String(objectValue).trim();
}

function notify(type, message) {
  globalThis.ui?.notifications?.[type]?.(message);
}

