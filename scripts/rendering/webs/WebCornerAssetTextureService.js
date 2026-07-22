import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

import {
  configureWebDisplayObject
} from "./webDrawingCompatibility.js";

import {
  configureWebCarpetColourFilter
} from "./WebCarpetPatchTextureService.js";

import {
  applyWebCornerAssetAffineTransform
} from "./webCornerAssetTransform.js";

import {
  createWebCornerAssetDilationFilter,
  resolveWebCornerAssetDilation
} from "./webCornerAssetDilationFilter.js";

/**
 * Client-local texture loader for deterministic corner-web WebP assets.
 *
 * The procedural Graphics display remains visible until the asset is loaded.
 * A failed or absent texture therefore preserves the existing visual rather
 * than leaving a generated web invisible. Discrete thickness levels retain one
 * crisp sprite and add at most one alpha-dilated fringe underlay; the previous
 * directional offset-copy blur is deliberately not used.
 */
export class WebCornerAssetTextureService {
  constructor({
    loadTexture =
      loadFoundryTexture,
    getTexture =
      getFoundryTexture
  } = {}) {
    this.loadTexture =
      loadTexture;

    this.getTexture =
      getTexture;

    this.entries =
      new Map();

    this.cacheEpoch =
      0;

    this.loadCount =
      0;

    this.cacheHitCount =
      0;

    this.failureCount =
      0;

    this.lastFailure =
      null;

    this.dilationRequestCount =
      0;

    this.dilationFilterCount =
      0;

    this.dilationFallbackCount =
      0;

    this.lastDilationFailure =
      null;
  }

  createCornerDisplay({
    pixi,
    presentation,
    fallbackDisplay,
    tint,
    alphaMultiplier = 1,
    thicknessMultiplier = 1
  }) {
    if (
      !pixi ||
      typeof pixi.Container !==
        "function" ||
      typeof pixi.Sprite !==
        "function"
    ) {
      return null;
    }

    const source =
      requireWebpPath(
        presentation?.modulePath
      );

    const display =
      new pixi.Container();

    configureWebDisplayObject(
      display
    );

    display.name =
      `dynamic-webs.web-corner-asset.${String(presentation?.assetId ?? "unknown")}`;

    display.sortableChildren =
      true;

    const assetLayers =
      new pixi.Container();

    configureWebDisplayObject(
      assetLayers
    );

    assetLayers.name =
      `${display.name}.layers`;

    assetLayers.visible =
      false;

    assetLayers.sortableChildren =
      true;

    const cachedTexture =
      this.getTexture(
        source
      ) ??
      this.entries.get(
        source
      )?.texture ??
      null;

    const initialTexture =
      cachedTexture ??
      pixi.Texture?.EMPTY ??
      pixi.Texture?.WHITE ??
      null;

    const dilation =
      resolveWebCornerAssetDilation(
        thicknessMultiplier
      );

    const sprites =
      [];

    let dilationFilter =
      null;

    if (
      dilation.enabled
    ) {
      this.dilationRequestCount +=
        1;

      dilationFilter =
        createWebCornerAssetDilationFilter({
          pixi,
          radiusPx:
            dilation.radiusPx,
          strength:
            dilation.strength
        });

      if (
        dilationFilter
      ) {
        this.dilationFilterCount +=
          1;

        const underlay =
          createCornerAssetSprite({
            pixi,
            texture:
              initialTexture,
            name:
              `${assetLayers.name}.dilation`,
            zIndex:
              0,
            filter:
              dilationFilter
          });

        assetLayers.addChild(
          underlay
        );

        sprites.push(
          underlay
        );
      } else {
        this.dilationFallbackCount +=
          1;

        this.lastDilationFailure =
          Object.freeze({
            assetId:
              String(
                presentation?.assetId ??
                ""
              ),
            source,
            thicknessMultiplier:
              Math.max(
                1,
                Math.min(
                  4,
                  Math.round(
                    Number(
                      thicknessMultiplier
                    ) ||
                    1
                  )
                )
              ),
            reason:
              "PIXI custom-filter support is unavailable; the crisp asset remains visible without dilation."
          });
      }
    }

    const crispSprite =
      createCornerAssetSprite({
        pixi,
        texture:
          initialTexture,
        name:
          `${assetLayers.name}.crisp`,
        zIndex:
          1
      });

    assetLayers.addChild(
      crispSprite
    );

    sprites.push(
      crispSprite
    );

    const numericTint =
      normaliseTint(
        tint
      );

    const filterApplied =
      configureWebCarpetColourFilter({
        pixi,
        displayObject:
          assetLayers,
        tint:
          numericTint
      });

    if (
      !filterApplied &&
      numericTint !==
        null
    ) {
      for (
        const sprite of
        sprites
      ) {
        sprite.tint =
          numericTint;
      }
    }

    assetLayers.alpha =
      clamp(
        (
          Number(
            presentation?.alpha
          ) ||
          1
        ) *
        normaliseUnitMultiplier(
          alphaMultiplier
        ),
        0,
        1
      );

    if (
      fallbackDisplay
    ) {
      fallbackDisplay.visible =
        true;
    }

    display.addChild(
      assetLayers
    );

    applyWebCornerAssetAffineTransform({
      pixi,
      displayObject:
        assetLayers,
      presentation
    });

    display.dynamicWebsCornerAssetId =
      String(
        presentation?.assetId ??
        ""
      );

    display.dynamicWebsCornerAssetPath =
      source;

    display.dynamicWebsCornerAssetFallback =
      fallbackDisplay ??
      null;

    display.dynamicWebsCornerAssetDilation =
      Object.freeze({
        requested:
          dilation.enabled,
        applied:
          Boolean(
            dilationFilter
          ),
        radiusPx:
          dilation.radiusPx,
        strength:
          dilation.strength,
        implementation:
          dilationFilter?.dynamicWebsDilationImplementation ??
          null
      });

    const revealAsset =
      texture => {
        if (
          !texture ||
          display.destroyed ===
            true ||
          assetLayers.destroyed ===
            true
        ) {
          return;
        }

        for (
          const sprite of
          sprites
        ) {
          if (
            sprite.destroyed !==
              true
          ) {
            sprite.texture =
              texture;

            sprite.width =
              1;

            sprite.height =
              1;
          }
        }

        assetLayers.visible =
          true;

        if (
          fallbackDisplay &&
          fallbackDisplay.destroyed !==
            true
        ) {
          fallbackDisplay.visible =
            false;
        }

        display.dynamicWebsCornerAssetLoaded =
          true;
      };

    if (
      cachedTexture
    ) {
      this.cacheHitCount +=
        1;

      this.#rememberTexture(
        source,
        cachedTexture
      );

      revealAsset(
        cachedTexture
      );

      return display;
    }

