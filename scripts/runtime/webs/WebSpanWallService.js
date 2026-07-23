import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

import {
  createGeneratedSpanWallData,
  generatedSpanWallMatches,
  getGeneratedSpanWallWebId,
  isGeneratedSpanWallDocument,
  isGeneratedSpanWallOpenSecretDoor,
  mergeGeneratedSpanWallFlags
} from "../../foundry/webSpanWallCompatibility.js";

/**
 * GM-owned reconciliation of module-generated WallDocuments for intact spans.
 *
 * Requests are coalesced so rapid regeneration or mutable-state changes apply
 * only the newest desired state. Geometry remains authoritative in generated
 * span blueprints; WallDocuments are derived Scene presentation/interaction
 * documents and are never used as generation inputs.
 */
export class WebSpanWallService {
  constructor() {
    this.pendingJobs =
      [];

    this.reconciliationPromise =
      null;

    /**
     * Fast-path index populated from authoritative Scene WallDocuments.
     * Missing entries always fall back to a Scene collection scan.
     */
    this.wallIdsBySceneId =
      new Map();

    this.diagnostics =
      createEmptyDiagnostics();
  }

  requestReconciliation({
    scene,
    webs,
    destroyedWebIds = [],
    behaviour,
    generationId = null,
    reason = "span-wall-reconciliation"
  }) {
    const sceneId =
      resolveSceneId(
        scene
      );

    if (!sceneId) {
      return false;
    }

    const job =
      Object.freeze({
        type:
          "reconcile",
        scene,
        sceneId,
        webs:
          Object.freeze([
            ...(
              Array.isArray(
                webs
              )
                ? webs
                : []
            )
          ]),
        destroyedWebIds:
          Object.freeze([
            ...new Set(
              (
                Array.isArray(
                  destroyedWebIds
                )
                  ? destroyedWebIds
                  : []
              ).map(
                String
              )
            )
          ]),
        behaviour:
          normaliseBehaviour(
            behaviour
          ),
        generationId:
          normaliseGenerationId(
            generationId
          ),
        reason:
          String(
            reason ??
            "span-wall-reconciliation"
          )
      });

    /**
     * A full reconciliation is authoritative for the complete Scene state.
     * Supersede every still-pending targeted mutation for the same Scene.
     */
    this.pendingJobs =
      this.pendingJobs.filter(
        pending =>
          pending.sceneId !==
            sceneId
      );

    return this.#queueJob(
      job
    );
  }

  /**
   * Delete only the generated walls belonging to the supplied destroyed spans.
   */
  requestWebRemoval({
    scene,
    webIds,
    generationId = null,
    reason = "destroy-span-wall"
  }) {
    const sceneId =
      resolveSceneId(
        scene
      );

    const identifiers =
      normaliseIdentifierList(
        webIds
      );

    if (
      !sceneId ||
      identifiers.length ===
        0
    ) {
      return false;
    }

    const job =
      Object.freeze({
        type:
          "remove",
        scene,
        sceneId,
        webIds:
          Object.freeze(
            identifiers
          ),
        generationId:
          normaliseGenerationId(
            generationId
          ),
        reason:
          String(
            reason ??
            "destroy-span-wall"
          )
      });

    const last =
      this.pendingJobs.at(
        -1
      );

    if (
      last?.type ===
        "remove" &&
      last.sceneId ===
        sceneId
    ) {
      this.pendingJobs[
        this.pendingJobs.length -
        1
      ] =
        Object.freeze({
          ...last,
          webIds:
            Object.freeze(
              normaliseIdentifierList([
                ...last.webIds,
                ...identifiers
              ])
            ),
          generationId:
            job.generationId,
          reason:
            job.reason
        });

      this.#markRequested(
        job
      );

      this.#ensureDrain();

      return true;
    }

    return this.#queueJob(
      job
    );
  }

  /**
   * Create or repair only the generated walls belonging to restored spans.
   */
  requestWebRestoration({
    scene,
    webs,
    behaviour,
    generationId = null,
    reason = "restore-span-wall"
  }) {
    const sceneId =
      resolveSceneId(
        scene
      );

    const restoredWebs =
      (
        Array.isArray(
          webs
        )
          ? webs
          : []
      ).filter(
        web =>
          web?.kind ===
            "wall-span" &&
          String(
            web?.id ??
            ""
          ).trim()
      );

    if (
      !sceneId ||
      restoredWebs.length ===
        0
    ) {
      return false;
    }

    return this.#queueJob(
      Object.freeze({
        type:
          "restore",
        scene,
        sceneId,
        webs:
          Object.freeze([
            ...restoredWebs
          ]),
        behaviour:
          normaliseBehaviour(
            behaviour
          ),
        generationId:
          normaliseGenerationId(
            generationId
          ),
        reason:
          String(
            reason ??
            "restore-span-wall"
          )
      })
    );
  }

  async flush() {
    while (
      this.pendingJobs.length >
        0 ||
      this.reconciliationPromise
    ) {
      this.#ensureDrain();

      if (
        this.reconciliationPromise
      ) {
        await this.reconciliationPromise;
      }
    }

    return this.createDiagnosticSnapshot();
  }

  createDiagnosticSnapshot() {
    return deepFreezeClone(
      this.diagnostics
    );
  }

  /** Forget one Scene's fast-path generated-wall index after external maintenance. */
  invalidateSceneWallIndex(
    sceneId
  ) {
    const identifier =
      String(
        sceneId ??
        ""
      ).trim();

    return identifier
      ? this.wallIdsBySceneId.delete(
          identifier
        )
      : false;
  }

  #queueJob(
    job
  ) {
    this.pendingJobs.push(
      job
    );

    this.#markRequested(
      job
    );

    this.#ensureDrain();

    return true;
  }

  #markRequested(
    job
  ) {
    this.diagnostics = {
      ...this.diagnostics,
      sceneId:
        job.sceneId,
      pending:
        true,
      generationId:
        job.generationId,
      lastRequestedAt:
        Date.now(),
      lastReason:
        job.reason,
      lastOperationType:
        job.type,
      targetWebIds:
        Object.freeze(
          job.type ===
            "remove"
            ? [
                ...job.webIds
              ]
            : job.type ===
                "restore"
              ? job.webs.map(
                  web =>
                    String(
                      web.id
                    )
                )
              : []
        )
    };
  }

  #ensureDrain() {
    if (
      this.reconciliationPromise
    ) {
      return;
    }

    this.reconciliationPromise =
      this.#drain()
        .finally(
          () => {
            this.reconciliationPromise =
              null;

            this.diagnostics = {
              ...this.diagnostics,
              pending:
                this.pendingJobs.length >
                  0
            };

            if (
              this.pendingJobs.length >
                0
            ) {
              this.#ensureDrain();
            }
          }
        );
  }

  async #drain() {
    while (
      this.pendingJobs.length >
        0
    ) {
      const job =
        this.pendingJobs.shift();

      try {
        let result;

        if (
          job.type ===
            "remove"
        ) {
          result =
            await this.#removeWebWalls(
              job
            );
        } else if (
          job.type ===
            "restore"
        ) {
          result =
            await this.#restoreWebWalls(
              job
            );
        } else {
          result =
            await this.#reconcile(
              job
            );
        }

        this.diagnostics = {
          ...this.diagnostics,
          sceneId:
            job.sceneId,
          pending:
            this.pendingJobs.length >
              0,
          generationId:
            job.generationId,
          lastReason:
            job.reason,
          lastOperationType:
            job.type,
          lastCompletedAt:
            Date.now(),
          lastError:
            null,
          deferredCount:
            0,
          deferredWallIds:
            Object.freeze([]),
          ...result
        };
      } catch (error) {
        this.diagnostics = {
          ...this.diagnostics,
          sceneId:
            job.sceneId,
          pending:
            this.pendingJobs.length >
              0,
          generationId:
            job.generationId,
          lastReason:
            job.reason,
          lastOperationType:
            job.type,
          lastCompletedAt:
            Date.now(),
          lastError:
            Object.freeze({
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
            })
        };

        console.warn(
          "dynamic-webs | Generated wall-span WallDocuments could not be updated.",
          error
        );
      }
    }
  }

  async #reconcile(
    job
  ) {
    if (
      globalThis.game?.user?.isGM !==
        true
    ) {
      return {
        authoritative:
          false,
        desiredWallCount:
          0,
        activeWallCount:
          collectGeneratedWalls(
            job.scene
          ).length,
        createdCount:
          0,
        updatedCount:
          0,
        deletedCount:
          0
      };
    }

    const scene =
      job.scene;

    const canWrite =
      typeof scene.createEmbeddedDocuments ===
        "function" &&
      typeof scene.updateEmbeddedDocuments ===
        "function" &&
      typeof scene.deleteEmbeddedDocuments ===
        "function";

    if (
      !canWrite
    ) {
      return {
        authoritative:
          false,
        desiredWallCount:
          0,
        activeWallCount:
          collectGeneratedWalls(
            scene
          ).length,
        createdCount:
          0,
        updatedCount:
          0,
        deletedCount:
          0,
        skippedReason:
          "scene-not-writable"
      };
    }

    const wallEffectsEnabled =
      job.behaviour.secretDoor ===
        true ||
      job.behaviour.visionMode !==
        "none";

    const destroyed =
      new Set(
        job.destroyedWebIds
      );

    const desiredWebs =
      wallEffectsEnabled
        ? job.webs
            .filter(
              web =>
                web?.kind ===
                  "wall-span" &&
                !destroyed.has(
                  String(
                    web.id
                  )
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
            )
        : [];

    const existingWalls =
      collectGeneratedWalls(
        scene
      );

    const existingByWebId =
      new Map();

    const duplicateWallIds =
      [];

    for (
      const wall of
      existingWalls
    ) {
      const webId =
        getGeneratedSpanWallWebId(
          wall
        );

      if (
        !webId ||
        existingByWebId.has(
          webId
        )
      ) {
        const wallId =
          getDocumentId(
            wall
          );

        if (
          wallId
        ) {
          duplicateWallIds.push(
            wallId
          );
        }

        continue;
      }

      existingByWebId.set(
        webId,
        wall
      );
    }

    const desiredByWebId =
      new Map();

    for (
      const web of
      desiredWebs
    ) {
      desiredByWebId.set(
        String(
          web.id
        ),
        web
      );
    }

    const deleteIds =
      [
        ...duplicateWallIds
      ];

    for (
      const [
        webId,
        wall
      ] of existingByWebId
    ) {
      if (
        !desiredByWebId.has(
          webId
        )
      ) {
        const wallId =
          getDocumentId(
            wall
          );

        if (
          wallId
        ) {
          deleteIds.push(
            wallId
          );
        }
      }
    }

    const createData =
      [];

    const updateData =
      [];

    for (
      const [
        webId,
        web
      ] of desiredByWebId
    ) {
      const existing =
        existingByWebId.get(
          webId
        ) ??
        null;

      const desired =
        createGeneratedSpanWallData({
          web,
          behaviour:
            job.behaviour,
          existingWall:
            existing
        });

      const data =
        {
          ...desired,
          flags:
            mergeGeneratedSpanWallFlags(
              desired
            )
        };

      if (
        !existing
      ) {
        createData.push(
          data
        );

        continue;
      }

      if (
        !generatedSpanWallMatches(
          existing,
          data
        )
      ) {
        const wallId =
          getDocumentId(
            existing
          );

        if (
          wallId
        ) {
          updateData.push({
            _id:
              wallId,
            ...data
          });
        }
      }
    }

    if (
      deleteIds.length >
        0
    ) {
      await scene.deleteEmbeddedDocuments(
        "Wall",
        Array.from(
          new Set(
            deleteIds
          )
        )
      );
    }

    if (
      updateData.length >
        0
    ) {
      await scene.updateEmbeddedDocuments(
        "Wall",
        updateData
      );
    }

    if (
      createData.length >
        0
    ) {
      await scene.createEmbeddedDocuments(
        "Wall",
        createData
      );
    }

    this.#rebuildSceneWallIndex(
      scene
    );

    return {
      authoritative:
        true,
      desiredWallCount:
        desiredWebs.length,
      activeWallCount:
        desiredWebs.length,
      createdCount:
        createData.length,
      updatedCount:
        updateData.length,
      deletedCount:
        Array.from(
          new Set(
            deleteIds
          )
        ).length
    };
  }

  async #removeWebWalls(
    job
  ) {
    const scene =
      job.scene;

    if (
      globalThis.game?.user?.isGM !==
        true
    ) {
      return createNonAuthoritativeResult(
        scene
      );
    }

    if (
      typeof scene.deleteEmbeddedDocuments !==
        "function"
    ) {
      return {
        ...createNonAuthoritativeResult(
          scene
        ),
        skippedReason:
          "scene-not-writable"
      };
    }

    const targets =
      new Set(
        job.webIds
      );

    const targetWallsById =
      new Map();

    const indexed =
      this.wallIdsBySceneId.get(
        job.sceneId
      ) ??
      this.#rebuildSceneWallIndex(
        scene
      );

    for (
      const webId of
      targets
    ) {
      const wallId =
        indexed.get(
          webId
        );

      const wall =
        wallId
          ? resolveSceneWallById(
              scene,
              wallId
            )
          : null;

      if (wall) {
        targetWallsById.set(
          wallId,
          wall
        );
      }
    }

    /**
     * The index is only an optimisation. Scan the authoritative collection as
     * a repair fallback and include duplicate generated walls for the targets.
     */
    for (
      const wall of
      collectGeneratedWalls(
        scene
      )
    ) {
      const webId =
        getGeneratedSpanWallWebId(
          wall
        );

      if (
        !webId ||
        !targets.has(
          webId
        )
      ) {
        continue;
      }

      const wallId =
        getDocumentId(
          wall
        );

      if (wallId) {
        targetWallsById.set(
          wallId,
          wall
        );
      }
    }

    const deleteIds =
      [];

    const deferredWallIds =
      [];

    for (
      const [
        wallId,
        wall
      ] of targetWallsById
    ) {
      if (
        isGeneratedSpanWallOpenSecretDoor(
          wall
        )
      ) {
        deferredWallIds.push(
          wallId
        );
      } else {
        deleteIds.push(
          wallId
        );
      }
    }

    /**
     * An already-open secret door no longer blocks movement or sight. Leaving
     * that harmless WallDocument in place avoids Foundry's expensive deferred
     * perception rebuild during token movement. Full reconciliation and the
     * explicit maintenance actions remove it later.
     */
    if (
      deleteIds.length >
        0
    ) {
      await scene.deleteEmbeddedDocuments(
        "Wall",
        deleteIds
      );
    }

    const nextIndex =
      this.#rebuildSceneWallIndex(
        scene
      );

    return {
      authoritative:
        true,
      desiredWallCount:
        Math.max(
          0,
          nextIndex.size -
            deferredWallIds.length
        ),
      activeWallCount:
        nextIndex.size,
      createdCount:
        0,
      updatedCount:
        0,
      deletedCount:
        deleteIds.length,
      deferredCount:
        deferredWallIds.length,
      deferredWallIds:
        Object.freeze(
          deferredWallIds.sort()
        )
    };
  }

  async #restoreWebWalls(
    job
  ) {
    const scene =
      job.scene;

    if (
      globalThis.game?.user?.isGM !==
        true
    ) {
      return createNonAuthoritativeResult(
        scene
      );
    }

    const canWrite =
      typeof scene.createEmbeddedDocuments ===
        "function" &&
      typeof scene.updateEmbeddedDocuments ===
        "function";

    if (!canWrite) {
      return {
        ...createNonAuthoritativeResult(
          scene
        ),
        skippedReason:
          "scene-not-writable"
      };
    }

    const wallEffectsEnabled =
      job.behaviour.secretDoor ===
        true ||
      job.behaviour.visionMode !==
        "none";

    if (!wallEffectsEnabled) {
      return {
        authoritative:
          true,
        desiredWallCount:
          collectGeneratedWalls(
            scene
          ).length,
        activeWallCount:
          collectGeneratedWalls(
            scene
          ).length,
        createdCount:
          0,
        updatedCount:
          0,
        deletedCount:
          0
      };
    }

    const targetIds =
      new Set(
        job.webs.map(
          web =>
            String(
              web.id
            )
        )
      );

    const existingByWebId =
      new Map();

    for (
      const wall of
      collectGeneratedWalls(
        scene
      )
    ) {
      const webId =
        getGeneratedSpanWallWebId(
          wall
        );

      if (
        webId &&
        targetIds.has(
          webId
        ) &&
        !existingByWebId.has(
          webId
        )
      ) {
        existingByWebId.set(
          webId,
          wall
        );
      }
    }

    const createData =
      [];

    const updateData =
      [];

    for (
      const web of
      job.webs
    ) {
      const webId =
        String(
          web.id
        );

      const existing =
        existingByWebId.get(
          webId
        ) ??
        null;

      const desired =
        createGeneratedSpanWallData({
          web,
          behaviour:
            job.behaviour,
          existingWall:
            existing,
          preserveDoorState:
            false
        });

      const data =
        {
          ...desired,
          flags:
            mergeGeneratedSpanWallFlags(
              desired
            )
        };

      if (!existing) {
        createData.push(
          data
        );

        continue;
      }

      if (
        !generatedSpanWallMatches(
          existing,
          data
        )
      ) {
        const wallId =
          getDocumentId(
            existing
          );

        if (wallId) {
          updateData.push({
            _id:
              wallId,
            ...data
          });
        }
      }
    }

    if (
      updateData.length >
        0
    ) {
      await scene.updateEmbeddedDocuments(
        "Wall",
        updateData
      );
    }

    if (
      createData.length >
        0
    ) {
      await scene.createEmbeddedDocuments(
        "Wall",
        createData
      );
    }

    const nextIndex =
      this.#rebuildSceneWallIndex(
        scene
      );

    return {
      authoritative:
        true,
      desiredWallCount:
        nextIndex.size,
      activeWallCount:
        nextIndex.size,
      createdCount:
        createData.length,
      updatedCount:
        updateData.length,
      deletedCount:
        0
    };
  }

  #rebuildSceneWallIndex(
    scene
  ) {
    const sceneId =
      resolveSceneId(
        scene
      );

    const index =
      new Map();

    if (sceneId) {
      for (
        const wall of
        collectGeneratedWalls(
          scene
        )
      ) {
        const webId =
          getGeneratedSpanWallWebId(
            wall
          );

        const wallId =
          getDocumentId(
            wall
          );

        if (
          webId &&
          wallId &&
          !index.has(
            webId
          )
        ) {
          index.set(
            webId,
            wallId
          );
        }
      }

      this.wallIdsBySceneId.set(
        sceneId,
        index
      );
    }

    return index;
  }
}

