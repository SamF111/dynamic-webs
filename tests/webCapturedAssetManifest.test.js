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
  "captured asset manifest describes eight unique deterministic WebP files",
  () => {
    assert.equal(
      manifest.schemaVersion,
      1
    );

    assert.equal(
      manifest.generator.topology,
      "local-entanglement-overlay"
    );

    assert.equal(
      manifest.assets.length,
      8
    );

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
      8
    );
  }
);
