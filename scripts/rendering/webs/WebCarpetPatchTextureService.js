import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

import {
  configureWebDisplayObject
} from "./webDrawingCompatibility.js";

const MINIMUM_PATCH_THICKNESS_MULTIPLIER = 0.5;
const MAXIMUM_PATCH_THICKNESS_MULTIPLIER = 4;

/**
 * Apply one colour-matrix tint to an entire carpet patch container.
 *
 * All bundled patch assets are transparent white, so one web-level filter can
 * recolour every patch without relying on WebP Sprite tint behaviour. Keeping
 * the filter at the web container level also avoids one filter pass per patch.
 *
 * @returns {boolean} True when a colour filter was applied.
 */
export function configureWebCarpetColourFilter({
  pixi,
  displayObject,
  tint
}) {
  const numericTint =
    normaliseTint(
      tint
    );

  if (
    !displayObject ||
    numericTint ===
      null
  ) {
    return false;
  }

  const filter =
    createColourMatrixTintFilter(
      pixi,
      numericTint
    );

  if (!filter) {
    return false;
  }

  displayObject.filters =
    [
      filter
    ];

  displayObject.webCarpetTint =
    numericTint;

  return true;
}

/**
 * Client-local loader/cache for bundled web-carpet WebP assets.
 *
 * The service never uploads or persists generated files. Foundry's texture
 * loader remains the authoritative shared asset cache; this service only
 * deduplicates in-flight module requests and applies loaded textures to patch
 * displays.
 */
export class WebCarpetPatchTextureService {
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

  /**
   * Create one carpet patch display.
   *
   * The checked-in WebPs are transparent white. A colour-matrix filter is
   * preferred over Sprite tint because it reliably recolours alpha textures
   * across the PIXI versions used by Foundry v13 and v14. When that filter is
   * unavailable, ordinary Sprite tint remains as a compatibility fallback.
   *
   * Thickness is presentation-only. Additional locally offset copies of the
   * same immutable patch texture widen visible fibres without changing the
   * descriptor's centre, dimensions, rotation, mask, or deterministic recipe.
   */
  createPatchSprite({
    pixi,
    descriptor,
    tint,
    alphaMultiplier = 1,
    thicknessMultiplier = 1
  }) {
    if (
      !pixi ||
      typeof pixi.Sprite !==
        "function"
    ) {
      throw new Error(
        `${MODULE_TITLE} | PIXI.Sprite is required to render web-carpet patches.`
      );
    }

    const source =
      requireWebpPath(
        descriptor?.modulePath
      );

    const cachedTexture =
      this.getTexture(
        source
      ) ??
      this.entries.get(
        source
      )?.texture ??
      null;

    const texture =
      cachedTexture ??
      pixi.Texture?.EMPTY ??
      pixi.Texture?.WHITE;

    const patchDisplay =
      createPatchDisplay({
        pixi,
        descriptor,
        texture,
        tint,
        alphaMultiplier,
        thicknessMultiplier
      });

    if (cachedTexture) {
      this.cacheHitCount +=
        1;

      this.#rememberTexture(
        source,
        cachedTexture
      );

      return patchDisplay.display;
    }

