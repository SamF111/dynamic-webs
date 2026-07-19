// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\dynamic-webs.js

import {
  MODULE_ID,
  MODULE_TITLE,
  RUNTIME_KEY
} from "./module/moduleConstants.js";

import {
  initialiseRuntime
} from "./runtime/runtimeRegistry.js";

import {
  createPublicApi
} from "./api.js";

import {
  registerLifecycleHooks,
  disposeLifecycleHooks
} from "./lifecycle/sceneLifecycle.js";

import {
  registerSceneConfigHooks
} from "./ui/sceneConfigApplication.js";

import {
  reportDiagnostic
} from "./diagnostics/diagnosticReporter.js";

let initialisationPromise =
  null;

let namespace =
  null;

let optionalGmHooksRegistered =
  false;

globalThis.Hooks.once(
  "init",
  () => {
    initialisationPromise =
      initialiseDynamicWebs();

    void initialisationPromise.catch(
      () => {
        // Detailed diagnostics are emitted by initialiseDynamicWebs().
      }
    );
  }
);

globalThis.Hooks.once(
  "ready",
  async () => {
    try {
      const runtime =
        await requireInitialisedRuntime();

      registerOptionalGmHooks();

      runtime.ready =
        true;

      /**
       * canvasReady normally performs this synchronisation. The extra ready
       * check covers development reloads where the canvas was already ready
       * before this module entry point was evaluated.
       */
      if (
        globalThis.canvas?.ready ===
          true &&
        globalThis.canvas?.scene
      ) {
        const currentSceneId =
          String(
            globalThis.canvas.scene.id ??
            ""
          ).trim();

        const webState =
          runtime
            .getWebRuntimeService()
            .getState();

        if (
          webState?.sceneId !==
            currentSceneId
        ) {
          const controller =
            registerLifecycleHooks(
              runtime
            );

          controller.synchroniseActiveScene(
            "foundry-ready"
          );
        }
      }

      console.log(
        `${MODULE_TITLE} | Ready`
      );

      globalThis.Hooks.callAll(
        `${MODULE_ID}.ready`,
        namespace
      );
    } catch (error) {
      reportDiagnostic({
        code:
          "bootstrap.ready-failed",
        message:
          "Ready-phase initialisation failed.",
        context: {
          moduleId:
            MODULE_ID
        },
        nextAction:
          "Reload Foundry and inspect the original error stack.",
        error
      });
    }
  }
);

/**
 * Initialise the standalone Dynamic Webs module.
 *
 * @returns {Promise<object>} Initialised runtime.
 */
async function initialiseDynamicWebs() {
  try {
    const runtime =
      initialiseRuntime();

    registerLifecycleHooks(
      runtime
    );

    const api =
      createPublicApi(
        runtime
      );

    namespace =
      Object.freeze({
        id:
          MODULE_ID,
        title:
          MODULE_TITLE,
        api
      });

    exposePublicNamespace(
      namespace
    );

    const moduleRecord =
      globalThis.game
        ?.modules
        ?.get?.(
          MODULE_ID
        );

    if (moduleRecord) {
      moduleRecord.api =
        api;
    }

    registerOptionalGmHooks();

    console.log(
      `${MODULE_TITLE} | Initialised`
    );

    globalThis.Hooks.callAll(
      `${MODULE_ID}.init`,
      namespace
    );

    return runtime;
  } catch (error) {
    disposeLifecycleHooks();

    if (
      Object.prototype.hasOwnProperty.call(
        globalThis,
        RUNTIME_KEY
      )
    ) {
      delete globalThis[
        RUNTIME_KEY
      ];
    }

    namespace =
      null;

    reportDiagnostic({
      code:
        "bootstrap.init-failed",
      message:
        "Init-phase initialisation failed.",
      context: {
        moduleId:
          MODULE_ID
      },
      nextAction:
        "Reload Foundry and inspect the original error stack.",
      error
    });

    throw error;
  }
}

function registerOptionalGmHooks() {
  if (
    optionalGmHooksRegistered ||
    globalThis.game?.user?.isGM !==
      true
  ) {
    return false;
  }

  registerSceneConfigHooks();

  optionalGmHooksRegistered =
    true;

  return true;
}

async function requireInitialisedRuntime() {
  if (!initialisationPromise) {
    throw new Error(
      `${MODULE_TITLE} | The init-phase bootstrap was not started.`
    );
  }

  return initialisationPromise;
}

function exposePublicNamespace(
  value
) {
  const descriptor =
    Object.getOwnPropertyDescriptor(
      globalThis,
      RUNTIME_KEY
    );

  if (
    descriptor &&
    descriptor.configurable !==
      true
  ) {
    throw new Error(
      `${MODULE_TITLE} | globalThis.${RUNTIME_KEY} is already owned by a non-configurable value.`
    );
  }

  Object.defineProperty(
    globalThis,
    RUNTIME_KEY,
    {
      value,
      enumerable:
        true,
      configurable:
        true,
      writable:
        false
    }
  );
}

function handleClientUnload() {
  try {
    disposeLifecycleHooks();
  } finally {
    if (
      Object.prototype.hasOwnProperty.call(
        globalThis,
        RUNTIME_KEY
      )
    ) {
      delete globalThis[
        RUNTIME_KEY
      ];
    }
  }
}

globalThis.addEventListener?.(
  "beforeunload",
  handleClientUnload
);

globalThis.addEventListener?.(
  "pagehide",
  handleClientUnload
);
