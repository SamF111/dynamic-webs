import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

import {
  configureWebDisplayObject
} from "./webDrawingCompatibility.js";

import {
  applyWebCapturedAssetTransform
} from "./webCapturedAssetTransform.js";

const LOADED_ASSET_FALLBACK_ALPHA_MULTIPLIER =
  0.5;

/** Client-local loader for transient captured-web overlay assets. */
export class WebCapturedAssetTextureService {
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
  }

  createCapturedDisplay({
    pixi,
    presentation,
    fallbackDisplay = null,
    tint = 0xffffff,
    alphaMultiplier = 1
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
      `dynamic-webs.web-captured-asset.${String(presentation?.assetId ?? "unknown")}`;

    const cachedTexture =
      this.getTexture(
        source
      ) ??
      this.entries.get(
        source
      )?.texture ??
      null;

    const sprite =
      new pixi.Sprite(
        cachedTexture ??
        pixi.Texture?.EMPTY ??
        pixi.Texture?.WHITE ??
        null
      );

    configureWebDisplayObject(
      sprite
    );

    sprite.name =
      `${display.name}.sprite`;

    if (
      typeof sprite.anchor?.set ===
        "function"
    ) {
      sprite.anchor.set(
        0,
        0
      );
    }

    sprite.x =
      0;

    sprite.y =
      0;

    sprite.tint =
      normaliseTint(
        tint
      );

    sprite.alpha =
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

    sprite.visible =
      false;

    display.addChild(
      sprite
    );

    applyWebCapturedAssetTransform({
      pixi,
      displayObject:
        sprite,
      presentation
    });

    const fallbackInitialAlpha =
      resolveDisplayAlpha(
        fallbackDisplay
      );

    if (
      fallbackDisplay
    ) {
      fallbackDisplay.visible =
        true;

      fallbackDisplay.alpha =
        fallbackInitialAlpha;
    }

    const reveal =
      texture => {
        if (
          !texture ||
          display.destroyed ===
            true ||
          sprite.destroyed ===
            true
        ) {
          return false;
        }

        try {
          sprite.texture =
            texture;

          applyWebCapturedAssetTransform({
            pixi,
            displayObject:
              sprite,
            presentation,
            sourceDimensions:
              resolveTextureDimensions(
                texture,
                presentation
              )
          });

          sprite.visible =
            true;

          if (
            fallbackDisplay &&
            fallbackDisplay.destroyed !==
              true
          ) {
            /*
             * Retain a subdued procedural backing after the asynchronous WebP
             * resolves. A successfully loaded texture object does not prove
             * that its transparent pixels are perceptible in the current
             * Scene, and hiding the fallback caused captures to appear briefly
             * and then vanish. The asset remains authoritative above it.
             */
            fallbackDisplay.visible =
              true;

            fallbackDisplay.alpha =
              fallbackInitialAlpha *
              LOADED_ASSET_FALLBACK_ALPHA_MULTIPLIER;
          }

          display.dynamicWebsCapturedAssetLoaded =
            true;

          return true;
        } catch (error) {
          sprite.visible =
            false;

          if (
            fallbackDisplay &&
            fallbackDisplay.destroyed !==
              true
          ) {
            fallbackDisplay.visible =
              true;

            fallbackDisplay.alpha =
              fallbackInitialAlpha;
          }

          display.dynamicWebsCapturedAssetLoaded =
            false;

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

          return false;
        }
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

      reveal(
        cachedTexture
      );

      return display;
    }

    void this.#load(
      source,
      pixi
    ).then(
      reveal
    ).catch(
      () => {
        display.dynamicWebsCapturedAssetLoaded =
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
        this.lastFailure
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
        loaded => {
          const texture =
            normaliseLoadedTexture(
              loaded,
              pixi
            );

          if (!texture) {
            throw new Error(
              `${MODULE_TITLE} | Captured-web texture "${source}" could not be loaded.`
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
        error => {
          const current =
            this.entries.get(
              source
            );

          if (
            requestEpoch ===
              this.cacheEpoch &&
            current?.promise ===
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

function resolveDisplayAlpha(
  display
) {
  const alpha =
    Number(
      display?.alpha
    );

  return Number.isFinite(
    alpha
  )
    ? clamp(
        alpha,
        0,
        1
      )
    : 1;
}

function normaliseTint(
  value
) {
  const number =
    Number(
      value
    );

  return Number.isInteger(
    number
  ) &&
    number >=
      0 &&
    number <=
      0xffffff
    ? number
    : 0xffffff;
}

function normaliseUnitMultiplier(
  value
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? clamp(
        number,
        0,
        1
      )
    : 1;
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
      `${MODULE_TITLE} | Captured-web assets must use .webp paths.`
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
    `${MODULE_TITLE} | Foundry's canvas texture loader is unavailable for captured-web assets.`
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

function resolveTextureDimensions(
  texture,
  presentation
) {
  const width =
    firstPositiveNumber(
      texture?.orig?.width,
      texture?.frame?.width,
      texture?.width,
      texture?.baseTexture?.width,
      texture?.source?.width,
      presentation?.source?.widthPx
    );

  const height =
    firstPositiveNumber(
      texture?.orig?.height,
      texture?.frame?.height,
      texture?.height,
      texture?.baseTexture?.height,
      texture?.source?.height,
      presentation?.source?.heightPx
    );

  return Object.freeze({
    width,
    height
  });
}

function firstPositiveNumber(
  ...values
) {
  for (const value of values) {
    const number =
      Number(
        value
      );

    if (
      Number.isFinite(
        number
      ) &&
      number >
        0
    ) {
      return number;
    }
  }

  return 1;
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


