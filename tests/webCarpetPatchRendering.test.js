import test from "node:test";
import assert from "node:assert/strict";

import { WebRenderService } from "../scripts/rendering/webs/WebRenderService.js";
import { WebCarpetPatchTextureService } from "../scripts/rendering/webs/WebCarpetPatchTextureService.js";
import { WebCarpetRegionMaskService } from "../scripts/rendering/webs/webCarpetRegionMask.js";

class MockDisplayObject {
  constructor() {
    this.parent = null;
    this.children = [];
    this.destroyed = false;
    this.name = null;
    this.label = null;
    this.zIndex = 0;
    this.elevation = 0;
    this.eventMode = "auto";
    this.interactive = true;
    this.interactiveChildren = true;
    this.cursor = "pointer";
    this.scale = { x: 1, y: 1 };
    this.filters = null;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parent = null;
    return child;
  }

  sortChildren() {
    this.children.sort((a, b) => Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0));
  }

  destroy({ children = false } = {}) {
    if (children) {
      for (const child of [...this.children]) child.destroy?.({ children: true });
    }
    this.children = [];
    this.destroyed = true;
  }
}

class MockContainer extends MockDisplayObject {}

class MockGraphics extends MockDisplayObject {
  constructor() {
    super();
    this.commands = [];
    this.visible = true;
    this.renderable = true;
  }

  clear() {
    this.commands.push(["clear"]);
    return this;
  }

  beginFill(colour, alpha) {
    this.commands.push(["beginFill", colour, alpha]);
    return this;
  }

  drawPolygon(points) {
    this.commands.push(["drawPolygon", points]);
    return this;
  }

  beginHole() {
    this.commands.push(["beginHole"]);
    return this;
  }

  endHole() {
    this.commands.push(["endHole"]);
    return this;
  }

  endFill() {
    this.commands.push(["endFill"]);
    return this;
  }

  moveTo() {}
  lineTo() {}
  stroke() {}
}

class MockSprite extends MockDisplayObject {
  constructor(texture) {
    super();
    this.texture = texture;
    this.anchor = {
      x: 0,
      y: 0,
      set: (x, y) => {
        this.anchor.x = x;
        this.anchor.y = y;
      }
    };
    this.scale = { x: 1, y: 1 };
  }
}

class MockColorMatrixFilter {
  constructor() {
    this.appliedTint = null;
    this.multiply = null;
  }

  tint(colour, multiply) {
    this.appliedTint = colour;
    this.multiply = multiply;
  }
}


function createCarpetWeb({
  colourProfileId = "natural-white",
  thicknessMultiplier = 1
} = {}) {
  return Object.freeze({
    id: "web-carpet:scene:population:base:region-a",
    kind: "web-carpet",
    populationId: "population",
    thicknessMultiplier,
    colourProfileId,
    elevationBand: Object.freeze({ bottom: 0, top: 9 }),
    strands: Object.freeze([]),
    carpet: Object.freeze({
      patches: Object.freeze([
        Object.freeze({
          id: "patch-0",
          modulePath: "modules/dynamic-webs/assets/web-carpet/generated/loose-network-01.webp",
          x: 200,
          y: 200,
          width: 260,
          height: 240,
          rotation: 30,
          alpha: 0.7,
          flipX: false,
          flipY: true
        })
      ]),
      mask: Object.freeze({
        cacheKey: "render-mask-a",
        resolutionPx: 256,
        bounds: Object.freeze({
          x: 50,
          y: 50,
          width: 400,
          height: 300,
          right: 450,
          bottom: 350
        }),
        confineShapes: Object.freeze([
          Object.freeze({ type: "rectangle", x: 50, y: 50, width: 400, height: 300, rotation: 0 })
        ]),
        excludeShapes: Object.freeze([])
      })
    })
  });
}

