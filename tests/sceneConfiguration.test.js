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
