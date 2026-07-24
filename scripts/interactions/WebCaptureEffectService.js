import {
  DEFAULT_WEB_RENDER_LAYER_MODE,
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  resolveCanvasParentForWebLayer,
  resolveWebPrimarySortLayer,
  requirePixi
} from "../foundry/displayCompatibility.js";

import {
  createWebCapturedAssetPresentation
} from "../data/webCapturedAssetCatalog.js";

import {
  WebCapturedAssetTextureService
} from "../rendering/webs/WebCapturedAssetTextureService.js";

import {
  configureWebDisplayObject,
  drawWebPolyline
} from "../rendering/webs/webDrawingCompatibility.js";

import {
  WEB_CAPTURE_HOOKS
} from "./webInteractionContract.js";

const CAPTURE_SORT_LAYER_OFFSET =
  10;

/**
 * Client-local transient captured-web presentation state.
 *
 * Captures are not deterministic Scene geometry, are not persisted and are not
 * socket-synchronised. Consumer modules decide when every client should show
 * or remove them.
 */
export class WebCaptureEffectService {
  constructor({
    textureService =
      null
  } = {}) {
    this.textureService =
      textureService instanceof
        WebCapturedAssetTextureService
        ? textureService
        : new WebCapturedAssetTextureService();

    this.sceneId =
      null;

    this.visibleLevelIds =
      new Set();

    this.captures =
      new Map();

    this.displaysByCaptureId =
      new Map();

    this.containersByElevation =
      new Map();

    this.revision =
      0;

    this.lastMutation =
      null;
  }

  synchroniseContext({
    sceneId,
    visibleLevelIds = []
  } = {}) {
    const nextSceneId =
      normaliseOptionalIdentifier(
        sceneId
      );

    const enteringScene =
      this.sceneId !==
      nextSceneId;

    if (
      enteringScene
    ) {
      this.clear({
        emitHook:
          false,
        clearTextureCache:
          false,
        reason:
          "scene-context-change"
      });

      this.sceneId =
        nextSceneId;
    }

    this.visibleLevelIds =
      new Set(
        normaliseIdentifierList(
          visibleLevelIds
        )
      );

    this.#rebuildVisibleDisplays();

    return this.createSnapshot();
  }

  show(
    request
  ) {
    const captureId =
      resolveRequestedCaptureId(
        request
      );

    const descriptor =
      createCaptureDescriptor({
        request,
        captureId,
        sceneId:
          this.sceneId,
        previous:
          this.captures.get(
            captureId
          ) ??
          null
      });

    this.#removeDisplay(
      descriptor.captureId
    );

    this.captures.set(
      descriptor.captureId,
      descriptor
    );

