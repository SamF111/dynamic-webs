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
