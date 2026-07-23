import {
  MODULE_ID
} from "../module/moduleConstants.js";

import {
  createWebTokenMovementSnapshot
} from "../foundry/webTokenCompatibility.js";

const SOCKET_CHANNEL =
  `module.${MODULE_ID}`;

const MESSAGE_TYPES =
  Object.freeze({
    REQUEST:
      "mutable-state-request",
    SNAPSHOT:
      "mutable-state-snapshot",
    TOKEN_MOVEMENT_REQUEST:
      "token-span-movement-request"
  });

const MOVEMENT_REQUEST_MAXIMUM_AGE_MS =
  10000;

const MOVEMENT_PATH_TOLERANCE_PX =
  4;

const POINT_EPSILON =
  0.000001;

let registration =
  null;

let movementRequestSequence =
  0;

const processedMovementRequestIds =
  new Map();

export function registerWebMutableStateSocket(
  runtime
) {
  if (
    registration
  ) {
    return false;
  }

  const socket =
    globalThis.game?.socket;

  const hooks =
    globalThis.Hooks;

  if (
    typeof socket?.on !==
      "function" ||
    typeof socket?.emit !==
      "function" ||
    typeof hooks?.on !==
      "function"
  ) {
    return false;
  }

  const handleSocketMessage =
    message =>
      handleMessage({
        runtime,
        socket,
        message
      });

  socket.on(
    SOCKET_CHANNEL,
    handleSocketMessage
  );

  const hookIds =
    [
      {
        event:
          `${MODULE_ID}.mutableStateChanged`,
        id:
          hooks.on(
            `${MODULE_ID}.mutableStateChanged`,
            (
              snapshot,
              context = {}
            ) => {
              if (
                globalThis.game?.user?.isGM ===
                  true &&
                context?.remote !==
                  true
              ) {
                emitSnapshot({
                  runtime,
                  socket,
                  snapshot,
                  reason:
                    context?.reason ??
                    "mutable-state-change"
                });
              }
            }
          )
      },
      {
        event:
          "canvasReady",
        id:
          hooks.on(
            "canvasReady",
            () => {
              if (
                globalThis.game?.user?.isGM !==
                  true
              ) {
                requestSnapshot(
                  socket
                );
              }
            }
          )
      }
    ];

  registration =
    {
      socket,
      handleSocketMessage,
      hookIds
    };

  if (
    globalThis.game?.user?.isGM !==
      true &&
    globalThis.canvas?.ready ===
      true
  ) {
    requestSnapshot(
      socket
    );
  }

  return true;
}

/**
 * Submit one locally observed rendered token segment for GM validation.
 *
 * The initiating player never mutates web state directly. The GM independently
 * resolves the current TokenDocument, level and collision radius, re-runs the
 * spatial intersection query, and owns the resulting destruction.
 */
export function requestTokenSpanWebMovement({
  movement,
  from,
  to,
  hitWebIds = [],
  animate = false
}) {
  if (
    globalThis.game?.user?.isGM ===
      true
  ) {
    return false;
  }

  const socket =
    registration?.socket ??
    globalThis.game?.socket;

  if (
    typeof socket?.emit !==
      "function"
  ) {
    return false;
  }

  const requesterUserId =
    normaliseIdentifier(
      globalThis.game?.user?.id
    );

  const tokenId =
    normaliseIdentifier(
      movement?.tokenId
    );

  const sceneId =
    normaliseIdentifier(
      movement?.sceneId
    );

  const segmentFrom =
    normalisePoint(
      from
    );

  const segmentTo =
    normalisePoint(
      to
    );

  const movementFrom =
    normalisePoint(
      movement?.from?.centre
    );

  const movementTo =
    normalisePoint(
      movement?.to?.centre
    );

  if (
    !requesterUserId ||
    !tokenId ||
    !sceneId ||
    !segmentFrom ||
    !segmentTo ||
    !movementFrom ||
    !movementTo ||
    pointsEqual(
      segmentFrom,
      segmentTo
    )
  ) {
    return false;
  }

  movementRequestSequence +=
    1;

  const sentAt =
    Date.now();

  socket.emit(
    SOCKET_CHANNEL,
    {
      type:
        MESSAGE_TYPES.TOKEN_MOVEMENT_REQUEST,
      requestId:
        [
          requesterUserId,
          tokenId,
          Number(
            movement?.capturedAt
          ) ||
            sentAt,
          movementRequestSequence
        ].join(
          ":"
        ),
      requesterUserId,
      sceneId,
      tokenId,
      movementFrom,
      movementTo,
      segmentFrom,
      segmentTo,
      hitWebIds:
        normaliseIdentifierList(
          hitWebIds
        ),
      animate:
        animate ===
          true,
      capturedAt:
        Number(
          movement?.capturedAt
        ) ||
          sentAt,
      sentAt
    }
  );

  return true;
}