function resolveSceneId(
  scene
) {
  if (
    !scene ||
    typeof scene !==
      "object"
  ) {
    return null;
  }

  const sceneId =
    String(
      scene.id ??
      ""
    ).trim();

  return sceneId ||
    null;
}

function normaliseBehaviour(
  behaviour
) {
  return Object.freeze({
    visionMode:
      behaviour?.visionMode ??
      "none",
    secretDoor:
      behaviour?.secretDoor ===
        true,
    destructible:
      behaviour?.destructible ===
        true
  });
}

function normaliseGenerationId(
  value
) {
  return Number.isInteger(
    Number(
      value
    )
  )
    ? Number(
        value
      )
    : null;
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
          value =>
            String(
              value ??
              ""
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  ).sort();
}

function createNonAuthoritativeResult(
  scene
) {
  return {
    authoritative:
      false,
    desiredWallCount:
      0,
    activeWallCount:
      collectGeneratedWalls(
        scene
      ).length,
    createdCount:
      0,
    updatedCount:
      0,
    deletedCount:
      0
  };
}

function collectGeneratedWalls(
  scene
) {
  const values =
    collectValues(
      scene?.walls
    );

  return values.filter(
    isGeneratedSpanWallDocument
  );
}

function collectValues(
  collection
) {
  if (
    Array.isArray(
      collection?.contents
    )
  ) {
    return collection.contents;
  }

  if (
    Array.isArray(
      collection
    )
  ) {
    return collection;
  }

  if (
    typeof collection?.values ===
      "function"
  ) {
    return Array.from(
      collection.values()
    );
  }

  return [];
}