    if (
      this.#isCaptureVisible(
        descriptor
      )
    ) {
      this.#renderDescriptor(
        descriptor
      );
    }

    this.revision +=
      1;

    this.lastMutation =
      deepFreeze({
        action:
          "show",
        captureIds:
          [
            descriptor.captureId
          ],
        entityId:
          descriptor.entityId,
        at:
          Date.now()
      });

    emitHook(
      WEB_CAPTURE_HOOKS.SHOWN,
      descriptor
    );

    return descriptor;
  }

  remove(
    captureId,
    {
      emitHook =
        true,
      reason =
        "public-api-remove-capture"
    } = {}
  ) {
    const identifier =
      requireIdentifier(
        captureId,
        "capture ID"
      );

    const descriptor =
      this.captures.get(
        identifier
      ) ??
      null;

    if (!descriptor) {
      return false;
    }

    this.#removeDisplay(
      identifier
    );

    this.captures.delete(
      identifier
    );

    this.revision +=
      1;

    this.lastMutation =
      deepFreeze({
        action:
          "remove",
        captureIds:
          [
            identifier
          ],
        entityId:
          descriptor.entityId,
        reason:
          normaliseOptionalIdentifier(
            reason
          ),
        at:
          Date.now()
      });

    if (
      emitHook
    ) {
      emitHookSafely(
        WEB_CAPTURE_HOOKS.REMOVED,
        descriptor,
        this.lastMutation
      );
    }

    return true;
  }

  clearByEntity(
    entityId,
    {
      sourceModuleId =
        null,
      entityType =
        null,
      reason =
        "public-api-clear-entity-captures"
    } = {}
  ) {
    const identifier =
      requireIdentifier(
        entityId,
        "entity ID"
      );

    const expectedSourceModuleId =
      normaliseOptionalIdentifier(
        sourceModuleId
      );

    const expectedEntityType =
      normaliseOptionalIdentifier(
        entityType
      );

    const captureIds =
      Array.from(
        this.captures.values()
      )
        .filter(
          descriptor =>
            descriptor.entityId ===
              identifier &&
            (
              !expectedSourceModuleId ||
              descriptor.sourceModuleId ===
                expectedSourceModuleId
            ) &&
            (
              !expectedEntityType ||
              descriptor.entityType ===
                expectedEntityType
            )
        )
        .map(
          descriptor =>
            descriptor.captureId
        )
        .sort();

    for (
      const captureId of
      captureIds
    ) {
      this.remove(
        captureId,
        {
          emitHook:
            false,
          reason
        }
      );
    }

    if (
      captureIds.length >
      0
    ) {
      emitHookSafely(
        WEB_CAPTURE_HOOKS.CLEARED,
        deepFreeze({
          entityId:
            identifier,
          captureIds,
          reason
        })
      );
    }

    return Object.freeze(
      captureIds
    );
  }

  clear({
    emitHook =
      true,
    clearTextureCache =
      false,
    resetContext =
      false,
    reason =
      "clear-captured-webs"
  } = {}) {
    const captureIds =
      Array.from(
        this.captures.keys()
      ).sort();

    for (
      const captureId of
      captureIds
    ) {
      this.#removeDisplay(
        captureId
      );
    }

    this.captures.clear();

    this.#destroyContainers();

    if (
      clearTextureCache
    ) {
      this.textureService.clear();
    }

    if (
      resetContext ===
        true
    ) {
      this.sceneId =
        null;

      this.visibleLevelIds.clear();
    }

    if (
      captureIds.length >
      0
    ) {
      this.revision +=
        1;

      this.lastMutation =
        deepFreeze({
          action:
            "clear",
          captureIds,
          reason:
            normaliseOptionalIdentifier(
              reason
            ),
          at:
            Date.now()
        });

      if (
        emitHook
      ) {
        emitHookSafely(
          WEB_CAPTURE_HOOKS.CLEARED,
          this.lastMutation
        );
      }
    }

    return captureIds.length >
      0;
  }

  getCapture(
    captureId
  ) {
    const identifier =
      normaliseOptionalIdentifier(
        captureId
      );

    return identifier
      ? this.captures.get(
          identifier
        ) ??
        null
      : null;
  }

  createSnapshot() {
    const captures =
      Array.from(
        this.captures.values()
      ).sort(
        (
          first,
          second
        ) =>
          first.captureId.localeCompare(
            second.captureId
          )
      );

    return deepFreeze({
      sceneId:
        this.sceneId,
      revision:
        this.revision,
      captureCount:
        captures.length,
      visibleCaptureCount:
        this.displaysByCaptureId.size,
      containerCount:
        this.containersByElevation.size,
      visibleLevelIds:
        Array.from(
          this.visibleLevelIds
        ).sort(),
      captures,
      textures:
        this.textureService.createDiagnosticSnapshot(),
      lastMutation:
        this.lastMutation
    });
  }

  #isCaptureVisible(
    descriptor
  ) {
    if (
      descriptor.sceneId !==
      this.sceneId
    ) {
      return false;
    }

    return !descriptor.levelId ||
      this.visibleLevelIds.size ===
        0 ||
      this.visibleLevelIds.has(
        descriptor.levelId
      );
  }

  #rebuildVisibleDisplays() {
    for (
      const captureId of
      Array.from(
        this.displaysByCaptureId.keys()
      )
    ) {
      this.#removeDisplay(
        captureId
      );
    }

    this.#destroyContainers();

    for (
      const descriptor of
      Array.from(
        this.captures.values()
      ).sort(
        (
          first,
          second
        ) =>
          first.captureId.localeCompare(
            second.captureId
          )
      )
    ) {
      if (
        this.#isCaptureVisible(
          descriptor
        )
      ) {
        this.#renderDescriptor(
          descriptor
        );
      }
    }
  }

  #renderDescriptor(
    descriptor
  ) {
    if (
      !globalThis.canvas?.ready
    ) {
      return false;
    }

    const pixi =
      requirePixi();

    const parent =
      resolveCanvasParentForWebLayer(
        DEFAULT_WEB_RENDER_LAYER_MODE
      );

    if (!parent) {
      return false;
    }

    const elevation =
      resolveCaptureElevation(
        descriptor
      );

    const container =
      this.#requireContainer({
        pixi,
        parent,
        elevation
      });

    const display =
      new pixi.Container();

    configureWebDisplayObject(
      display
    );

    display.name =
      `${MODULE_ID}.capture.${descriptor.captureId}`;

    display.elevation =
      elevation;

    display.zIndex =
      0;

    display.sortableChildren =
      true;

    const fallback =
      createProceduralCaptureFallback({
        pixi,
        descriptor
      });

    fallback.zIndex =
      0;

    display.addChild(
      fallback
    );

    const assetDisplay =
      this.textureService.createCapturedDisplay({
        pixi,
        presentation:
          descriptor.presentation,
        fallbackDisplay:
          fallback,
        tint:
          descriptor.tint,
        alphaMultiplier:
          1
      });

    if (
      assetDisplay
    ) {
      assetDisplay.zIndex =
        1;

      display.addChild(
        assetDisplay
      );
    }

    container.addChild(
      display
    );

    this.displaysByCaptureId.set(
      descriptor.captureId,
      display
    );

    markParentForSorting(
      parent
    );

    return true;
  }

  #requireContainer({
    pixi,
    parent,
    elevation
  }) {
    const key =
      String(
        elevation
      );

    const existing =
      this.containersByElevation.get(
        key
      );

    if (
      existing &&
      existing.destroyed !==
        true
    ) {
      return existing;
    }

    const container =
      new pixi.Container();

    configureWebDisplayObject(
      container
    );

    container.name =
      `${MODULE_ID}.captures.elevation-${formatElevation(elevation)}`;

    container.elevation =
      elevation;

    container.sortLayer =
      resolveWebPrimarySortLayer(
        DEFAULT_WEB_RENDER_LAYER_MODE
      ) +
      CAPTURE_SORT_LAYER_OFFSET;

    container.sortableChildren =
      true;

    container.zIndex =
      0;

    parent.addChild(
      container
    );

    this.containersByElevation.set(
      key,
      container
    );

    markParentForSorting(
      parent
    );

    return container;
  }

  #removeDisplay(
    captureId
  ) {
    const display =
      this.displaysByCaptureId.get(
        captureId
      ) ??
      null;

    if (!display) {
      return false;
    }

    const parent =
      display.parent ??
      null;

    parent?.removeChild?.(
      display
    );

    display.destroy?.({
      children:
        true
    });

    this.displaysByCaptureId.delete(
      captureId
    );

    if (
      parent &&
      Array.isArray(
        parent.children
      ) &&
      parent.children.length ===
        0
    ) {
      const key =
        Array.from(
          this.containersByElevation.entries()
        ).find(
          ([
            _entryKey,
            entry
          ]) =>
            entry ===
            parent
        )?.[0] ??
        null;

      const grandParent =
        parent.parent ??
        null;

      grandParent?.removeChild?.(
        parent
      );

      parent.destroy?.({
        children:
          true
      });

      if (
        key !==
        null
      ) {
        this.containersByElevation.delete(
          key
        );
      }

      markParentForSorting(
        grandParent
      );
    }

    return true;
  }

  #destroyContainers() {
    for (
      const container of
      this.containersByElevation.values()
    ) {
      const parent =
        container.parent ??
        null;

      parent?.removeChild?.(
        container
      );

      container.destroy?.({
        children:
          true
      });

      markParentForSorting(
        parent
      );
    }

    this.containersByElevation.clear();

    this.displaysByCaptureId.clear();
  }
}

