import {
  createWebTokenMovementSnapshot,
  createWebTokenMovementTransition,
  createWebTokenMovementTransitionFromSnapshots,
  getRenderedWebTokenCentre,
  getWebTokenPlaceable,
  hasRenderedWebTokenArrived,
  hasWebTokenMovementChange
} from "../foundry/webTokenCompatibility.js";

import {
  requestTokenSpanWebMovement
} from "../networking/webMutableStateSocket.js";

const MOVEMENT_SNAPSHOT_MAXIMUM_AGE_MS =
  10000;

const VISUAL_MOVEMENT_MAXIMUM_AGE_MS =
  30000;

const POINT_EPSILON =
  0.000001;

/**
 * Initiating-client token movement handler for GM-authoritative whole-span
 * destruction.
 *
 * preUpdateToken captures the true document origin and destination only on the
 * client that initiated the movement. updateToken then follows that client's
 * rendered Token placeable through the canvas ticker so every visible movement
 * segment is tested. GM-originated movement is applied directly; player
 * movement is submitted to the GM through the Dynamic Webs socket.
 */
export class TokenSpanWebInteractionController {
  constructor({
    runtime
  }) {
    this.runtime =
      runtime;

    this.snapshotsByTokenId =
      new Map();

    this.pendingMovementsByTokenId =
      new Map();

    this.visualMovementTrackersByTokenId =
      new Map();

    this.visualMovementTickerCallback =
      null;

    this.processedMovementCount =
      0;

    this.submittedMovementRequestCount =
      0;

    this.destroyedWebCount =
      0;

    this.lastOutcome =
      null;
  }

  prime(
    scene = globalThis.canvas?.scene
  ) {
    this.stopAllVisualMovementTrackers();
    this.pendingMovementsByTokenId.clear();
    this.snapshotsByTokenId.clear();

    const levels =
      this.#getLevels();

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
    const hadState =
      this.snapshotsByTokenId.size >
        0 ||
      this.pendingMovementsByTokenId.size >
        0 ||
      this.visualMovementTrackersByTokenId.size >
        0 ||
      this.visualMovementTickerCallback !==
        null;

    this.stopAllVisualMovementTrackers();
    this.pendingMovementsByTokenId.clear();
    this.snapshotsByTokenId.clear();

    return hadState;
  }

  /** Capture the authoritative movement endpoints before Foundry mutates the document. */
  handleTokenPreUpdated(
    tokenDocument,
    changed,
    options = {},
    userId = null
  ) {
    void options;

    const service =
      this.runtime
        ?.getWebRuntimeService?.();

    if (
      !service ||
      !hasWebTokenMovementChange(
        changed
      ) ||
      !movementWasInitiatedByCurrentUser(
        userId
      )
    ) {
      return null;
    }

    const state =
      service.getState();

    if (
      state?.active !==
        true
    ) {
      return null;
    }

    this.#pruneExpiredPendingMovements();

    const movement =
      createWebTokenMovementTransition({
        token:
          tokenDocument,
        changed,
        scene:
          globalThis.canvas?.scene,
        levels:
          state?.levels ??
          [],
        userId
      });

    if (
      !this.#isMovementCompatibleWithState(
        movement,
        state
      )
    ) {
      return null;
    }

    this.pendingMovementsByTokenId.set(
      movement.tokenId,
      movement
    );

