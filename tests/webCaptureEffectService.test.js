import test from "node:test";
import assert from "node:assert/strict";

import {
  WebCaptureEffectService
} from "../scripts/interactions/WebCaptureEffectService.js";

import {
  WebCapturedAssetTextureService
} from "../scripts/rendering/webs/WebCapturedAssetTextureService.js";

class MockDisplayObject {
  constructor() {
    this.parent = null;
    this.children = [];
    this.destroyed = false;
    this.visible = true;
    this.alpha = 1;
    this.zIndex = 0;
    this.transform = {
      matrix: null,
      setFromMatrix: matrix => {
        this.transform.matrix = matrix;
      }
    };
  }

  addChild(
    child
  ) {
    child.parent =
      this;
    this.children.push(
      child
    );
    return child;
  }

  removeChild(
    child
  ) {
    this.children =
      this.children.filter(
        entry =>
          entry !==
          child
      );
    child.parent =
      null;
    return child;
  }

  sortChildren() {}

  destroy({
    children =
      false
  } = {}) {
    if (
      children
    ) {
      for (
        const child of
        this.children
      ) {
        child.destroy?.({
          children:
            true
        });
      }
    }
    this.children =
      [];
    this.destroyed =
      true;
  }
}

class MockContainer extends MockDisplayObject {}

class MockSprite extends MockDisplayObject {
  constructor(
    texture
  ) {
    super();
    this.texture =
      texture;
    this.width =
      0;
    this.height =
      0;
    this.anchor = {
      set() {}
    };
  }
}

class MockGraphics extends MockDisplayObject {
  moveTo() {}
  lineTo() {}
  stroke() {}
}

class MockMatrix {
  constructor(
    a,
    b,
    c,
    d,
    tx,
    ty
  ) {
    Object.assign(
      this,
      {
        a,
        b,
        c,
        d,
        tx,
        ty
      }
    );
  }
}

function createPixi() {
  return {
    Container:
      MockContainer,
    Sprite:
      MockSprite,
    Graphics:
      MockGraphics,
    Matrix:
      MockMatrix,
    Texture: {
      EMPTY: {
        id:
          "empty"
      }
    }
  };
}

test(
  "captured-web service upserts one entity overlay and clears it by entity",
  () => {
    const previousCanvas =
      globalThis.canvas;
    const previousPixi =
      globalThis.PIXI;
    const previousHooks =
      globalThis.Hooks;

    const primary =
      new MockContainer();

    globalThis.PIXI =
      createPixi();
    globalThis.canvas = {
      ready:
        true,
      primary
    };
    globalThis.Hooks = {
      callAll() {}
    };

    try {
      const textureService =
        new WebCapturedAssetTextureService({
          getTexture: () => ({
            id:
              "cached"
          })
        });

      const service =
        new WebCaptureEffectService({
          textureService
        });

      service.synchroniseContext({
        sceneId:
          "scene",
        visibleLevelIds:
          [
            "level-0"
          ]
      });

      const first =
        service.show({
          sourceModuleId:
            "ambient-critters",
          entityType:
            "critter",
          entityId:
            "critter-1",
          point: {
            x:
              100,
            y:
              120
          },
          radiusPx:
            30,
          levelId:
            "level-0",
          elevationBand: {
            bottom:
              0,
            top:
              9
          }
        });

      const second =
        service.show({
          sourceModuleId:
            "ambient-critters",
          entityType:
            "critter",
          entityId:
            "critter-1",
          point: {
            x:
              110,
            y:
              130
          },
          radiusPx:
            32,
          levelId:
            "level-0",
          elevationBand: {
            bottom:
              0,
            top:
              9
          }
        });

      assert.equal(
        first.captureId,
        second.captureId
      );

      assert.equal(
        service.createSnapshot().captureCount,
        1
      );

      assert.equal(
        service.createSnapshot().visibleCaptureCount,
        1
      );

      assert.equal(
        service.clearByEntity(
          "critter-1"
        ).length,
        1
      );

      assert.equal(
        service.createSnapshot().captureCount,
        0
      );
    } finally {
      globalThis.canvas =
        previousCanvas;
      globalThis.PIXI =
        previousPixi;
      globalThis.Hooks =
        previousHooks;
    }
  }
);

