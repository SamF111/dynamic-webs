import {
  MODULE_TITLE
} from "../../module/moduleConstants.js";

import {
  createGeneratedSpanWallData,
  generatedSpanWallMatches,
  getGeneratedSpanWallWebId,
  isGeneratedSpanWallDocument,
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
    this.pendingJob =
      null;

    this.reconciliationPromise =
      null;

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
    if (
      !scene ||
      typeof scene !==
        "object"
    ) {
      return false;
    }

    const sceneId =
      String(
        scene.id ??
        ""
      ).trim();

    if (
      !sceneId
    ) {
      return false;
    }

    this.pendingJob = {
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
        Object.freeze({
          visionMode:
            behaviour?.visionMode ??
            "none",
          secretDoor:
            behaviour?.secretDoor ===
              true,
          destructible:
            behaviour?.destructible ===
              true
        }),
      generationId:
        Number.isInteger(
          Number(
            generationId
          )
        )
          ? Number(
              generationId
            )
          : null,
      reason:
        String(
          reason ??
          "span-wall-reconciliation"
        )
    };

    this.diagnostics = {
      ...this.diagnostics,
      sceneId,
      pending:
        true,
      lastRequestedAt:
        Date.now(),
      lastReason:
        this.pendingJob.reason
    };

    this.#ensureDrain();

    return true;
  }

  async flush() {
    while (
      this.pendingJob ||
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
                this.pendingJob !==
                  null
            };

            if (
              this.pendingJob
            ) {
              this.#ensureDrain();
            }
          }
        );
  }

  async #drain() {
    while (
      this.pendingJob
    ) {
      const job =
        this.pendingJob;

      this.pendingJob =
        null;

      try {
        const result =
          await this.#reconcile(
            job
          );

        this.diagnostics = {
          ...this.diagnostics,
          sceneId:
            job.sceneId,
          pending:
            this.pendingJob !==
              null,
          generationId:
            job.generationId,
          lastReason:
            job.reason,
          lastCompletedAt:
            Date.now(),
          lastError:
            null,
          ...result
        };
      } catch (error) {
        this.diagnostics = {
          ...this.diagnostics,
          sceneId:
            job.sceneId,
          pending:
            this.pendingJob !==
              null,
          generationId:
            job.generationId,
          lastReason:
            job.reason,
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
          "dynamic-webs | Generated wall-span WallDocuments could not be reconciled.",
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
    lastRequestedAt:
      null,
    lastCompletedAt:
      null,
    lastReason:
      null,
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
