// D:/FoundryVTT/Data/modules/dynamic-webs/tests/moduleManifest.test.js
// Purpose: verify release metadata stays aligned with the standalone module.
import test from "node:test";
import assert from "node:assert/strict";

import {
  readFile
} from "node:fs/promises";

test(
  "module release metadata remains internally consistent",
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

    assert.match(moduleManifest.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u);

    assert.equal(
      packageManifest.version,
      moduleManifest.version
    );

    const releaseRoot = `https://github.com/SamF111/dynamic-webs/releases/download/v${moduleManifest.version}`;
    assert.equal(moduleManifest.manifest, `${releaseRoot}/module.json`);
    assert.equal(moduleManifest.download, `${releaseRoot}/module.zip`);
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

    assert.ok(moduleManifest.relationships.recommends.some(({id}) => id === "levels"));
  }
);

