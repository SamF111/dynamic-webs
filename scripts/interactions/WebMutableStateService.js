import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

/**
 * Session-scoped mutable state for immutable generated web blueprints.
 *
 * Only stable web IDs are stored. Regeneration reconciles those IDs against
 * the new deterministic population, preserving compatible destroyed spans
 * without mutating any blueprint object.
 */
export class WebMutableStateService {
  constructor() {
    this.sceneId =
      null;

    this.generationId =
      0;

    this.revision =
      0;

    this.destroyedWebIds =
      new Set();

    this.lastMutation =
      null;
  }

  reconcile({
    sceneId,
    generationId,
    webs
  }) {
    const nextSceneId =
      normaliseIdentifier(
        sceneId
      );

    const sceneChanged =
      this.sceneId !==
        null &&
      this.sceneId !==
        nextSceneId;

    if (
      sceneChanged
    ) {
      this.destroyedWebIds.clear();
    }

    const validDestroyableIds =
      new Set(
        (
          Array.isArray(
            webs
          )
            ? webs
            : []
        )
          .filter(
            (
              web
            ) =>
              web?.kind ===
                "wall-span"
          )
          .map(
            (
              web
            ) =>
              String(
                web.id
              )
          )
      );

    let pruned =
      false;

    for (
      const webId of
      this.destroyedWebIds
    ) {
      if (
        !validDestroyableIds.has(
          webId
        )
      ) {
        this.destroyedWebIds.delete(
          webId
        );

        pruned =
          true;
      }
    }

    this.sceneId =
      nextSceneId;

    this.generationId =
      Number.isInteger(
        generationId
      )
        ? generationId
        : 0;

    if (
      sceneChanged ||
      pruned
    ) {
      this.revision +=
        1;

      this.lastMutation =
        Object.freeze({
          action:
            sceneChanged
              ? "scene-reset"
              : "reconcile-prune",
          at:
            Date.now(),
          cause:
            "deterministic-regeneration"
        });
    }

    return this.createSnapshot();
  }

  isWebIntact(
    webId
  ) {
    const id =
      normaliseIdentifier(
        webId
      );

    return !id ||
      !this.destroyedWebIds.has(
        id
      );
  }

  destroyWeb(
    webId,
    metadata = {}
  ) {
    const id =
      requireIdentifier(
        webId,
        "destroyed web ID"
      );

    if (
      this.destroyedWebIds.has(
        id
      )
    ) {
      return false;
    }

    this.destroyedWebIds.add(
      id
    );

    this.revision +=
      1;

    this.lastMutation =
      createMutationSnapshot({
        action:
          "destroy",
        webIds:
          [
            id
          ],
        metadata
      });

    return true;
  }

  destroyWebs(
    webIds,
    metadata = {}
  ) {
    const ids =
      normaliseIdentifierList(
        webIds
      );

    const changed =
      [];

    for (
      const id of
      ids
    ) {
      if (
        !this.destroyedWebIds.has(
          id
        )
      ) {
        this.destroyedWebIds.add(
          id
        );

        changed.push(
          id
        );
      }
    }

    if (
      changed.length ===
        0
    ) {
      return Object.freeze([]);
    }

    this.revision +=
      1;

    this.lastMutation =
      createMutationSnapshot({
        action:
          "destroy",
        webIds:
          changed,
        metadata
      });

    return Object.freeze(
      changed
    );
  }

  restoreWeb(
    webId,
    metadata = {}
  ) {
    const id =
      requireIdentifier(
        webId,
        "restored web ID"
      );

    if (
      !this.destroyedWebIds.delete(
        id
      )
    ) {
      return false;
    }

    this.revision +=
      1;

    this.lastMutation =
      createMutationSnapshot({
        action:
          "restore",
        webIds:
          [
            id
          ],
        metadata
      });

    return true;
  }

  reset(
    metadata = {}
  ) {
    if (
      this.destroyedWebIds.size ===
        0
    ) {
      return false;
    }

    const restoredWebIds =
      Array.from(
        this.destroyedWebIds
      ).sort();

    this.destroyedWebIds.clear();

    this.revision +=
      1;

    this.lastMutation =
      createMutationSnapshot({
        action:
          "reset",
        webIds:
          restoredWebIds,
        metadata
      });

    return true;
  }

