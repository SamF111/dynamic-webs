import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebRuntimeSnapshot,
  createWebRuntimeState
} from "../scripts/runtime/webs/webRuntimeState.js";

test(
  "empty runtime diagnostics expose v0.2 telemetry and frozen count groups",
  () => {
    const state =
      createWebRuntimeState({
        generationId:
          4,
        generationReason:
          "canvas-ready",
        generatedAt:
          1234,
        lastOperationReason:
          "clear",
        lastOperationAt:
          5678
      });

    const snapshot =
      createWebRuntimeSnapshot(
        state,
        Object.freeze({
          hasContainer:
            false
        })
      );

    assert.equal(
      snapshot.blueprintSchemaVersion,
      2
    );

    assert.equal(
      snapshot.generationId,
      4
    );

    assert.equal(
      snapshot.presentationRevision,
      0
    );

    assert.equal(
      snapshot.colourProfileId,
      null
    );

    assert.equal(
      snapshot.categoryDensities,
      null
    );

    assert.equal(
      snapshot.categoryDensitySources,
      null
    );

    assert.equal(
      snapshot.thicknessMultiplier,
      null
    );

    assert.equal(
      snapshot.generationReason,
      "canvas-ready"
    );

    assert.equal(
      snapshot.lastOperationReason,
      "clear"
    );

    assert.equal(
      snapshot.counts.byWebKind.ground,
      0
    );

    assert.equal(
      snapshot.counts.byStrandKind.capture,
      0
    );

    assert.equal(
      Object.isFrozen(
        snapshot
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        snapshot.counts.byWebKind
      ),
      true
    );

    assert.equal(
      Object.isFrozen(
        snapshot.rendering
      ),
      true
    );
  }
);


test(
  "telemetry snapshots omit geometry while preserving counts and rendering",
  () => {
    const state =
      createWebRuntimeState();

    state.active =
      true;

    state.webs =
      Object.freeze([
        Object.freeze({
          id:
            "ground:scene:index-0"
        })
      ]);

    state.counts =
      Object.freeze({
        total:
          1,
        corner:
          0,
        span:
          0,
        ground:
          1,
        strands:
          0,
        byWebKind:
          Object.freeze({
            "wall-corner":
              0,
            "wall-span":
              0,
            ground:
              1
          }),
        byStrandKind:
          Object.freeze({
            structural:
              0,
            capture:
              0,
            decorative:
              0
          })
      });

    const snapshot =
      createWebRuntimeSnapshot(
        state,
        {
          hasContainer:
            true
        },
        {
          includeWebs:
            false
        }
      );

    assert.equal(
      snapshot.webs,
      null
    );

    assert.equal(
      snapshot.counts.total,
      1
    );

    assert.equal(
      snapshot.rendering.hasContainer,
      true
    );
  }
);

test(
  "runtime snapshots clone mutable state rather than exposing it",
  () => {
    const state =
      createWebRuntimeState();

    state.sceneGeometry = {
      gridSize:
        100
    };

    const snapshot =
      createWebRuntimeSnapshot(
        state
      );

    state.sceneGeometry.gridSize =
      200;

    assert.equal(
      snapshot.sceneGeometry.gridSize,
      100
    );

    assert.equal(
      Object.isFrozen(
        snapshot.sceneGeometry
      ),
      true
    );
  }
);