test(
  "anonymous captures receive one stable generated ID per show call and runtime context can be reset",
  () => {
    const previousCanvas =
      globalThis.canvas;
    const previousPixi =
      globalThis.PIXI;
    const previousHooks =
      globalThis.Hooks;

    const primary =
      new MockContainer();

    globalThis.PIXI =
      createPixi();
    globalThis.canvas = {
      ready:
        true,
      primary
    };
    globalThis.Hooks = {
      callAll() {}
    };

    try {
      const service =
        new WebCaptureEffectService({
          textureService:
            new WebCapturedAssetTextureService({
              getTexture: () => ({
                id:
                  "cached"
              })
            })
        });

      service.synchroniseContext({
        sceneId:
          "scene",
        visibleLevelIds:
          [
            "level-0"
          ]
      });

      const capture =
        service.show({
          point: {
            x:
              40,
            y:
              50
          },
          radiusPx:
            12,
          levelId:
            "level-0"
        });

      assert.match(
        capture.captureId,
        /^capture:anonymous:/u
      );

      assert.equal(
        service.getCapture(
          capture.captureId
        ),
        capture
      );

      service.clear({
        emitHook:
          false,
        resetContext:
          true
      });

      assert.equal(
        service.createSnapshot().sceneId,
        null
      );

      assert.deepEqual(
        service.createSnapshot().visibleLevelIds,
        []
      );
    } finally {
      globalThis.canvas =
        previousCanvas;
      globalThis.PIXI =
        previousPixi;
      globalThis.Hooks =
        previousHooks;
    }
  }
);


test(
  "captured WebP display uses texture-pixel dimensions and only hides the procedural fallback after a valid transform",
  () => {
    const previousCanvas =
      globalThis.canvas;
    const previousPixi =
      globalThis.PIXI;
    const previousHooks =
      globalThis.Hooks;

    const primary =
      new MockContainer();

    globalThis.PIXI =
      createPixi();
    globalThis.canvas = {
      ready:
        true,
      primary
    };
    globalThis.Hooks = {
      callAll() {}
    };

    try {
      const texture = {
        id:
          "captured-512",
        width:
          512,
        height:
          512
      };

      const service =
        new WebCaptureEffectService({
          textureService:
            new WebCapturedAssetTextureService({
              getTexture: () =>
                texture
            })
        });

      service.synchroniseContext({
        sceneId:
          "scene",
        visibleLevelIds:
          [
            "level-0"
          ]
      });

      const descriptor =
        service.show({
          captureId:
            "capture-transform",
          point: {
            x:
              320,
            y:
              240
          },
          radiusPx:
            40,
          levelId:
            "level-0"
        });

      const layerContainer =
        primary.children[0];

      const captureDisplay =
        layerContainer.children[0];

      const fallback =
        captureDisplay.children[0];

      const assetDisplay =
        captureDisplay.children[1];

      const sprite =
        assetDisplay.children[0];

      const matrix =
        sprite.transform.matrix;

      const sourcePivotPx = {
        x:
          descriptor.presentation.source.pivot.x *
          descriptor.presentation.source.widthPx,
        y:
          descriptor.presentation.source.pivot.y *
          descriptor.presentation.source.heightPx
      };

      assert.equal(
        sprite.texture,
        texture
      );

      assert.equal(
        sprite.visible,
        true
      );

      assert.equal(
        fallback.visible,
        false
      );

      assert.equal(
        assetDisplay.dynamicWebsCapturedAssetLoaded,
        true
      );

      assert.ok(
        Math.abs(
          matrix.a *
            sourcePivotPx.x +
          matrix.c *
            sourcePivotPx.y +
          matrix.tx -
          descriptor.point.x
        ) <
          0.000001
      );

      assert.ok(
        Math.abs(
          matrix.b *
            sourcePivotPx.x +
          matrix.d *
            sourcePivotPx.y +
          matrix.ty -
          descriptor.point.y
        ) <
          0.000001
      );
    } finally {
      globalThis.canvas =
        previousCanvas;
      globalThis.PIXI =
        previousPixi;
      globalThis.Hooks =
        previousHooks;
    }
  }
);

