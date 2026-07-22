import test from "node:test";
import assert from "node:assert/strict";

import {
  createBaselineDiagnosticReport
} from "../scripts/diagnostics/baselineDiagnosticReport.js";

test(
  "baseline report combines module, runtime, lifecycle, integrity and determinism telemetry",
  () => {
    const previousGame =
      globalThis.game;

    const previousCanvas =
      globalThis.canvas;

    const web =
      Object.freeze({
        schemaVersion:
          2,
        id:
          "ground:scene:0",
        colourProfileId:
          "natural-white",
        strands:
          Object.freeze([
            Object.freeze({
              schemaVersion:
                2,
              id:
                "ground:scene:0:structural-0",
              baseAlpha:
                0.7,
              colour:
                0xe8edf2,
              underColour:
                0x111827,
              points:
                Object.freeze([
                  Object.freeze({
                    x:
                      1,
                    y:
                      2
                  }),
                  Object.freeze({
                    x:
                      3,
                    y:
                      4
                  })
                ])
            })
          ])
      });

    const webs =
      Object.freeze([
        web
      ]);

    const snapshot =
      Object.freeze({
        active:
          true,
        sceneId:
          "scene",
        generationId:
          2,
        generationReason:
          "canvas-ready",
        generatedAt:
          100,
        lastOperationReason:
          "canvas-ready",
        lastOperationAt:
          100,
        seed:
          "seed",
        categorySeeds:
          Object.freeze({
            corner:
              "corner",
            span:
              "span",
            ground:
              "ground"
          }),
        densityId:
          "standard",
        categoryDensities:
          Object.freeze({
            "wall-corner":
              "dense",
            "wall-span":
              "sparse",
            ground:
              "standard",
            "web-carpet":
              "disabled"
          }),
        categoryDensitySources:
          Object.freeze({
            "wall-corner":
              "explicit",
            "wall-span":
              "explicit",
            ground:
              "legacy-fallback",
            "web-carpet":
              "explicit"
          }),
        colourProfileId:
          "natural-white",
        thicknessMultiplier:
          1.75,
        presentationRevision:
          3,
        sceneGeometry:
          Object.freeze({
            gridSize:
              100,
            sceneRect:
              Object.freeze({
                x:
                  0,
                y:
                  0,
                width:
                  1000,
                height:
                  1000,
                right:
                  1000,
                bottom:
                  1000
              }),
            structuralWallCount:
              8
          }),
        counts:
          Object.freeze({
            total:
              1,
            strands:
              1
          }),
        rendering:
          Object.freeze({
            hasContainer:
              true,
            childCount:
              1
          }),
        spatial:
          Object.freeze({
            active:
              true,
            counts:
              Object.freeze({
                webs:
                  1,
                strands:
                  1,
                perches:
                  0
              })
          })
      });

    const webService = {
      createDiagnosticSnapshot:
        () =>
          snapshot,
      getState:
        () => ({
          webs
        }),
      createDeterminismDiagnostic:
        () =>
          Object.freeze({
            executed:
              true,
            deterministic:
              true,
            matchesRuntimeState:
              true
          })
    };

    const runtime = {
      runtimeOwnerType:
        "DynamicWebsRuntime",
      ready:
        true,
      getWebRuntimeService:
        () =>
          webService
    };

    const lifecycleController = {
      createDiagnosticSnapshot:
        () =>
          Object.freeze({
            pendingRebuild:
              false,
            debounceMilliseconds:
              200
          })
    };

    globalThis.game = {
      version:
        "14",
      release: {
        generation:
          14
      },
      user: {
        isGM:
          true
      },
      modules: {
        get:
          () => ({
            version:
              "0.6.0"
          })
      }
    };

    globalThis.canvas = {
      ready:
        true,
      scene: {
        id:
          "scene",
        name:
          "Diagnostic Scene"
      }
    };

    try {
      const report =
        createBaselineDiagnosticReport({
          runtime,
          lifecycleController
        });

      assert.equal(
        report.reportSchemaVersion,
        1
      );

      assert.equal(
        report.scene.structuralWallCount,
        8
      );

      assert.equal(
        report.scene.colourProfileId,
        "natural-white"
      );

      assert.equal(
        report.scene.categoryDensities["wall-span"],
        "sparse"
      );

      assert.equal(
        report.generation.categoryDensitySources.ground,
        "legacy-fallback"
      );

      assert.equal(
        report.generation.presentationRevision,
        3
      );

      assert.equal(
        report.scene.thicknessMultiplier,
        1.75
      );

      assert.equal(
        report.spatial.counts.strands,
        1
      );

      assert.equal(
        Object.isFrozen(report.spatial),
        true
      );

      assert.equal(
        report.integrity.uniqueWebIdCount,
        1
      );

      assert.equal(
        report.integrity.schemaChecks.allStrandsWebQualified,
        true
      );

      assert.equal(
        report.integrity.schemaChecks.allStrandsColourResolved,
        true
      );

      assert.equal(
        report.determinism.deterministic,
        true
      );

      assert.equal(
        report.lifecycle.debounceMilliseconds,
        200
      );

      assert.equal(
        Object.isFrozen(
          report
        ),
        true
      );
    } finally {
      globalThis.game =
        previousGame;

      globalThis.canvas =
        previousCanvas;
    }
  }
);