    return movement;
  }

  /**
   * Begin visual movement tracking after the TokenDocument has reached its
   * destination coordinates.
   */
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
      !hasWebTokenMovementChange(
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
          [],

        /**
         * Foundry v13 may animate TokenDocument getters from the rendered
         * origin while _source and the update differential already contain
         * the destination. Resolve the applied endpoint from `changed` so a
         * valid preUpdateToken capture is not rejected one movement late.
         */
        changed
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

    const capturedMovement =
      current.tokenId
        ? this.pendingMovementsByTokenId.get(
            current.tokenId
          ) ??
          null
        : null;

    if (
      current.tokenId
    ) {
      this.pendingMovementsByTokenId.delete(
        current.tokenId
      );
    }

    if (
      !movementWasInitiatedByCurrentUser(
        userId
      )
    ) {
      return null;
    }

    const movement =
      this.#selectMovement({
        capturedMovement,
        previous,
        current,
        userId
      });

    if (
      !this.#isMovementCompatibleWithState(
        movement,
        state
      ) ||
      pointsEqual(
        movement.from.centre,
        movement.to.centre
      )
    ) {
      return null;
    }

    return this.startVisualMovementTracker(
      movement,
      options
    );
  }

  /** Clear all transient tracking for one deleted token. */
  handleTokenDeleted(
    tokenDocument
  ) {
    const tokenId =
      String(
        tokenDocument?.id ??
        tokenDocument?._id ??
        ""
      ).trim();

    if (!tokenId) {
      return false;
    }

    const removedSnapshot =
      this.snapshotsByTokenId.delete(
        tokenId
      );

    const removedPendingMovement =
      this.pendingMovementsByTokenId.delete(
        tokenId
      );

    const removedVisualTracker =
      this.stopVisualMovementTracker(
        tokenId
      );

    return removedSnapshot ||
      removedPendingMovement ||
      removedVisualTracker;
  }

  /**
   * Process the complete captured movement immediately, then continue
   * following the rendered token for any non-linear visual path.
   *
   * Span webs are static geometry. Their first-pass crossing result must not
   * depend on Foundry advancing a PIXI animation or on the canvas ticker being
   * sampled before the movement finishes. The authoritative pre-update
   * endpoints therefore provide the primary swept segment. Rendered tracking
   * remains as a compatibility supplement for unusual curved movement.
   */
  startVisualMovementTracker(
    movement,
    options = {}
  ) {
    this.stopVisualMovementTracker(
      movement.tokenId
    );

    const tracker = {
      movement,
      previousCentre:
        movement.from.centre,
      startedAt:
        Date.now(),
      processedWebIds:
        new Set(),
      animate:
        options?.animate ===
          true
    };

    const completePathOutcome =
      this.#processMovementSegment(
        tracker,
        movement.from.centre,
        movement.to.centre
      );

    const tokenPlaceable =
      getWebTokenPlaceable(
        movement.tokenId
      );

    const ticker =
      globalThis.canvas?.app?.ticker;

    if (
      !tokenPlaceable ||
      !ticker ||
      typeof ticker.add !==
        "function" ||
      typeof ticker.remove !==
        "function"
    ) {
      return completePathOutcome;
    }

    const renderedCentre =
      getRenderedWebTokenCentre(
        tokenPlaceable,
        movement
      );

    if (renderedCentre) {
      tracker.previousCentre =
        renderedCentre;
    }

    if (
      renderedCentre &&
      hasRenderedWebTokenArrived(
        movement,
        renderedCentre
      )
    ) {
      return completePathOutcome;
    }

    this.visualMovementTrackersByTokenId.set(
      movement.tokenId,
      tracker
    );

    this.ensureVisualMovementTicker();

    return completePathOutcome;
  }

  /** Register the one shared canvas ticker callback used by all token moves. */
  ensureVisualMovementTicker() {
    if (
      this.visualMovementTickerCallback
    ) {
      return false;
    }

    const ticker =
      globalThis.canvas?.app?.ticker;

    if (
      !ticker ||
      typeof ticker.add !==
        "function"
    ) {
      return false;
    }

    this.visualMovementTickerCallback =
      () =>
        this.updateVisualMovementTrackers();

    ticker.add(
      this.visualMovementTickerCallback
    );

    return true;
  }

  /** Test every visible token segment travelled since the previous frame. */
  updateVisualMovementTrackers() {
    const service =
      this.runtime
        ?.getWebRuntimeService?.();

    const state =
      service?.getState?.();

    for (
      const [
        tokenId,
        tracker
      ] of
      this.visualMovementTrackersByTokenId
    ) {
      const movement =
        tracker.movement;

      if (
        !this.#isMovementCompatibleWithState(
          movement,
          state
        )
      ) {
        this.stopVisualMovementTracker(
          tokenId
        );

        continue;
      }

      const renderedCentre =
        getRenderedWebTokenCentre(
          getWebTokenPlaceable(
            tokenId
          ),
          movement
        );

      if (
        renderedCentre &&
        !pointsEqual(
          tracker.previousCentre,
          renderedCentre
        )
      ) {
        this.#processMovementSegment(
          tracker,
          tracker.previousCentre,
          renderedCentre
        );

        tracker.previousCentre =
          renderedCentre;
      }

      const expired =
        Date.now() -
        tracker.startedAt >=
          VISUAL_MOVEMENT_MAXIMUM_AGE_MS;

      const arrived =
        renderedCentre
          ? hasRenderedWebTokenArrived(
              movement,
              renderedCentre
            )
          : false;

      if (
        !arrived &&
        !expired
      ) {
        continue;
      }

      if (
        !arrived &&
        !pointsEqual(
          tracker.previousCentre,
          movement.to.centre
        )
      ) {
        this.#processMovementSegment(
          tracker,
          tracker.previousCentre,
          movement.to.centre
        );
      }

      this.stopVisualMovementTracker(
        tokenId
      );
    }

    return this.visualMovementTrackersByTokenId.size;
  }

  /** Stop one rendered movement tracker. */
  stopVisualMovementTracker(
    tokenId
  ) {
    const removed =
      this.visualMovementTrackersByTokenId.delete(
        tokenId
      );

    if (
      this.visualMovementTrackersByTokenId.size ===
        0
    ) {
      this.removeVisualMovementTicker();
    }

    return removed;
  }

  /** Stop every rendered movement tracker. */
  stopAllVisualMovementTrackers() {
    const hadTrackers =
      this.visualMovementTrackersByTokenId.size >
        0;

    this.visualMovementTrackersByTokenId.clear();
    this.removeVisualMovementTicker();

    return hadTrackers;
  }

  /** Remove the shared ticker callback when no tracked movements remain. */
  removeVisualMovementTicker() {
    if (
      !this.visualMovementTickerCallback
    ) {
      return false;
    }

    const callback =
      this.visualMovementTickerCallback;

    this.visualMovementTickerCallback =
      null;

    try {
      globalThis.canvas?.app?.ticker?.remove?.(
        callback
      );
    } catch (error) {
      console.warn(
        "dynamic-webs | The token span-web movement ticker could not be removed cleanly.",
        error
      );
    }

    return true;
  }

  createDiagnosticSnapshot() {
    return Object.freeze({
      trackedTokenCount:
        this.snapshotsByTokenId.size,
      pendingMovementCount:
        this.pendingMovementsByTokenId.size,
      visualMovementTrackerCount:
        this.visualMovementTrackersByTokenId.size,
      visualMovementTickerActive:
        this.visualMovementTickerCallback !==
          null,
      processedMovementCount:
        this.processedMovementCount,
      submittedMovementRequestCount:
        this.submittedMovementRequestCount,
      destroyedWebCount:
        this.destroyedWebCount,
      lastOutcome:
        this.lastOutcome
    });
  }

  #processMovementSegment(
    tracker,
    from,
    to
  ) {
    if (
      pointsEqual(
        from,
        to
      )
    ) {
      return null;
    }

    const service =
      this.runtime
        ?.getWebRuntimeService?.();

    if (!service) {
      return null;
    }

    const movement =
      tracker.movement;

    const hits =
      service.queryMovementIntersections({
        from,
        to,
        levelId:
          movement.levelId,
        elevation:
          movement.elevation,
        collisionRadiusPx:
          movement.collisionRadiusPx,
        categories:
          [
            "wall-span"
          ]
      });

    this.processedMovementCount +=
      1;

    const newHits =
      hits.filter(
        hit =>
          !tracker.processedWebIds.has(
            hit.webId
          )
      );

    for (
      const hit of
      newHits
    ) {
      tracker.processedWebIds.add(
        hit.webId
      );
    }

    if (
      newHits.length ===
        0
    ) {
      if (
        tracker.processedWebIds.size ===
          0
      ) {
        this.lastOutcome =
          Object.freeze({
            tokenId:
              movement.tokenId,
            userId:
              movement.userId,
            from:
              Object.freeze({
                ...from
              }),
            to:
              Object.freeze({
                ...to
              }),
            hitWebIds:
              Object.freeze([]),
            destroyedWebIds:
              Object.freeze([]),
            at:
              Date.now()
          });
      }

      return this.lastOutcome;
    }

    const hitWebIds =
      Object.freeze(
        newHits.map(
          hit =>
            hit.webId
        )
      );

    if (
      globalThis.game?.user?.isGM !==
        true
    ) {
      const requested =
        requestTokenSpanWebMovement({
          movement,
          from,
          to,
          hitWebIds,
          animate:
            tracker.animate
        });

      if (
        requested
      ) {
        this.submittedMovementRequestCount +=
          1;
      } else {
        for (
          const hit of
          newHits
        ) {
          tracker.processedWebIds.delete(
            hit.webId
          );
        }
      }

      this.lastOutcome =
        Object.freeze({
          tokenId:
            movement.tokenId,
          userId:
            movement.userId,
          from:
            Object.freeze({
              ...from
            }),
          to:
            Object.freeze({
              ...to
            }),
          hitWebIds,
          destroyedWebIds:
            Object.freeze([]),
          requestSubmitted:
            requested,
          at:
            Date.now()
        });

      return this.lastOutcome;
    }

    const result =
      service.destroyWebs(
        hitWebIds,
        {
          cause:
            "token-movement",
          entityId:
            movement.tokenId,
          userId:
            movement.userId ??
            globalThis.game?.user?.id ??
            null,
          animate:
            tracker.animate
        }
      );

    this.destroyedWebCount +=
      result.destroyedWebIds.length;

    this.lastOutcome =
      Object.freeze({
        tokenId:
          movement.tokenId,
        userId:
          movement.userId,
        from:
          Object.freeze({
            ...from
          }),
        to:
          Object.freeze({
            ...to
          }),
        hitWebIds,
        destroyedWebIds:
          result.destroyedWebIds,
        requestSubmitted:
          false,
        at:
          Date.now()
      });

    return this.lastOutcome;
  }

  #selectMovement({
    capturedMovement,
    previous,
    current,
    userId
  }) {
    if (
      capturedMovement &&
      capturedMovement.tokenId ===
        current.tokenId &&
      capturedMovement.sceneId ===
        current.sceneId &&
      Date.now() -
        Number(
          capturedMovement.capturedAt
        ) <=
          MOVEMENT_SNAPSHOT_MAXIMUM_AGE_MS &&
      pointsEqual(
        capturedMovement.to?.centre,
        current.centre
      ) &&
      (
        !capturedMovement.userId ||
        !userId ||
        capturedMovement.userId ===
          String(
            userId
          )
      )
    ) {
      return capturedMovement;
    }

    return createWebTokenMovementTransitionFromSnapshots({
      from:
        previous,
      to:
        current,
      userId
    });
  }

  #pruneExpiredPendingMovements() {
    const oldestAllowedTimestamp =
      Date.now() -
      MOVEMENT_SNAPSHOT_MAXIMUM_AGE_MS;

    for (
      const [
        tokenId,
        movement
      ] of
      this.pendingMovementsByTokenId
    ) {
      if (
        Number(
          movement?.capturedAt
        ) <
          oldestAllowedTimestamp
      ) {
        this.pendingMovementsByTokenId.delete(
          tokenId
        );
      }
    }
  }

  #isMovementCompatibleWithState(
    movement,
    state
  ) {
    return Boolean(
      movement &&
      movement.tokenId &&
      movement.sceneId &&
      movement.levelId &&
      state?.active ===
        true &&
      state?.sceneId ===
        movement.sceneId &&
      globalThis.canvas?.scene?.id ===
        movement.sceneId
    );
  }

  #getLevels() {
    return this.runtime
      ?.getWebRuntimeService?.()
      ?.getState?.()
      ?.levels ??
      [];
  }
}

function movementWasInitiatedByCurrentUser(
  userId
) {
  const currentUserId =
    String(
      globalThis.game?.user?.id ??
      ""
    ).trim();

  const initiatingUserId =
    String(
      userId ??
      ""
    ).trim();

  if (
    initiatingUserId
  ) {
    return Boolean(
      currentUserId &&
      currentUserId ===
        initiatingUserId
    );
  }

  return globalThis.game?.user?.isGM ===
    true;
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
      POINT_EPSILON &&
    Math.abs(
      Number(
        first?.y
      ) -
      Number(
        second?.y
      )
    ) <
      POINT_EPSILON;
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

    if (id) {
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
