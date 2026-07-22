import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebCornerAssetPresentation
} from "../scripts/data/webCornerAssetCatalog.js";

import {
  WebCornerAssetTextureService
} from "../scripts/rendering/webs/WebCornerAssetTextureService.js";

import {
  WebRenderService
} from "../scripts/rendering/webs/WebRenderService.js";

class MockDisplayObject {
  constructor() {
    this.parent =
      null;

    this.children =
      [];

    this.destroyed =
      false;

    this.visible =
      true;

    this.alpha =
      1;

    this.zIndex =
      0;

    this.transform = {
      matrix:
        null,
      setFromMatrix: matrix => {
        this.transform.matrix =
          matrix;
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

    if (
      child.parent ===
        this
    ) {
      child.parent =
        null;
    }

    return child;
  }

  sortChildren() {}

  destroy({
    children = false
  } = {}) {
    if (children) {
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

    this.destroyed =
      true;

    this.children =
      [];
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
      x:
        0,
      y:
        0,
      set: (
        x,
        y
      ) => {
        this.anchor.x =
          x;

        this.anchor.y =
          y;
      }
    };
  }
}

class MockGraphics extends MockDisplayObject {
  constructor() {
    super();

    this.commands =
      [];
  }

  moveTo(
    x,
    y
  ) {
    this.commands.push([
      "moveTo",
      x,
      y
    ]);
  }

  lineTo(
    x,
    y
  ) {
    this.commands.push([
      "lineTo",
      x,
      y
    ]);
  }

  stroke(
    style
  ) {
    this.commands.push([
      "stroke",
      style
    ]);
  }
}


class MockGlProgram {
  constructor(
    options
  ) {
    this.options =
      options;
  }

  static from(
    options
  ) {
    return new MockGlProgram(
      options
    );
  }
}

class MockFilter {
  constructor(
    options
  ) {
    this.options =
      options;

    this.resources =
      options?.resources ??
      null;

    this.padding =
      0;

    this.antialias =
      null;
  }
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
    Filter:
      MockFilter,
    GlProgram:
      MockGlProgram,
    Texture: {
      EMPTY: {
        id:
          "empty"
      }
    }
  };
}

function createPresentation() {
  return createWebCornerAssetPresentation({
    targetAngleDeg:
      90,
    selectionKey:
      "render:corner",
    corner: {
      x:
        100,
      y:
        100
    },
    firstAnchor: {
      x:
        180,
      y:
        100
    },
    secondAnchor: {
      x:
        100,
      y:
        160
    }
  });
}

test(
  "corner texture loading hides the procedural fallback only after success",
  async () => {
    const texture = {
      id:
        "loaded",
      source: {
        id:
          "source"
      }
    };

    const service =
      new WebCornerAssetTextureService({
        getTexture:
          () => null,
        loadTexture:
          async () => texture
      });

    const fallback =
      new MockGraphics();

    const display =
      service.createCornerDisplay({
        pixi:
          createPixi(),
        presentation:
          createPresentation(),
        fallbackDisplay:
          fallback,
        tint:
          0xffffff,
        thicknessMultiplier:
          1
      });

    assert.equal(
      fallback.visible,
      true
    );

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          0
        )
    );

    assert.equal(
      fallback.visible,
      false
    );

    assert.equal(
      display.children[0].visible,
      true
    );

    assert.equal(
      display.children[0].children[0].texture,
      texture
    );
  }
);

test(
  "failed corner texture loading preserves the procedural fallback",
  async () => {
    const service =
      new WebCornerAssetTextureService({
        getTexture:
          () => null,
        loadTexture:
          async () => {
            throw new Error(
              "missing asset"
            );
          }
      });

    const fallback =
      new MockGraphics();

    const display =
      service.createCornerDisplay({
        pixi:
          createPixi(),
        presentation:
          createPresentation(),
        fallbackDisplay:
          fallback,
        tint:
          0xffffff
      });

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          0
        )
    );

    assert.equal(
      fallback.visible,
      true
    );

    assert.equal(
      display.children[0].visible,
      false
    );

    assert.equal(
      service.createDiagnosticSnapshot().failureCount,
      1
    );
  }
);

test(
  "corner thickness uses one crisp sprite plus one alpha-dilated underlay",
  () => {
    const texture = {
      id:
        "cached"
    };

    const service =
      new WebCornerAssetTextureService({
        getTexture:
          () => texture
      });

    const display =
      service.createCornerDisplay({
        pixi:
          createPixi(),
        presentation:
          createPresentation(),
        fallbackDisplay:
          new MockGraphics(),
        tint:
          0xffffff,
        thicknessMultiplier:
          4
      });

    const layers =
      display.children[0];

    assert.equal(
      layers.children.length,
      2
    );

    const [
      underlay,
      crisp
    ] =
      layers.children;

    assert.match(
      underlay.name,
      /\.dilation$/u
    );

    assert.match(
      crisp.name,
      /\.crisp$/u
    );

    assert.equal(
      underlay.x,
      0
    );

    assert.equal(
      underlay.y,
      0
    );

    assert.equal(
      crisp.x,
      0
    );

    assert.equal(
      crisp.y,
      0
    );

    assert.equal(
      underlay.filters.length,
      1
    );

    assert.equal(
      underlay.filters[0].dynamicWebsDilationRadiusPx,
      2
    );

    assert.equal(
      underlay.filters[0].padding,
      3
    );

    assert.equal(
      crisp.filters,
      undefined
    );

    assert.deepEqual(
      display.dynamicWebsCornerAssetDilation,
      {
        requested:
          true,
        applied:
          true,
        radiusPx:
          2,
        strength:
          0.9,
        implementation:
          "pixi-v8-gl-program"
      }
    );

    const diagnostics =
      service.createDiagnosticSnapshot();

    assert.equal(
      diagnostics.dilationRequestCount,
      1
    );

    assert.equal(
      diagnostics.dilationFilterCount,
      1
    );

    assert.equal(
      diagnostics.dilationFallbackCount,
      0
    );
  }
);

