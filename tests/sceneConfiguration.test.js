import test from "node:test";
import assert from "node:assert/strict";

import {
  getSceneWebDensityConfiguration,
  normaliseSceneWebDensity
} from "../scripts/config/sceneWebDensityConfiguration.js";

import {
  doesSceneUpdateAffectWebDensity,
  doesSceneUpdateAffectWebGeometry
} from "../scripts/config/sceneWebFlagPaths.js";

test(
  "missing Scene density resolves to disabled",
  () => {
    const scene = {
      getFlag:
        () =>
          undefined
    };

    assert.deepEqual(
      getSceneWebDensityConfiguration(
        scene
      ),
      {
        densityId:
          "disabled",
        enabled:
          false,
        preset:
          null,
        generationOptions:
          null
      }
    );
  }
);

test(
  "supported density resolves its generation preset",
  () => {
    const scene = {
      getFlag:
        () =>
          "infested"
    };

    const configuration =
      getSceneWebDensityConfiguration(
        scene
      );

    assert.equal(
      configuration.enabled,
      true
    );

    assert.equal(
      configuration.generationOptions.cornerWebs.maximumCount,
      96
    );

    assert.equal(
      normaliseSceneWebDensity(
        "dense"
      ),
      "dense"
    );
  }
);

test(
  "Scene update paths separate density from geometry",
  () => {
    assert.equal(
      doesSceneUpdateAffectWebDensity({
        flags: {
          "dynamic-webs": {
            webDensity:
              "standard"
          }
        }
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebGeometry({
        grid: {
          size:
            140
        }
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebGeometry({
        name:
          "Renamed"
      }),
      false
    );
  }
);


test(
  "invalid and non-string density values fail clearly",
  () => {
    assert.throws(
      () =>
        normaliseSceneWebDensity(
          "unknown"
        ),
      /Unsupported Scene web density/u
    );

    assert.throws(
      () =>
        normaliseSceneWebDensity(
          42
        ),
      /must be a string/u
    );
  }
);

test(
  "Scene density can be read from plain flags when getFlag is unavailable",
  () => {
    const configuration =
      getSceneWebDensityConfiguration({
        flags: {
          "dynamic-webs": {
            webDensity:
              "sparse"
          }
        }
      });

    assert.equal(
      configuration.densityId,
      "sparse"
    );

    assert.equal(
      configuration.generationOptions.groundWebs.count,
      2
    );
  }
);

test(
  "density differential detection handles replacement and removal forms",
  () => {
    assert.equal(
      doesSceneUpdateAffectWebDensity({
        "flags.dynamic-webs.webDensity":
          "dense"
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebDensity({
        flags: {
          "dynamic-webs": {
            "-=webDensity":
              null
          }
        }
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebDensity({
        flags: {
          "-=dynamic-webs":
            null
        }
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebDensity({
        flags: {
          "dynamic-webs":
            null
        }
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebDensity({
        flags: {
          "dynamic-webs": {
            unrelated:
              true
          }
        }
      }),
      false
    );

    assert.equal(
      doesSceneUpdateAffectWebDensity({
        flags: {
          "ambient-critters": {
            webDensity:
              "dense"
          }
        }
      }),
      false
    );
  }
);

test(
  "all generation-relevant Scene geometry paths are classified",
  () => {
    for (
      const changed of
      [
        {
          width:
            1000
        },
        {
          height:
            1000
        },
        {
          padding:
            0.2
        },
        {
          "grid.size":
            140
        },
        {
          background: {
            offsetX:
              10
          }
        },
        {
          background: {
            offsetY:
              10
          }
        }
      ]
    ) {
      assert.equal(
        doesSceneUpdateAffectWebGeometry(
          changed
        ),
        true
      );
    }
  }
);
