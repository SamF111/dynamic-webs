import {
  createSeededRandom
} from "../../util/seededRandom.js";

import {
  WEB_CARPET_ASSET_MANIFEST,
  WEB_CARPET_ASSETS
} from "../../data/webCarpetAssetManifest.js";

import {
  calculateWebRegionRecordBounds,
  isPointInsideWebRegionRecord
} from "../../foundry/webRegionCompatibility.js";

import {
  WEB_BLUEPRINT_KINDS,
  createStableWebId
} from "./webBlueprintContract.js";

import {
  createWebBlueprint,
  randomBetween
} from "./webGeometry.js";

/**
 * Generate deterministic Region-owned visual web carpets from bundled WebP
 * patch assets. Carpet patches are presentation descriptors, not PIXI objects.
 */
export class WebCarpetPatchGenerator {
  generate({
    sceneId,
    populationId = "default",
    populationLabel = "Default Web Population",
    thicknessMultiplier = 1,
    level,
    gridSize,
    generationSeed,
    configuration,
    random,
    regionRestriction = null
  }) {
    if (
      configuration?.enabled !==
        true ||
      typeof random !==
        "function" ||
      !Number.isFinite(
        Number(
          gridSize
        )
      ) ||
      Number(
        gridSize
      ) <=
        0
    ) {
      return Object.freeze([]);
    }

    /**
     * Carpets are intentionally Region-owned. A population with no matching
     * Confine Region produces no carpet rather than stretching one texture
     * across the complete Scene.
     */
    const confineRegions =
      Array.isArray(
        regionRestriction?.confineRegions
      )
        ? [...regionRestriction.confineRegions]
            .sort(
              (
                first,
                second
              ) =>
                String(
                  first?.id ??
                  ""
                ).localeCompare(
                  String(
                    second?.id ??
                    ""
                  )
                )
            )
        : [];

    if (
      confineRegions.length ===
        0
    ) {
      return Object.freeze([]);
    }

    const excludeRegions =
      Array.isArray(
        regionRestriction?.excludeRegions
      )
        ? regionRestriction.excludeRegions
        : [];

    const webs =
      [];

    for (
      const region of
      confineRegions
    ) {
      const bounds =
        calculateWebRegionRecordBounds(
          region
        );

      if (
        !bounds ||
        bounds.width <=
          0 ||
        bounds.height <=
          0
      ) {
        continue;
      }

      const overlappingExcludeRegions =
        excludeRegions.filter(
          (
            excludeRegion
          ) => {
            const excludeBounds =
              calculateWebRegionRecordBounds(
                excludeRegion
              );

            return excludeBounds &&
              boundsOverlap(
                bounds,
                excludeBounds
              );
          }
        );

      const patchCount =
        resolvePatchCount({
          bounds,
          gridSize:
            Number(
              gridSize
            ),
          configuration
        });

      if (
        patchCount <=
          0
      ) {
        continue;
      }

      const sourceKey =
        `region-${String(region.id)}`;

      const webId =
        createStableWebId({
          sceneId,
          populationId,
          levelId:
            level.id,
          kind:
            WEB_BLUEPRINT_KINDS.WEB_CARPET,
          sourceKey
        });

      /**
       * Isolate every Region from category-local changes in neighbouring
       * Regions. Changing one Region's area or patch count must not reshuffle
       * the reusable assets selected for another Region.
       */
      const regionRandom =
        createSeededRandom(
          [
            String(
              generationSeed ??
              "dynamic-webs:web-carpet"
            ),
            encodeURIComponent(
              String(
                region.id
              )
            )
          ].join(
            ":"
          )
        );

      const patches =
        createPatchDescriptors({
          webId,
          targetRegion:
            region,
          excludeRegions:
            overlappingExcludeRegions,
          bounds,
          gridSize:
            Number(
              gridSize
            ),
          patchCount,
          configuration,
          random:
            regionRandom,
          elevation:
            resolveContainmentElevation(
              level
            )
        });

      if (
        patches.length ===
          0
      ) {
        continue;
      }

      const hub =
        {
          x:
            patches[0].x,
          y:
            patches[0].y
        };

      webs.push(
        createWebBlueprint({
          id:
            webId,
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
            WEB_BLUEPRINT_KINDS.WEB_CARPET,
          hub,
          bounds,
          strands:
            [],
          perches:
            [],
          supportingWallIds:
            [],
          regionIds:
            [region.id],
          regionTags:
            region.tags ??
            [],
          carpet: {
            assetManifestSchemaVersion:
              WEB_CARPET_ASSET_MANIFEST.schemaVersion,
            assetGeneratorVersion:
              WEB_CARPET_ASSET_MANIFEST.generator.version,
            regionId:
              String(
                region.id
              ),
            patches,
            mask:
              createCarpetMask({
                webId,
                bounds,
                resolutionPx:
                  configuration.maskResolutionPx,
                confineShapes:
                  region.maskShapes ??
                  region.shapes ??
                  [],
                excludeShapes:
                  overlappingExcludeRegions.flatMap(
                    (
                      excludeRegion
                    ) =>
                      excludeRegion.maskShapes ??
                      excludeRegion.shapes ??
                      []
                  )
              })
          }
        })
      );
    }

    return Object.freeze(
      webs
    );
  }
}

