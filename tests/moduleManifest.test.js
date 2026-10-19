// D:/FoundryVTT/Data/modules/dynamic-webs/tests/moduleManifest.test.js
// Purpose: verify release metadata stays aligned with the standalone module.
import test from "node:test";
import assert from "node:assert/strict";

import {
  readFile
} from "node:fs/promises";

test(
  "module manifest and package versions remain aligned for v1.0.0",
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
      "1.0.0"
    );

    assert.equal(
      packageManifest.version,
      moduleManifest.version
    );

    assert.equal(moduleManifest.manifest, "https://github.com/SamF111/dynamic-webs/releases/download/v1.0.0/module.json");
    assert.equal(moduleManifest.download, "https://github.com/SamF111/dynamic-webs/releases/download/v1.0.0/module.zip");
    assert.equal(moduleManifest.relationships.requires, undefined);

    assert.deepEqual(
      moduleManifest.compatibility,
      {
        minimum:
          "13",
        verified:
          "14"
      }
    );

    assert.deepEqual(
      moduleManifest.esmodules,
      [
        "scripts/dynamic-webs.js"
      ]
    );

    assert.equal(
      moduleManifest.relationships.recommends[0].id,
      "levels"
    );

    assert.equal(
      packageManifest.scripts.validate,
      "npm run check:syntax && npm run test:v07"
    );
  }
);

