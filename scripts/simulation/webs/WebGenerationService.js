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

/** Deterministic, Foundry-independent web-blueprint generation service. */
export class WebGenerationService {
  constructor(
    options = {}
  ) {
    this.wallCornerGenerator =
      options.wallCornerGenerator instanceof
        WallCornerWebGenerator
        ? options.wallCornerGenerator
        : new WallCornerWebGenerator();

    this.wallSpanGenerator =
      options.wallSpanGenerator instanceof
        WallSpanWebGenerator
        ? options.wallSpanGenerator
        : new WallSpanWebGenerator();

    this.groundGenerator =
      options.groundGenerator instanceof
        GroundWebGenerator
        ? options.groundGenerator
        : new GroundWebGenerator();
  }

  generate(
    context,
    options = {}
  ) {
    validateContext(
      context
    );

    const configuration =
      normaliseWebGenerationConfiguration(
        options,
        context.sceneId
      );

    const colourProfile =
      getWebColourProfile(
        typeof options?.colourProfileId ===
          "string"
          ? options.colourProfileId
          : DEFAULT_WEB_COLOUR_PROFILE_ID
      );

    const categorySeeds =
      Object.freeze({
        corner:
          `${configuration.seed}:wall-corner`,
        span:
          `${configuration.seed}:wall-span`,
        ground:
          `${configuration.seed}:ground`
      });

    const cornerWebs =
      this.wallCornerGenerator.generate({
        sceneId:
          context.sceneId,
        generationSeed:
          categorySeeds.corner,
        wallSegments:
          context.wallSegments,
        gridSize:
          context.gridSize,
        configuration:
          configuration.cornerWebs,
        random:
          createSeededRandom(
            categorySeeds.corner
          )
      });

    const spanWebs =
      this.wallSpanGenerator.generate({
        sceneId:
          context.sceneId,
        generationSeed:
          categorySeeds.span,
        wallSegments:
          context.wallSegments,
        gridSize:
          context.gridSize,
        configuration:
          configuration.spanWebs,
        random:
          createSeededRandom(
            categorySeeds.span
          )
      });

    const groundWebs =
      this.groundGenerator.generate({
        sceneId:
          context.sceneId,
        generationSeed:
          categorySeeds.ground,
        sceneRect:
          context.sceneRect,
        gridSize:
          context.gridSize,
        configuration:
          configuration.groundWebs,
        random:
          createSeededRandom(
            categorySeeds.ground
          )
      });

    const geometryWebs =
      Object.freeze([
        ...spanWebs,
        ...cornerWebs,
        ...groundWebs
      ]);

    const webs =
      applyWebColourProfileToPopulation(
        geometryWebs,
        colourProfile
      );

    assertWebPopulationIntegrity(
      webs,
      {
        expectedSceneId:
          context.sceneId
      }
    );

    return Object.freeze({
      blueprintSchemaVersion:
        WEB_BLUEPRINT_SCHEMA_VERSION,
      sceneId:
        context.sceneId,
      seed:
        configuration.seed,
      categorySeeds,
      configuration,
      colourProfileId:
        colourProfile.id,
      colourProfile,
      webs,
      counts:
        createGenerationCounts({
          webs,
          cornerWebs,
          spanWebs,
          groundWebs
        })
    });
  }
}

function createGenerationCounts({
  webs,
  cornerWebs,
  spanWebs,
  groundWebs
}) {
  const byStrandKind = {
    structural:
      0,
    capture:
      0,
    decorative:
      0
  };

  for (
    const web of
    webs
  ) {
    for (
      const strand of
      web.strands
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          byStrandKind,
          strand.kind
        )
      ) {
        byStrandKind[
          strand.kind
        ] +=
          1;
      }
    }
  }

  const strandCount =
    Object.values(
      byStrandKind
    ).reduce(
      (
        total,
        count
      ) =>
        total +
        count,
      0
    );

  return Object.freeze({
    total:
      webs.length,
    corner:
      cornerWebs.length,
    span:
      spanWebs.length,
    ground:
      groundWebs.length,
    strands:
      strandCount,
    byWebKind:
      Object.freeze({
        "wall-corner":
          cornerWebs.length,
        "wall-span":
          spanWebs.length,
        ground:
          groundWebs.length
      }),
    byStrandKind:
      Object.freeze(
        byStrandKind
      )
  });
}

function validateContext(
  context
) {
  if (
    !context ||
    typeof context !==
      "object" ||
    typeof context.sceneId !==
      "string" ||
    !context.sceneRect ||
    !Number.isFinite(
      Number(
        context.gridSize
      )
    ) ||
    Number(
      context.gridSize
    ) <=
      0 ||
    !Array.isArray(
      context.wallSegments
    )
  ) {
    throw new TypeError(
      "Dynamic Webs | WebGenerationService requires a valid Scene context."
    );
  }
}
