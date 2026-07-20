import test from "node:test";
import assert from "node:assert/strict";

import {
  getSceneRect
} from "../scripts/foundry/canvasCompatibility.js";

import {
  collectStructuralWallSegments,
  createActiveWebSceneContext
} from "../scripts/foundry/webSceneCompatibility.js";

test(
  "Scene rectangle resolves modern and legacy Foundry dimension fields",
  () => {
    const previousCanvas =
      globalThis.canvas;

    try {
      globalThis.canvas = {
        dimensions: {
          sceneRect: {
            x:
              10,
            y:
              20,
            width:
              300,
            height:
              400
          }
        }
      };

      assert.deepEqual(
        getSceneRect(),
        {
          x:
            10,
          y:
            20,
          width:
            300,
          height:
            400,
          right:
            310,
          bottom:
            420
        }
      );

      globalThis.canvas = {
        dimensions: {
          sceneX:
            5,
          sceneY:
            6,
          sceneWidth:
            700,
          sceneHeight:
            800
        }
      };

      assert.deepEqual(
        getSceneRect(),
        {
          x:
            5,
          y:
            6,
          width:
            700,
          height:
            800,
          right:
            705,
          bottom:
            806
        }
      );
    } finally {
      globalThis.canvas =
        previousCanvas;
    }
  }
);

test(
  "structural wall collection supports placeables and excludes doors",
  () => {
    const previousCanvas =
      globalThis.canvas;

    try {
      globalThis.canvas = {
        walls: {
          placeables: [
            {
              document: {
                id:
                  "b",
                c:
                  [
                    10,
                    10,
                    20,
                    10
                  ],
                door:
                  0
              }
            },
            {
              document: {
                id:
                  "door",
                c:
                  [
                    0,
                    0,
                    10,
                    0
                  ],
                door:
                  1
              }
            },
            {
              document: {
                id:
                  "a",
                coords:
                  [
                    0,
                    0,
                    0,
                    10
                  ],
                door:
                  0
              }
            },
            {
              document: {
                id:
                  "invalid",
                c:
                  [
                    0,
                    0,
                    0,
                    0
                  ],
                door:
                  0
              }
            }
          ]
        }
      };

      const walls =
        collectStructuralWallSegments({
          walls:
            []
        });

      assert.deepEqual(
        walls.map(
          (
            wall
          ) =>
            wall.wallId
        ),
        [
          "a",
          "b"
        ]
      );

      assert.equal(
        walls[0].length,
        10
      );

      assert.equal(
        Object.isFrozen(
          walls[0]
        ),
        true
      );
    } finally {
      globalThis.canvas =
        previousCanvas;
    }
  }
);

test(
  "active Scene context is plain, sorted and immutable",
  () => {
    const previousCanvas =
      globalThis.canvas;

    try {
      globalThis.canvas = {
        dimensions: {
          size:
            140,
          sceneRect: {
            x:
              100,
            y:
              200,
            width:
              1400,
            height:
              700
          }
        },
        walls: {
          placeables: [
            {
              document: {
                id:
                  "wall",
                c:
                  [
                    100,
                    200,
                    500,
                    200
                  ],
                door:
                  0
              }
            }
          ]
        }
      };

      const context =
        createActiveWebSceneContext({
          id:
            "scene"
        });

      assert.equal(
        context.sceneId,
        "scene"
      );

      assert.equal(
        context.gridSize,
        140
      );

      assert.equal(
        context.wallSegments.length,
        1
      );

      assert.equal(
        Object.isFrozen(
          context
        ),
        true
      );

      assert.equal(
        Object.isFrozen(
          context.wallSegments
        ),
        true
      );
    } finally {
      globalThis.canvas =
        previousCanvas;
    }
  }
);