    const promise =
      this.#load(
        source,
        pixi
      );

    void promise.then(
      (
        loadedTexture
      ) => {
        if (
          !loadedTexture ||
          patchDisplay.display.destroyed ===
            true
        ) {
          return;
        }

        for (
          const sprite of
          patchDisplay.sprites
        ) {
          if (
            sprite.destroyed !==
              true
          ) {
            sprite.texture =
              loadedTexture;
          }
        }

        applyPatchPresentation({
          pixi,
          display:
            patchDisplay.display,
          sprites:
            patchDisplay.sprites,
          descriptor,
          tint,
          alphaMultiplier,
          thicknessMultiplier,
          displayIsSprite:
            patchDisplay.displayIsSprite
        });
      }
    ).catch(
      () => {
        // #load records diagnostics. A missing patch remains transparent.
      }
    );

    return patchDisplay.display;
  }

  clear() {
    const clearedEntries =
      this.entries.size;

    this.entries.clear();

    this.cacheEpoch +=
      1;

    return clearedEntries >
      0;
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
        (
          loaded
        ) => {
          const loadedTexture =
            normaliseLoadedTexture(
              loaded,
              pixi
            );

          if (!loadedTexture) {
            throw new Error(
              `${MODULE_TITLE} | Bundled web-carpet texture "${source}" could not be loaded.`
            );
          }

          /**
           * A cache clear invalidates requests that were already in flight.
           * The old Promise may still resolve for a now-destroyed display, but
           * it must not silently repopulate the newly cleared module cache.
           */
          if (
            requestEpoch ===
              this.cacheEpoch
          ) {
            this.#rememberTexture(
              source,
              loadedTexture
            );
          }

          return loadedTexture;
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

function createPatchDisplay({
  pixi,
  descriptor,
  texture,
  tint,
  alphaMultiplier,
  thicknessMultiplier
}) {
  const canCreateLayeredDisplay =
    typeof pixi.Container ===
      "function";

  const display =
    canCreateLayeredDisplay
      ? new pixi.Container()
      : new pixi.Sprite(
          texture
        );

  configureWebDisplayObject(
    display
  );

  display.name =
    `dynamic-webs.web-carpet-patch.${String(descriptor?.id ?? "unknown")}`;

  const offsets =
    canCreateLayeredDisplay
      ? createThicknessLayerOffsets(
          thicknessMultiplier
        )
      : Object.freeze([
          Object.freeze({
            x:
              0,
            y:
              0,
            alpha:
              1
          })
        ]);

  const sprites =
    canCreateLayeredDisplay
      ? offsets.map(
          (
            offset,
            index
          ) => {
            const sprite =
              new pixi.Sprite(
                texture
              );

            configureWebDisplayObject(
              sprite
            );

            sprite.name =
              `${display.name}.layer-${index}`;

            display.addChild(
              sprite
            );

            return sprite;
          }
        )
      : [
          display
        ];

  applyPatchPresentation({
    pixi,
    display,
    sprites,
    descriptor,
    tint,
    alphaMultiplier,
    thicknessMultiplier,
    displayIsSprite:
      !canCreateLayeredDisplay,
    offsets
  });

  return {
    display,
    sprites,
    displayIsSprite:
      !canCreateLayeredDisplay
  };
}

function applyPatchPresentation({
  pixi,
  display,
  sprites,
  descriptor,
  tint,
  alphaMultiplier,
  thicknessMultiplier,
  displayIsSprite = false,
  offsets = createThicknessLayerOffsets(
    thicknessMultiplier
  )
}) {
  const width =
    Math.max(
      0.01,
      Number(
        descriptor?.width
      ) ||
      1
    );

  const height =
    Math.max(
      0.01,
      Number(
        descriptor?.height
      ) ||
      1
    );

  const resolvedThicknessMultiplier =
    normaliseThicknessMultiplier(
      thicknessMultiplier
    );

  const patchAlpha =
    clamp(
      (
        Number(
          descriptor?.alpha
        ) ||
        0
      ) *
      (
        Number.isFinite(
          Number(
            alphaMultiplier
          )
        )
          ? Number(
              alphaMultiplier
            )
          : 1
      ) *
      resolveThinPatchAlphaMultiplier(
        resolvedThicknessMultiplier
      ),
      0,
      1
    );

  applyDisplayTransform({
    display,
    descriptor,
    patchAlpha
  });

  for (
    const [
      index,
      sprite
    ] of sprites.entries()
  ) {
    const offset =
      offsets[index] ??
      offsets[0] ??
      {
        x:
          0,
        y:
          0,
        alpha:
          1
      };

    applySpriteLayer({
      sprite,
      width,
      height,
      offset,
      preserveDisplayPosition:
        displayIsSprite ===
        true &&
        sprite ===
        display
    });
  }

  applyPatchColour({
    sprites,
    tint
  });

  display.webCarpetTint =
    normaliseTint(
      tint
    );

  display.webCarpetThicknessMultiplier =
    resolvedThicknessMultiplier;

  display.webCarpetThicknessLayerCount =
    sprites.length;
}

function applyDisplayTransform({
  display,
  descriptor,
  patchAlpha
}) {
  display.x =
    Number(
      descriptor?.x
    ) ||
    0;

  display.y =
    Number(
      descriptor?.y
    ) ||
    0;

  display.rotation =
    (
      Number(
        descriptor?.rotation
      ) ||
      0
    ) *
    Math.PI /
    180;

  display.alpha =
    patchAlpha;

  if (
    display.scale
  ) {
    const absoluteScaleX =
      Math.abs(
        Number(
          display.scale.x
        ) ||
        1
      );

    const absoluteScaleY =
      Math.abs(
        Number(
          display.scale.y
        ) ||
        1
      );

    display.scale.x =
      descriptor?.flipX ===
        true
        ? -absoluteScaleX
        : absoluteScaleX;

    display.scale.y =
      descriptor?.flipY ===
        true
        ? -absoluteScaleY
        : absoluteScaleY;
  }
}

function applySpriteLayer({
  sprite,
  width,
  height,
  offset,
  preserveDisplayPosition = false
}) {
  if (
    typeof sprite.anchor?.set ===
      "function"
  ) {
    sprite.anchor.set(
      0.5,
      0.5
    );
  } else if (
    sprite.anchor
  ) {
    sprite.anchor.x =
      0.5;

    sprite.anchor.y =
      0.5;
  }

  if (
    preserveDisplayPosition !==
      true
  ) {
    sprite.x =
      Number(
        offset?.x
      ) ||
      0;

    sprite.y =
      Number(
        offset?.y
      ) ||
      0;
  }

  sprite.width =
    width;

  sprite.height =
    height;

  if (
    preserveDisplayPosition !==
      true
  ) {
    sprite.alpha =
      clamp(
        Number(
          offset?.alpha
        ) ||
        1,
        0,
        1
      );
  }
}

function applyPatchColour({
  sprites,
  tint
}) {
  const numericTint =
    normaliseTint(
      tint
    );

  if (
    numericTint ===
      null
  ) {
    return false;
  }

  for (
    const sprite of
    sprites
  ) {
    sprite.tint =
      numericTint;
  }

  return true;
}

function createColourMatrixTintFilter(
  pixi,
  numericTint
) {
  const FilterClass =
    pixi?.ColorMatrixFilter ??
    pixi?.filters?.ColorMatrixFilter ??
    null;

  if (
    typeof FilterClass !==
      "function"
  ) {
    return null;
  }

  try {
    const filter =
      new FilterClass();

    if (
      typeof filter.tint ===
        "function"
    ) {
      filter.tint(
        numericTint,
        false
      );

      return filter;
    }

    const red =
      (
        numericTint >>
        16
      ) /
      255;

    const green =
      (
        numericTint >>
        8 &
        0xff
      ) /
      255;

    const blue =
      (
        numericTint &
        0xff
      ) /
      255;

    if (
      "matrix" in
      filter
    ) {
      filter.matrix =
        [
          red, 0, 0, 0, 0,
          0, green, 0, 0, 0,
          0, 0, blue, 0, 0,
          0, 0, 0, 1, 0
        ];

      return filter;
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function createThicknessLayerOffsets(
  value
) {
  const thicknessMultiplier =
    normaliseThicknessMultiplier(
      value
    );

  if (
    thicknessMultiplier <=
      1
  ) {
    return Object.freeze([
      Object.freeze({
        x:
          0,
        y:
          0,
        alpha:
          1
      })
    ]);
  }

  const outerRadius =
    Math.min(
      3,
      Math.max(
        0.25,
        (
          thicknessMultiplier -
          1
        ) *
        1.05
      )
    );

  const offsets =
    [
      {
        x:
          0,
        y:
          0,
        alpha:
          1
      }
    ];

  const outerAlpha =
    clamp(
      0.22 +
      (
        thicknessMultiplier -
        1
      ) *
      0.08,
      0.22,
      0.46
    );

  for (
    let index = 0;
    index <
      4;
    index +=
      1
  ) {
    const angle =
      index *
      Math.PI /
      2;

    offsets.push({
      x:
        Math.cos(
          angle
        ) *
        outerRadius,
      y:
        Math.sin(
          angle
        ) *
        outerRadius,
      alpha:
        outerAlpha
    });
  }

  if (
    thicknessMultiplier >=
      2.5
  ) {
    const innerRadius =
      outerRadius *
      0.72;

    const innerAlpha =
      clamp(
        outerAlpha +
        0.05,
        0.28,
        0.5
      );

    for (
      let index = 0;
      index <
        4;
      index +=
        1
    ) {
      const angle =
        index *
        Math.PI /
        2 +
        Math.PI /
        4;

      offsets.push({
        x:
          Math.cos(
            angle
          ) *
          innerRadius,
        y:
          Math.sin(
            angle
          ) *
          innerRadius,
        alpha:
          innerAlpha
      });
    }
  }

  return Object.freeze(
    offsets.map(
      Object.freeze
    )
  );
}

function resolveThinPatchAlphaMultiplier(
  thicknessMultiplier
) {
  if (
    thicknessMultiplier >=
      1
  ) {
    return 1;
  }

  return 0.1 +
    thicknessMultiplier *
    0.9;
}

function normaliseThicknessMultiplier(
  value
) {
  const numericValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return 1;
  }

  return clamp(
    numericValue,
    MINIMUM_PATCH_THICKNESS_MULTIPLIER,
    MAXIMUM_PATCH_THICKNESS_MULTIPLIER
  );
}

function normaliseTint(
  value
) {
  const numericTint =
    Number(
      value
    );

  return Number.isInteger(
    numericTint
  ) &&
    numericTint >=
      0 &&
    numericTint <=
      0xffffff
    ? numericTint
    : null;
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

function getFoundryTexture(
  source
) {
  const namespaced =
    globalThis.foundry?.canvas?.getTexture;

  if (
    typeof namespaced ===
      "function"
  ) {
    try {
      return namespaced(
        source
      );
    } catch (_error) {
      return null;
    }
  }

  return null;
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
    `${MODULE_TITLE} | Foundry's namespaced canvas texture loader is unavailable.`
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
      `${MODULE_TITLE} | Web-carpet patch assets must use .webp paths.`
    );
  }

  return source;
}
