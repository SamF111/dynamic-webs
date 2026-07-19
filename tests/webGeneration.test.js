import test from "node:test";
import assert from "node:assert/strict";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

import {
  getWebDensityPreset
} from "../scripts/simulation/webs/webDensityPresets.js";

test(
  "web generation is deterministic for one Scene and density",
  () => {
    const context = {
      sceneId:
        "scene-one",
      gridSize:
        100,
      sceneRect: {
        x:
          0,
        y:
          0,
        width:
          1000,
        height:
          1000,
        right:
          1000,
        bottom:
          1000
      },
      wallSegments: [
        {
          wallId:
            "a",
          a: {
            x:
              100,
            y:
              100
          },
          b: {
            x:
              900,
            y:
              100
          }
        },
        {
          wallId:
            "b",
          a: {
            x:
              100,
            y:
              100
          },
          b: {
            x:
              100,
            y:
              900
          }
        },
        {
          wallId:
            "c",
          a: {
            x:
              300,
            y:
              300
          },
          b: {
            x:
              300,
            y:
              800
          }
        },
        {
          wallId:
            "d",
          a: {
            x:
              400,
            y:
              300
          },
          b: {
            x:
              400,
            y:
              800
          }
        }
      ]
    };

    const options =
      getWebDensityPreset(
        "standard"
      ).configuration;

    const service =
      new WebGenerationService();

    const first =
      service.generate(
        context,
        options
      );

    const second =
      service.generate(
        context,
        options
      );

    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.seed,
      "dynamic-webs:web-generation:v2:scene-one"
    );

    assert.equal(
      first.counts.ground,
      6
    );

    assert.ok(
      first.counts.total >=
        6
    );
  }
);