test(
  "aboveTokens is opt-in and upserting one capture moves it between distinct render containers",
  () => {
    const previousCanvas =
      globalThis.canvas;
    const previousPixi =
      globalThis.PIXI;
    const previousHooks =
      globalThis.Hooks;
    const previousFoundry =
      globalThis.foundry;

    const primary =
      new MockContainer();

    globalThis.PIXI =
      createPixi();
    globalThis.canvas = {
      ready:
        true,
      primary
    };
    globalThis.Hooks = {
      callAll() {}
    };
    globalThis.foundry = {
      canvas: {
        groups: {
          PrimaryCanvasGroup: {
            SORT_LAYERS: {
              SCENE:
                0,
              TILES:
                500,
              DRAWINGS:
                600,
              TOKENS:
                700,
              WEATHER:
                1000
            }
          }
        }
      }
    };

    try {
      const service =
        new WebCaptureEffectService({
          textureService:
            new WebCapturedAssetTextureService({
              getTexture: () => ({
                width:
                  512,
                height:
                  512
              })
            })
        });

      service.synchroniseContext({
        sceneId:
          "scene",
        visibleLevelIds:
          [
            "level-0"
          ]
      });

      const under =
        service.show({
          captureId:
            "capture-layer",
          point: {
            x:
              100,
            y:
              120
          },
          radiusPx:
            30,
          levelId:
            "level-0"
        });

      assert.equal(
        under.aboveTokens,
        false
      );

      assert.equal(
        primary.children.length,
        1
      );

      assert.match(
        primary.children[0].name,
        /captures\.under-tokens/u
      );

      assert.equal(
        primary.children[0].sortLayer,
        660
      );

      const above =
        service.show({
          captureId:
            "capture-layer",
          point: {
            x:
              100,
            y:
              120
          },
          radiusPx:
            30,
          levelId:
            "level-0",
          aboveTokens:
            true
        });

      assert.equal(
        above.aboveTokens,
        true
      );

      assert.equal(
        service.createSnapshot().captureCount,
        1
      );

      assert.equal(
        service.createSnapshot().visibleCaptureCount,
        1
      );

      assert.equal(
        primary.children.length,
        1
      );

      assert.match(
        primary.children[0].name,
        /captures\.above-tokens/u
      );

      assert.equal(
        primary.children[0].sortLayer,
        860
      );

      const preserved =
        service.show({
          captureId:
            "capture-layer",
          point: {
            x:
              110,
            y:
              130
          },
          radiusPx:
            32,
          levelId:
            "level-0"
        });

      assert.equal(
        preserved.aboveTokens,
        true
      );

      const returnedUnder =
        service.show({
          captureId:
            "capture-layer",
          point: {
            x:
              110,
            y:
              130
          },
          radiusPx:
            32,
          levelId:
            "level-0",
          aboveTokens:
            false
        });

      assert.equal(
        returnedUnder.aboveTokens,
        false
      );

      assert.match(
        primary.children[0].name,
        /captures\.under-tokens/u
      );

      assert.throws(
        () =>
          service.show({
            captureId:
              "capture-invalid-layer",
            point: {
              x:
                0,
              y:
                0
            },
            radiusPx:
              10,
            levelId:
              "level-0",
            aboveTokens:
              "true"
          }),
        /aboveTokens must be a boolean/u
      );
    } finally {
      globalThis.canvas =
        previousCanvas;
      globalThis.PIXI =
        previousPixi;
      globalThis.Hooks =
        previousHooks;
      globalThis.foundry =
        previousFoundry;
    }
  }
);
