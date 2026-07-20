import test from "node:test";
import assert from "node:assert/strict";

import {
  getSceneWebCategoryDensityConfiguration,
  getWebCategoryDensityDefinition,
  normaliseSceneWebCategoryDensity
} from "../scripts/config/sceneWebCategoryDensityConfiguration.js";

import {
  doesSceneUpdateAffectWebCategoryDensity
} from "../scripts/config/sceneWebFlagPaths.js";

import {
  createPublicApi
} from "../scripts/api.js";

import {
  createSceneConfigTemplateContext
} from "../scripts/ui/sceneConfigTemplateContext.js";

import {
  activateSceneConfigDensitySliders
} from "../scripts/ui/sceneConfigDensitySliders.js";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

const BASE_CONTEXT =
  Object.freeze({
    sceneId:
      "category-density-scene",
    gridSize:
      100,
    sceneRect:
      Object.freeze({
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
      }),
    wallSegments:
      Object.freeze([
        Object.freeze({
          wallId:
            "a",
          a:
            Object.freeze({
              x:
                100,
              y:
                100
            }),
          b:
            Object.freeze({
              x:
                900,
              y:
                100
            })
        }),
        Object.freeze({
          wallId:
            "b",
          a:
            Object.freeze({
              x:
                100,
              y:
                100
            }),
          b:
            Object.freeze({
              x:
                100,
              y:
                900
            })
        }),
        Object.freeze({
          wallId:
            "c",
          a:
            Object.freeze({
              x:
                300,
              y:
                300
            }),
          b:
            Object.freeze({
              x:
                300,
              y:
                800
            })
        }),
        Object.freeze({
          wallId:
            "d",
          a:
            Object.freeze({
              x:
                400,
              y:
                300
            }),
          b:
            Object.freeze({
              x:
                400,
              y:
                800
            })
        })
      ])
  });

test(
  "legacy webDensity resolves all categories until explicit overrides exist",
  () => {
    const configuration =
      getSceneWebCategoryDensityConfiguration({
        flags: {
          "dynamic-webs": {
            webDensity:
              "dense"
          }
        }
      });

    assert.deepEqual(
      configuration.categoryDensities,
      {
        "wall-corner":
          "dense",
        "wall-span":
          "dense",
        ground:
          "dense",
        "web-carpet":
          "dense"
      }
    );

    assert.deepEqual(
      configuration.categoryDensitySources,
      {
        "wall-corner":
          "legacy-fallback",
        "wall-span":
          "legacy-fallback",
        ground:
          "legacy-fallback",
        "web-carpet":
          "legacy-fallback"
      }
    );

    assert.equal(
      configuration.generationOptions.cornerWebs.maximumCount,
      48
    );

    assert.equal(
      configuration.generationOptions.spanWebs.maximumCount,
      10
    );

    assert.equal(
      configuration.generationOptions.groundWebs.count,
      10
    );

    assert.equal(
      configuration.implementedEnabled,
      true
    );

    assert.equal(
      Object.isFrozen(
        configuration.categoryDensities
      ),
      true
    );
  }
);

test(
  "category overrides independently resolve generation options and dormant carpet state",
  () => {
    const configuration =
      getSceneWebCategoryDensityConfiguration({
        flags: {
          "dynamic-webs": {
            webDensity:
              "standard",
            cornerWebDensity:
              "disabled",
            spanWebDensity:
              "sparse",
            groundWebDensity:
              "infested",
            carpetWebDensity:
              "dense"
          }
        }
      });

    assert.equal(
      configuration.categories["wall-corner"].source,
      "explicit"
    );

    assert.deepEqual(
      configuration.generationOptions.cornerWebs,
      {
        enabled:
          false
      }
    );

    assert.equal(
      configuration.generationOptions.spanWebs.maximumCount,
      3
    );

    assert.equal(
      configuration.generationOptions.spanWebs.minimumSpacingGridUnits,
      1.6
    );

    assert.equal(
      configuration.generationOptions.groundWebs.count,
      54
    );

    assert.equal(
      configuration.categories["web-carpet"].enabled,
      true
    );

    assert.equal(
      configuration.categories["web-carpet"].implemented,
      false
    );

    assert.equal(
      configuration.categories["web-carpet"].generationActive,
      false
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        configuration.generationOptions,
        "carpetWebs"
      ),
      false
    );
  }
);