function resolveSceneWallById(
  scene,
  wallId
) {
  const direct =
    scene?.walls?.get?.(
      wallId
    );

  if (direct) {
    return direct;
  }

  return collectValues(
    scene?.walls
  ).find(
    wall =>
      getDocumentId(
        wall
      ) ===
        wallId
  ) ??
    null;
}

function getDocumentId(
  document
) {
  const id =
    String(
      document?.id ??
      document?._id ??
      document?.document?.id ??
      ""
    ).trim();

  return id ||
    null;
}

function createEmptyDiagnostics() {
  return {
    authoritative:
      null,
    sceneId:
      null,
    generationId:
      null,
    pending:
      false,
    desiredWallCount:
      0,
    activeWallCount:
      0,
    createdCount:
      0,
    updatedCount:
      0,
    deletedCount:
      0,
    deferredCount:
      0,
    deferredWallIds:
      Object.freeze([]),
    lastRequestedAt:
      null,
    lastCompletedAt:
      null,
    lastReason:
      null,
    lastOperationType:
      null,
    targetWebIds:
      Object.freeze([]),
    lastError:
      null
  };
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

  return Object.freeze(
    Object.fromEntries(
      Object.entries(
        value
      ).map(
        ([
          key,
          child
        ]) => [
          key,
          deepFreezeClone(
            child
          )
        ]
      )
    )
  );
}
