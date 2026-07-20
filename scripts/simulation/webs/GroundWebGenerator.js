import {
  WEB_STRAND_KINDS,
  createWebBlueprint,
  createWebStrand,
  lerpPoint,
  randomBetween
} from "./webGeometry.js";

import {
  WEB_BLUEPRINT_KINDS,
  createStableWebId
} from "./webBlueprintContract.js";

/** Generate deterministic irregular radial ground webs. */
export class GroundWebGenerator {
  generate({
    sceneId,
    populationId = "default",
    populationLabel = "Default Web Population",
    thicknessMultiplier = 1,
    level,
    generationSeed,
    sceneRect,
    gridSize,
    configuration,
    random
  }) {
    if (
      configuration?.enabled !== true ||
      configuration.count <= 0 ||
      !sceneRect
    ) {
      return Object.freeze([]);
    }

    const webs = [];
    for (let index = 0; index < configuration.count; index += 1) {
      webs.push(createGroundWeb({
        index,
        sceneId,
        populationId,
        populationLabel,
        thicknessMultiplier,
        level,
        generationSeed,
        sceneRect,
        gridSize,
        configuration,
        random
      }));
    }

    return Object.freeze(webs);
  }
}

function createGroundWeb({
  index,
  sceneId,
  populationId,
  populationLabel,
  thicknessMultiplier,
  level,
  generationSeed,
  sceneRect,
  gridSize,
  configuration,
  random
}) {
  const radiusX = randomBetween(
    random,
    configuration.minimumRadiusGridUnits * gridSize,
    configuration.maximumRadiusGridUnits * gridSize
  );
  const radiusY = radiusX * randomBetween(random, 0.68, 1.12);
  const margin = configuration.edgeMarginGridUnits * gridSize;

  const centre = {
    x: chooseCoordinate(random, sceneRect.x, sceneRect.right, margin),
    y: chooseCoordinate(random, sceneRect.y, sceneRect.bottom, margin)
  };

  const rotation = randomBetween(random, 0, Math.PI * 2);
  const spokeCount = 10 + Math.floor(random() * 5);
  const perimeter = [];
  const strands = [];

  const hub = {
    x: centre.x + randomBetween(random, -radiusX * 0.09, radiusX * 0.09),
    y: centre.y + randomBetween(random, -radiusY * 0.09, radiusY * 0.09)
  };

  for (let spokeIndex = 0; spokeIndex < spokeCount; spokeIndex += 1) {
    const angle =
      rotation +
      spokeIndex / spokeCount * Math.PI * 2 +
      randomBetween(random, -0.08, 0.08);
    const radiusMultiplier = randomBetween(random, 0.82, 1.18);
    const point = {
      x: centre.x + Math.cos(angle) * radiusX * radiusMultiplier,
      y: centre.y + Math.sin(angle) * radiusY * radiusMultiplier
    };

    perimeter.push(point);
    strands.push(createWebStrand({
      id: `structural-${spokeIndex}`,
      kind: WEB_STRAND_KINDS.STRUCTURAL,
      points: [hub, point],
      random,
      alphaMultiplier: randomBetween(random, 0.9, 1)
    }));
  }

  const ringCount = 5 + Math.floor(random() * 3);
  for (let ringIndex = 1; ringIndex <= ringCount; ringIndex += 1) {
    const fraction = ringIndex / ringCount;
    const jitter = radiusX * 0.018;
    const ring = perimeter.map((point) => {
      const base = lerpPoint(hub, point, fraction);
      return {
        x: base.x + randomBetween(random, -jitter, jitter),
        y: base.y + randomBetween(random, -jitter, jitter)
      };
    });

    const gapStart = Math.floor(random() * ring.length);
    const gapLength = random() < 0.45
      ? 1 + Math.floor(random() * 2)
      : 0;
    const openRing = [];

    for (let offset = gapLength; offset < ring.length; offset += 1) {
      openRing.push(ring[(gapStart + offset) % ring.length]);
    }
    if (gapLength === 0 && openRing.length > 0) openRing.push(openRing[0]);

    strands.push(createWebStrand({
      id: `capture-${ringIndex}`,
      kind: WEB_STRAND_KINDS.CAPTURE,
      points: openRing,
      random,
      alphaMultiplier: 1 - fraction * 0.18
    }));
  }

  if (random() < 0.7) {
    const perimeterPoint = perimeter[Math.floor(random() * perimeter.length)];
    const direction = {
      x: perimeterPoint.x - centre.x,
      y: perimeterPoint.y - centre.y
    };
    const length = Math.hypot(direction.x, direction.y) || 1;
    const looseEnd = {
      x: perimeterPoint.x + direction.x / length * radiusX * randomBetween(random, 0.12, 0.3),
      y: perimeterPoint.y + direction.y / length * radiusY * randomBetween(random, 0.12, 0.3)
    };

    strands.push(createWebStrand({
      id: "decorative-0",
      kind: WEB_STRAND_KINDS.DECORATIVE,
      points: [perimeterPoint, looseEnd],
      random
    }));
  }

  const sourceKey =
    `index-${index}`;

  return createWebBlueprint({
    id:
      createStableWebId({
        sceneId,
        populationId,
        levelId:
          level.id,
        kind:
          WEB_BLUEPRINT_KINDS.GROUND,
        sourceKey
      }),
    sceneId,
    populationId,
    populationLabel,
    thicknessMultiplier,
    levelProviderMode:
      level.providerMode,
    levelId:
      level.id,
    elevationBand:
      level.elevationBand,
    seed:
      generationSeed,
    sourceKey,
    kind:
      WEB_BLUEPRINT_KINDS.GROUND,
    hub,
    strands,
    perches: [{
      id: "hub",
      x: hub.x,
      y: hub.y,
      rotation
    }]
  });
}

function chooseCoordinate(random, minimum, maximum, margin) {
  const innerMinimum = minimum + margin;
  const innerMaximum = maximum - margin;
  if (innerMaximum <= innerMinimum) return (minimum + maximum) / 2;
  return randomBetween(random, innerMinimum, innerMaximum);
}
