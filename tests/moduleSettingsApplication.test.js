import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";

test(
  "legacy standalone settings application remains removed",
  async () => {
    await assert.rejects(
      access(
        new URL(
          "../scripts/ui/moduleSettingsApplication.js",
          import.meta.url
        )
      ),
      error =>
        error?.code ===
          "ENOENT"
    );
  }
);