export function disposeWebMutableStateSocket() {
  if (
    !registration
  ) {
    return false;
  }

  const hooks =
    globalThis.Hooks;

  for (
    const hook of
    registration.hookIds
  ) {
    hooks?.off?.(
      hook.event,
      hook.id
    );
  }

  registration.socket?.off?.(
    SOCKET_CHANNEL,
    registration.handleSocketMessage
  );

  registration =
    null;

  processedMovementRequestIds.clear();

  return true;
}

function handleMessage({
  runtime,
  socket,
  message
}) {
  if (
    !message ||
    typeof message !==
      "object"
  ) {
    return;
  }

  if (
    message.type ===
      MESSAGE_TYPES.TOKEN_MOVEMENT_REQUEST
  ) {
    handleTokenSpanMovementRequest({
      runtime,
      message
    });

    return;
  }

  if (
    message.type ===
      MESSAGE_TYPES.REQUEST
  ) {
    if (
      globalThis.game?.user?.isGM ===
        true
    ) {
      emitSnapshot({
        runtime,
        socket,
        targetUserId:
          normaliseIdentifier(
            message.requesterUserId
          ),
        reason:
          "state-request"
      });
    }

    return;
  }

  if (
    message.type !==
      MESSAGE_TYPES.SNAPSHOT ||
    globalThis.game?.user?.isGM ===
      true
  ) {
    return;
  }

  const currentUserId =
    normaliseIdentifier(
      globalThis.game?.user?.id
    );

  const targetUserId =
    normaliseIdentifier(
      message.targetUserId
    );

  if (
    targetUserId &&
    targetUserId !==
      currentUserId
  ) {
    return;
  }

  runtime
    ?.getWebRuntimeService?.()
    ?.applyMutableStateSnapshot?.(
      message.snapshot,
      {
        reason:
          normaliseIdentifier(
            message.reason
          ) ??
          "socket-state-snapshot"
      }
    );
}

function handleTokenSpanMovementRequest({
  runtime,
  message
}) {
  if (
    globalThis.game?.user?.isGM !==
      true ||
    !isResponsibleActiveGM()
  ) {
    return false;
  }

  const request =
    normaliseTokenMovementRequest(
      message
    );

  if (!request) {
    return false;
  }

  pruneProcessedMovementRequests();

  if (
    processedMovementRequestIds.has(
      request.requestId
    )
  ) {
    return false;
  }

  const service =
    runtime
      ?.getWebRuntimeService?.();

  const state =
    service?.getState?.();

  if (
    !service ||
    state?.active !==
      true ||
    state?.sceneId !==
      request.sceneId ||
    normaliseIdentifier(
      globalThis.canvas?.scene?.id
    ) !==
      request.sceneId
  ) {
    return false;
  }

  const tokenDocument =
    resolveTokenDocument(
      request.sceneId,
      request.tokenId
    );

  if (
    !tokenDocument ||
    !requesterMayMoveToken(
      request.requesterUserId,
      tokenDocument
    )
  ) {
    return false;
  }

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

  if (
    current.tokenId !==
      request.tokenId ||
    current.sceneId !==
      request.sceneId ||
    !current.levelId
  ) {
    return false;
  }

  const pathTolerance =
    current.collisionRadiusPx +
    MOVEMENT_PATH_TOLERANCE_PX;

  /**
   * A player socket message can reach the GM before Foundry applies the same
   * TokenDocument update on the GM client. Accept either endpoint, or any
   * intermediate authoritative position on the declared movement path,
   * instead of requiring the GM document to have already reached the final
   * destination. This removes the deterministic one-movement delay while
   * still rejecting requests unrelated to the authoritative token position.
   */
  if (
    pointToSegmentDistance(
      current.centre,
      request.movementFrom,
      request.movementTo
    ) >
      pathTolerance ||
    pointToSegmentDistance(
      request.segmentFrom,
      request.movementFrom,
      request.movementTo
    ) >
      pathTolerance ||
    pointToSegmentDistance(
      request.segmentTo,
      request.movementFrom,
      request.movementTo
    ) >
      pathTolerance
  ) {
    return false;
  }

  processedMovementRequestIds.set(
    request.requestId,
    Date.now()
  );

  const hits =
    service.queryMovementIntersections({
      from:
        request.segmentFrom,
      to:
        request.segmentTo,
      levelId:
        current.levelId,
      elevation:
        current.elevation,
      collisionRadiusPx:
        current.collisionRadiusPx,
      categories:
        [
          "wall-span"
        ]
    });

  if (
    !Array.isArray(
      hits
    ) ||
    hits.length ===
      0
  ) {
    return true;
  }

  service.destroyWebs(
    hits.map(
      hit =>
        hit.webId
    ),
    {
      cause:
        "token-movement",
      entityId:
        request.tokenId,
      userId:
        request.requesterUserId,
      animate:
        request.animate
    }
  );

  return true;
}