function resolvePatchCount({
  bounds,
  gridSize,
  configuration
}) {
  const areaInGridSquares =
    bounds.width *
    bounds.height /
    (
      gridSize *
      gridSize
    );

  const estimated =
    Math.round(
      areaInGridSquares *
      Number(
        configuration.patchesPerGridSquare
      )
    );

  return Math.max(
    Number(
      configuration.minimumPatchCountPerRegion
    ),
    Math.min(
      Number(
        configuration.maximumPatchCountPerRegion
      ),
      estimated
    )
  );
}

function createPatchDescriptors({
  webId,
  targetRegion,
  excludeRegions,
  bounds,
  gridSize,
  patchCount,
  configuration,
  random,
  elevation
}) {
  const patches =
    [];

  const centres =
    [];

  const minimumSeparationPx =
    Number(
      configuration.minimumPatchSeparationGridUnits
    ) *
    gridSize;

  const attemptsPerPatch =
    Math.max(
      1,
      Math.trunc(
        Number(
          configuration.placementAttemptsPerPatch
        )
      )
    );

  for (
    let patchIndex = 0;
    patchIndex <
      patchCount;
    patchIndex +=
      1
  ) {
    let centre =
      null;

    for (
      let attempt = 0;
      attempt <
        attemptsPerPatch;
      attempt +=
        1
    ) {
      const candidate =
        {
          x:
            randomBetween(
              random,
              bounds.x,
              bounds.right
            ),
          y:
            randomBetween(
              random,
              bounds.y,
              bounds.bottom
            )
        };

      if (
        !isPointInsideWebRegionRecord(
          targetRegion,
          candidate.x,
          candidate.y,
          {
            elevation
          }
        )
      ) {
        continue;
      }

      if (
        excludeRegions.some(
          (
            region
          ) =>
            isPointInsideWebRegionRecord(
              region,
              candidate.x,
              candidate.y,
              {
                elevation
              }
            )
        )
      ) {
        continue;
      }

      const relaxedSeparation =
        attempt <
          Math.floor(
            attemptsPerPatch *
            0.65
          )
          ? minimumSeparationPx
          : minimumSeparationPx *
            0.45;

      if (
        centres.some(
          (
            existing
          ) =>
            Math.hypot(
              existing.x -
                candidate.x,
              existing.y -
                candidate.y
            ) <
              relaxedSeparation
        )
      ) {
        continue;
      }

      centre =
        candidate;

      break;
    }

    if (!centre) {
      continue;
    }

    centres.push(
      centre
    );

    const asset =
      chooseWeightedAsset(
        random
      );

    const scale =
      randomBetween(
        random,
        asset.recommendedScale[0],
        asset.recommendedScale[1]
      );

    const baseSize =
      Number(
        configuration.basePatchSizeGridUnits
      ) *
      gridSize *
      scale;

    const aspectJitter =
      randomBetween(
        random,
        0.9,
        1.1
      );

    patches.push(
      Object.freeze({
        id:
          `${webId}:patch-${patchIndex}`,
        assetId:
          asset.id,
        category:
          asset.category,
        modulePath:
          asset.modulePath,
        x:
          centre.x,
        y:
          centre.y,
        width:
          baseSize *
          aspectJitter,
        height:
          baseSize /
          aspectJitter,
        rotation:
          asset.allowRotation
            ? randomBetween(
                random,
                -180,
                180
              )
            : 0,
        alpha:
          randomBetween(
            random,
            asset.recommendedAlpha[0],
            asset.recommendedAlpha[1]
          ),
        flipX:
          asset.allowFlipX &&
          random() <
            0.5,
        flipY:
          asset.allowFlipY &&
          random() <
            0.5
      })
    );
  }

  return Object.freeze(
    patches
  );
}

function chooseWeightedAsset(
  random
) {
  const totalWeight =
    WEB_CARPET_ASSETS.reduce(
      (
        total,
        asset
      ) =>
        total +
        asset.weight,
      0
    );

  let target =
    random() *
    totalWeight;

  for (
    const asset of
    WEB_CARPET_ASSETS
  ) {
    target -=
      asset.weight;

    if (
      target <=
        0
    ) {
      return asset;
    }
  }

  return WEB_CARPET_ASSETS.at(
    -1
  );
}

function createCarpetMask({
  webId,
  bounds,
  resolutionPx,
  confineShapes,
  excludeShapes
}) {
  const payload =
    {
      bounds,
      resolutionPx,
      confineShapes,
      excludeShapes
    };

  return {
    cacheKey:
      `${webId}:mask-${hashText(JSON.stringify(payload))}`,
    ...payload
  };
}

function hashText(
  text
) {
  let hash =
    0x811c9dc5;

  for (
    let index = 0;
    index <
      text.length;
    index +=
      1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        0x01000193
      ) >>>
      0;
  }

  return hash.toString(
    16
  ).padStart(
    8,
    "0"
  );
}

function resolveContainmentElevation(
  level
) {
  for (
    const value of
    [
      level?.elevationBand?.bottom,
      level?.elevationBand?.top,
      0
    ]
  ) {
    const number =
      Number(
        value
      );

    if (
      value !==
        null &&
      value !==
        undefined &&
      value !==
        "" &&
      Number.isFinite(
        number
      )
    ) {
      return number;
    }
  }

  return 0;
}

function boundsOverlap(
  first,
  second
) {
  return first.x <=
    second.right &&
    second.x <=
      first.right &&
    first.y <=
      second.bottom &&
    second.y <=
      first.bottom;
}

