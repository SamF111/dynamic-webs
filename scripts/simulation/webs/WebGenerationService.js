import {
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../../module/moduleConstants.js";

import {
  createSeededRandom
} from "../../util/seededRandom.js";

import {
  normaliseWebGenerationConfiguration
} from "./webConfiguration.js";

import {
  WallCornerWebGenerator
} from "./WallCornerWebGenerator.js";

import {
  GroundWebGenerator
} from "./GroundWebGenerator.js";

import {
  WallSpanWebGenerator
} from "./WallSpanWebGenerator.js";

import {
  assertWebPopulationIntegrity
} from "./webBlueprintContract.js";

import {
  DEFAULT_WEB_COLOUR_PROFILE_ID,
  applyWebColourProfileToPopulation,
  getWebColourProfile
} from "./webColourProfiles.js";

import {
  createBaseWebLevel,
  createWebLevelDescriptor
} from "./webLevelContract.js";

import {
  createWebLevelGenerationContexts
} from "./webLevelGenerationContext.js";

import {
  buildWebRegionRestrictionIndex,
  createWebRegionRestrictionDiagnostics
} from "../../spatial/webRegionRestrictionIndex.js";

/** Deterministic, Foundry-independent web-blueprint generation service. */
export class WebGenerationService {
  constructor(options = {}) {
    this.wallCornerGenerator = options.wallCornerGenerator instanceof WallCornerWebGenerator
      ? options.wallCornerGenerator
      : new WallCornerWebGenerator();
    this.wallSpanGenerator = options.wallSpanGenerator instanceof WallSpanWebGenerator
      ? options.wallSpanGenerator
      : new WallSpanWebGenerator();
    this.groundGenerator = options.groundGenerator instanceof GroundWebGenerator
      ? options.groundGenerator
      : new GroundWebGenerator();
  }

  generate(context, options = {}) {
    const generationContext = normaliseGenerationContext(context);

    if (Array.isArray(options?.populations)) {
      return this.#generateModularPopulations(generationContext, options.populations);
    }

    return this.#generateDirectConfiguration(generationContext, options);
  }

  #generateModularPopulations(generationContext, requestedPopulations) {
    const levelContexts = createWebLevelGenerationContexts(generationContext);
    const levelContextsById = new Map(
      levelContexts.map((entry) => [entry.level.id, entry])
    );

    const webs = [];
    const populationSeeds = {};
    const populationConfigurations = [];
    let rendering = null;

    for (const requested of requestedPopulations) {
      if (!requested || requested.enabled !== true) continue;

      const populationId = requireIdentifier(requested.id ?? requested.populationId, "web population ID");
      const populationLabel = populationId;
      const levelId = requireIdentifier(requested.levelId, `level ID for web population "${populationId}"`);
      const levelContext = levelContextsById.get(levelId);
      if (!levelContext) continue;

      const thicknessMultiplier = normalisePositiveNumber(requested.thicknessMultiplier, 1);
      const colourProfile = getWebColourProfile(
        typeof requested.colourProfileId === "string"
          ? requested.colourProfileId
          : DEFAULT_WEB_COLOUR_PROFILE_ID
      );
      const populationSeed = [
        "dynamic-webs",
        "web-generation",
        "v4",
        generationContext.sceneId,
        encodeURIComponent(populationId)
      ].join(":");

      const configuration = normaliseWebGenerationConfiguration({
        ...(requested.generationOptions ?? {}),
        seed: populationSeed
      }, generationContext.sceneId);

      rendering ??= configuration.rendering;

      const encodedLevelId = encodeURIComponent(levelId);
      const categorySeeds = Object.freeze({
        corner: `${populationSeed}:${encodedLevelId}:wall-corner`,
        span: `${populationSeed}:${encodedLevelId}:wall-span`,
        ground: `${populationSeed}:${encodedLevelId}:ground`
      });
      populationSeeds[populationId] = categorySeeds;

      const regionRestriction =
        buildWebRegionRestrictionIndex({
          regions:
            generationContext.regions,
          population:
            requested,
          level:
            levelContext.level
        });

      const geometry = this.#generateForLevel({
        generationContext,
        levelContext,
        configuration,
        categorySeeds,
        populationId,
        populationLabel,
        thicknessMultiplier,
        regionRestriction
      });

      webs.push(...applyWebColourProfileToPopulation(geometry, colourProfile));
      populationConfigurations.push(Object.freeze({
        id: populationId,
        label: populationLabel,
        enabled: true,
        levelId,
        confineRegionTags:
          requested.confineRegionTags ??
          Object.freeze([]),
        excludeRegionTags:
          requested.excludeRegionTags ??
          Object.freeze([]),
        regionRestriction:
          createWebRegionRestrictionDiagnostics(
            regionRestriction
          ),
        categoryDensities: requested.categoryDensities ?? null,
        colourProfileId: colourProfile.id,
        thicknessMultiplier,
        seed: populationSeed,
        categorySeeds,
        generationOptions: requested.generationOptions ?? {},
        configuration
      }));
    }

    const frozenWebs = Object.freeze(webs);
    assertWebPopulationIntegrity(frozenWebs, {
      expectedSceneId: generationContext.sceneId
    });

    return Object.freeze({
      blueprintSchemaVersion: WEB_BLUEPRINT_SCHEMA_VERSION,
      sceneId: generationContext.sceneId,
      seed: `dynamic-webs:web-generation:v4:${generationContext.sceneId}`,
      categorySeeds: Object.freeze(populationSeeds),
      populationSeeds: Object.freeze(populationSeeds),
      levelProvider: generationContext.levelProvider,
      levels: generationContext.levels,
      regions: generationContext.regions,
      configuration: Object.freeze({
        rendering: rendering ?? normaliseWebGenerationConfiguration({}, generationContext.sceneId).rendering,
        populations: Object.freeze(populationConfigurations)
      }),
      populations: Object.freeze(populationConfigurations),
      colourProfileId: null,
      colourProfile: null,
      webs: frozenWebs,
      counts: createGenerationCounts(frozenWebs, generationContext.levels)
    });
  }

  #generateDirectConfiguration(generationContext, options) {
    const configuration = normaliseWebGenerationConfiguration(options, generationContext.sceneId);
    const colourProfile = getWebColourProfile(
      typeof options?.colourProfileId === "string"
        ? options.colourProfileId
        : DEFAULT_WEB_COLOUR_PROFILE_ID
    );
    const levelContexts = createWebLevelGenerationContexts(generationContext);
    const categorySeedsByLevel = {};
    const geometryWebs = [];

    for (const levelContext of levelContexts) {
      const levelId = levelContext.level.id;
      const encodedLevelId = encodeURIComponent(levelId);
      const categorySeeds = Object.freeze({
        corner: `${configuration.seed}:${encodedLevelId}:wall-corner`,
        span: `${configuration.seed}:${encodedLevelId}:wall-span`,
        ground: `${configuration.seed}:${encodedLevelId}:ground`
      });
      categorySeedsByLevel[levelId] = categorySeeds;
      geometryWebs.push(...this.#generateForLevel({
        generationContext,
        levelContext,
        configuration,
        categorySeeds,
        populationId: "default",
        populationLabel: "Default Web Population",
        thicknessMultiplier: 1
      }));
    }

    const webs = applyWebColourProfileToPopulation(Object.freeze(geometryWebs), colourProfile);
    assertWebPopulationIntegrity(webs, { expectedSceneId: generationContext.sceneId });

    return Object.freeze({
      blueprintSchemaVersion: WEB_BLUEPRINT_SCHEMA_VERSION,
      sceneId: generationContext.sceneId,
      seed: configuration.seed,
      categorySeeds: Object.freeze(categorySeedsByLevel),
      levelProvider: generationContext.levelProvider,
      levels: generationContext.levels,
      regions: generationContext.regions,
      configuration,
      populations: Object.freeze([]),
      colourProfileId: colourProfile.id,
      colourProfile,
      webs,
      counts: createGenerationCounts(webs, generationContext.levels)
    });
  }

  #generateForLevel({
    generationContext,
    levelContext,
    configuration,
    categorySeeds,
    populationId,
    populationLabel,
    thicknessMultiplier,
    regionRestriction = null
  }) {
    const common = {
      sceneId: generationContext.sceneId,
      populationId,
      populationLabel,
      thicknessMultiplier,
      level: levelContext.level,
      wallSegments: levelContext.wallSegments,
      gridSize: generationContext.gridSize,
      regionRestriction
    };

    return Object.freeze([
      ...this.wallSpanGenerator.generate({
        ...common,
        generationSeed: categorySeeds.span,
        configuration: configuration.spanWebs,
        random: createSeededRandom(categorySeeds.span)
      }),
      ...this.wallCornerGenerator.generate({
        ...common,
        generationSeed: categorySeeds.corner,
        configuration: configuration.cornerWebs,
        random: createSeededRandom(categorySeeds.corner)
      }),
      ...this.groundGenerator.generate({
        ...common,
        generationSeed: categorySeeds.ground,
        sceneRect: generationContext.sceneRect,
        configuration: configuration.groundWebs,
        random: createSeededRandom(categorySeeds.ground)
      })
    ]);
  }
}

