import test from "node:test";
import assert from "node:assert/strict";

import {
  WebCornerAssetTextureService
} from "../scripts/rendering/webs/WebCornerAssetTextureService.js";

import {
  createWebCornerAssetDilationFilter,
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

class MockGlProgram {
  constructor(options) {
    this.options = options;
  }

  static from(options) {
    return new MockGlProgram(options);
  }
}

class MockFilter {
  constructor(options) {
    this.options = options;
    this.resources = options?.resources ?? null;
    this.padding = 0;
    this.antialias = null;
  }
}

function createPixi() {
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Matrix: MockMatrix,
    Filter: MockFilter,
    GlProgram: MockGlProgram,
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

test("discrete corner thickness resolves to bounded dilation recipes", () => {
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

test("PIXI v8 dilation filter expands only the alpha fringe", () => {
  const filter = createWebCornerAssetDilationFilter({
    pixi: createPixi(),
    radiusPx: 2,
    strength: 0.9
  });

  assert.ok(filter);
  assert.equal(filter.padding, 3);
  assert.equal(filter.dynamicWebsDilationRadiusPx, 2);
  assert.equal(filter.dynamicWebsDilationImplementation, "pixi-v8-gl-program");
  assert.equal(
    filter.resources.webCornerDilationUniforms.uDilationRadius.value,
    2
  );
  assert.match(
    filter.options.glProgram.options.fragment,
    /best\.a - centre\.a/u
  );
});

test("PIXI v7-compatible filter constructor remains supported", () => {
  class MockV7Filter {
    constructor(vertex, fragment, uniforms) {
      this.vertex = vertex;
      this.fragment = fragment;
      this.uniforms = uniforms;
      this.padding = 0;
    }
  }

  const filter = createWebCornerAssetDilationFilter({
    pixi: { Filter: MockV7Filter },
    radiusPx: 1.35,
    strength: 0.82
  });

  assert.ok(filter);
  assert.equal(filter.dynamicWebsDilationImplementation, "pixi-v7-filter-constructor");
  assert.equal(filter.uniforms.uDilationRadius, 1.35);
  assert.match(filter.fragment, /best\.a - centre\.a/u);
});

test("corner asset thickness four uses one filtered underlay and one crisp sprite", () => {
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
  assert.equal(crisp.filters, undefined);
  assert.equal(fallback.visible, false);

  const diagnostics = service.createDiagnosticSnapshot();
  assert.equal(diagnostics.dilationRequestCount, 1);
  assert.equal(diagnostics.dilationFilterCount, 1);
  assert.equal(diagnostics.dilationFallbackCount, 0);
});

test("missing filter support preserves a single crisp asset without offset copies", () => {
  const pixi = createPixi();
  delete pixi.Filter;
  delete pixi.GlProgram;

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
