import test from "node:test";
import assert from "node:assert/strict";

import {
  readdir
} from "node:fs/promises";

import {
  dirname,
  resolve
} from "node:path";

import {
  fileURLToPath,
  pathToFileURL
} from "node:url";

const projectRoot =
  resolve(
    dirname(
      fileURLToPath(
        import.meta.url
      )
    ),
    ".."
  );

test(
  "all non-entrypoint module files import successfully",
  async () => {
    const scriptFiles =
      (
        await collectJavaScriptFiles(
          resolve(
            projectRoot,
            "scripts"
          )
        )
      )
        .filter(
          (
            file
          ) =>
            !file.endsWith(
              `${resolve("scripts", "dynamic-webs.js")}`
            )
        )
        .sort();

    for (
      const scriptFile of
      scriptFiles
    ) {
      await assert.doesNotReject(
        () =>
          import(
            pathToFileURL(
              scriptFile
            ).href
          ),
        scriptFile
      );
    }

    assert.ok(
      scriptFiles.length >
        30
    );
  }
);

test(
  "module entrypoint registers Foundry init and ready hooks",
  async () => {
    const previousHooks =
      globalThis.Hooks;

    const previousAddEventListener =
      globalThis.addEventListener;

    const onceCalls =
      [];

    const eventListeners =
      [];

    globalThis.Hooks = {
      once(
        event,
        callback
      ) {
        onceCalls.push({
          event,
          callback
        });

        return onceCalls.length;
      },

      callAll() {}
    };

    globalThis.addEventListener =
      (
        event,
        callback
      ) => {
        eventListeners.push({
          event,
          callback
        });
      };

    try {
      await import(
        `${
          pathToFileURL(
            resolve(
              projectRoot,
              "scripts",
              "dynamic-webs.js"
            )
          ).href
        }?module-import-test=${Date.now()}`
      );

      assert.deepEqual(
        onceCalls.map(
          (
            entry
          ) =>
            entry.event
        ),
        [
          "init",
          "ready"
        ]
      );

      assert.deepEqual(
        eventListeners.map(
          (
            entry
          ) =>
            entry.event
        ),
        [
          "beforeunload",
          "pagehide"
        ]
      );
    } finally {
      globalThis.Hooks =
        previousHooks;

      globalThis.addEventListener =
        previousAddEventListener;
    }
  }
);

async function collectJavaScriptFiles(
  directory
) {
  const entries =
    await readdir(
      directory,
      {
        withFileTypes:
          true
      }
    );

  const files =
    [];

  for (
    const entry of
    entries
  ) {
    const path =
      resolve(
        directory,
        entry.name
      );

    if (
      entry.isDirectory()
    ) {
      files.push(
        ...await collectJavaScriptFiles(
          path
        )
      );
    } else if (
      entry.isFile() &&
      path.endsWith(
        ".js"
      )
    ) {
      files.push(
        path
      );
    }
  }

  return files;
}