function createGenerationCounts(webs, levels) {
  const byStrandKind = { structural: 0, capture: 0, decorative: 0 };
  const byWebKind = { "wall-corner": 0, "wall-span": 0, ground: 0 };
  const byLevel = {};
  const byPopulation = {};

  for (const level of levels) byLevel[level.id] = createMutableLevelCounts(level);

  for (const web of webs) {
    if (Object.prototype.hasOwnProperty.call(byWebKind, web.kind)) byWebKind[web.kind] += 1;

    const levelCounts = byLevel[web.levelId] ?? (byLevel[web.levelId] = createMutableLevelCounts({
      id: web.levelId,
      label: web.levelId,
      providerMode: web.levelProviderMode,
      elevationBand: web.elevationBand
    }));

    const populationCounts = byPopulation[web.populationId] ?? (byPopulation[web.populationId] = {
      id: web.populationId,
      label: web.populationLabel,
      levelId: web.levelId,
      colourProfileId: web.colourProfileId,
      thicknessMultiplier: web.thicknessMultiplier,
      total: 0,
      strands: 0,
      byWebKind: { "wall-corner": 0, "wall-span": 0, ground: 0 },
      byStrandKind: { structural: 0, capture: 0, decorative: 0 }
    });

    levelCounts.total += 1;
    populationCounts.total += 1;
    if (Object.prototype.hasOwnProperty.call(levelCounts.byWebKind, web.kind)) levelCounts.byWebKind[web.kind] += 1;
    if (Object.prototype.hasOwnProperty.call(populationCounts.byWebKind, web.kind)) populationCounts.byWebKind[web.kind] += 1;

    for (const strand of web.strands) {
      if (Object.prototype.hasOwnProperty.call(byStrandKind, strand.kind)) {
        byStrandKind[strand.kind] += 1;
        levelCounts.byStrandKind[strand.kind] += 1;
        populationCounts.byStrandKind[strand.kind] += 1;
      }
      levelCounts.strands += 1;
      populationCounts.strands += 1;
    }
  }

  const freezeCountMap = (map) => Object.freeze(Object.fromEntries(
    Object.entries(map).map(([id, counts]) => [id, Object.freeze({
      ...counts,
      ...(counts.level ? { level: Object.freeze(counts.level) } : {}),
      byWebKind: Object.freeze(counts.byWebKind),
      byStrandKind: Object.freeze(counts.byStrandKind)
    })])
  ));

  return Object.freeze({
    total: webs.length,
    corner: byWebKind["wall-corner"],
    span: byWebKind["wall-span"],
    ground: byWebKind.ground,
    strands: Object.values(byStrandKind).reduce((total, count) => total + count, 0),
    byWebKind: Object.freeze(byWebKind),
    byStrandKind: Object.freeze(byStrandKind),
    byLevel: freezeCountMap(byLevel),
    byPopulation: freezeCountMap(byPopulation)
  });
}