function createCaptureDescriptor({
  request,
  captureId,
  sceneId,
  previous
}) {
  if (
    !request ||
    typeof request !==
      "object" ||
    Array.isArray(
      request
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Captured-web request must be an object.`
    );
  }

  const resolvedCaptureId =
    requireIdentifier(
      captureId,
      "capture ID"
    );

  const entityId =
    normaliseOptionalIdentifier(
      request.entityId ??
      request.entity?.id
    );

  const entityType =
    normaliseOptionalIdentifier(
      request.entityType ??
      request.entity?.type
    ) ??
    "external-entity";

  const sourceModuleId =
    normaliseOptionalIdentifier(
      request.sourceModuleId ??
      request.entity?.sourceModuleId
    ) ??
    "external";

  const point =
    requirePoint(
      request.point ??
      request.position,
      "captured-web point"
    );

  const radiusPx =
    requirePositiveNumber(
      request.radiusPx ??
      request.radius ??
      24,
      "captured-web radius"
    );

  const levelId =
    normaliseOptionalIdentifier(
      request.levelId
    );

  const elevationBand =
    normaliseElevationBand(
      request.elevationBand
    );

  const elevation =
    normaliseOptionalFiniteNumber(
      request.elevation
    );

  const selectionKey =
    normaliseOptionalIdentifier(
      request.selectionKey
    ) ??
    [
      resolvedCaptureId,
      sourceModuleId,
      entityType,
      entityId ??
        "anonymous"
    ].join(
      ":"
    );

  const presentation =
    createWebCapturedAssetPresentation({
      selectionKey,
      point,
      radiusPx,
      rotation:
        request.rotation ??
        0,
      alpha:
        request.alpha ??
        null,
      variant:
        request.variant ??
        null
    });

  const now =
    Date.now();

  return deepFreeze({
    captureId:
      resolvedCaptureId,
    sceneId:
      normaliseOptionalIdentifier(
        request.sceneId
      ) ??
      sceneId,
    sourceModuleId,
    entityType,
    entityId,
    levelId,
    elevation,
    elevationBand,
    point,
    radiusPx,
    tint:
      normaliseTint(
        request.tint
      ),
    colourProfileId:
      normaliseOptionalIdentifier(
        request.colourProfileId
      ),
    presentation,
    createdAt:
      previous?.createdAt ??
      now,
    updatedAt:
      now
  });
}

function resolveRequestedCaptureId(
  request
) {
  const explicit =
    normaliseOptionalIdentifier(
      request?.captureId
    );

  if (
    explicit
  ) {
    return explicit;
  }

  const entityId =
    normaliseOptionalIdentifier(
      request?.entityId ??
      request?.entity?.id
    );

  if (
    entityId
  ) {
    return [
      "capture",
      normaliseOptionalIdentifier(
        request?.sourceModuleId ??
        request?.entity?.sourceModuleId
      ) ??
        "external",
      normaliseOptionalIdentifier(
        request?.entityType ??
        request?.entity?.type
      ) ??
        "entity",
      entityId
    ].map(
      encodeURIComponent
    ).join(
      ":"
    );
  }

  return `capture:anonymous:${createRandomToken()}`;
}

function createProceduralCaptureFallback({
  pixi,
  descriptor
}) {
  const graphics =
    new pixi.Graphics();

  configureWebDisplayObject(
    graphics
  );

  graphics.name =
    `${MODULE_ID}.capture-fallback.${descriptor.captureId}`;

  const point =
    descriptor.point;

  const radius =
    descriptor.radiusPx;

  const colour =
    descriptor.tint;

  for (
    let ring = 0;
    ring <
      3;
    ring +=
      1
  ) {
    const ringRadius =
      radius *
      (
        0.45 +
        ring *
        0.24
      );

    const points =
      [];

    for (
      let index = 0;
      index <=
        20;
      index +=
        1
    ) {
      const angle =
        index /
        20 *
        Math.PI *
        2 +
        ring *
        0.37;

      points.push({
        x:
          point.x +
          Math.cos(
            angle
          ) *
          ringRadius,
        y:
          point.y +
          Math.sin(
            angle
          ) *
          ringRadius *
          0.88
      });
    }

    drawWebPolyline(
      graphics,
      points,
      {
        width:
          1.2,
        colour,
        alpha:
          0.55
      }
    );
  }

  for (
    let index = 0;
    index <
      8;
    index +=
      1
  ) {
    const angle =
      index /
      8 *
      Math.PI *
      2;

    drawWebPolyline(
      graphics,
      [
        {
          x:
            point.x +
            Math.cos(
              angle
            ) *
            radius *
            0.12,
          y:
            point.y +
            Math.sin(
              angle
            ) *
            radius *
            0.12
        },
        {
          x:
            point.x +
            Math.cos(
              angle
            ) *
            radius,
          y:
            point.y +
            Math.sin(
              angle
            ) *
            radius *
            0.88
        }
      ],
      {
        width:
          1.4,
        colour,
        alpha:
          0.68
      }
    );
  }

  return graphics;
}

function resolveCaptureElevation(
  descriptor
) {
  if (
    descriptor.elevation !==
      null
  ) {
    return descriptor.elevation;
  }

  const bottom =
    Number(
      descriptor.elevationBand?.bottom
    );

  return Number.isFinite(
    bottom
  )
    ? bottom
    : 0;
}

function normaliseElevationBand(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  const bottom =
    normaliseOptionalFiniteNumber(
      value?.bottom
    );

  const top =
    normaliseOptionalFiniteNumber(
      value?.top
    );

  if (
    bottom !==
      null &&
    top !==
      null &&
    top <
      bottom
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Captured-web elevation band must not be inverted.`
    );
  }

  return Object.freeze({
    bottom,
    top
  });
}

