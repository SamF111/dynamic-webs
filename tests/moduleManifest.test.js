import test from "node:test";
import assert from "node:assert/strict";

import {
  readFile
} from "node:fs/promises";

test(
  "module manifest and package versions remain aligned for v0.2.2",
  async () => {
    const moduleManifest =
      JSON.parse(
        await readFile(
          new URL(
            "../module.json",
            import.meta.url
          ),
          "utf8"
        )
      );

    const packageManifest =
      JSON.parse(
        await readFile(
          new URL(
            "../package.json",
            import.meta.url
          ),
          "utf8"
        )
      );

    assert.equal(
      moduleManifest.id,
      "dynamic-webs"
    );

    assert.equal(
      moduleManifest.version,
      "0.2.2"
    );

    assert.equal(
      packageManifest.version,
      moduleManifest.version
    );

    assert.deepEqual(
      moduleManifest.compatibility,
      {
        minimum:
          13,
        verified:
          14
      }
    );

    assert.deepEqual(
      moduleManifest.esmodules,
      [
        "scripts/dynamic-webs.js"
      ]
    );

    assert.equal(
      packageManifest.scripts.validate,
      "npm run check:syntax && npm run test:v02"
    );
  }
);
