import test from "node:test";
import assert from "node:assert/strict";

import {
  MAXIMUM_SCENE_WEB_THICKNESS,
  MINIMUM_SCENE_WEB_THICKNESS,
  SCENE_WEB_THICKNESS_STEP,
  getSceneWebThicknessConfiguration,
  normaliseSceneWebThickness
} from "../scripts/config/sceneWebThicknessConfiguration.js";

import {
  doesSceneUpdateAffectWebThickness
} from "../scripts/config/sceneWebFlagPaths.js";

import {
  createSceneConfigTemplateContext
} from "../scripts/ui/sceneConfigTemplateContext.js";

test(
  "Scene thickness resolves defaults, numeric strings and supported bounds",
  () => {
    assert.equal(
      normaliseSceneWebThickness(
        undefined
      ),
      1
    );

    assert.equal(
      normaliseSceneWebThickness(
        "2.25"
      ),
      2.25
    );

    assert.equal(
      normaliseSceneWebThickness(
        MINIMUM_SCENE_WEB_THICKNESS
      ),
      0.5
    );

    assert.equal(
      normaliseSceneWebThickness(
        MAXIMUM_SCENE_WEB_THICKNESS
      ),
      4
    );

    assert.throws(
      () =>
        normaliseSceneWebThickness(
          0.25
        ),
      /between 0.5 and 4/u
    );

    assert.throws(
      () =>
        normaliseSceneWebThickness(
          "wide"
        ),
      /finite number/u
    );
  }
);

test(
  "Scene thickness is read from plain flags and exposed in Scene Configuration",
  async () => {
    const scene = {
      flags: {
        "dynamic-webs": {
          webDensity:
            "dense",
          webColour:
            "yellowed",
          webThickness:
            2.5
        }
      }
    };

    const configuration =
      getSceneWebThicknessConfiguration(
        scene
      );

    assert.deepEqual(
      configuration,
      {
        thicknessMultiplier:
          2.5
      }
    );

    assert.equal(
      Object.isFrozen(
        configuration
      ),
      true
    );

    const context =
      await createSceneConfigTemplateContext({
        application: {
          isEditable:
            true
        },
        scene
      });

    assert.equal(
      context.configuration.webThickness,
      2.5
    );

    assert.equal(
      context.fieldNames.webThickness,
      "flags.dynamic-webs.webThickness"
    );

    assert.equal(
      context.webThicknessControl.minimum,
      MINIMUM_SCENE_WEB_THICKNESS
    );

    assert.equal(
      context.webThicknessControl.maximum,
      MAXIMUM_SCENE_WEB_THICKNESS
    );

    assert.equal(
      context.webThicknessControl.step,
      SCENE_WEB_THICKNESS_STEP
    );
  }
);

test(
  "Scene thickness differential detection is independent from colour and density",
  () => {
    assert.equal(
      doesSceneUpdateAffectWebThickness({
        flags: {
          "dynamic-webs": {
            webThickness:
              1.75
          }
        }
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebThickness({
        "flags.dynamic-webs.webThickness":
          3
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebThickness({
        flags: {
          "dynamic-webs": {
            webColour:
              "black"
          }
        }
      }),
      false
    );
  }
);