function requirePoint(
  value,
  label
) {
  const x =
    Number(
      value?.x
    );

  const y =
    Number(
      value?.y
    );

  if (
    !Number.isFinite(
      x
    ) ||
    !Number.isFinite(
      y
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} requires finite x and y coordinates.`
    );
  }

  return Object.freeze({
    x,
    y
  });
}

function requirePositiveNumber(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <=
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a positive finite number.`
    );
  }

  return number;
}

function normaliseOptionalFiniteNumber(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Captured-web elevation must be finite.`
    );
  }

  return number;
}

function normaliseTint(
  value
) {
  if (
    typeof value ===
      "string" &&
    /^#[0-9a-f]{6}$/iu.test(
      value.trim()
    )
  ) {
    return Number.parseInt(
      value.trim().slice(
        1
      ),
      16
    );
  }

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
    : 0xe8edf2;
}

function createRandomToken() {
  const foundryId =
    globalThis.foundry?.utils?.randomID?.(
      16
    ) ??
    globalThis.randomID?.(
      16
    );

  if (
    typeof foundryId ===
      "string" &&
    foundryId.length >
      0
  ) {
    return foundryId;
  }

  const getRandomValues =
    globalThis.crypto?.getRandomValues;

  if (
    typeof getRandomValues ===
      "function"
  ) {
    const values =
      new Uint8Array(
        12
      );

    getRandomValues.call(
      globalThis.crypto,
      values
    );

    return Array.from(
      values
    ).map(
      value =>
        value.toString(
          16
        ).padStart(
          2,
          "0"
        )
    ).join(
      ""
    );
  }

  return Math.random().toString(
    36
  ).slice(
    2
  );
}

function requireIdentifier(
  value,
  label
) {
  const identifier =
    normaliseOptionalIdentifier(
      value
    );

  if (!identifier) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a non-empty identifier.`
    );
  }

  return identifier;
}