function normaliseTokenMovementRequest(
  message
) {
  const requestId =
    normaliseIdentifier(
      message?.requestId
    );

  const requesterUserId =
    normaliseIdentifier(
      message?.requesterUserId
    );

  const sceneId =
    normaliseIdentifier(
      message?.sceneId
    );

  const tokenId =
    normaliseIdentifier(
      message?.tokenId
    );

  const movementFrom =
    normalisePoint(
      message?.movementFrom
    );

  const movementTo =
    normalisePoint(
      message?.movementTo
    );

  const segmentFrom =
    normalisePoint(
      message?.segmentFrom
    );

  const segmentTo =
    normalisePoint(
      message?.segmentTo
    );

  const sentAt =
    Number(
      message?.sentAt
    );

  const now =
    Date.now();

  if (
    !requestId ||
    !requesterUserId ||
    !sceneId ||
    !tokenId ||
    !movementFrom ||
    !movementTo ||
    !segmentFrom ||
    !segmentTo ||
    !Number.isFinite(
      sentAt
    ) ||
    now -
      sentAt <
        -1000 ||
    now -
      sentAt >
        MOVEMENT_REQUEST_MAXIMUM_AGE_MS ||
    pointsEqual(
      segmentFrom,
      segmentTo
    )
  ) {
    return null;
  }

  return Object.freeze({
    requestId,
    requesterUserId,
    sceneId,
    tokenId,
    movementFrom:
      Object.freeze(
        movementFrom
      ),
    movementTo:
      Object.freeze(
        movementTo
      ),
    segmentFrom:
      Object.freeze(
        segmentFrom
      ),
    segmentTo:
      Object.freeze(
        segmentTo
      ),
    animate:
      message?.animate ===
        true
  });
}

function requestSnapshot(
  socket
) {
  socket.emit(
    SOCKET_CHANNEL,
    {
      type:
        MESSAGE_TYPES.REQUEST,
      requesterUserId:
        normaliseIdentifier(
          globalThis.game?.user?.id
        ),
      sceneId:
        normaliseIdentifier(
          globalThis.canvas?.scene?.id
        )
    }
  );
}

function emitSnapshot({
  runtime,
  socket,
  snapshot = null,
  targetUserId = null,
  reason = null
}) {
  const state =
    snapshot ??
    runtime
      ?.getWebRuntimeService?.()
      ?.getMutableState?.();

  if (
    !state
  ) {
    return false;
  }

  socket.emit(
    SOCKET_CHANNEL,
    {
      type:
        MESSAGE_TYPES.SNAPSHOT,
      targetUserId:
        normaliseIdentifier(
          targetUserId
        ),
      reason:
        normaliseIdentifier(
          reason
        ),
      snapshot:
        state
    }
  );

  return true;
}

