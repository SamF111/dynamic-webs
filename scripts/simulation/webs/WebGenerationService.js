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

/** Deterministic, Foundry-independent web-blueprint generation service. */
export class WebGenerationService {
  constructor(options = {}) {
    this.wallCornerGenerator =
      options.wallCornerGenerator instanceof WallCornerWebGenerator
        ? options.wallCornerGenerator
        : new WallCornerWebGenerator();

    this.wallSpanGenerator =
      options.wallSpanGenerator instanceof WallSpanWebGenerator
        ? options.wallSpanGenerator
        : new WallSpanWebGenerator();

    this.groundGenerator =
      options.groundGenerator instanceof GroundWebGenerator
        ? options.groundGenerator
        : new GroundWebGenerator();
  }

  generate(context, options = {}) {
    validateContext(context);

    const configuration =
      normaliseWebGenerationConfiguration(
        options,
        context.sceneId
      );

    const cornerRandom =
      createSeededRandom(
        `${configuration.seed}:wall-corner`
      );

    const spanRandom =
      createSeededRandom(
        `${configuration.seed}:wall-span`
      );

    const groundRandom =
      createSeededRandom(
        `${configuration.seed}:ground`
      );

    const cornerWebs =
      this.wallCornerGenerator.generate({
        wallSegments:
          context.wallSegments,
        gridSize:
          context.gridSize,
        configuration:
          configuration.cornerWebs,
        random:
          cornerRandom
      });

    const spanWebs =
      this.wallSpanGenerator.generate({
        wallSegments:
          context.wallSegments,
        gridSize:
          context.gridSize,
        configuration:
          configuration.spanWebs,
        random:
          spanRandom
      });

    const groundWebs =
      this.groundGenerator.generate({
        sceneRect:
          context.sceneRect,
        gridSize:
          context.gridSize,
        configuration:
          configuration.groundWebs,
        random:
          groundRandom
      });

    const webs =
      Object.freeze([
        ...spanWebs,
        ...cornerWebs,
        ...groundWebs
      ]);

    return Object.freeze({
      sceneId:
        context.sceneId,
      seed:
        configuration.seed,
      configuration,
      webs,
      counts:
        Object.freeze({
          total:
            webs.length,
          corner:
            cornerWebs.length,
          span:
            spanWebs.length,
          ground:
            groundWebs.length,
          strands:
            webs.reduce(
              (total, web) => total + web.strands.length,
              0
            )
        })
    });
  }
}

function validateContext(context) {
  if (
    !context ||
    typeof context !== "object" ||
    typeof context.sceneId !== "string" ||
    !context.sceneRect ||
    !Number.isFinite(Number(context.gridSize)) ||
    Number(context.gridSize) <= 0 ||
    !Array.isArray(context.wallSegments)
  ) {
    throw new TypeError(
      "Dynamic Webs | WebGenerationService requires a valid Scene context."
    );
  }
}

