// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\ui\sceneConfigHookRegistration.js

import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  reportDiagnostic
} from "../diagnostics/diagnosticReporter.js";

import {
  SCENE_CONFIG_PART_ID,
  SCENE_CONFIG_POPULATION_CARD_TEMPLATE_PATH,
  SCENE_CONFIG_TAB_ICON,
  SCENE_CONFIG_TEMPLATE_PATH
} from "./sceneConfigConstants.js";

/**
 * Stable marker placed on the SceneConfig class after it has been patched.
 *
 * Symbol.for() prevents duplicate patching if development reload behaviour
 * evaluates this module more than once in one browser session.
 */
const SCENE_CONFIG_REGISTRATION_MARKER =
  Symbol.for(
    `${MODULE_ID}.sceneConfigNativeTabRegistered`
  );

/**
 * Create the public SceneConfig registration function.
 *
 * The registration module owns Foundry's SceneConfig class patching while the
 * large application module still owns template context, DOM listeners, and
 * module-owned registration state.
 *
 * @param {object} options - Registration callbacks.
 * @param {Function} options.createTemplateContext - Build module part context.
 * @param {Function} options.activateControls - Activate module part controls.
 * @param {Function} options.registerAdditionalHooks - Register level hooks.
 * @returns {Function} Idempotent SceneConfig hook registrar.
 */
export function createSceneConfigHookRegistration({
  createTemplateContext,
  activateControls,
  registerAdditionalHooks
}) {
  assertCallback(
    createTemplateContext,
    "createTemplateContext"
  );

  assertCallback(
    activateControls,
    "activateControls"
  );

  assertCallback(
    registerAdditionalHooks,
    "registerAdditionalHooks"
  );

  let sceneConfigHooksRegistered =
    false;

  let sceneConfigTemplateLoadPromise =
    null;

  /**
   * Register Dynamic Webs as a native SceneConfig ApplicationV2 part.
   *
   * Foundry's SceneConfig already defines static PARTS and a "sheet" TABS
   * group. This function extends those definitions before any SceneConfig
   * application is opened. It also wraps two ApplicationV2 lifecycle methods:
   *
   * - _preparePartContext() supplies module-owned template data.
   * - _attachPartListeners() activates the enabled-state controls.
   *
   * No post-render DOM injection is performed. Foundry renders the template as
   * an ordinary SceneConfig tab and includes its fields in the normal top-level
   * Scene Configuration form.
   *
   * Registration is idempotent.
   *
   * @returns {boolean} True when registration was performed by this call.
   */
  function registerSceneConfigHooks() {
    if (sceneConfigHooksRegistered) {
      return false;
    }

    const sceneConfigClass =
      resolveSceneConfigClass();

    if (
      sceneConfigClass[
        SCENE_CONFIG_REGISTRATION_MARKER
      ] === true
    ) {
      sceneConfigHooksRegistered =
        true;

      return false;
    }

    validateSceneConfigClass(
      sceneConfigClass
    );

    registerSceneConfigPart(
      sceneConfigClass
    );

    registerSceneConfigTab(
      sceneConfigClass
    );

    wrapSceneConfigPartContext({
      sceneConfigClass,
      createTemplateContext
    });

    wrapSceneConfigPartListeners({
      sceneConfigClass,
      activateControls
    });

    registerAdditionalHooks();

    Object.defineProperty(
      sceneConfigClass,
      SCENE_CONFIG_REGISTRATION_MARKER,
      {
        value:
          true,

        enumerable:
          false,

        configurable:
          false,

        writable:
          false
      }
    );

    sceneConfigHooksRegistered =
      true;

    void preloadSceneConfigTemplate()
      .catch(
        (error) => {
          reportDiagnostic({
            code:
              "ui.scene-config.template-preload-failed",
            severity:
              "error",
            message:
              "Scene Configuration template preload failed.",
            context: {
              templatePath:
                SCENE_CONFIG_TEMPLATE_PATH
            },
            nextAction:
              "Check that the Scene Configuration template exists and can be loaded; Dynamic Webs scene controls may not render.",
            error
          });
        }
      );

    console.log(
      `${MODULE_ID} | Native Scene Configuration tab registered.`
    );

    return true;
  }

  /**
   * Preload the Scene Configuration Handlebars template.
   *
   * @returns {Promise<void>} Shared preload operation.
   */
  async function preloadSceneConfigTemplate() {
    if (sceneConfigTemplateLoadPromise) {
      return sceneConfigTemplateLoadPromise;
    }

    sceneConfigTemplateLoadPromise =
      loadSceneConfigTemplate();

    try {
      await sceneConfigTemplateLoadPromise;
    } catch (error) {
      sceneConfigTemplateLoadPromise =
        null;

      throw error;
    }
  }

  return registerSceneConfigHooks;
}

/**
 * Register the Dynamic Webs Handlebars part immediately before Foundry's
 * standard form footer.
 *
 * Preserving the existing part order is important because the tabs navigation
 * must remain before tab bodies and the footer must remain last.
 *
 * @param {Function} sceneConfigClass - Foundry SceneConfig class.
 */