function resolveTokenDocument(
  sceneId,
  tokenId
) {
  const tokenPlaceable =
    globalThis.canvas
      ?.tokens
      ?.get?.(
        tokenId
      ) ??
    (
      Array.isArray(
        globalThis.canvas?.tokens?.placeables
      )
        ? globalThis.canvas.tokens.placeables.find(
            token =>
              normaliseIdentifier(
                token?.id ??
                token?.document?.id
              ) ===
                tokenId
          )
        : null
    );

  if (
    tokenPlaceable?.document
  ) {
    return tokenPlaceable.document;
  }

  const scene =
    normaliseIdentifier(
      globalThis.canvas?.scene?.id
    ) ===
      sceneId
      ? globalThis.canvas.scene
      : globalThis.game
          ?.scenes
          ?.get?.(
            sceneId
          );

  const collectionToken =
    scene?.tokens?.get?.(
      tokenId
    );

  if (
    collectionToken
  ) {
    return collectionToken;
  }

  const tokenValues =
    Array.isArray(
      scene?.tokens?.contents
    )
      ? scene.tokens.contents
      : Array.isArray(
          scene?.tokens
        )
        ? scene.tokens
        : [];

  return tokenValues.find(
    token =>
      normaliseIdentifier(
        token?.id ??
          token?._id
      ) ===
        tokenId
  ) ??
    null;
}

function requesterMayMoveToken(
  requesterUserId,
  tokenDocument
) {
  const users =
    globalThis.game?.users;

  const requester =
    users?.get?.(
      requesterUserId
    ) ??
    (
      Array.isArray(
        users?.contents
      )
        ? users.contents.find(
            user =>
              normaliseIdentifier(
                user?.id
              ) ===
                requesterUserId
          )
        : null
    );

  if (
    !requester
  ) {
    return true;
  }

  if (
    requester.isGM ===
      true
  ) {
    return true;
  }

  if (
    typeof tokenDocument?.testUserPermission ===
      "function"
  ) {
    try {
      return tokenDocument.testUserPermission(
        requester,
        "OWNER"
      ) ===
        true;
    } catch (_error) {
      return false;
    }
  }

  return true;
}

function isResponsibleActiveGM() {
  const currentUserId =
    normaliseIdentifier(
      globalThis.game?.user?.id
    );

  if (!currentUserId) {
    return false;
  }

  const users =
    globalThis.game?.users;

  const values =
    Array.isArray(
      users?.contents
    )
      ? users.contents
      : Array.isArray(
          users
        )
        ? users
        : typeof users?.values ===
            "function"
          ? Array.from(
              users.values()
            )
          : [];

  const activeGMs =
    values
      .filter(
        user =>
          user?.isGM ===
            true &&
          user?.active !==
            false &&
          normaliseIdentifier(
            user?.id
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          String(
            first.id
          ).localeCompare(
            String(
              second.id
            )
          )
      );

  return activeGMs.length ===
    0 ||
    normaliseIdentifier(
      activeGMs[0]?.id
    ) ===
      currentUserId;
}

function pruneProcessedMovementRequests() {
  const oldestAllowedTimestamp =
    Date.now() -
    MOVEMENT_REQUEST_MAXIMUM_AGE_MS;

  for (
    const [
      requestId,
      processedAt
    ] of processedMovementRequestIds
  ) {
    if (
      processedAt <
        oldestAllowedTimestamp
    ) {
      processedMovementRequestIds.delete(
        requestId
      );
    }
  }
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
          normaliseIdentifier
        )
        .filter(
          Boolean
        )
    )
  ).sort();
}

function normalisePoint(
  value
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
    return null;
  }

  return {
    x,
    y
  };
}

function pointsEqual(
  first,
  second
) {
  return pointDistance(
    first,
    second
  ) <=
    POINT_EPSILON;
}

function pointDistance(
  first,
  second
) {
  return Math.hypot(
    Number(
      first?.x
    ) -
      Number(
        second?.x
      ),
    Number(
      first?.y
    ) -
      Number(
        second?.y
      )
  );
}

function pointToSegmentDistance(
  point,
  start,
  end
) {
  const dx =
    end.x -
    start.x;

  const dy =
    end.y -
    start.y;

  const lengthSquared =
    dx *
      dx +
    dy *
      dy;

  if (
    lengthSquared <=
      POINT_EPSILON
  ) {
    return pointDistance(
      point,
      start
    );
  }

  const parameter =
    Math.max(
      0,
      Math.min(
        1,
        (
          (
            point.x -
            start.x
          ) *
            dx +
          (
            point.y -
            start.y
          ) *
            dy
        ) /
          lengthSquared
      )
    );

  return pointDistance(
    point,
    {
      x:
        start.x +
        dx *
          parameter,
      y:
        start.y +
        dy *
          parameter
    }
  );
}

function normaliseIdentifier(
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
