
import {
  getSceneWebCategoryDensityConfiguration
} from "../config/sceneWebCategoryDensityConfiguration.js";

import {
  BASELINE_DIAGNOSTIC_SCHEMA_VERSION,
  MODULE_ID,
  PUBLIC_API_VERSION,
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../module/moduleConstants.js";

/**
 * Create the comprehensive baseline diagnostic report.
 *
 * @param {object} options - Report dependencies.
 * @param {object} options.runtime - Dynamic Webs runtime.
 * @param {object|null} [options.lifecycleController=null] - Lifecycle owner.
 * @returns {Readonly<object>} Frozen copyable report.
 */
export function createBaselineDiagnosticReport({
  runtime,
  lifecycleController = null
}) {
  if (
    !runtime ||
    runtime.runtimeOwnerType !==
      "DynamicWebsRuntime"
  ) {
    throw new TypeError(
      "Dynamic Webs | Baseline diagnostics require the initialised runtime."
    );
  }

  const webService =
    runtime.getWebRuntimeService();

  const state =
    webService.createTelemetrySnapshot?.() ??
    webService.createDiagnosticSnapshot();

  const rawState =
    webService.getState();

  const population =
    createPopulationSummary(
      rawState?.webs
    );

  const determinism =
    webService.createDeterminismDiagnostic();

  const moduleRecord =
    globalThis.game
      ?.modules
      ?.get?.(
        MODULE_ID
      );

  const activeScene =
    globalThis.canvas?.scene ??
    null;

  const sceneCategoryDensityConfiguration =
    activeScene
      ? getSceneWebCategoryDensityConfiguration(
          activeScene
        )
      : null;

  const categoryDensities =
    state.categoryDensities ??
    sceneCategoryDensityConfiguration?.categoryDensities ??
    null;

  const categoryDensitySources =
    state.categoryDensitySources ??
    sceneCategoryDensityConfiguration?.categoryDensitySources ??
    null;

  return deepFreeze({
    reportSchemaVersion:
      BASELINE_DIAGNOSTIC_SCHEMA_VERSION,
    generatedAt:
      Date.now(),
    module: {
      id:
        MODULE_ID,
      version:
        moduleRecord?.version ??
        moduleRecord?.manifest?.version ??
        "0.2.2",
      publicApiVersion:
        PUBLIC_API_VERSION,
      blueprintSchemaVersion:
        WEB_BLUEPRINT_SCHEMA_VERSION,
      runtimeReady:
        runtime.ready ===
          true
    },
    foundry: {
      version:
        globalThis.game?.version ??
        globalThis.game?.release?.version ??
        null,
      generation:
        globalThis.game?.release?.generation ??
        null,
      userIsGM:
        globalThis.game?.user?.isGM ===
          true,
      canvasReady:
        globalThis.canvas?.ready ===
          true
    },
    scene: {
      id:
        activeScene?.id ??
        state.sceneId ??
        null,
      name:
        activeScene?.name ??
        null,
      densityId:
        state.densityId,
      categoryDensities,
      categoryDensitySources,
      colourProfileId:
        state.colourProfileId,
      thicknessMultiplier:
        state.thicknessMultiplier,
      gridSize:
        state.sceneGeometry?.gridSize ??
        null,
      sceneRect:
        state.sceneGeometry?.sceneRect ??
        null,
      structuralWallCount:
        state.sceneGeometry?.structuralWallCount ??
        null
    },
    generation: {
      active:
        state.active,
      generationId:
        state.generationId,
      presentationRevision:
        state.presentationRevision,
      colourProfileId:
        state.colourProfileId,
      thicknessMultiplier:
        state.thicknessMultiplier,
      reason:
        state.generationReason,
      generatedAt:
        state.generatedAt,
      seed:
        state.seed,
      categorySeeds:
        state.categorySeeds,
      categoryDensities,
      categoryDensitySources,
      counts:
        state.counts,
      lastOperationReason:
        state.lastOperationReason,
      lastOperationAt:
        state.lastOperationAt
    },
    rendering:
      state.rendering,
    lifecycle:
      lifecycleController
        ?.createDiagnosticSnapshot?.() ??
      null,
    integrity:
      population,
    determinism
  });
}

function createPopulationSummary(
  webs
) {
  const population =
    Array.isArray(
      webs
    )
      ? webs
      : [];

  const webIds =
    population.map(
      (
        web
      ) =>
        String(
          web?.id ??
          ""
        )
    );

  const strands =
    population.flatMap(
      (
        web
      ) =>
        Array.isArray(
          web?.strands
        )
          ? web.strands
          : []
    );

  const strandIds =
    strands.map(
      (
        strand
      ) =>
        String(
          strand?.id ??
          ""
        )
    );

  return {
    webCount:
      webIds.length,
    uniqueWebIdCount:
      new Set(
        webIds
      ).size,
    duplicateWebIds:
      findDuplicates(
        webIds
      ),
    strandCount:
      strandIds.length,
    uniqueStrandIdCount:
      new Set(
        strandIds
      ).size,
    duplicateStrandIds:
      findDuplicates(
        strandIds
      ),
    schemaChecks: {
      allWebsVersioned:
        population.every(
          (
            web
          ) =>
            web?.schemaVersion ===
              WEB_BLUEPRINT_SCHEMA_VERSION
        ),
      allStrandsVersioned:
        strands.every(
          (
            strand
          ) =>
            strand?.schemaVersion ===
              WEB_BLUEPRINT_SCHEMA_VERSION
        ),
      allStrandsWebQualified:
        population.every(
          (
            web
          ) =>
            (
              Array.isArray(
                web?.strands
              )
                ? web.strands
                : []
            ).every(
              (
                strand
              ) =>
                String(
                  strand?.id ??
                  ""
                ).startsWith(
                  `${String(web?.id ?? "")}:`
                )
            )
        )
,
      allWebsColourProfiled:
        population.every(
          (
            web
          ) =>
            typeof web?.colourProfileId ===
              "string" &&
            web.colourProfileId.length >
              0
        ),
      allStrandsColourResolved:
        strands.every(
          (
            strand
          ) =>
            Number.isInteger(
              strand?.colour
            ) &&
            Number.isInteger(
              strand?.underColour
            ) &&
            Number.isFinite(
              Number(
                strand?.baseAlpha
              )
            )
        )
    },
    immutabilityChecks: {
      webArrayFrozen:
        Object.isFrozen(
          population
        ),
      allWebsFrozen:
        population.every(
          Object.isFrozen
        ),
      allStrandsFrozen:
        strands.every(
          Object.isFrozen
        ),
      allPointArraysFrozen:
        strands.every(
          (
            strand
          ) =>
            Object.isFrozen(
              strand?.points
            )
        ),
      allPointsFrozen:
        strands.every(
          (
            strand
          ) =>
            (
              Array.isArray(
                strand?.points
              )
                ? strand.points
                : []
            ).every(
              Object.isFrozen
            )
        )
    },
    sampleWebIds:
      webIds.slice(
        0,
        12
      ),
    sampleStrandIds:
      strandIds.slice(
        0,
        24
      )
  };
}

function findDuplicates(
  values
) {
  const seen =
    new Set();

  const duplicates =
    new Set();

  for (
    const value of
    values
  ) {
    if (
      seen.has(
        value
      )
    ) {
      duplicates.add(
        value
      );
    }

    seen.add(
      value
    );
  }

  return Array.from(
    duplicates
  ).sort();
}

function deepFreeze(
  value
) {
  if (
    value ===
      null ||
    typeof value !==
      "object"
  ) {
    return value;
  }

  for (
    const child of
    Object.values(
      value
    )
  ) {
    deepFreeze(
      child
    );
  }

  return Object.isFrozen(
    value
  )
    ? value
    : Object.freeze(
        value
      );
}