function registerSceneConfigPart(
  sceneConfigClass
) {
  const existingParts =
    sceneConfigClass.PARTS;

  if (
    Object.prototype.hasOwnProperty.call(
      existingParts,
      SCENE_CONFIG_PART_ID
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | SceneConfig part "${SCENE_CONFIG_PART_ID}" is already registered.`
    );
  }

  const replacementParts =
    {};

  let inserted =
    false;

  for (
    const [
      partId,
      partConfiguration
    ] of Object.entries(
      existingParts
    )
  ) {
    if (
      partId ===
        "footer"
    ) {
      replacementParts[
        SCENE_CONFIG_PART_ID
      ] =
        createSceneConfigPartDefinition();

      inserted =
        true;
    }

    replacementParts[
      partId
    ] =
      partConfiguration;
  }

  if (!inserted) {
    replacementParts[
      SCENE_CONFIG_PART_ID
    ] =
      createSceneConfigPartDefinition();
  }

  replaceStaticClassProperty(
    sceneConfigClass,
    "PARTS",
    replacementParts
  );
}

/**
 * Create the module-owned SceneConfig part definition.
 *
 * @returns {Readonly<object>} Handlebars part definition.
 */
function createSceneConfigPartDefinition() {
  return Object.freeze({
    template:
      SCENE_CONFIG_TEMPLATE_PATH,

    /**
     * The template root is the scrolling tab body.
     */
    scrollable: [
      ""
    ]
  });
}

/**
 * Register the Dynamic Webs tab in SceneConfig's main "sheet" tab group.
 *
 * @param {Function} sceneConfigClass - Foundry SceneConfig class.
 */
function registerSceneConfigTab(
  sceneConfigClass
) {
  const existingTabs =
    sceneConfigClass.TABS;

  const sheetTabs =
    existingTabs?.sheet;

  if (
    !sheetTabs ||
    !Array.isArray(
      sheetTabs.tabs
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | SceneConfig does not expose the expected "sheet" tab group.`
    );
  }

  if (
    sheetTabs.tabs.some(
      (
        tab
      ) =>
        tab?.id ===
        SCENE_CONFIG_PART_ID
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | SceneConfig tab "${SCENE_CONFIG_PART_ID}" is already registered.`
    );
  }

  const replacementTabs = {
    ...existingTabs,

    sheet: {
      ...sheetTabs,

      tabs: [
        ...sheetTabs.tabs,

        Object.freeze({
          id:
            SCENE_CONFIG_PART_ID,

          icon:
            SCENE_CONFIG_TAB_ICON
        })
      ]
    }
  };

  replaceStaticClassProperty(
    sceneConfigClass,
    "TABS",
    replacementTabs
  );
}

/**
 * Wrap SceneConfig._preparePartContext() to provide module-owned context.
 *
 * The original Foundry implementation always runs first. Dynamic Webs
 * augments only its own part, apart from replacing the generated tab label
 * with a direct readable string for the shared tabs-navigation part.
 *
 * @param {object} options - Wrapper values.
 * @param {Function} options.sceneConfigClass - Foundry SceneConfig class.
 * @param {Function} options.createTemplateContext - Context callback.
 */
function wrapSceneConfigPartContext({
  sceneConfigClass,
  createTemplateContext
}) {
  const prototype =
    sceneConfigClass.prototype;

  const originalPreparePartContext =
    prototype._preparePartContext;

  if (
    typeof originalPreparePartContext !==
      "function"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | SceneConfig._preparePartContext() is unavailable.`
    );
  }

  prototype._preparePartContext =
    async function (
      partId,
      context,
      options
    ) {
      const preparedContext =
        await originalPreparePartContext.call(
          this,
          partId,
          context,
          options
        );

      const contextWithTabLabel =
        applySceneConfigTabLabel(
          preparedContext
        );

      if (
        partId !==
        SCENE_CONFIG_PART_ID
      ) {
        return contextWithTabLabel;
      }

      const scene =
        resolveConfiguredScene(
          this
        );

      const moduleContext =
        await createTemplateContext({
          application:
            this,

          scene
        });

      return {
        ...contextWithTabLabel,
        ...moduleContext
      };
    };
}

/**
 * Wrap SceneConfig._attachPartListeners() to activate controls in only the
 * module-owned part.
 *
 * @param {object} options - Wrapper values.
 * @param {Function} options.sceneConfigClass - Foundry SceneConfig class.
 * @param {Function} options.activateControls - Control activation callback.
 */