function createMutableLevelCounts(level) {
  return {
    level: {
      id: level.id,
      label: level.label ?? level.id,
      providerMode: level.providerMode,
      elevationBand: level.elevationBand
    },
    total: 0,
    strands: 0,
    byWebKind: { "wall-corner": 0, "wall-span": 0, ground: 0 },
    byStrandKind: { structural: 0, capture: 0, decorative: 0 }
  };
}

function normaliseGenerationContext(context) {
  validateContext(context);
  const levels = Array.isArray(context.levels) && context.levels.length > 0
    ? Object.freeze(context.levels.map(createWebLevelDescriptor))
    : Object.freeze([createBaseWebLevel()]);
  const fallbackLevel = levels[0];
  const wallSegments = Object.freeze(context.wallSegments.map((segment) => Object.freeze({
    ...segment,
    levelProviderMode: segment?.levelProviderMode ?? fallbackLevel.providerMode,
    levelId: segment?.levelId ?? fallbackLevel.id,
    elevationBand: segment?.elevationBand ?? fallbackLevel.elevationBand
  })));

  const regions = Object.freeze(
    (Array.isArray(context.regions) ? context.regions : [])
      .map((region) => Object.freeze({ ...region }))
  );

  return Object.freeze({
    ...context,
    levels,
    wallSegments,
    regions,
    levelProvider: context.levelProvider ?? Object.freeze({
      requestedMode: fallbackLevel.providerMode,
      resolvedMode: fallbackLevel.providerMode,
      providerAvailable: true,
      fallbackUsed: false,
      fallbackReason: null,
      activeViewedLevelId: fallbackLevel.id,
      levels
    })
  });
}

function validateContext(context) {
  if (!context || typeof context !== "object" || typeof context.sceneId !== "string" || !context.sceneRect ||
      !Number.isFinite(Number(context.gridSize)) || Number(context.gridSize) <= 0 || !Array.isArray(context.wallSegments)) {
    throw new TypeError("Dynamic Webs | WebGenerationService requires a valid Scene context.");
  }
}

function requireIdentifier(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new TypeError(`Dynamic Webs | ${label} must be a non-empty identifier.`);
  return text;
}

function normalisePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
