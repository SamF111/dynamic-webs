import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile
} from "node:fs/promises";

import {
  WEB_GROUND_ASSETS
} from "../scripts/data/webGroundAssetCatalog.js";

test(
  "checked-in ground manifest matches the runtime asset catalogue",
  async () => {
    const manifest = JSON.parse(
      await readFile(
        new URL(
          "../assets/web-ground/generated/manifest.json",
          import.meta.url
        ),
        "utf8"
      )
    );

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.generator.topology, "irregular-radial-sheet");
    assert.equal(manifest.assets.length, WEB_GROUND_ASSETS.length);

    assert.deepEqual(
      manifest.assets.map(asset => ({
        id: asset.id,
        modulePath: asset.modulePath,
        variant: asset.variant
      })),
      WEB_GROUND_ASSETS.map(asset => ({
        id: asset.id,
        modulePath: asset.modulePath,
        variant: asset.variant
      }))
    );
  }
);
