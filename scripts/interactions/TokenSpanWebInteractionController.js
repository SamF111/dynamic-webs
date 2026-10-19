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

import {
  SPAN_WEB_CROSSING_ACTIONS,
  normaliseSpanWebCrossingAction
} from "../config/spanWebBehaviourContract.js";

const MOVEMENT_SNAPSHOT_MAXIMUM_AGE_MS =
  10000;

const VISUAL_MOVEMENT_MAXIMUM_AGE_MS =
  30000;

const POINT_EPSILON =
  0.000001;

/**
 * Initiating-client token movement handler for GM-authoritative wall-span
 * crossing behaviour.
 *
 * preUpdateToken captures and evaluates the intended movement immediately so a
 * closed generated secret door can react to an attempted crossing before any
 * committed TokenDocument movement exists. updateToken then follows the
 * rendered Token placeable as a compatibility supplement for unusual visual
 * paths. Player interactions are submitted to the GM for validation.
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

    this.preProcessedMovementsByTokenId =
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

    this.openedDoorRequestCount =
      0;

    this.lastOutcome =
      null;
  }

  prime(
    scene = globalThis.canvas?.scene
  ) {
    this.stopAllVisualMovementTrackers();
    this.pendingMovementsByTokenId.clear();
    this.preProcessedMovementsByTokenId.clear();
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
      this.preProcessedMovementsByTokenId.size >
        0 ||
      this.visualMovementTrackersByTokenId.size >
        0 ||
      this.visualMovementTickerCallback !==
        null;

    this.stopAllVisualMovementTrackers();
    this.pendingMovementsByTokenId.clear();
    this.preProcessedMovementsByTokenId.clear();
    this.snapshotsByTokenId.clear();

    return hadState;
  }

  /**
   * Evaluate Foundry's final constrained movement path before the update
   * workflow concludes. Foundry v13/v14 expose this only to the initiating
   * client, making it the earliest reliable point for attempted-crossing
   * behaviour such as opening a blocking generated secret door.
   */
  handleTokenPreMoved(
    tokenDocument,
    movement,
    operation = {}
  ) {
    const service =
      this.runtime
        ?.getWebRuntimeService?.();

    const state =
      service?.getState?.();

    const crossingAction =
      resolveCrossingAction(
        state
      );

    if (
      !service ||
      state?.active !==
        true ||
      crossingAction ===
        SPAN_WEB_CROSSING_ACTIONS.NONE
    ) {
      return null;
    }

    const movementSnapshots =
      createPreMoveSnapshots({
        tokenDocument,
        movement,
        scene:
          globalThis.canvas?.scene,
        levels:
          state?.levels ??
          []
      });

    if (
      movementSnapshots.length <
        2
    ) {
      return null;
    }

    const userId =
      String(
        globalThis.game?.user?.id ??
        ""
      ).trim() ||
      null;

    const overallMovement =
      createWebTokenMovementTransitionFromSnapshots({
        from:
          movementSnapshots[0],
        to:
          movementSnapshots[
            movementSnapshots.length -
            1
          ],
        userId
      });

    if (
      !this.#isMovementCompatibleWithState(
        overallMovement,
        state
      )
    ) {
      return null;
    }

    const pathPoints =
      Object.freeze(
        movementSnapshots.map(
          snapshot =>
            snapshot.centre
        )
      );

    const tracker =
      {
        movement:
          overallMovement,
        previousCentre:
          overallMovement.from.centre,
        startedAt:
          Date.now(),
        processedWebIds:
          new Set(),
        animate:
          operation?.animate ===
            true
      };

    let outcome =
      null;

    for (
      let index = 0;
      index +
        1 <
        movementSnapshots.length;
      index +=
        1
    ) {
      const fromSnapshot =
        movementSnapshots[
          index
        ];

      const toSnapshot =
        movementSnapshots[
          index +
            1
        ];

      if (
        pointsEqual(
          fromSnapshot.centre,
          toSnapshot.centre
        )
      ) {
        continue;
      }

      const segmentMovement =
        createWebTokenMovementTransitionFromSnapshots({
          from:
            fromSnapshot,
          to:
            toSnapshot,
          userId
        });

      if (
        !this.#isMovementCompatibleWithState(
          segmentMovement,
          state
        )
      ) {
        continue;
      }

      tracker.movement =
        Object.freeze({
          ...segmentMovement,
          pathPoints
        });

      outcome =
        this.#processMovementSegment(
          tracker,
          fromSnapshot.centre,
          toSnapshot.centre
        ) ??
        outcome;
    }

    tracker.movement =
      overallMovement;

    this.pendingMovementsByTokenId.set(
      overallMovement.tokenId,
      overallMovement
    );

    this.preProcessedMovementsByTokenId.set(
      overallMovement.tokenId,
      {
        movement:
          overallMovement,
        processedWebIds:
          new Set(
            tracker.processedWebIds
          ),
        outcome,
        capturedAt:
          Date.now()
      }
    );

    return outcome;
  }

  /** Capture the authoritative movement endpoints before Foundry mutates the document. */
  handleTokenPreUpdated(
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
      ) ||
      !movementWasInitiatedByCurrentUser(
        userId
      )
    ) {
      return null;
    }

    const state =
      service.getState();

    const crossingAction =
      resolveCrossingAction(
        state
      );

    if (
      state?.active !==
        true ||
      crossingAction ===
        SPAN_WEB_CROSSING_ACTIONS.NONE
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
      ) ||
      pointsEqual(
        movement.from.centre,
        movement.to.centre
      )
    ) {
      return null;
    }

    this.pendingMovementsByTokenId.set(
      movement.tokenId,
      movement
    );

    const preMoved =
      this.preProcessedMovementsByTokenId.get(
        movement.tokenId
      ) ??
      null;

    if (
      preMoved &&
      Date.now() -
        Number(
          preMoved.capturedAt
        ) <=
          MOVEMENT_SNAPSHOT_MAXIMUM_AGE_MS &&
      pointsEqual(
        preMoved.movement?.from?.centre,
        movement.from.centre
      ) &&
      pointsEqual(
        preMoved.movement?.to?.centre,
        movement.to.centre
      )
    ) {
      return movement;
    }

    const tracker =
      {
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

    const outcome =
      this.#processMovementSegment(
        tracker,
        movement.from.centre,
        movement.to.centre
      );

    this.preProcessedMovementsByTokenId.set(
      movement.tokenId,
      {
        movement,
        processedWebIds:
          new Set(
            tracker.processedWebIds
          ),
        outcome,
        capturedAt:
          Date.now()
      }
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

    const preProcessed =
      current.tokenId
        ? this.preProcessedMovementsByTokenId.get(
            current.tokenId
          ) ??
          null
        : null;

    if (
      current.tokenId
    ) {
      this.preProcessedMovementsByTokenId.delete(
        current.tokenId
      );
    }

    if (
      resolveCrossingAction(
        state
      ) ===
        SPAN_WEB_CROSSING_ACTIONS.NONE
    ) {
      return null;
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
      options,
      preProcessed
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

    const removedPreProcessedMovement =
      this.preProcessedMovementsByTokenId.delete(
        tokenId
      );

    const removedVisualTracker =
      this.stopVisualMovementTracker(
        tokenId
      );

    return removedSnapshot ||
      removedPendingMovement ||
      removedPreProcessedMovement ||
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
    options = {},
    preProcessed = null
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
        new Set(
          preProcessed?.processedWebIds ??
          []
        ),
      animate:
        options?.animate ===
          true
    };

    const completePathOutcome =
      preProcessed
        ? preProcessed.outcome ??
          this.lastOutcome
        : this.#processMovementSegment(
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
      preProcessedMovementCount:
        this.preProcessedMovementsByTokenId.size,
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
      openedDoorRequestCount:
        this.openedDoorRequestCount,
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

    const state =
      service?.getState?.();

    const crossingAction =
      resolveCrossingAction(
        state
      );

    if (
      !service ||
      crossingAction ===
        SPAN_WEB_CROSSING_ACTIONS.NONE
    ) {
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
            crossingAction,
            hitWebIds:
              Object.freeze([]),
            destroyedWebIds:
              Object.freeze([]),
            openedWebIds:
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
          crossingAction,
          hitWebIds,
          destroyedWebIds:
            Object.freeze([]),
          openedWebIds:
            Object.freeze([]),
          requestSubmitted:
            requested,
          at:
            Date.now()
        });

      return this.lastOutcome;
    }

    let destroyedWebIds =
      Object.freeze([]);

    let openedWebIds =
      Object.freeze([]);

    if (
      crossingAction ===
        SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB
    ) {
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

      destroyedWebIds =
        result.destroyedWebIds;

      this.destroyedWebCount +=
        destroyedWebIds.length;
    } else if (
      crossingAction ===
        SPAN_WEB_CROSSING_ACTIONS.OPEN_SECRET_DOOR
    ) {
      const result =
        service.openSpanSecretDoors?.(
          hitWebIds,
          {
            cause:
              "token-movement",
            entityId:
              movement.tokenId,
            userId:
              movement.userId ??
              globalThis.game?.user?.id ??
              null
          }
        );

      openedWebIds =
        Object.freeze([
          ...(
            Array.isArray(
              result?.requestedWebIds
            )
              ? result.requestedWebIds
              : []
          )
        ]);

      this.openedDoorRequestCount +=
        openedWebIds.length;
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
        crossingAction,
        hitWebIds,
        destroyedWebIds,
        openedWebIds,
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

function createPreMoveSnapshots({
  tokenDocument,
  movement,
  scene,
  levels
}) {
  const origin =
    createWebTokenMovementSnapshot({
      token:
        tokenDocument,
      scene,
      levels,
      changed:
        createWaypointSnapshotChange(
          movement?.origin
        )
    });

  const pendingWaypoints =
    Array.isArray(
      movement?.pending?.waypoints
    ) &&
    movement.pending.waypoints.length >
      0
      ? movement.pending.waypoints
      : movement?.destination
        ? [
            movement.destination
          ]
        : [];

  const snapshots =
    [
      origin
    ];

  for (
    const waypoint of
    pendingWaypoints
  ) {
    const snapshot =
      createWebTokenMovementSnapshot({
        token:
          tokenDocument,
        scene,
        levels,
        changed:
          createWaypointSnapshotChange(
            waypoint
          )
      });

    const previous =
      snapshots.at(
        -1
      );

    if (
      previous &&
      pointsEqual(
        previous.centre,
        snapshot.centre
      ) &&
      previous.levelId ===
        snapshot.levelId &&
      previous.elevation ===
        snapshot.elevation
    ) {
      continue;
    }

    snapshots.push(
      snapshot
    );
  }

  return snapshots;
}

function createWaypointSnapshotChange(
  waypoint
) {
  if (
    !waypoint ||
    typeof waypoint !==
      "object"
  ) {
    return {};
  }

  const changed =
    {};

  for (
    const key of
    [
      "x",
      "y",
      "width",
      "height",
      "elevation"
    ]
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        waypoint,
        key
      )
    ) {
      changed[
        key
      ] =
        waypoint[
          key
        ];
    }
  }

  const levelId =
    waypoint.levelId ??
    (
      typeof waypoint.level ===
        "string"
        ? waypoint.level
        : waypoint.level?.id
    );

  if (
    levelId !==
      null &&
    levelId !==
      undefined &&
    String(
      levelId
    ).trim()
  ) {
    changed.levelId =
      String(
        levelId
      ).trim();
  }

  return changed;
}

function resolveCrossingAction(
  state
) {
  const behaviour =
    state?.spanWebBehaviour;

  if (
    behaviour?.crossingAction
  ) {
    const action =
      normaliseSpanWebCrossingAction(
        behaviour.crossingAction,
        SPAN_WEB_CROSSING_ACTIONS.NONE
      );

    return action ===
        SPAN_WEB_CROSSING_ACTIONS.OPEN_SECRET_DOOR &&
      behaviour.secretDoor !==
        true
      ? SPAN_WEB_CROSSING_ACTIONS.NONE
      : action;
  }

  /**
   * Compatibility fallback for transient/test state created before schema v2.
   */
  return behaviour?.destructible ===
    false
    ? SPAN_WEB_CROSSING_ACTIONS.NONE
    : SPAN_WEB_CROSSING_ACTIONS.DESTROY_WEB;
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

