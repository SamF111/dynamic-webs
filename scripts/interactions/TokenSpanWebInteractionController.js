import {
  createWebTokenMovementSnapshot
} from "../foundry/webTokenCompatibility.js";

/** GM-authoritative token movement handler for whole wall-span destruction. */
export class TokenSpanWebInteractionController {
  constructor({
    runtime
  }) {
    this.runtime =
      runtime;

    this.snapshotsByTokenId =
      new Map();

    this.processedMovementCount =
      0;

    this.destroyedWebCount =
      0;

    this.lastOutcome =
      null;
  }

  prime(
    scene = globalThis.canvas?.scene
  ) {
    this.snapshotsByTokenId.clear();

    const levels =
      this.runtime
        ?.getWebRuntimeService?.()
        ?.getState?.()
        ?.levels ??
      [];

    for (
      const token of
      collectSceneTokens(
        scene
      )
    ) {
      const snapshot =
        createWebTokenMovementSnapshot({
          token,
          scene,
          levels
        });

      if (
        snapshot.tokenId
      ) {
        this.snapshotsByTokenId.set(
          snapshot.tokenId,
          snapshot
        );
      }
    }

    return this.snapshotsByTokenId.size;
  }

  clear() {
    const hadSnapshots =
      this.snapshotsByTokenId.size >
      0;

    this.snapshotsByTokenId.clear();

    return hadSnapshots;
  }

  handleTokenUpdated(
    tokenDocument,
    changed,
    options = {},
    userId = null
  ) {
    const service =
      this.runtime
        ?.getWebRuntimeService?.();

    if (
      !service ||
      !doesTokenUpdateMove(
        changed
      )
    ) {
      return null;
    }

    const state =
      service.getState();

    const current =
      createWebTokenMovementSnapshot({
        token:
          tokenDocument,
        scene:
          globalThis.canvas?.scene,
        levels:
          state?.levels ??
          []
      });

    const previous =
      current.tokenId
        ? this.snapshotsByTokenId.get(
            current.tokenId
          ) ??
          null
        : null;

    if (
      current.tokenId
    ) {
      this.snapshotsByTokenId.set(
        current.tokenId,
        current
      );
    }

    if (
      globalThis.game?.user?.isGM !==
        true ||
      !previous ||
      previous.sceneId !==
        current.sceneId ||
      state?.active !==
        true ||
      state?.sceneId !==
        current.sceneId ||
      !current.levelId ||
      pointsEqual(
        previous.centre,
        current.centre
      )
    ) {
      return null;
    }

    const hits =
      service.queryMovementIntersections({
        from:
          previous.centre,
        to:
          current.centre,
        levelId:
          current.levelId,
        elevation:
          current.elevation,
        collisionRadiusPx:
          Math.max(
            previous.collisionRadiusPx,
            current.collisionRadiusPx
          ),
        categories:
          [
            "wall-span"
          ]
      });

    this.processedMovementCount +=
      1;

    if (
      hits.length ===
        0
    ) {
      this.lastOutcome =
        Object.freeze({
          tokenId:
            current.tokenId,
          userId,
          hitWebIds:
            Object.freeze([]),
          destroyedWebIds:
            Object.freeze([]),
          at:
            Date.now()
        });

      return this.lastOutcome;
    }

    const result =
      service.destroyWebs(
        hits.map(
          (
            hit
          ) =>
            hit.webId
        ),
        {
          cause:
            "token-movement",
          entityId:
            current.tokenId,
          userId:
            userId ??
            globalThis.game?.user?.id ??
            null,
          animate:
            options?.animate ===
              true
        }
      );

    this.destroyedWebCount +=
      result.destroyedWebIds.length;

    this.lastOutcome =
      Object.freeze({
        tokenId:
          current.tokenId,
        userId,
        hitWebIds:
          Object.freeze(
            hits.map(
              (
                hit
              ) =>
                hit.webId
            )
          ),
        destroyedWebIds:
          result.destroyedWebIds,
        at:
          Date.now()
      });

    return this.lastOutcome;
  }

  createDiagnosticSnapshot() {
    return Object.freeze({
      trackedTokenCount:
        this.snapshotsByTokenId.size,
      processedMovementCount:
        this.processedMovementCount,
      destroyedWebCount:
        this.destroyedWebCount,
      lastOutcome:
        this.lastOutcome
    });
  }
}

function doesTokenUpdateMove(
  changed
) {
  return changed &&
    typeof changed ===
      "object" &&
    (
      Object.prototype.hasOwnProperty.call(
        changed,
        "x"
      ) ||
      Object.prototype.hasOwnProperty.call(
        changed,
        "y"
      )
    );
}

function pointsEqual(
  first,
  second
) {
  return Math.abs(
    Number(
      first?.x
    ) -
    Number(
      second?.x
    )
  ) <
      0.000001 &&
    Math.abs(
      Number(
        first?.y
      ) -
      Number(
        second?.y
      )
    ) <
      0.000001;
}

function collectSceneTokens(
  scene
) {
  const values =
    [];

  appendCollection(
    values,
    globalThis.canvas?.tokens?.placeables
  );

  appendCollection(
    values,
    scene?.tokens
  );

  const byId =
    new Map();

  for (
    const value of
    values
  ) {
    const document =
      value?.document ??
      value;

    const id =
      String(
        document?.id ??
        document?._id ??
        ""
      );

    if (
      id
    ) {
      byId.set(
        id,
        value
      );
    }
  }

  return Array.from(
    byId.values()
  );
}

function appendCollection(
  target,
  collection
) {
  if (
    Array.isArray(
      collection?.contents
    )
  ) {
    target.push(
      ...collection.contents
    );

    return;
  }

  if (
    Array.isArray(
      collection
    )
  ) {
    target.push(
      ...collection
    );

    return;
  }

  if (
    typeof collection?.values ===
      "function"
  ) {
    target.push(
      ...collection.values()
    );
  }
}