    void this.#load(
      source,
      pixi
    ).then(
      revealAsset
    ).catch(
      () => {
        display.dynamicWebsCornerAssetLoaded =
          false;
      }
    );

    return display;
  }

  clear() {
    const hadEntries =
      this.entries.size >
      0;

    this.entries.clear();

    this.cacheEpoch +=
      1;

    return hadEntries;
  }

  createDiagnosticSnapshot() {
    let loadedCount =
      0;

    let pendingCount =
      0;

    for (
      const entry of
      this.entries.values()
    ) {
      if (
        entry.texture
      ) {
        loadedCount +=
          1;
      } else if (
        entry.promise
      ) {
        pendingCount +=
          1;
      }
    }

    return Object.freeze({
      cacheEpoch:
        this.cacheEpoch,
      entryCount:
        this.entries.size,
      loadedCount,
      pendingCount,
      loadCount:
        this.loadCount,
      cacheHitCount:
        this.cacheHitCount,
      failureCount:
        this.failureCount,
      lastFailure:
        this.lastFailure,
      dilationRequestCount:
        this.dilationRequestCount,
      dilationFilterCount:
        this.dilationFilterCount,
      dilationFallbackCount:
        this.dilationFallbackCount,
      lastDilationFailure:
        this.lastDilationFailure
    });
  }

  #load(
    source,
    pixi
  ) {
    const existing =
      this.entries.get(
        source
      );

    if (
      existing?.texture
    ) {
      this.cacheHitCount +=
        1;

      return Promise.resolve(
        existing.texture
      );
    }

    if (
      existing?.promise
    ) {
      this.cacheHitCount +=
        1;

      return existing.promise;
    }

    this.loadCount +=
      1;

    const requestEpoch =
      this.cacheEpoch;

    let promise;

    promise =
      Promise.resolve(
        this.loadTexture(
          source
        )
      ).then(
        (
          loaded
        ) => {
          const texture =
            normaliseLoadedTexture(
              loaded,
              pixi
            );

          if (!texture) {
            throw new Error(
              `${MODULE_TITLE} | Corner-web texture "${source}" could not be loaded.`
            );
          }

          if (
            requestEpoch ===
              this.cacheEpoch
          ) {
            this.#rememberTexture(
              source,
              texture
            );
          }

          return texture;
        }
      ).catch(
        (
          error
        ) => {
          const currentEntry =
            this.entries.get(
              source
            );

          if (
            requestEpoch ===
              this.cacheEpoch &&
            currentEntry?.promise ===
              promise
          ) {
            this.entries.delete(
              source
            );
          }

          this.failureCount +=
            1;

          this.lastFailure =
            Object.freeze({
              source,
              name:
                String(
                  error?.name ??
                  "Error"
                ),
              message:
                String(
                  error?.message ??
                  error
                )
            });

          throw error;
        }
      );

    this.entries.set(
      source,
      {
        texture:
          null,
        promise
      }
    );

    return promise;
  }

  #rememberTexture(
    source,
    texture
  ) {
    this.entries.set(
      source,
      {
        texture,
        promise:
          Promise.resolve(
            texture
          )
      }
    );
  }
}