function wrapSceneConfigPartListeners({
  sceneConfigClass,
  activateControls
}) {
  const prototype =
    sceneConfigClass.prototype;

  const originalAttachPartListeners =
    prototype._attachPartListeners;

  if (
    typeof originalAttachPartListeners !==
      "function"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | SceneConfig._attachPartListeners() is unavailable.`
    );
  }

  prototype._attachPartListeners =
    function (
      partId,
      htmlElement,
      options
    ) {
      originalAttachPartListeners.call(
        this,
        partId,
        htmlElement,
        options
      );

      if (
        partId !==
        SCENE_CONFIG_PART_ID
      ) {
        return;
      }

      activateControls(
        this,
        htmlElement
      );
    };
}

/**
 * Apply a direct readable label to the prepared Dynamic Webs tab.
 *
 * Foundry's SceneConfig tab group uses a core localisation prefix. A module
 * tab does not belong to that core namespace, so the prepared tab entry is
 * cloned with the module title as its label.
 *
 * @param {object} context - Prepared ApplicationV2 part context.
 * @returns {object} Context with a readable tab label.
 */
export function applySceneConfigTabLabel(
  context
) {
  if (
    !context ||
    typeof context !==
      "object"
  ) {
    return context;
  }

  const existingTabs =
    context.tabs;

  const existingModuleTab =
    existingTabs?.[
      SCENE_CONFIG_PART_ID
    ];

  if (
    !existingTabs ||
    !existingModuleTab ||
    typeof existingTabs !==
      "object"
  ) {
    return context;
  }

  return {
    ...context,

    tabs: {
      ...existingTabs,

      [SCENE_CONFIG_PART_ID]: {
        ...existingModuleTab,

        label:
          MODULE_TITLE
      }
    }
  };
}

/**
 * Resolve Foundry's SceneConfig ApplicationV2 class.
 *
 * @returns {Function} SceneConfig class.
 */
function resolveSceneConfigClass() {
  const sceneConfigClass =
    globalThis.foundry
      ?.applications
      ?.sheets
      ?.SceneConfig;

  if (
    typeof sceneConfigClass !==
      "function"
  ) {
    throw new Error(
      `${MODULE_TITLE} | Foundry's ApplicationV2 SceneConfig class is unavailable.`
    );
  }

  return sceneConfigClass;
}

/**
 * Validate the SceneConfig static contracts used by this integration.
 *
 * @param {Function} sceneConfigClass - Candidate SceneConfig class.
 */
function validateSceneConfigClass(
  sceneConfigClass
) {
  if (
    !sceneConfigClass.PARTS ||
    typeof sceneConfigClass.PARTS !==
      "object"
  ) {
    throw new Error(
      `${MODULE_TITLE} | SceneConfig.PARTS is unavailable.`
    );
  }

  if (
    !sceneConfigClass.TABS ||
    typeof sceneConfigClass.TABS !==
      "object"
  ) {
    throw new Error(
      `${MODULE_TITLE} | SceneConfig.TABS is unavailable.`
    );
  }
}

/**
 * Replace one writable or configurable static class property.
 *
 * @param {Function} targetClass - Class receiving the replacement.
 * @param {string} propertyName - Static property name.
 * @param {object} value - Replacement value.
 */
function replaceStaticClassProperty(
  targetClass,
  propertyName,
  value
) {
  const ownDescriptor =
    Object.getOwnPropertyDescriptor(
      targetClass,
      propertyName
    );

  if (
    !ownDescriptor ||
    ownDescriptor.writable ===
      true
  ) {
    targetClass[
      propertyName
    ] =
      value;

    return;
  }

  if (
    ownDescriptor.configurable ===
      true
  ) {
    Object.defineProperty(
      targetClass,
      propertyName,
      {
        ...ownDescriptor,

        value
      }
    );

    return;
  }

  throw new Error(
    `${MODULE_TITLE} | SceneConfig.${propertyName} cannot be extended.`
  );
}

/**
 * Resolve the Scene configured by one SceneConfig application.
 *
 * @param {object} application - SceneConfig application.
 * @returns {object} Scene document.
 */
function resolveConfiguredScene(
  application
) {
  const scene =
    application?.document ??
    application?.object ??
    application?.scene;

  if (
    !scene ||
    typeof scene !==
      "object"
  ) {
    throw new Error(
      `${MODULE_TITLE} | SceneConfig did not expose a Scene document.`
    );
  }

  return scene;
}

/**
 * Perform one template preload.
 *
 * @returns {Promise<void>}
 */
async function loadSceneConfigTemplate() {
  const handlebarsApi =
    globalThis.foundry
      ?.applications
      ?.handlebars;

  if (
    typeof handlebarsApi?.loadTemplates ===
      "function"
  ) {
    await handlebarsApi.loadTemplates([
      SCENE_CONFIG_TEMPLATE_PATH,
      SCENE_CONFIG_POPULATION_CARD_TEMPLATE_PATH
    ]);

    return;
  }

  if (
    typeof globalThis.loadTemplates ===
      "function"
  ) {
    await globalThis.loadTemplates([
      SCENE_CONFIG_TEMPLATE_PATH,
      SCENE_CONFIG_POPULATION_CARD_TEMPLATE_PATH
    ]);

    return;
  }

  throw new Error(
    `${MODULE_TITLE} | Foundry's Handlebars template loader is unavailable.`
  );
}

/**
 * Assert that one registration callback is callable.
 *
 * @param {unknown} callback - Candidate callback.
 * @param {string} name - Callback label.
 */
function assertCallback(
  callback,
  name
) {
  if (
    typeof callback !==
      "function"
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | SceneConfig registration requires ${name}().`
    );
  }
}
