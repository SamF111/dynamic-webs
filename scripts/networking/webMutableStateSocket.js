import {
  MODULE_ID
} from "../module/moduleConstants.js";

const SOCKET_CHANNEL =
  `module.${MODULE_ID}`;

const MESSAGE_TYPES =
  Object.freeze({
    REQUEST:
      "mutable-state-request",
    SNAPSHOT:
      "mutable-state-snapshot"
  });

let registration =
  null;

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