test("renderer composes bundled WebP patches through one cached Region mask", () => {
  const previous = {
    PIXI: globalThis.PIXI,
    canvas: globalThis.canvas,
    foundry: globalThis.foundry
  };

  const patchTexture = { id: "patch-texture" };
  const parent = new MockContainer();
  parent.name = "PrimaryCanvasGroup";

  globalThis.PIXI = {
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    ColorMatrixFilter: MockColorMatrixFilter,
    Texture: {
      EMPTY: { id: "empty" },
      WHITE: { id: "white" },
    }
  };
  globalThis.canvas = {
    ready: true,
    scene: { id: "scene" },
    primary: parent
  };
  globalThis.foundry = {
    canvas: {
      groups: {
        PrimaryCanvasGroup: {
          SORT_LAYERS: {
            SCENE: 0,
            TILES: 500,
            DRAWINGS: 600,
            TOKENS: 700,
            WEATHER: 1000
          }
        }
      }
    }
  };

  const textureService = new WebCarpetPatchTextureService({
    getTexture: () => patchTexture,
    loadTexture: async () => patchTexture
  });
  const maskService = new WebCarpetRegionMaskService();
  const service = new WebRenderService({
    carpetTextureService: textureService,
    carpetMaskService: maskService
  });

  const configuration = {
    layerMode: "under-tokens",
    zIndex: 0,
    underAlphaMultiplier: 0.42,
    underWidthAdditionPx: 1.1,
    thicknessMultiplier: 1
  };

  try {
    service.render([createCarpetWeb()], configuration);
    let diagnostics = service.createDiagnosticSnapshot();
    assert.equal(diagnostics.renderedWebCount, 1);
    assert.equal(diagnostics.renderedCarpetCount, 1);
    assert.equal(diagnostics.renderedCarpetPatchCount, 1);
    assert.equal(diagnostics.carpetMasks.planBuildCount, 1);
    assert.equal(diagnostics.carpetMasks.vectorDrawCount, 1);
    assert.equal(diagnostics.carpetMasks.rasterCount, 0);

    const levelContainer = parent.children[0];
    const maskGraphics = levelContainer.children[0];
    const carpetDisplay = levelContainer.children[1];
    const patchContainer = carpetDisplay.children[0];
    const patchDisplay = patchContainer.children[0];
    const patchLayer = patchDisplay.children[0];

    assert.equal(carpetDisplay.mask, maskGraphics);
    assert.equal(maskGraphics.parent, levelContainer);
    assert.equal(carpetDisplay.parent, levelContainer);
    assert.ok(maskGraphics instanceof MockGraphics);
    assert.equal(maskGraphics.renderable, false);
    assert.equal(maskGraphics.visible, true);
    assert.deepEqual(maskGraphics.commands.slice(0, 3), [
      ["clear"],
      ["beginFill", 0xffffff, 1],
      [
        "drawPolygon",
        [
          50,
          50,
          450,
          50,
          450,
          350,
          50,
          350
        ]
      ]
    ]);
    assert.equal(patchContainer.mask, undefined);
    assert.equal(carpetDisplay.webCarpetMaskCacheKey, "render-mask-a");
    assert.deepEqual(
      carpetDisplay.webCarpetMaskBounds,
      {
        x: 50,
        y: 50,
        width: 400,
        height: 300,
        right: 450,
        bottom: 350
      }
    );
    assert.equal(patchLayer.texture, patchTexture);
    assert.equal(carpetDisplay.zIndex, -25);
    assert.equal(patchContainer.webCarpetTint, 0xcdd3da);
    assert.equal(patchDisplay.webCarpetTint, 0xffffff);
    assert.equal(patchDisplay.webCarpetThicknessMultiplier, 1);
    assert.equal(patchDisplay.webCarpetThicknessLayerCount, 1);
    assert.equal(patchContainer.filters[0].appliedTint, 0xcdd3da);
    assert.equal(patchLayer.tint, 0xffffff);

    service.render([createCarpetWeb({
      colourProfileId: "blood-red",
      thicknessMultiplier: 3
    })], configuration);
    diagnostics = service.createDiagnosticSnapshot();
    assert.equal(diagnostics.carpetMasks.planBuildCount, 1);
    assert.equal(diagnostics.carpetMasks.vectorDrawCount, 2);
    assert.equal(diagnostics.carpetMasks.rasterCount, 0);
    assert.equal(diagnostics.carpetMasks.cacheHitCount, 1);

    const recolouredLevelContainer = parent.children[0];
    const recolouredMaskGraphics = recolouredLevelContainer.children[0];
    const recolouredCarpetDisplay = recolouredLevelContainer.children[1];
    const recolouredPatchContainer = recolouredCarpetDisplay.children[0];
    const recolouredPatchDisplay = recolouredPatchContainer.children[0];
    assert.equal(recolouredCarpetDisplay.mask, recolouredMaskGraphics);
    assert.notEqual(recolouredMaskGraphics, maskGraphics);
    assert.equal(recolouredPatchContainer.webCarpetTint, 0x721919);
    assert.equal(recolouredPatchContainer.filters[0].appliedTint, 0x721919);
    assert.equal(recolouredPatchDisplay.webCarpetTint, 0xffffff);
    assert.equal(recolouredPatchDisplay.webCarpetThicknessMultiplier, 3);
    assert.equal(recolouredPatchDisplay.webCarpetThicknessLayerCount, 9);
    assert.equal(recolouredPatchDisplay.children.length, 9);
    assert.equal(diagnostics.thicknessMultipliersByPopulation.population, 3);

    assert.equal(service.clearCarpetTextureCache(), true);
    diagnostics = service.createDiagnosticSnapshot();
    assert.equal(diagnostics.carpetMasks.entryCount, 0);
    assert.equal(diagnostics.carpetTextures.entryCount, 0);
  } finally {
    service.clear();
    globalThis.PIXI = previous.PIXI;
    globalThis.canvas = previous.canvas;
    globalThis.foundry = previous.foundry;
  }
});

