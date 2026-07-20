import test from "node:test";
import assert from "node:assert/strict";

import {
  readFile
} from "node:fs/promises";

import {
  BASELINE_DIAGNOSTIC_SCHEMA_VERSION,
  PUBLIC_API_VERSION,
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../scripts/module/moduleConstants.js";

const README_URL =
  new URL(
    "../README.md",
    import.meta.url
  );

const ROADMAP_URL =
  new URL(
    "../roadmap.md",
    import.meta.url
  );

const MODULE_URL =
  new URL(
    "../module.json",
    import.meta.url
  );

const PACKAGE_URL =
  new URL(
    "../package.json",
    import.meta.url
  );

const PRESETS_URL =
  new URL(
    "../data/webs/presets.json",
    import.meta.url
  );

const COLOURS_URL =
  new URL(
    "../data/webs/colours.json",
    import.meta.url
  );

test(
  "README documents the v0.2 public, blueprint and colour contracts",
  async () => {
    const [
      readme,
      moduleManifest,
      packageManifest
    ] =
      await Promise.all([
        readFile(
          README_URL,
          "utf8"
        ),
        readJson(
          MODULE_URL
        ),
        readJson(
          PACKAGE_URL
        )
      ]);

    assert.ok(
      readme.includes(
        `**Current version:** \`${moduleManifest.version}\``
      )
    );

    assert.equal(
      packageManifest.version,
      moduleManifest.version
    );

    assert.ok(
      readme.includes(
        `**Public API version:** \`${PUBLIC_API_VERSION}\``
      )
    );

    assert.ok(
      readme.includes(
        `**Blueprint schema version:** \`${WEB_BLUEPRINT_SCHEMA_VERSION}\``
      )
    );

    assert.ok(
      readme.includes(
        `**Baseline diagnostic schema version:** \`${BASELINE_DIAGNOSTIC_SCHEMA_VERSION}\``
      )
    );

    for (
      const apiCall of
      [
        "dynamicWebs.api.getState();",
        "dynamicWebs.api.webs.getState();",
        "dynamicWebs.api.webs.generate();",
        "dynamicWebs.api.webs.clear();",
        "dynamicWebs.api.scene.getDensity();",
        "dynamicWebs.api.scene.setDensity(\"dense\")",
        "dynamicWebs.api.diagnostics.getBaselineReport();",
        "dynamicWebs.api.diagnostics.showBaselineReport();"
      ]
    ) {
      assert.ok(
        readme.includes(
          apiCall
        ),
        apiCall
      );
    }

    assert.ok(
      readme.includes(
        "<web-kind>:<encoded-scene-id>:<encoded-source-key>"
      )
    );

    assert.ok(
      readme.includes(
        "<web-id>:<encoded-local-strand-id>"
      )
    );

    assert.ok(
      readme.includes(
        "dynamic-webs:web-generation:v2:<scene-id>:wall-corner"
      )
    );

    assert.ok(
      readme.includes(
        'Hooks.callAll("dynamic-webs.ready", namespace);'
      )
    );

    assert.equal(
      readme.includes(
        'Hooks.callAll("dynamicWebs.ready"'
      ),
      false
    );

    assert.ok(
      readme.includes(
        "npm run validate"
      )
    );

    assert.ok(
      readme.includes(
        "npm run test:v02"
      )
    );

    assert.equal(
      packageManifest.scripts.validate,
      "npm run check:syntax && npm run test:v02"
    );

    assert.ok(
      readme.includes(
        "Complete this smoke test on both Foundry v13 and v14"
      )
    );
  }
);

test(
  "README density documentation matches the JSON-authored preset order",
  async () => {
    const [
      readme,
      presetData
    ] =
      await Promise.all([
        readFile(
          README_URL,
          "utf8"
        ),
        readJson(
          PRESETS_URL
        )
      ]);

    const densityIds =
      [
        "disabled",
        ...presetData.presets.map(
          (
            preset
          ) =>
            preset.id
        )
      ];

    for (
      const densityId of
      densityIds
    ) {
      assert.ok(
        readme.includes(
          `- \`${densityId}\``
        ),
        densityId
      );
    }
  }
);

test(
  "README colour documentation matches JSON-authored profiles",
  async () => {
    const [
      readme,
      colourData
    ] =
      await Promise.all([
        readFile(
          README_URL,
          "utf8"
        ),
        readJson(
          COLOURS_URL
        )
      ]);

    assert.ok(
      readme.includes(
        "flags.dynamic-webs.webColour"
      )
    );

    for (
      const profile of
      colourData.profiles
    ) {
      assert.ok(
        readme.includes(
          `- \`${profile.id}\``
        ),
        profile.id
      );
    }
  }
);

test(
  "roadmap closes coloured webs and preserves later barrier planning",
  async () => {
    const [
      roadmap,
      moduleManifest,
      presetData
    ] =
      await Promise.all([
        readFile(
          ROADMAP_URL,
          "utf8"
        ),
        readJson(
          MODULE_URL
        ),
        readJson(
          PRESETS_URL
        )
      ]);

    const dense =
      presetData.presets.find(
        (
          preset
        ) =>
          preset.id ===
            "dense"
      );

    assert.ok(
      dense
    );

    assert.ok(
      roadmap.includes(
        "## Milestone 0 — Baseline hardening — complete"
      )
    );

    assert.ok(
      roadmap.includes(
        "## Milestone 1 — Coloured webs — complete"
      )
    );

    assert.ok(
      roadmap.includes(
        "**Delivered:** v0.2.0"
      )
    );

    assert.ok(
      roadmap.includes(
        "Changing colour does not advance the generation ID."
      )
    );

    assert.ok(
      roadmap.includes(
        `**Delivered:** v${moduleManifest.version}`
      )
    );

    assert.ok(
      roadmap.includes(
        "### Exit criteria — met"
      )
    );

    assert.ok(
      roadmap.includes(
        "dynamicWebs.api.diagnostics.showBaselineReport();"
      )
    );

    assert.ok(
      roadmap.includes(
        `Up to ${dense.configuration.cornerWebs.maximumCount} corner webs`
      )
    );

    assert.ok(
      roadmap.includes(
        `Up to ${dense.configuration.spanWebs.maximumCount} span webs`
      )
    );

    assert.ok(
      roadmap.includes(
        `${dense.configuration.groundWebs.count} ground webs`
      )
    );

    assert.equal(
      roadmap.includes(
        "Up to 20 corner webs"
      ),
      false
    );

    assert.ok(
      roadmap.includes(
        "<stable-web-qualified-strand-id>"
      )
    );

    assert.ok(
      roadmap.includes(
        "## Milestone 7 — Optional web barriers"
      )
    );

    assert.ok(
      roadmap.includes(
        "## Milestone 8 — Tokens destroying webs"
      )
    );

    for (
      const barrierMode of
      [
        "`none`",
        "`vision`",
        "`movement`",
        "`vision-and-movement`"
      ]
    ) {
      assert.ok(
        roadmap.includes(
          barrierMode
        ),
        barrierMode
      );
    }

    assert.ok(
      roadmap.includes(
        "flags.dynamic-webs.generatedWebBarrier"
      )
    );

    assert.ok(
      roadmap.includes(
        "Dynamic Webs barriers must never become source walls for further web generation."
      )
    );

    assert.ok(
      roadmap.includes(
        "Generated barrier lifecycle events must not trigger recursive web rebuilds"
      )
    );
  }
);

async function readJson(
  url
) {
  return JSON.parse(
    await readFile(
      url,
      "utf8"
    )
  );
}
