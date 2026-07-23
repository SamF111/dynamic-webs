import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  createSceneSpanWebBehaviourFlagValue
} from "../config/sceneSpanWebBehaviourConfiguration.js";

/** Activate the collapsed Scene-wide wall-span behaviour controls. */
export function activateSceneConfigSpanBehaviourControls(
  application,
  partElement
) {
  if (
    !partElement?.querySelector
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Scene Configuration span-behaviour controls require an HTMLElement.`
    );
  }

  const hidden =
    partElement.querySelector(
      "[data-dynamic-webs-span-behaviour-value]"
    );

  const section =
    partElement.querySelector(
      "[data-dynamic-webs-span-behaviour-section]"
    );

  if (
    !hidden ||
    !section
  ) {
    throw new Error(
      `${MODULE_TITLE} | Scene Configuration span-behaviour controls could not be resolved.`
    );
  }

  const useWorldWidth =
    section.querySelector(
      "[data-dynamic-webs-use-world-span-width]"
    );

  const maximumWidth =
    section.querySelector(
      "[data-dynamic-webs-span-maximum-width]"
    );

  const visionMode =
    section.querySelector(
      "[data-dynamic-webs-span-vision-mode]"
    );

  const secretDoor =
    section.querySelector(
      "[data-dynamic-webs-span-secret-door]"
    );

  const destructible =
    section.querySelector(
      "[data-dynamic-webs-span-destructible]"
    );

  if (
    !useWorldWidth ||
    !maximumWidth ||
    !visionMode ||
    !secretDoor ||
    !destructible
  ) {
    throw new Error(
      `${MODULE_TITLE} | One or more Scene span-behaviour controls are missing.`
    );
  }

  const editable =
    application?.isEditable !==
      false;

  const sync =
    () => {
      const value =
        createSceneSpanWebBehaviourFlagValue({
          maximumSpanGridUnits:
            useWorldWidth.checked
              ? null
              : maximumWidth.value,
          visionMode:
            visionMode.value,
          secretDoor:
            secretDoor.checked,
          destructible:
            destructible.checked
        });

      hidden.value =
        JSON.stringify(
          value
        );

      maximumWidth.disabled =
        !editable ||
        useWorldWidth.checked;

      for (
        const control of
        section.querySelectorAll(
          "[data-dynamic-webs-span-behaviour-control]"
        )
      ) {
        if (
          control ===
            maximumWidth
        ) {
          continue;
        }

        control.disabled =
          !editable;
      }

      const warning =
        section.querySelector(
          "[data-dynamic-webs-span-indestructible-warning]"
        );

      if (
        warning
      ) {
        const destroyedCount =
          Number(
            warning.dataset.destroyedCount
          ) ||
          0;

        warning.hidden =
          destructible.checked ||
          destroyedCount ===
            0;
      }
    };

  section.addEventListener(
    "input",
    sync
  );

  section.addEventListener(
    "change",
    sync
  );

  sync();
}
