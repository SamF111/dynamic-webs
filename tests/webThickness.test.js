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
  "population thickness is exposed in Scene Configuration",
  async () => {
    const scene = {
      flags: {
        "dynamic-webs": {
          webPopulations: [{
            id:
              "thick-webs",
            label:
              "Thick Webs",
            enabled:
              true,
            levelId:
              "base",
            categoryDensities: {
              "wall-corner":
                "dense",
              "wall-span":
                "disabled",
              ground:
                "disabled",
              "web-carpet":
                "disabled"
            },
            colourProfileId:
              "yellowed",
            thicknessMultiplier:
              2.5
          }]
        }
      }
    };

    const context =
      await createSceneConfigTemplateContext({
        application: {
          isEditable:
            true
        },
        scene
      });

    const population =
      context.populationCards[0];

    assert.equal(
      population.thicknessMultiplier,
      2.5
    );

    assert.equal(
      population.thicknessMinimum,
      MINIMUM_SCENE_WEB_THICKNESS
    );

    assert.equal(
      population.thicknessMaximum,
      MAXIMUM_SCENE_WEB_THICKNESS
    );

    assert.equal(
      population.thicknessStep,
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