function normaliseOptionalIdentifier(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  return text ||
    null;
}

function normaliseIdentifierList(
  values
) {
  return Array.from(
    new Set(
      (
        Array.isArray(
          values
        )
          ? values
          : []
      )
        .map(
          normaliseOptionalIdentifier
        )
        .filter(
          Boolean
        )
    )
  ).sort();
}

function formatElevation(
  elevation
) {
  return String(
    elevation
  )
    .replace(
      /^-/u,
      "negative-"
    )
    .replace(
      /\./gu,
      "-"
    );
}

function markParentForSorting(
  parent
) {
  if (!parent) {
    return;
  }

  if (
    "sortableChildren" in
    parent
  ) {
    parent.sortableChildren =
      true;
  }

  if (
    "sortDirty" in
    parent
  ) {
    parent.sortDirty =
      true;
  }

  parent.sortChildren?.();
}

function emitHook(
  name,
  payload
) {
  emitHookSafely(
    name,
    payload
  );
}

function emitHookSafely(
  name,
  ...payload
) {
  globalThis.Hooks?.callAll?.(
    name,
    ...payload
  );
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

  if (
    Array.isArray(
      value
    )
  ) {
    return Object.freeze(
      value.map(
        deepFreeze
      )
    );
  }

  const clone =
    {};

  for (
    const [
      key,
      entry
    ] of Object.entries(
      value
    )
  ) {
    clone[key] =
      deepFreeze(
        entry
      );
  }

  return Object.freeze(
    clone
  );
}