function createCornerAssetSprite({
  pixi,
  texture,
  name,
  zIndex,
  filter = null
}) {
  const sprite =
    new pixi.Sprite(
      texture
    );

  configureWebDisplayObject(
    sprite
  );

  sprite.name =
    name;

  sprite.zIndex =
    zIndex;

  if (
    typeof sprite.anchor?.set ===
      "function"
  ) {
    sprite.anchor.set(
      0,
      0
    );
  } else if (
    sprite.anchor
  ) {
    sprite.anchor.x =
      0;

    sprite.anchor.y =
      0;
  }

  sprite.x =
    0;

  sprite.y =
    0;

  sprite.width =
    1;

  sprite.height =
    1;

  sprite.alpha =
    1;

  if (
    filter
  ) {
    sprite.filters =
      [
        filter
      ];
  }

  return sprite;
}

function normaliseUnitMultiplier(
  value
) {
  const numericValue =
    Number(
      value
    );

  return Number.isFinite(
    numericValue
  )
    ? clamp(
        numericValue,
        0,
        1
      )
    : 1;
}

function normaliseTint(
  value
) {
  const numericValue =
    Number(
      value
    );

  return Number.isInteger(
    numericValue
  ) &&
    numericValue >=
      0 &&
    numericValue <=
      0xffffff
    ? numericValue
    : null;
}

function requireWebpPath(
  value
) {
  const source =
    String(
      value ??
      ""
    ).trim();

  if (
    !source.toLowerCase().endsWith(
      ".webp"
    )
  ) {
    throw new Error(
      `${MODULE_TITLE} | Corner-web assets must use .webp paths.`
    );
  }

  return source;
}

function getFoundryTexture(
  source
) {
  const getter =
    globalThis.foundry?.canvas?.getTexture;

  if (
    typeof getter !==
      "function"
  ) {
    return null;
  }

  try {
    return getter(
      source
    );
  } catch (_error) {
    return null;
  }
}

function loadFoundryTexture(
  source
) {
  const namespaced =
    globalThis.foundry?.canvas?.loadTexture;

  if (
    typeof namespaced ===
      "function"
  ) {
    return namespaced(
      source
    );
  }

  const loader =
    globalThis.foundry?.canvas?.TextureLoader?.loader;

  if (
    typeof loader?.loadTexture ===
      "function"
  ) {
    return loader.loadTexture(
      source
    );
  }

  throw new Error(
    `${MODULE_TITLE} | Foundry's canvas texture loader is unavailable for corner-web assets.`
  );
}

function normaliseLoadedTexture(
  loaded,
  pixi
) {
  if (!loaded) {
    return null;
  }

  if (
    loaded.texture &&
    typeof loaded.texture ===
      "object"
  ) {
    return loaded.texture;
  }

  if (
    loaded.baseTexture ||
    loaded.source
  ) {
    return loaded;
  }

  if (
    typeof pixi?.Texture ===
      "function"
  ) {
    try {
      return new pixi.Texture(
        loaded
      );
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function clamp(
  value,
  minimum,
  maximum
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value
    )
  );
}

