import test from "node:test";
import assert from "node:assert/strict";

import { WebCarpetPatchTextureService } from "../scripts/rendering/webs/WebCarpetPatchTextureService.js";

class MockSprite {
  constructor(texture) {
    this.texture = texture;
    this.destroyed = false;
    this.anchor = {
      x: 0,
      y: 0,
      set: (x, y) => {
        this.anchor.x = x;
        this.anchor.y = y;
      }
    };
    this.scale = { x: 1, y: 1 };
    this.eventMode = "auto";
    this.interactive = true;
    this.interactiveChildren = true;
  }
}

const descriptor = Object.freeze({
  id: "patch-1",
  modulePath: "modules/dynamic-webs/assets/web-carpet/generated/loose-network-01.webp",
  x: 120,
  y: 240,
  width: 300,
  height: 220,
  rotation: 90,
  alpha: 0.8,
  flipX: true,
  flipY: false
});

test("patch texture service deduplicates WebP loads and reapplies deterministic transforms", async () => {
  let resolveLoad;
  let loadCount = 0;
  const loadedTexture = { id: "loaded-webp", source: {} };
  const service = new WebCarpetPatchTextureService({
    getTexture: () => null,
    loadTexture: () => {
      loadCount += 1;
      return new Promise((resolve) => {
        resolveLoad = resolve;
      });
    }
  });
  const pixi = {
    Sprite: MockSprite,
    Texture: {
      EMPTY: { id: "empty" },
      WHITE: { id: "white" }
    }
  };

  const first = service.createPatchSprite({
    pixi,
    descriptor,
    tint: 0x123456,
    alphaMultiplier: 0.5
  });
  const second = service.createPatchSprite({
    pixi,
    descriptor,
    tint: 0x123456,
    alphaMultiplier: 0.5
  });

  assert.equal(loadCount, 1);
  assert.equal(first.texture.id, "empty");
  assert.equal(second.texture.id, "empty");

  resolveLoad(loadedTexture);
  await new Promise((resolve) => setImmediate(resolve));

  for (const sprite of [first, second]) {
    assert.equal(sprite.texture, loadedTexture);
    assert.equal(sprite.x, 120);
    assert.equal(sprite.y, 240);
    assert.equal(sprite.width, 300);
    assert.equal(sprite.height, 220);
    assert.equal(sprite.rotation, Math.PI / 2);
    assert.equal(sprite.tint, 0x123456);
    assert.equal(sprite.alpha, 0.4);
    assert.equal(sprite.anchor.x, 0.5);
    assert.equal(sprite.anchor.y, 0.5);
    assert.equal(sprite.scale.x, -1);
  }

  const diagnostics = service.createDiagnosticSnapshot();
  assert.equal(diagnostics.entryCount, 1);
  assert.equal(diagnostics.loadedCount, 1);
  assert.equal(diagnostics.loadCount, 1);
  assert.equal(diagnostics.cacheHitCount, 1);

  assert.equal(service.clear(), true);
  assert.equal(service.createDiagnosticSnapshot().entryCount, 0);
  assert.equal(service.createDiagnosticSnapshot().cacheEpoch, 1);
});

test("patch texture service rejects non-WebP paths", () => {
  const service = new WebCarpetPatchTextureService({
    getTexture: () => null,
    loadTexture: async () => ({})
  });

  assert.throws(
    () => service.createPatchSprite({
      pixi: { Sprite: MockSprite, Texture: { EMPTY: {} } },
      descriptor: { ...descriptor, modulePath: "invalid.png" },
      tint: 0xffffff
    }),
    /must use \.webp paths/u
  );
});

test("clearing the cache invalidates older in-flight WebP requests", async () => {
  const deferred = [];
  const service = new WebCarpetPatchTextureService({
    getTexture: () => null,
    loadTexture: () => new Promise((resolve) => deferred.push(resolve))
  });
  const pixi = {
    Sprite: MockSprite,
    Texture: { EMPTY: { id: "empty" }, WHITE: { id: "white" } }
  };

  const oldSprite = service.createPatchSprite({
    pixi,
    descriptor,
    tint: 0xffffff
  });
  assert.equal(deferred.length, 1);

  service.clear();

  const newSprite = service.createPatchSprite({
    pixi,
    descriptor,
    tint: 0xffffff
  });
  assert.equal(deferred.length, 2);

  const oldTexture = { id: "old", source: {} };
  deferred[0](oldTexture);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(oldSprite.texture, oldTexture);
  assert.equal(service.createDiagnosticSnapshot().pendingCount, 1);
  assert.equal(service.createDiagnosticSnapshot().loadedCount, 0);

  const newTexture = { id: "new", source: {} };
  deferred[1](newTexture);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(newSprite.texture, newTexture);
  assert.equal(service.createDiagnosticSnapshot().pendingCount, 0);
  assert.equal(service.createDiagnosticSnapshot().loadedCount, 1);
  assert.equal(service.createDiagnosticSnapshot().entryCount, 1);
});


class MockContainer {
  constructor() {
    this.children = [];
    this.destroyed = false;
    this.scale = { x: 1, y: 1 };
    this.eventMode = "auto";
    this.interactive = true;
    this.interactiveChildren = true;
    this.filters = null;
  }

  addChild(child) {
    this.children.push(child);
    child.parent = this;
    return child;
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

test("patch texture service applies fallback tint and widens fibres with local layers", () => {
  const texture = { id: "cached-webp", source: {} };
  const service = new WebCarpetPatchTextureService({
    getTexture: () => texture,
    loadTexture: async () => texture
  });
  const pixi = {
    Container: MockContainer,
    Sprite: MockSprite,
    ColorMatrixFilter: MockColorMatrixFilter,
    Texture: {
      EMPTY: { id: "empty" },
      WHITE: { id: "white" }
    }
  };

  const display = service.createPatchSprite({
    pixi,
    descriptor,
    tint: 0x721919,
    alphaMultiplier: 0.75,
    thicknessMultiplier: 3
  });

  assert.equal(display.x, 120);
  assert.equal(display.y, 240);
  assert.equal(display.rotation, Math.PI / 2);
  assert.equal(display.scale.x, -1);
  assert.ok(Math.abs(display.alpha - 0.6) < 1e-9);
  assert.equal(display.webCarpetTint, 0x721919);
  assert.equal(display.webCarpetThicknessMultiplier, 3);
  assert.equal(display.webCarpetThicknessLayerCount, 9);
  assert.equal(display.children.length, 9);
  assert.equal(display.filters, null);

  for (const sprite of display.children) {
    assert.equal(sprite.texture, texture);
    assert.equal(sprite.width, 300);
    assert.equal(sprite.height, 220);
    assert.equal(sprite.tint, 0x721919);
    assert.equal(sprite.anchor.x, 0.5);
    assert.equal(sprite.anchor.y, 0.5);
  }

  assert.equal(display.children.some((sprite) => sprite.x !== 0 || sprite.y !== 0), true);
});