test(
  "all implemented categories may be disabled while carpet remains reserved",
  () => {
    const configuration =
      getSceneWebCategoryDensityConfiguration({
        flags: {
          "dynamic-webs": {
            webDensity:
              "disabled",
            carpetWebDensity:
              "infested"
          }
        }
      });

    assert.equal(
      configuration.implementedEnabled,
      false
    );

    assert.equal(
      configuration.categoryDensities["web-carpet"],
      "infested"
    );
  }
);

test(
  "category identifiers and density values are strict",
  () => {
    assert.equal(
      getWebCategoryDensityDefinition(
        "wall-span"
      ).flagKey,
      "spanWebDensity"
    );

    assert.equal(
      normaliseSceneWebCategoryDensity(
        "infested",
        "ground"
      ),
      "infested"
    );

    assert.throws(
      () =>
        getWebCategoryDensityDefinition(
          "ceiling"
        ),
      /Unsupported web category/u
    );

    assert.throws(
      () =>
        normaliseSceneWebCategoryDensity(
          "impossible",
          "ground"
        ),
      /Unsupported Scene web density/u
    );
  }
);

test(
  "category-density differential detection is independent from legacy density and presentation",
  () => {
    assert.equal(
      doesSceneUpdateAffectWebCategoryDensity({
        flags: {
          "dynamic-webs": {
            cornerWebDensity:
              "dense"
          }
        }
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebCategoryDensity({
        "flags.dynamic-webs.groundWebDensity":
          "sparse"
      }),
      true
    );

    assert.equal(
      doesSceneUpdateAffectWebCategoryDensity({
        flags: {
          "dynamic-webs": {
            webDensity:
              "dense",
            webColour:
              "blood-red"
          }
        }
      }),
      false
    );
  }
);

test(
  "changing one resolved category preserves unrelated generated categories",
  () => {
    const baselineConfiguration =
      getSceneWebCategoryDensityConfiguration({
        flags: {
          "dynamic-webs": {
            webDensity:
              "standard"
          }
        }
      });

    const changedConfiguration =
      getSceneWebCategoryDensityConfiguration({
        flags: {
          "dynamic-webs": {
            webDensity:
              "standard",
            groundWebDensity:
              "infested"
          }
        }
      });

    const service =
      new WebGenerationService();

    const baseline =
      service.generate(
        BASE_CONTEXT,
        baselineConfiguration.generationOptions
      );

    const changed =
      service.generate(
        BASE_CONTEXT,
        changedConfiguration.generationOptions
      );

    assert.deepEqual(
      selectKinds(
        baseline.webs,
        [
          "wall-corner",
          "wall-span"
        ]
      ),
      selectKinds(
        changed.webs,
        [
          "wall-corner",
          "wall-span"
        ]
      )
    );

    assert.notEqual(
      baseline.counts.ground,
      changed.counts.ground
    );
  }
);

test(
  "public category-density API reads frozen values and persists single or batch updates",
  async () => {
    const previousGame =
      globalThis.game;

    const previousCanvas =
      globalThis.canvas;

    const setFlagCalls =
      [];

    const updateCalls =
      [];

    const flags = {
      webDensity:
        "standard",
      cornerWebDensity:
        "dense",
      spanWebDensity:
        undefined,
      groundWebDensity:
        "sparse",
      carpetWebDensity:
        "disabled",
      webColour:
        "natural-white",
      webThickness:
        1
    };

    const scene = {
      id:
        "scene",
      getFlag(
        _namespace,
        key
      ) {
        return flags[
          key
        ];
      },
      async setFlag(
        namespace,
        key,
        value
      ) {
        setFlagCalls.push({
          namespace,
          key,
          value
        });

        return this;
      },
      async update(
        values
      ) {
        updateCalls.push(
          values
        );

        return this;
      }
    };

    const runtime = {
      runtimeOwnerType:
        "DynamicWebsRuntime",
      ready:
        true,
      getWebRuntimeService:
        () => ({
          createDiagnosticSnapshot:
            () =>
              Object.freeze({
                active:
                  false
              })
        })
    };

    globalThis.canvas = {
      scene
    };

    globalThis.game = {
      user: {
        isGM:
          true
      },
      modules: {
        get:
          () => ({
            version:
              "0.2.2"
          })
      },
      scenes: {
        get:
          () =>
            scene
      }
    };

    try {
      const api =
        createPublicApi(
          runtime
        );

      const densities =
        api.scene.getCategoryDensities();

      assert.equal(
        Object.isFrozen(
          densities
        ),
        true
      );

      assert.deepEqual(
        densities,
        {
          "wall-corner":
            "dense",
          "wall-span":
            "standard",
          ground:
            "sparse",
          "web-carpet":
            "disabled"
        }
      );

      assert.equal(
        api.scene.getCategoryDensity(
          "wall-span"
        ),
        "standard"
      );

      await api.scene.setCategoryDensity(
        "wall-span",
        "infested"
      );

      assert.deepEqual(
        setFlagCalls,
        [
          {
            namespace:
              "dynamic-webs",
            key:
              "spanWebDensity",
            value:
              "infested"
          }
        ]
      );

      await api.scene.setCategoryDensities({
        "wall-corner":
          "sparse",
        ground:
          "dense",
        "web-carpet":
          "infested"
      });

      assert.deepEqual(
        updateCalls,
        [
          {
            "flags.dynamic-webs.cornerWebDensity":
              "sparse",
            "flags.dynamic-webs.groundWebDensity":
              "dense",
            "flags.dynamic-webs.carpetWebDensity":
              "infested"
          }
        ]
      );
    } finally {
      globalThis.game =
        previousGame;

      globalThis.canvas =
        previousCanvas;
    }
  }
);

test(
  "Scene Configuration exposes four labelled discrete sliders",
  async () => {
    const context =
      await createSceneConfigTemplateContext({
        application: {
          isEditable:
            true
        },
        scene: {
          flags: {
            "dynamic-webs": {
              webDensity:
                "standard",
              spanWebDensity:
                "dense",
              webColour:
                "natural-white",
              webThickness:
                1
            }
          }
        }
      });

    assert.equal(
      context.webCategoryDensityControls.length,
      4
    );

    const span =
      context.webCategoryDensityControls.find(
        (
          control
        ) =>
          control.categoryId ===
            "wall-span"
      );

    assert.equal(
      span.sliderValue,
      3
    );

    assert.equal(
      span.densityLabel,
      "Dense"
    );

    assert.equal(
      span.fieldName,
      "flags.dynamic-webs.spanWebDensity"
    );

    const carpet =
      context.webCategoryDensityControls.find(
        (
          control
        ) =>
          control.categoryId ===
            "web-carpet"
      );

    assert.equal(
      carpet.future,
      true
    );

    assert.match(
      carpet.description,
      /no generation effect/u
    );
  }
);

test(
  "slider activation maps numeric positions to persisted density identifiers",
  () => {
    const listeners =
      new Map();

    const slider = {
      value:
        "4",
      addEventListener(
        event,
        callback
      ) {
        listeners.set(
          event,
          callback
        );
      }
    };

    const hiddenInput = {
      value:
        "disabled",
      dispatchEvent() {}
    };

    const output = {
      value:
        "",
      textContent:
        "",
      dataset:
        {}
    };

    const control = {
      dataset:
        {},
      querySelector(
        selector
      ) {
        if (
          selector.includes(
            "density-range"
          )
        ) {
          return slider;
        }

        if (
          selector.includes(
            "density-value"
          )
        ) {
          return hiddenInput;
        }

        if (
          selector.includes(
            "density-output"
          )
        ) {
          return output;
        }

        return null;
      }
    };

    const htmlElement = {
      querySelectorAll:
        () => [
          control
        ]
    };

    assert.equal(
      activateSceneConfigDensitySliders(
        null,
        htmlElement
      ),
      1
    );

    assert.equal(
      hiddenInput.value,
      "infested"
    );

    assert.equal(
      output.textContent,
      "Infested"
    );

    slider.value =
      "1";

    listeners.get(
      "input"
    )();

    assert.equal(
      hiddenInput.value,
      "sparse"
    );

    assert.equal(
      control.dataset.densityId,
      "sparse"
    );
  }
);

function selectKinds(
  webs,
  kinds
) {
  const allowed =
    new Set(
      kinds
    );

  return webs.filter(
    (
      web
    ) =>
      allowed.has(
        web.kind
      )
  );
}
