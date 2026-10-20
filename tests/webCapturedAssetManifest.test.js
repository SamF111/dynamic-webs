import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const directory =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );

const generatedDirectory =
  path.resolve(
    directory,
    "../assets/web-captured/generated"
  );

const manifest =
  JSON.parse(
    fs.readFileSync(
      path.join(
        generatedDirectory,
        "manifest.json"
      ),
      "utf8"
    )
  );

test(
  "captured asset manifest describes unique WebP files with valid hashes",
  () => {
    assert.equal(
      manifest.schemaVersion,
      1
    );

    assert.equal(
      manifest.generator.topology,
      "local-entanglement-overlay"
    );

    assert.ok(manifest.assets.length > 0);
    assert.equal(new Set(manifest.assets.map(asset => asset.id)).size, manifest.assets.length);

    const hashes =
      new Set();

    for (
      const asset of
      manifest.assets
    ) {
      const file =
        path.join(
          generatedDirectory,
          asset.file
        );

      assert.equal(
        path.extname(
          file
        ),
        ".webp"
      );

      assert.equal(
        fs.existsSync(
          file
        ),
        true
      );

      const digest =
        crypto.createHash(
          "sha256"
        ).update(
          fs.readFileSync(
            file
          )
        ).digest(
          "hex"
        );

      assert.equal(
        digest,
        asset.sha256
      );

      hashes.add(
        digest
      );
    }

    assert.equal(
      hashes.size,
      manifest.assets.length
    );
  }
);