  clear() {
    const hadState =
      this.sceneId !==
        null ||
      this.destroyedWebIds.size >
        0;

    this.sceneId =
      null;

    this.generationId =
      0;

    this.destroyedWebIds.clear();

    if (
      hadState
    ) {
      this.revision +=
        1;

      this.lastMutation =
        Object.freeze({
          action:
            "clear",
          at:
            Date.now(),
          cause:
            "runtime-clear",
          webIds:
            Object.freeze([]),
          entityId:
            null
        });
    }

    return hadState;
  }

  applySnapshot(
    snapshot,
    {
      expectedSceneId =
        null
    } = {}
  ) {
    if (
      !snapshot ||
      typeof snapshot !==
        "object" ||
      Array.isArray(
        snapshot
      )
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | A mutable web-state snapshot is required.`
      );
    }

    const sceneId =
      normaliseIdentifier(
        snapshot.sceneId
      );

    const requiredSceneId =
      normaliseIdentifier(
        expectedSceneId
      );

    if (
      requiredSceneId &&
      sceneId !==
        requiredSceneId
    ) {
      return false;
    }

    const incomingRevision =
      Number(
        snapshot.revision
      );

    if (
      !Number.isInteger(
        incomingRevision
      ) ||
      incomingRevision <
        0
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | Mutable web-state revision must be a non-negative integer.`
      );
    }

    const incomingDestroyedWebIds =
      normaliseIdentifierList(
        snapshot.destroyedWebIds
      );

    if (
      this.sceneId ===
        sceneId &&
      incomingRevision <
        this.revision
    ) {
      return false;
    }

    if (
      this.sceneId ===
        sceneId &&
      incomingRevision ===
        this.revision &&
      arraysEqual(
        Array.from(
          this.destroyedWebIds
        ).sort(),
        incomingDestroyedWebIds
      )
    ) {
      return false;
    }

    this.sceneId =
      sceneId;

    this.generationId =
      Number.isInteger(
        Number(
          snapshot.generationId
        )
      )
        ? Number(
            snapshot.generationId
          )
        : 0;

    this.revision =
      incomingRevision;

    this.destroyedWebIds =
      new Set(
        incomingDestroyedWebIds
      );

    this.lastMutation =
      snapshot.lastMutation &&
      typeof snapshot.lastMutation ===
        "object"
        ? deepFreezeClone(
            snapshot.lastMutation
          )
        : null;

    return true;
  }

  createSnapshot() {
    return deepFreezeClone({
      sceneId:
        this.sceneId,
      generationId:
        this.generationId,
      revision:
        this.revision,
      destroyedWebIds:
        Array.from(
          this.destroyedWebIds
        ).sort(),
      destroyedWebCount:
        this.destroyedWebIds.size,
      lastMutation:
        this.lastMutation
    });
  }
}

function createMutationSnapshot({
  action,
  webIds,
  metadata
}) {
  return deepFreezeClone({
    action,
    at:
      Date.now(),
    cause:
      normaliseIdentifier(
        metadata?.cause
      ) ??
      "public-api",
    entityId:
      normaliseIdentifier(
        metadata?.entityId
      ),
    userId:
      normaliseIdentifier(
        metadata?.userId
      ),
    webIds:
      normaliseIdentifierList(
        webIds
      )
  });
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
          : values ===
                null ||
              values ===
                undefined
            ? []
            : [
                values
              ]
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

function requireIdentifier(
  value,
  label
) {
  const id =
    normaliseIdentifier(
      value
    );

  if (!id) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a non-empty identifier.`
    );
  }

  return id;
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

function arraysEqual(
  first,
  second
) {
  return first.length ===
    second.length &&
    first.every(
      (
        value,
        index
      ) =>
        value ===
        second[index]
    );
}

function deepFreezeClone(
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
        deepFreezeClone
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
      deepFreezeClone(
        entry
      );
  }

  return Object.freeze(
    clone
  );
}
