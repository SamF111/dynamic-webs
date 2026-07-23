
import {
  getSceneWebPopulationConfiguration
} from "../config/sceneWebPopulationConfiguration.js";

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
      rawState?.webs,
      rawState?.sceneGeometry?.wallLevelById
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

  const scenePopulationConfiguration =
    activeScene
      ? getSceneWebPopulationConfiguration(
          activeScene
        )
      : null;

  const webPopulations =
    state.populations ??
    scenePopulationConfiguration?.populations ??
    Object.freeze([]);

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
        "0.7.0",
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
      webPopulations,
      densityId:
        state.densityId,
      categoryDensities:
        state.categoryDensities,
      categoryDensitySources:
        state.categoryDensitySources,
      colourProfileId:
        state.colourProfileId,
      thicknessMultiplier:
        state.thicknessMultiplier,
      populationCount:
        webPopulations.length,
      activePopulationCount:
        webPopulations.filter?.(
          (population) => population.enabled === true
        ).length ??
        0,
      unavailablePopulationIds:
        scenePopulationConfiguration?.unavailablePopulationIds ??
        Object.freeze([]),
      gridSize:
        state.sceneGeometry?.gridSize ??
        null,
      sceneRect:
        state.sceneGeometry?.sceneRect ??
        null,
      structuralWallCount:
        state.sceneGeometry?.structuralWallCount ??
        null,
      detectedLevelCount:
        state.sceneGeometry?.detectedLevelCount ??
        null,
      wallsByLevel:
        state.sceneGeometry?.wallsByLevel ??
        null,
      unresolvedWallLevelCount:
        state.sceneGeometry?.unresolvedWallLevelCount ??
        null,
      levelProvider:
        state.levelProvider ??
        null,
      levels:
        state.levels ??
        null,
      levelVisibility:
        state.levelVisibility ??
        null,
      regions:
        state.regions ??
        Object.freeze([]),
      regionCount:
        state.regions?.length ??
        0
    },
    generation: {
      active:
        state.active,
      generationId:
        state.generationId,
      presentationRevision:
        state.presentationRevision,
      populations:
        webPopulations,
      colourProfileId:
        state.colourProfileId,
      thicknessMultiplier:
        state.thicknessMultiplier,
      categoryDensities:
        state.categoryDensities,
      categoryDensitySources:
        state.categoryDensitySources,
      reason:
        state.generationReason,
      generatedAt:
        state.generatedAt,
      seed:
        state.seed,
      categorySeeds:
        state.categorySeeds,
      populationSeeds:
        state.categorySeeds,
      levelProvider:
        state.levelProvider ??
        null,
      levels:
        state.levels ??
        null,
      levelVisibility:
        state.levelVisibility ??
        null,
      regions:
        state.regions ??
        Object.freeze([]),
      regionRestrictions:
        Object.freeze(Object.fromEntries(
          webPopulations.map((population) => [
            population.id,
            population.regionRestriction ?? null
          ])
        )),
      counts:
        state.counts,
      lastOperationReason:
        state.lastOperationReason,
      lastOperationAt:
        state.lastOperationAt
    },
    rendering:
      state.rendering,
    interactions:
      state.mutableState ??
      null,
    spatial:
      state.spatial ??
      null,
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
  webs,
  wallLevelById = null
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

  const levelIds =
    population.map(
      (
        web
      ) =>
        String(
          web?.levelId ??
          ""
        )
    );

  const populationIds =
    population.map(
      (web) =>
        String(
          web?.populationId ??
          ""
        )
    );

  const webRegionIds = population.flatMap((web) =>
    Array.isArray(web?.regionIds) ? web.regionIds : []
  );

  const webRegionTags = population.flatMap((web) =>
    Array.isArray(web?.regionTags) ? web.regionTags : []
  );

  const supportLevelViolations =
    population
      .filter(
        (
          web
        ) =>
          (
            Array.isArray(
              web?.supportingWallIds
            )
              ? web.supportingWallIds
              : []
          ).some(
            (
              wallId
            ) =>
              wallLevelById?.[
                wallId
              ] !==
                undefined &&
              wallLevelById[
                wallId
              ] !==
                web.levelId
          )
      )
      .map(
        (
          web
        ) =>
          web.id
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
    populationCount:
      new Set(
        populationIds
      ).size,
    populationIds:
      Array.from(
        new Set(
          populationIds
        )
      ).sort(),
    levelCount:
      new Set(
        levelIds
      ).size,
    levelIds:
      Array.from(
        new Set(
          levelIds
        )
      ).sort(),
    supportLevelViolations,
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
      allWebsPopulationOwned:
        population.every(
          (web) =>
            typeof web?.populationId ===
              "string" &&
            web.populationId.length >
              0 &&
            typeof web?.populationLabel ===
              "string" &&
            web.populationLabel.length >
              0 &&
            Number.isFinite(
              Number(web?.thicknessMultiplier)
            ) &&
            Number(web.thicknessMultiplier) >
              0
        ),
      allWebsLevelOwned:
        population.every(
          (
            web
          ) =>
            typeof web?.levelProviderMode ===
              "string" &&
            web.levelProviderMode.length >
              0 &&
            typeof web?.levelId ===
              "string" &&
            web.levelId.length >
              0 &&
            web?.elevationBand &&
            typeof web.elevationBand ===
              "object"
        ),
      allSupportsSameLevel:
        supportLevelViolations.length ===
          0,
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
      allElevationBandsFrozen:
        population.every(
          (
            web
          ) =>
            Object.isFrozen(
              web?.elevationBand
            )
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

