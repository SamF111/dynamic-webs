import {
  MODULE_TITLE,
  WEB_MUTABLE_STATE_SCHEMA_VERSION
} from "../module/moduleConstants.js";

/**
 * Mutable whole-span state layered over immutable generated web blueprints.
 *
 * Only stable wall-span web IDs are stored. Scene entry hydrates the compact
 * persistent flag, deterministic regeneration reconciles those IDs against
 * the new population, and no blueprint object is ever mutated.
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

    this.eligibleWebIds =
      new Set();

    this.lastMutation =
      null;

    this.lastReconciliation =
      null;
  }

  reconcile({
    sceneId,
    generationId,
    webs,
    persistedState = null
  }) {
    const nextSceneId =
      normaliseIdentifier(
        sceneId
      );

    const enteringScene =
      this.sceneId !==
        nextSceneId;

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
            web =>
              web?.kind ===
                "wall-span"
          )
          .map(
            web =>
              String(
                web.id
              )
          )
      );

    if (
      enteringScene
    ) {
      const hydrated =
        normalisePersistentSnapshot(
          persistedState
        );

      this.sceneId =
        nextSceneId;

      this.revision =
        hydrated.revision;

      this.destroyedWebIds =
        new Set(
          hydrated.destroyedWebIds
        );

      this.lastMutation =
        null;
    }

    this.eligibleWebIds =
      validDestroyableIds;

    const prunedWebIds =
      [];

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

        prunedWebIds.push(
          webId
        );
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
      prunedWebIds.length >
        0
    ) {
      this.revision +=
        1;

      this.lastMutation =
        createMutationSnapshot({
          action:
            "reconcile-prune",
          webIds:
            prunedWebIds,
          metadata: {
            cause:
              "deterministic-regeneration"
          }
        });
    }

    this.lastReconciliation =
      deepFreezeClone({
        at:
          Date.now(),
        sceneId:
          nextSceneId,
        generationId:
          this.generationId,
        hydratedFromPersistence:
          enteringScene &&
          persistedState !==
            null &&
          persistedState !==
            undefined,
        persistedRevision:
          enteringScene
            ? normalisePersistentSnapshot(
                persistedState
              ).revision
            : null,
        eligibleWebCount:
          validDestroyableIds.size,
        prunedWebIds:
          prunedWebIds.sort()
      });

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
      !this.eligibleWebIds.has(
        id
      ) ||
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
        this.eligibleWebIds.has(
          id
        ) &&
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
        0 ||
      this.eligibleWebIds.size >
        0;

    this.sceneId =
      null;

    this.generationId =
      0;

    this.revision =
      0;

    this.destroyedWebIds.clear();
    this.eligibleWebIds.clear();

    this.lastMutation =
      null;

    this.lastReconciliation =
      null;

    return hadState;
  }

  applySnapshot(
    snapshot,
    {
      expectedSceneId =
        null,
      allowRevisionRollback =
        false
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

    const schemaVersion =
      snapshot.schemaVersion ===
        undefined
        ? WEB_MUTABLE_STATE_SCHEMA_VERSION
        : Number(
            snapshot.schemaVersion
          );

    if (
      !Number.isInteger(
        schemaVersion
      ) ||
      schemaVersion !==
        WEB_MUTABLE_STATE_SCHEMA_VERSION
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | Unsupported mutable web-state schema version.`
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

    const incomingEligibleWebIds =
      Array.isArray(
        snapshot.eligibleWebIds
      )
        ? normaliseIdentifierList(
            snapshot.eligibleWebIds
          )
        : null;

    const eligibility =
      incomingEligibleWebIds
        ? new Set(
            incomingEligibleWebIds
          )
        : this.eligibleWebIds;

    const incomingDestroyedWebIds =
      normaliseIdentifierList(
        snapshot.destroyedWebIds
      ).filter(
        webId =>
          eligibility.size ===
            0 ||
          eligibility.has(
            webId
          )
      );

    if (
      allowRevisionRollback !==
        true &&
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

    if (!sceneId) {
      this.eligibleWebIds.clear();
    }

    this.generationId =
      Number.isInteger(
        Number(
          snapshot.generationId
        )
      )
        ? Number(
            snapshot.generationId
          )
        : this.generationId;

    this.revision =
      incomingRevision;

    this.destroyedWebIds =
      new Set(
        incomingDestroyedWebIds
      );

    if (
      incomingEligibleWebIds
    ) {
      this.eligibleWebIds =
        new Set(
          incomingEligibleWebIds
        );
    }

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
      schemaVersion:
        WEB_MUTABLE_STATE_SCHEMA_VERSION,
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
      eligibleWebIds:
        Array.from(
          this.eligibleWebIds
        ).sort(),
      eligibleWebCount:
        this.eligibleWebIds.size,
      lastMutation:
        this.lastMutation,
      lastReconciliation:
        this.lastReconciliation
    });
  }
}

function normalisePersistentSnapshot(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return Object.freeze({
      revision:
        0,
      destroyedWebIds:
        Object.freeze([])
    });
  }

  const revision =
    Number(
      value.revision
    );

  return Object.freeze({
    revision:
      Number.isInteger(
        revision
      ) &&
      revision >=
        0
        ? revision
        : 0,
    destroyedWebIds:
      Object.freeze(
        normaliseIdentifierList(
          value.destroyedWebIds
        )
      )
  });
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
