import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebGroundAssetPresentation
} from "../scripts/data/webGroundAssetCatalog.js";

import {
  WebGroundAssetTextureService
} from "../scripts/rendering/webs/WebGroundAssetTextureService.js";

import {
  WebRenderService
} from "../scripts/rendering/webs/WebRenderService.js";

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

  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter(entry => entry !== child);
    if (child.parent === this) child.parent = null;
    return child;
  }

  sortChildren() {}

  destroy({ children = false } = {}) {
    if (children) {
      for (const child of this.children) child.destroy?.({ children: true });
    }
    this.destroyed = true;
    this.children = [];
  }
}

class MockContainer extends MockDisplayObject {}

class MockSprite extends MockDisplayObject {
  constructor(texture) {
    super();
    this.texture = texture;
    this.width = 0;
    this.height = 0;
    this.anchor = {
      x: 0,
      y: 0,
      set: (x, y) => {
        this.anchor.x = x;
        this.anchor.y = y;
      }
    };
  }
}

class MockGraphics extends MockDisplayObject {
  constructor() {
    super();
    this.commands = [];
  }

  moveTo(x, y) {
    this.commands.push(["moveTo", x, y]);
  }

  lineTo(x, y) {
    this.commands.push(["lineTo", x, y]);
  }

  stroke(style) {
    this.commands.push(["stroke", style]);
  }
}

class MockBlurFilter {
  constructor(options) {
    this.options = options;
    this.padding = 0;
  }
}

class MockMatrix {
  constructor(a, b, c, d, tx, ty) {
    Object.assign(this, { a, b, c, d, tx, ty });
  }
}

function createPixi() {
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Graphics: MockGraphics,
    Matrix: MockMatrix,
    VERSION: "8.6.6",
    BlurFilter: MockBlurFilter,
    Texture: {
      EMPTY: {
        id: "empty"
      }
    }
  };
}

function createPresentation() {
  return createWebGroundAssetPresentation({
    selectionKey: "render:ground",
    pivot: {
      x: 100,
      y: 120
    },
    radiusX: 80,
    radiusY: 55,
    rotation: 0.4
  });
}

test(
  "ground texture loading hides the procedural fallback only after success",
  async () => {
    const texture = {
      id: "loaded",
      source: {
        id: "source"
      }
    };

    const service = new WebGroundAssetTextureService({
      getTexture: () => null,
      loadTexture: async () => texture
    });

    const fallback = new MockGraphics();
    const display = service.createGroundDisplay({
      pixi: createPixi(),
      presentation: createPresentation(),
      fallbackDisplay: fallback,
      tint: 0xffffff,
      thicknessMultiplier: 1
    });

    assert.equal(fallback.visible, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(fallback.visible, false);
    assert.equal(display.children[0].visible, true);
    assert.equal(display.children[0].children[0].texture, texture);
  }
);

test(
  "ground thickness uses one crisp sprite plus one built-in softened underlay",
  () => {
    const service = new WebGroundAssetTextureService({
      getTexture: () => ({ id: "cached" })
    });

    const display = service.createGroundDisplay({
      pixi: createPixi(),
      presentation: createPresentation(),
      fallbackDisplay: new MockGraphics(),
      tint: 0xffffff,
      thicknessMultiplier: 4
    });

    const layers = display.children[0];
    assert.equal(layers.children.length, 2);
    assert.match(layers.children[0].name, /\.dilation$/u);
    assert.match(layers.children[1].name, /\.crisp$/u);
    assert.equal(layers.children[0].filters.length, 1);
    assert.equal(
      layers.children[0].filters[0].dynamicWebsDilationRadiusPx,
      2
    );
    assert.equal(
      service.createDiagnosticSnapshot().dilationFilterCount,
      1
    );
  }
);

test(
  "WebRenderService routes ground blueprints through the asset display",
  () => {
    const previousPixi = globalThis.PIXI;
    const previousCanvas = globalThis.canvas;
    const primary = new MockContainer();

    globalThis.PIXI = createPixi();
    globalThis.canvas = { primary };

    try {
      const groundTextureService = new WebGroundAssetTextureService({
        getTexture: () => ({ id: "cached" })
      });

      const service = new WebRenderService({
        groundTextureService
      });

      const web = Object.freeze({
        id: "ground:scene:default:base:index-0",
        kind: "ground",
        colourProfileId: "natural-white",
        elevationBand: Object.freeze({
          bottom: 0,
          top: 9
        }),
        thicknessMultiplier: 1,
        groundAsset: createPresentation(),
        strands: Object.freeze([
          Object.freeze({
            id: "strand",
            points: Object.freeze([
              Object.freeze({ x: 20, y: 20 }),
              Object.freeze({ x: 180, y: 180 })
            ]),
            widthPx: 1,
            alpha: 0.8,
            colour: 0xffffff,
            underColour: 0x111111
          })
        ])
      });

      service.render(
        [web],
        {
          layerMode: "under-tokens",
          zIndex: 0,
          underWidthAdditionPx: 1,
          underAlphaMultiplier: 0.4,
          thicknessMultiplier: 1
        }
      );

      const snapshot = service.createDiagnosticSnapshot();
      assert.equal(snapshot.renderedGroundAssetCount, 1);
      assert.equal(
        primary.children[0].children[0].name,
        `dynamic-webs.web-ground.${web.id}`
      );
      assert.equal(
        primary.children[0].children[0].children[0].visible,
        false
      );
    } finally {
      globalThis.PIXI = previousPixi;
      globalThis.canvas = previousCanvas;
    }
  }
);
