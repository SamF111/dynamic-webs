import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebSpanAssetPresentation
} from "../scripts/data/webSpanAssetCatalog.js";

import {
  WebSpanAssetTextureService
} from "../scripts/rendering/webs/WebSpanAssetTextureService.js";

class MockDisplayObject {
  constructor() {
    this.parent = null;
    this.children = [];
    this.destroyed = false;
    this.visible = true;
    this.alpha = 1;
    this.zIndex = 0;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  destroy() {
    this.destroyed = true;
  }
}

class MockContainer extends MockDisplayObject {}

class MockMeshSimple extends MockDisplayObject {
  constructor(options) {
    super();
    this.options = options;
    this.texture = options.texture;
    this.vertices = options.vertices;
    this.uvs = options.uvs;
    this.indices = options.indices;
  }
}

class MockBlurFilter {
  constructor(options) {
    this.options = options;
    this.padding = 0;
  }
}

function createPixi({ mesh = true } = {}) {
  return {
    Container: MockContainer,
    ...(mesh ? { MeshSimple: MockMeshSimple } : {}),
    VERSION: "8.6.6",
    BlurFilter: MockBlurFilter,
    Texture: { EMPTY: { id: "empty" } }
  };
}

function createPresentation() {
  return createWebSpanAssetPresentation({
    selectionKey: "render-span",
    firstWallStart: { x: 100, y: 100 },
    firstWallEnd: { x: 260, y: 100 },
    secondWallStart: { x: 120, y: 180 },
    secondWallEnd: { x: 245, y: 230 },
    targetLengthPx: 160,
    targetSpanPx: 100
  });
}

test("span texture success replaces procedural fallback with one crisp mesh", async () => {
  const texture = { id: "loaded", source: { id: "source" } };
  const service = new WebSpanAssetTextureService({
    getTexture: () => null,
    loadTexture: async () => texture
  });
  const fallback = new MockDisplayObject();
  const display = service.createSpanDisplay({
    pixi: createPixi(),
    presentation: createPresentation(),
    fallbackDisplay: fallback,
    tint: 0xffffff,
    thicknessMultiplier: 1
  });

  assert.equal(fallback.visible, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fallback.visible, false);
  assert.equal(display.dynamicWebsSpanAssetLoaded, true);

  const mesh = display.children[0].children[0];
  assert.equal(mesh.texture, texture);
  assert.deepEqual(Array.from(mesh.vertices), [100, 100, 260, 100, 245, 230, 120, 180]);
  assert.deepEqual(Array.from(mesh.indices), [0, 1, 2, 0, 2, 3]);
  assert.equal(mesh.dynamicWebsSpanAssetWarp.mode, "piecewise-affine-quad");
});

test("span thickness four uses one dilation mesh and one crisp mesh", () => {
  const texture = { id: "cached" };
  const service = new WebSpanAssetTextureService({
    getTexture: () => texture,
    loadTexture: async () => texture
  });
  const display = service.createSpanDisplay({
    pixi: createPixi(),
    presentation: createPresentation(),
    fallbackDisplay: new MockDisplayObject(),
    tint: 0xffffff,
    thicknessMultiplier: 4
  });

  const layers = display.children[0];
  assert.equal(layers.children.length, 2);
  assert.match(layers.children[0].name, /\.dilation$/u);
  assert.match(layers.children[1].name, /\.crisp$/u);
  assert.equal(layers.children[0].filters.length, 1);
  assert.equal(layers.children[1].filters, undefined);
  assert.equal(service.createDiagnosticSnapshot().dilationFilterCount, 1);
});

test("missing mesh support leaves the procedural span fallback visible", () => {
  const service = new WebSpanAssetTextureService({
    getTexture: () => ({ id: "cached" })
  });
  const fallback = new MockDisplayObject();
  const display = service.createSpanDisplay({
    pixi: createPixi({ mesh: false }),
    presentation: createPresentation(),
    fallbackDisplay: fallback,
    tint: 0xffffff,
    thicknessMultiplier: 4
  });

  assert.equal(display, null);
  assert.equal(fallback.visible, true);
  assert.match(
    service.createDiagnosticSnapshot().lastDilationFailure.reason,
    /span-mesh support is unavailable/u
  );
});
