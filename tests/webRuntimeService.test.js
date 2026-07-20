import test from "node:test";
import assert from "node:assert/strict";

import {
  WebRenderService
} from "../scripts/rendering/webs/WebRenderService.js";

import {
  WebRuntimeService
} from "../scripts/runtime/webs/WebRuntimeService.js";

import {
  WebGenerationService
} from "../scripts/simulation/webs/WebGenerationService.js";

function createEnvironment({
  renderFailure =
    null
} = {}) {
  const previousCanvas =
    globalThis.canvas;

  const scene = {
    id:
      "scene"
  };

  globalThis.canvas = {
    ready:
      true,
    scene,
    dimensions: {
      size:
        100,
      sceneRect: {
        x:
          0,
        y:
          0,
        width:
          1000,
        height:
          1000
      }
    },
    walls: {
      placeables:
        []
    }
  };

  const web =
    Object.freeze({
      schemaVersion:
        1,
      id:
        "ground:scene:index-0",
      kind:
        "ground",
      sceneId:
        "scene",
      seed:
        "seed:ground",
      sourceKey:
        "index-0",
      hub:
        Object.freeze({
          x:
            10,
          y:
            10
        }),
      bounds:
        Object.freeze({
          x:
            10,
          y:
            10,
          width:
            10,
          height:
            10,
          right:
            20,
          bottom:
            20
        }),
      strands:
        Object.freeze([]),
      perches:
        Object.freeze([]),
      supportingWallIds:
        Object.freeze([])
    });

  const generated =
    Object.freeze({
      blueprintSchemaVersion:
        1,
      sceneId:
        "scene",
      seed:
        "seed",
      categorySeeds:
        Object.freeze({
          corner:
            "seed:corner",
          span:
            "seed:span",
          ground:
            "seed:ground"
        }),
      configuration:
        Object.freeze({
          rendering:
            Object.freeze({
              layerMode:
                "under-tokens"
            })
        }),
      webs:
        Object.freeze([
          web
        ]),
      counts:
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
        })
    });

  const generationService =
    new WebGenerationService();

  generationService.generate =
    () =>
      generated;

  const renderCalls =
    [];

  const clearCalls =
    [];

  const renderService =
    new WebRenderService();

  renderService.render =
    (
      webs,
      configuration
    ) => {
      renderCalls.push({
        webs,
        configuration
      });

      if (
        renderFailure
      ) {
        throw renderFailure;
      }

      return {};
    };

  renderService.clear =
    () => {
      clearCalls.push(
        true
      );

      return true;
    };

  renderService.createDiagnosticSnapshot =
    () =>
      Object.freeze({
        hasContainer:
          renderCalls.length >
          clearCalls.length,
        renderedWebCount:
          renderCalls.length >
            clearCalls.length
            ? 1
            : 0
      });

  const runtime = {
    runtimeOwnerType:
      "DynamicWebsRuntime"
  };

  const service =
    new WebRuntimeService({
      runtime,
      generationService,
      renderService
    });

  return {
    scene,
    service,
    renderCalls,
    clearCalls,
    restore() {
      globalThis.canvas =
        previousCanvas;
    }
  };
}

test(
  "runtime generation records provenance, geometry and rendering telemetry",
  () => {
    const environment =
      createEnvironment();

    try {
      const snapshot =
        environment.service.generateForActiveScene({
          scene:
            environment.scene,
          densityId:
            "dense",
          reason:
            "runtime-test"
        });

      assert.equal(
        snapshot.active,
        true
      );

      assert.equal(
        snapshot.generationId,
        1
      );

      assert.equal(
        snapshot.generationReason,
        "runtime-test"
      );

      assert.equal(
        snapshot.densityId,
        "dense"
      );

      assert.equal(
        snapshot.sceneGeometry.gridSize,
        100
      );

      assert.equal(
        snapshot.sceneGeometry.structuralWallCount,
        0
      );

      assert.equal(
        snapshot.rendering.renderedWebCount,
        1
      );

      assert.equal(
        environment.renderCalls.length,
        1
      );

      assert.equal(
        Object.isFrozen(
          snapshot
        ),
        true
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime rendering failure leaves no active generated population",
  () => {
    const environment =
      createEnvironment({
        renderFailure:
          new Error(
            "render failed"
          )
      });

    try {
      assert.throws(
        () =>
          environment.service.generateForActiveScene({
            scene:
              environment.scene,
            reason:
              "runtime-test"
          }),
        /render failed/u
      );

      const state =
        environment.service.getState();

      assert.equal(
        state.active,
        false
      );

      assert.equal(
        state.generationId,
        0
      );

      assert.equal(
        state.lastOperationReason,
        "runtime-test-failed"
      );
    } finally {
      environment.restore();
    }
  }
);

test(
  "runtime clear preserves generation revision while removing active geometry",
  () => {
    const environment =
      createEnvironment();

    try {
      environment.service.generateForActiveScene({
        scene:
          environment.scene,
        reason:
          "runtime-test"
      });

      assert.equal(
        environment.service.clear(
          "manual-clear"
        ),
        true
      );

      const snapshot =
        environment.service.createDiagnosticSnapshot();

      assert.equal(
        snapshot.active,
        false
      );

      assert.equal(
        snapshot.generationId,
        1
      );

      assert.equal(
        snapshot.generationReason,
        "runtime-test"
      );

      assert.equal(
        snapshot.lastOperationReason,
        "manual-clear"
      );

      assert.equal(
        snapshot.webs.length,
        0
      );
    } finally {
      environment.restore();
    }
  }
);
