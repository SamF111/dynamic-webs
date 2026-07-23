import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getDynamicWebsRuntime
} from "../runtime/runtimeRegistry.js";

import {
  deleteAllGeneratedWebWallsForScene,
  restoreDestroyedSpanWebsForScene,
  updateGeneratedWebWallsForScene
} from "../maintenance/WebWallMaintenanceService.js";

/** Activate immediate generated-wall and destroyed-span controls in Scene Configuration. */
export function activateSceneConfigSpanWallControls(application, partElement) {
  if (!partElement?.querySelector) {
    throw new TypeError(`${MODULE_TITLE} | Scene web-wall controls require an HTMLElement.`);
  }

  const restoreButton = partElement.querySelector("[data-dynamic-webs-restore-destroyed-spans]");
  const updateButton = partElement.querySelector("[data-dynamic-webs-update-span-walls]");
  const deleteButton = partElement.querySelector("[data-dynamic-webs-delete-span-walls]");

  if (!restoreButton || !updateButton || !deleteButton) {
    throw new Error(`${MODULE_TITLE} | Scene web-wall maintenance controls could not be resolved.`);
  }

  const scene = application?.document ?? application?.object ?? application?.scene;
  const editable = application?.isEditable !== false;
  const buttons = [restoreButton, updateButton, deleteButton];

  const syncDisabledState = () => {
    const destroyedCount = Number(restoreButton.dataset.destroyedCount) || 0;

    restoreButton.disabled = !editable || destroyedCount <= 0;
    updateButton.disabled = !editable || updateButton.dataset.activeScene !== "true";
    deleteButton.disabled = !editable;
  };

  restoreButton.addEventListener("click", async event => {
    event.preventDefault();

    const destroyedCount = Number(restoreButton.dataset.destroyedCount) || 0;

    if (await confirmSceneRestoreDestroyedSpansAction({
      scene,
      destroyedCount
    }) !== true) {
      return;
    }

    await runAction({
      buttons,
      syncDisabledState,
      action: () => restoreDestroyedSpanWebsForScene(scene, {
        runtime: getDynamicWebsRuntime()
      }),
      success: result => `Restored ${result.restoredWebCount ?? 0} destroyed span web(s) in this Scene.`,
      afterSuccess: () => {
        restoreButton.dataset.destroyedCount = "0";

        const count = restoreButton.querySelector?.(
          "[data-dynamic-webs-restore-span-count]"
        );

        if (count) {
          count.textContent = "0";
        }

        const warning = partElement.querySelector(
          "[data-dynamic-webs-span-indestructible-warning]"
        );

        if (warning) {
          warning.dataset.destroyedCount = "0";
          warning.hidden = true;
        }
      }
    });
  });

  updateButton.addEventListener("click", async event => {
    event.preventDefault();

    await runAction({
      buttons,
      syncDisabledState,
      action: () => updateGeneratedWebWallsForScene(scene, {
        runtime: getDynamicWebsRuntime()
      }),
      success: result => `Updated generated web walls: ${result.createdWallCount ?? 0} created, ${result.updatedWallCount ?? 0} updated, ${result.deletedWallCount ?? 0} deleted.`
    });
  });

  deleteButton.addEventListener("click", async event => {
    event.preventDefault();

    if (await confirmSceneDeleteWebWallsAction(scene) !== true) {
      return;
    }

    await runAction({
      buttons,
      syncDisabledState,
      action: () => deleteAllGeneratedWebWallsForScene(scene, {
        runtime: getDynamicWebsRuntime()
      }),
      success: result => `Deleted ${result.deletedWallCount ?? 0} generated web wall(s) from this Scene.`
    });
  });

  syncDisabledState();
}

/** Confirm restoration through Foundry's V2 dialog API. */
export async function confirmSceneRestoreDestroyedSpansAction({
  scene,
  destroyedCount = 0
} = {}) {
  return confirmWithDialogV2({
    title: "Restore Destroyed Span Webs",
    content: `<p>Restore ${Number(destroyedCount) || 0} destroyed wall-span web(s) in <strong>${escapeHtml(scene?.name ?? "this Scene")}</strong>?</p><p>The saved destruction state is cleared. An active Scene updates immediately; an inactive Scene completes generated-wall recreation when next opened.</p>`,
    yesLabel: "Restore Destroyed Spans",
    yesIcon: "fa-undo"
  });
}

/** Confirm generated-wall deletion through Foundry's V2 dialog API. */
export async function confirmSceneDeleteWebWallsAction(scene) {
  return confirmWithDialogV2({
    title: "Delete Generated Web Walls",
    content: `<p>Delete every Dynamic Webs generated WallDocument from <strong>${escapeHtml(scene?.name ?? "this Scene")}</strong>?</p><p>Web populations and destroyed-span state are retained, so walls can return on the next update or Scene synchronisation.</p>`,
    yesLabel: "Delete Web Walls",
    yesIcon: "fa-trash"
  });
}

async function runAction({
  buttons,
  syncDisabledState,
  action,
  success,
  afterSuccess = null
}) {
  for (const button of buttons) {
    button.disabled = true;
  }

  try {
    const result = await action();

    if (result?.success !== true) {
      const message = result?.skippedReason === "scene-not-active"
        ? "Open this Scene on the canvas before updating its generated web walls."
        : "The generated web-wall action could not be completed.";
      globalThis.ui?.notifications?.warn?.(message);
      return;
    }

    afterSuccess?.(result);
    globalThis.ui?.notifications?.info?.(success(result));
    console.log(`${MODULE_TITLE} | Scene web-wall maintenance completed.`, result);
  } catch (error) {
    globalThis.ui?.notifications?.error?.(`${MODULE_TITLE} | Scene web-wall maintenance failed: ${String(error?.message ?? error)}`);
    console.error(`${MODULE_TITLE} | Scene web-wall maintenance failed.`, error);
  } finally {
    syncDisabledState();
  }
}

async function confirmWithDialogV2({
  title,
  content,
  yesLabel,
  yesIcon
}) {
  const DialogV2 = globalThis.foundry
    ?.applications
    ?.api
    ?.DialogV2 ??
    null;

  if (!DialogV2 || typeof DialogV2.confirm !== "function") {
    globalThis.ui?.notifications?.error?.(
      `${MODULE_TITLE} | Foundry's DialogV2 confirmation API is unavailable.`
    );

    return false;
  }

  return await DialogV2.confirm({
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
  }) === true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
