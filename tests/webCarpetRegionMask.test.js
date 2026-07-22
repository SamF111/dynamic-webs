import test from "node:test";
import assert from "node:assert/strict";

import {
  WebCarpetRegionMaskService,
  applyWebCarpetRegionMask,
  createWebCarpetRegionMaskPlan,
  createWebCarpetRegionMaskSprite,
  destroyWebCarpetRegionMaskResource
} from "../scripts/rendering/webs/webCarpetRegionMask.js";

class MockLegacyGraphics {
  constructor() {
    this.commands = [];
    this.parent = null;
    this.destroyed = false;
    this.visible = false;
    this.renderable = true;
    this.eventMode = "auto";
    this.interactive = true;
    this.interactiveChildren = true;
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

  destroy() {
    this.destroyed = true;
  }
}

class MockModernGraphics {
  constructor() {
    this.commands = [];
    this.parent = null;
    this.destroyed = false;
    this.visible = false;
    this.renderable = true;
  }

  clear() {
    this.commands.push(["clear"]);
    return this;
  }

  poly(points) {
    this.commands.push(["poly", points]);
    return this;
  }

  fill(style) {
    this.commands.push(["fill", style]);
    return this;
  }

  cut() {
    this.commands.push(["cut"]);
    return this;
  }

  destroy() {
    this.destroyed = true;
  }
}

function createCarpet() {
  return {
    mask: {
      cacheKey: "mask-test",
      resolutionPx: 512,
      bounds: {
        x: 100,
        y: 200,
        width: 800,
        height: 400,
        right: 900,
        bottom: 600
      },
      confineShapes: [
        {
          type: "rectangle",
          x: 100,
          y: 200,
          width: 800,
          height: 400,
          rotation: 0
        }
      ],
      excludeShapes: [
        {
          type: "ellipse",
          centreX: 500,
          centreY: 400,
          radiusX: 80,
          radiusY: 60,
          rotation: 15
        }
      ]
    }
  };
}

test("Region mask planning preserves immutable source geometry", () => {
  const plan = createWebCarpetRegionMaskPlan(createCarpet());

  assert.equal(plan.widthPx, 512);
  assert.equal(plan.heightPx, 256);
  assert.equal(plan.resolutionPx, 512);
  assert.equal(plan.confineShapes.length, 1);
  assert.equal(plan.excludeShapes.length, 1);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.bounds));
  assert.ok(Object.isFrozen(plan.confineShapes));
});

test("legacy PIXI Graphics masks fill Confine geometry and cut Exclude holes", () => {
  const pixi = {
    Graphics: MockLegacyGraphics
  };

  const service = new WebCarpetRegionMaskService();
  const first = service.createMaskSprite({
    pixi,
    carpet: createCarpet()
  });
  const second = service.createMaskSprite({
    pixi,
    carpet: createCarpet()
  });

  const clipTarget = {};

  assert.equal(
    applyWebCarpetRegionMask({
      target: clipTarget,
      resource: first
    }),
    true
  );

  assert.equal(clipTarget.mask, first.sprite);
  assert.equal(clipTarget.webCarpetMaskCacheKey, "mask-test");
  assert.equal(clipTarget.webCarpetMaskBounds, first.plan.bounds);
  assert.equal(first.sprite.visible, true);
  assert.equal(first.sprite.renderable, false);
  assert.equal(first.sprite.eventMode, "none");
  assert.equal(first.sprite.interactive, false);
  assert.equal(first.sprite.interactiveChildren, false);
  assert.notEqual(first.sprite, second.sprite);
  assert.equal(first.plan, second.plan);

  assert.deepEqual(
    first.sprite.commands.slice(0, 3),
    [
      ["clear"],
      ["beginFill", 0xffffff, 1],
      [
        "drawPolygon",
        [
          100,
          200,
          900,
          200,
          900,
          600,
          100,
          600
        ]
      ]
    ]
  );

  assert.equal(
    first.sprite.commands.filter((entry) => entry[0] === "beginHole").length,
    1
  );

  const ellipsePolygon = first.sprite.commands.find((entry, index) =>
    entry[0] === "drawPolygon" && index > 2
  );

  assert.equal(ellipsePolygon[1].length, 128);
  assert.deepEqual(first.sprite.commands.at(-2), ["endHole"]);
  assert.deepEqual(first.sprite.commands.at(-1), ["endFill"]);

  const diagnostics = service.createDiagnosticSnapshot();
  assert.equal(diagnostics.entryCount, 1);
  assert.equal(diagnostics.planBuildCount, 1);
  assert.equal(diagnostics.vectorDrawCount, 2);
  assert.equal(diagnostics.cacheHitCount, 1);
  assert.equal(diagnostics.rasterCount, 0);

  destroyWebCarpetRegionMaskResource(first);
  assert.equal(first.sprite.destroyed, true);

  assert.equal(service.clear(), true);
  assert.equal(service.createDiagnosticSnapshot().entryCount, 0);
});

test("modern PIXI Graphics masks use fill and cut operations", () => {
  const resource = createWebCarpetRegionMaskSprite({
    pixi: {
      Graphics: MockModernGraphics
    },
    carpet: createCarpet()
  });

  assert.deepEqual(resource.sprite.commands[0], ["clear"]);
  assert.equal(resource.sprite.commands[1][0], "poly");
  assert.deepEqual(resource.sprite.commands[2], [
    "fill",
    {
      color: 0xffffff,
      alpha: 1
    }
  ]);
  assert.equal(resource.sprite.commands[3][0], "poly");
  assert.deepEqual(resource.sprite.commands[4], ["cut"]);
});

test("polygon-tree masks preserve compound Region holes and invert Exclude holes", () => {
  const carpet = {
    mask: {
      cacheKey: "polygon-tree-mask",
      resolutionPx: 512,
      bounds: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100
      },
      confineShapes: [
        {
          type: "polygon-tree",
          operations: [
            {
              operation: "fill",
              points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 }
              ]
            },
            {
              operation: "cut",
              points: [
                { x: 20, y: 20 },
                { x: 80, y: 20 },
                { x: 80, y: 80 },
                { x: 20, y: 80 }
              ]
            }
          ]
        }
      ],
      excludeShapes: [
        {
          type: "polygon-tree",
          operations: [
            {
              operation: "fill",
              points: [
                { x: 5, y: 5 },
                { x: 15, y: 5 },
                { x: 15, y: 15 },
                { x: 5, y: 15 }
              ]
            },
            {
              operation: "cut",
              points: [
                { x: 8, y: 8 },
                { x: 12, y: 8 },
                { x: 12, y: 12 },
                { x: 8, y: 12 }
              ]
            }
          ]
        }
      ]
    }
  };

  const resource = createWebCarpetRegionMaskSprite({
    pixi: {
      Graphics: MockLegacyGraphics
    },
    carpet
  });

  assert.deepEqual(
    resource.sprite.commands.map((entry) => entry[0]),
    [
      "clear",
      "beginFill",
      "drawPolygon",
      "beginHole",
      "drawPolygon",
      "endHole",
      "beginHole",
      "drawPolygon",
      "endHole",
      "drawPolygon",
      "endFill"
    ]
  );
});
