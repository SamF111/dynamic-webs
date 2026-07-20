import {
  WEB_DENSITY_OPTIONS,
  WEB_DENSITY_ORDER
} from "../simulation/webs/webDensityPresets.js";

const LABELS_BY_DENSITY_ID =
  new Map(
    WEB_DENSITY_OPTIONS.map(
      (
        option
      ) => [
        option.id,
        option.label
      ]
    )
  );

/** Activate discrete category-density sliders in the Scene Configuration tab. */
export function activateSceneConfigDensitySliders(
  _application,
  htmlElement
) {
  if (
    !htmlElement ||
    typeof htmlElement.querySelectorAll !==
      "function"
  ) {
    return 0;
  }

  const controls =
    Array.from(
      htmlElement.querySelectorAll(
        "[data-dynamic-webs-density-slider]"
      )
    );

  for (
    const control of
    controls
  ) {
    activateDensitySlider(
      control
    );
  }

  return controls.length;
}

function activateDensitySlider(
  control
) {
  const slider =
    control.querySelector?.(
      "[data-dynamic-webs-density-range]"
    );

  const hiddenInput =
    control.querySelector?.(
      "[data-dynamic-webs-density-value]"
    );

  const output =
    control.querySelector?.(
      "[data-dynamic-webs-density-output]"
    );

  if (
    !slider ||
    !hiddenInput ||
    !output
  ) {
    return false;
  }

  const synchronise =
    (
      dispatchChange = false
    ) => {
      const index =
        clampDensityIndex(
          slider.value
        );

      const densityId =
        WEB_DENSITY_ORDER[
          index
        ];

      slider.value =
        String(
          index
        );

      hiddenInput.value =
        densityId;

      output.value =
        LABELS_BY_DENSITY_ID.get(
          densityId
        ) ??
        densityId;

      output.textContent =
        output.value;

      output.dataset.densityId =
        densityId;

      control.dataset.densityId =
        densityId;

      if (
        dispatchChange &&
        typeof hiddenInput.dispatchEvent ===
          "function" &&
        typeof globalThis.Event ===
          "function"
      ) {
        hiddenInput.dispatchEvent(
          new globalThis.Event(
            "change",
            {
              bubbles:
                true
            }
          )
        );
      }
    };

  slider.addEventListener?.(
    "input",
    () =>
      synchronise(
        false
      )
  );

  slider.addEventListener?.(
    "change",
    () =>
      synchronise(
        true
      )
  );

  synchronise(
    false
  );

  return true;
}

function clampDensityIndex(
  value
) {
  const numericValue =
    Number(
      value
    );

  const roundedValue =
    Number.isFinite(
      numericValue
    )
      ? Math.round(
          numericValue
        )
      : 0;

  return Math.max(
    0,
    Math.min(
      WEB_DENSITY_ORDER.length -
        1,
      roundedValue
    )
  );
}