test(
  "missing custom-filter support keeps one crisp corner sprite without ghost copies",
  () => {
    const pixi =
      createPixi();

    delete pixi.Filter;
    delete pixi.GlProgram;

    const service =
      new WebCornerAssetTextureService({
        getTexture:
          () => ({
            id:
              "cached"
          })
      });

    const display =
      service.createCornerDisplay({
        pixi,
        presentation:
          createPresentation(),
        fallbackDisplay:
          new MockGraphics(),
        tint:
          0xffffff,
        thicknessMultiplier:
          4
      });

    const layers =
      display.children[0];

    assert.equal(
      layers.children.length,
      1
    );

    assert.match(
      layers.children[0].name,
      /\.crisp$/u
    );

    assert.equal(
      service.createDiagnosticSnapshot().dilationFallbackCount,
      1
    );
  }
);

test(
  "WebRenderService routes corner blueprints through the asset display",
  () => {
    const previousPixi =
      globalThis.PIXI;

    const previousCanvas =
      globalThis.canvas;

    const pixi =
      createPixi();

    const primary =
      new MockContainer();

    globalThis.PIXI =
      pixi;

    globalThis.canvas = {
      primary
    };

    try {
      const cornerTextureService =
        new WebCornerAssetTextureService({
          getTexture:
            () => ({
              id:
                "cached"
            }),
          loadTexture:
            async () => ({
              id:
                "loaded"
            })
        });

      const service =
        new WebRenderService({
          cornerTextureService
        });

      const web =
        Object.freeze({
          id:
            "wall-corner:scene:base:one",
          kind:
            "wall-corner",
          colourProfileId:
            "natural-white",
          elevationBand:
            Object.freeze({
              bottom:
                10,
              top:
                19
            }),
          thicknessMultiplier:
            1,
          cornerAsset:
            createPresentation(),
          strands:
            Object.freeze([
              Object.freeze({
                id:
                  "strand",
                points:
                  Object.freeze([
                    Object.freeze({
                      x:
                        100,
                      y:
                        100
                    }),
                    Object.freeze({
                      x:
                        150,
                      y:
                        130
                    })
                  ]),
                widthPx:
                  1,
                alpha:
                  0.8,
                colour:
                  0xffffff,
                underColour:
                  0x111111
              })
            ])
        });

      service.render(
        [
          web
        ],
        {
          layerMode:
            "under-tokens",
          zIndex:
            0,
          underWidthAdditionPx:
            1,
          underAlphaMultiplier:
            0.4,
          thicknessMultiplier:
            1
        }
      );

      const snapshot =
        service.createDiagnosticSnapshot();

      assert.equal(
        snapshot.renderedCornerAssetCount,
        1
      );

      assert.equal(
        primary.children[0].children[0].name,
        `dynamic-webs.web-corner.${web.id}`
      );

      assert.equal(
        primary.children[0].children[0].children[0].visible,
        false
      );
    } finally {
      globalThis.PIXI =
        previousPixi;

      globalThis.canvas =
        previousCanvas;
    }
  }
);


test(
  "corner asset setup failure cannot detach the procedural fallback",
  () => {
    const previousPixi =
      globalThis.PIXI;

    const previousCanvas =
      globalThis.canvas;

    const pixi =
      createPixi();

    pixi.Container =
      class ContainerWithoutMatrixApi
        extends MockDisplayObject {
        constructor() {
          super();
          this.transform =
            null;
        }
      };

    const primary =
      new MockContainer();

    globalThis.PIXI =
      pixi;

    globalThis.canvas = {
      primary
    };

    try {
      const service =
        new WebRenderService();

      const web =
        Object.freeze({
          id:
            "wall-corner:scene:base:setup-failure",
          kind:
            "wall-corner",
          colourProfileId:
            "natural-white",
          elevationBand:
            Object.freeze({
              bottom:
                0,
              top:
                9
            }),
          thicknessMultiplier:
            1,
          cornerAsset:
            createPresentation(),
          strands:
            Object.freeze([
              Object.freeze({
                id:
                  "strand",
                points:
                  Object.freeze([
                    Object.freeze({
                      x:
                        100,
                      y:
                        100
                    }),
                    Object.freeze({
                      x:
                        150,
                      y:
                        130
                    })
                  ]),
                widthPx:
                  1,
                alpha:
                  0.8,
                colour:
                  0xffffff,
                underColour:
                  0x111111
              })
            ])
        });

      service.render(
        [
          web
        ],
        {
          layerMode:
            "under-tokens",
          zIndex:
            0,
          underWidthAdditionPx:
            1,
          underAlphaMultiplier:
            0.4,
          thicknessMultiplier:
            1
        }
      );

      const wrapper =
        primary.children[0].children[0];

      assert.equal(
        wrapper.name,
        `dynamic-webs.web-corner.${web.id}`
      );

      assert.equal(
        wrapper.children.length,
        1
      );

      assert.equal(
        wrapper.children[0].name,
        `dynamic-webs.web-corner-fallback.${web.id}`
      );

      assert.equal(
        wrapper.children[0].visible,
        true
      );

      assert.equal(
        wrapper.dynamicWebsCornerAssetSetupState,
        "setup-failed"
      );
    } finally {
      globalThis.PIXI =
        previousPixi;

      globalThis.canvas =
        previousCanvas;
    }
  }
);

