import test from "node:test";
import assert from "node:assert/strict";

import {
  WebCornerAssetTextureService
} from "../scripts/rendering/webs/WebCornerAssetTextureService.js";

import {
  createWebCornerAssetDilationFilter,
  resolveWebAssetThicknessUnderlayAlpha,
  resolveWebCornerAssetDilation
} from "../scripts/rendering/webs/webCornerAssetDilationFilter.js";

class MockDisplayObject {
  constructor() {
    this.children = [];
    this.destroyed = false;
    this.visible = true;
    this.alpha = 1;
    this.x = 0;
    this.y = 0;
    this.zIndex = 0;
    this.transform = {
      matrix: null,
      setFromMatrix: matrix => {
        this.transform.matrix = matrix;
      }
    };
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this;
    return child;
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

class MockMatrix {
  constructor(a, b, c, d, tx, ty) {
    Object.assign(this, { a, b, c, d, tx, ty });
  }
}

class MockBlurFilter {
  constructor(options) {
    this.options = options;
    this.padding = 0;
  }
}

function createPixi() {
  return {
    VERSION: "8.6.6",
    Container: MockContainer,
    Sprite: MockSprite,
    Matrix: MockMatrix,
    BlurFilter: MockBlurFilter,
    Texture: {
      EMPTY: { id: "empty" }
    }
  };
}

function createPresentation() {
  return {
    assetId: "corner-090-01",
    modulePath: "modules/dynamic-webs/assets/web-corner/generated/corner-090-01.webp",
    alpha: 0.9,
    source: {
      pivot: { x: 0, y: 0 },
      firstAnchor: { x: 1, y: 0 },
      secondAnchor: { x: 0, y: 1 }
    },
    target: {
      pivot: { x: 100, y: 100 },
      firstAnchor: { x: 180, y: 100 },
      secondAnchor: { x: 100, y: 160 }
    }
  };
}

test("discrete corner thickness resolves to bounded underlay recipes", () => {
  assert.deepEqual(resolveWebCornerAssetDilation(1), {
    enabled: false,
    radiusPx: 0,
    strength: 0
  });
  assert.deepEqual(resolveWebCornerAssetDilation(2), {
    enabled: true,
    radiusPx: 0.75,
    strength: 0.72
  });
  assert.deepEqual(resolveWebCornerAssetDilation(4), {
    enabled: true,
    radiusPx: 2,
    strength: 0.9
  });
  assert.equal(resolveWebCornerAssetDilation(99), resolveWebCornerAssetDilation(4));
});

test("PIXI v8 thickness underlay uses only the built-in BlurFilter", () => {
  const filter = createWebCornerAssetDilationFilter({
    pixi: createPixi(),
    radiusPx: 2,
    strength: 0.9
  });

  assert.ok(filter);
  assert.deepEqual(filter.options, {
    strength: 2.7,
    quality: 2,
    kernelSize: 5
  });
  assert.equal(filter.padding, 8);
  assert.equal(filter.dynamicWebsDilationRadiusPx, 2);
  assert.equal(filter.dynamicWebsDilationStrength, 0.9);
  assert.equal(filter.dynamicWebsBloomStrength, 2.7);
  assert.equal(filter.dynamicWebsDilationImplementation, "pixi-built-in-blur-v8");
  assert.equal(filter.dynamicWebsUsesCustomShader, false);
});

test("PIXI v7-compatible built-in BlurFilter constructor remains supported", () => {
  class MockV7BlurFilter {
    constructor(strength, quality) {
      this.strength = strength;
      this.quality = quality;
      this.padding = 0;
    }
  }

  const filter = createWebCornerAssetDilationFilter({
    pixi: {
      VERSION: "7.4.2",
      BlurFilter: MockV7BlurFilter
    },
    radiusPx: 1.35,
    strength: 0.82
  });

  assert.ok(filter);
  assert.equal(filter.dynamicWebsDilationImplementation, "pixi-built-in-blur-v7");
  assert.equal(filter.strength, 1.8225000000000002);
  assert.equal(filter.quality, 2);
  assert.equal(filter.dynamicWebsUsesCustomShader, false);
});

test("softened underlay alpha remains below the crisp fibre alpha", () => {
  assert.equal(resolveWebAssetThicknessUnderlayAlpha(0), 0);
  assert.equal(resolveWebAssetThicknessUnderlayAlpha(0.72), 0.396);
  assert.equal(resolveWebAssetThicknessUnderlayAlpha(0.9), 0.49500000000000005);
});

test("corner asset thickness four uses one softened underlay and one crisp sprite", () => {
  const texture = { id: "cached" };
  const service = new WebCornerAssetTextureService({
    getTexture: () => texture
  });

  const fallback = new MockDisplayObject();
  const display = service.createCornerDisplay({
    pixi: createPixi(),
    presentation: createPresentation(),
    fallbackDisplay: fallback,
    tint: 0xffffff,
    thicknessMultiplier: 4
  });

  const layers = display.children[0];
  assert.equal(layers.children.length, 2);

  const [underlay, crisp] = layers.children;
  assert.match(underlay.name, /\.dilation$/u);
  assert.match(crisp.name, /\.crisp$/u);
  assert.deepEqual([underlay.x, underlay.y, crisp.x, crisp.y], [0, 0, 0, 0]);
  assert.equal(underlay.filters.length, 1);
  assert.equal(underlay.alpha, 0.49500000000000005);
  assert.equal(underlay.filters[0].dynamicWebsUsesCustomShader, false);
  assert.equal(crisp.filters, undefined);
  assert.equal(fallback.visible, false);

  const diagnostics = service.createDiagnosticSnapshot();
  assert.equal(diagnostics.dilationRequestCount, 1);
  assert.equal(diagnostics.dilationFilterCount, 1);
  assert.equal(diagnostics.dilationFallbackCount, 0);
});

test("missing built-in BlurFilter support preserves one crisp asset", () => {
  const pixi = createPixi();
  delete pixi.BlurFilter;

  const service = new WebCornerAssetTextureService({
    getTexture: () => ({ id: "cached" })
  });

  const display = service.createCornerDisplay({
    pixi,
    presentation: createPresentation(),
    fallbackDisplay: new MockDisplayObject(),
    tint: 0xffffff,
    thicknessMultiplier: 4
  });

  const layers = display.children[0];
  assert.equal(layers.children.length, 1);
  assert.match(layers.children[0].name, /\.crisp$/u);
  assert.equal(service.createDiagnosticSnapshot().dilationFallbackCount, 1);
});
