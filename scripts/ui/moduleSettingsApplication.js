import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

/**
 * Build the GM-facing settings submenu class after Foundry has initialised.
 *
 * ClientSettings.registerMenu still accepts FormApplication subclasses in
 * Foundry v13 and v14. A small fallback base keeps module imports testable in
 * a plain Node environment without pretending that the application can render
 * there.
 */
export function createDynamicWebsSettingsApplicationClass({
  templatePath,
  createContext,
  saveValues,
  clearCarpetTextureCache
}) {
  assertCallback(
    createContext,
    "createContext"
  );

  assertCallback(
    saveValues,
    "saveValues"
  );

  assertCallback(
    clearCarpetTextureCache,
    "clearCarpetTextureCache"
  );

  const foundryFormApplication =
    globalThis.foundry
      ?.appv1
      ?.api
      ?.FormApplication;

  const Base =
    typeof globalThis.FormApplication ===
      "function"
      ? globalThis.FormApplication
      : typeof foundryFormApplication ===
          "function"
        ? foundryFormApplication
        : class {
          static get defaultOptions() {
            return {};
          }

          activateListeners() {}

          async close() {}
        };

  return class DynamicWebsSettingsApplication extends Base {
    static get defaultOptions() {
      const inherited =
        super.defaultOptions ??
        {};

      return {
        ...inherited,
        id:
          "dynamic-webs-settings",
        title:
          `${MODULE_TITLE} Defaults`,
        template:
          templatePath,
        width:
          620,
        height:
          "auto",
        closeOnSubmit:
          true,
        submitOnChange:
          false,
        submitOnClose:
          false,
        classes: [
          ...(
            Array.isArray(
              inherited.classes
            )
              ? inherited.classes
              : []
          ),
          "dynamic-webs-settings"
        ]
      };
    }

    async getData() {
      return createContext();
    }

    activateListeners(
      html
    ) {
      super.activateListeners?.(
        html
      );

      const root =
        resolveHtmlRoot(
          html
        );

      root
        ?.querySelector?.(
          "[data-dynamic-webs-clear-carpet-cache]"
        )
        ?.addEventListener?.(
          "click",
          async (
            event
          ) => {
            event.preventDefault();

            const button =
              event.currentTarget;

            if (
              button
            ) {
              button.disabled =
                true;
            }

            try {
              await clearCarpetTextureCache();

              globalThis.ui?.notifications?.info?.(
                "Dynamic Webs carpet texture cache cleared."
              );
            } finally {
              if (
                button
              ) {
                button.disabled =
                  false;
              }
            }
          }
        );
    }

    async _updateObject(
      _event,
      formData
    ) {
      await saveValues(
        formData ??
        {}
      );
    }
  };
}

function resolveHtmlRoot(
  html
) {
  if (
    html?.querySelector
  ) {
    return html;
  }

  if (
    html?.[0]?.querySelector
  ) {
    return html[0];
  }

  if (
    html?.element?.querySelector
  ) {
    return html.element;
  }

  return null;
}

function assertCallback(
  value,
  label
) {
  if (
    typeof value !==
      "function"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Settings application requires ${label}().`
    );
  }
}
