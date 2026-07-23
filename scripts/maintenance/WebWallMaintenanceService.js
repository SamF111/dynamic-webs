import {
  MODULE_ID,
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  SCENE_WEB_FLAG_KEYS
} from "../config/sceneWebFlagPaths.js";

import {
  getSceneWebMutableStateConfiguration,
  persistSceneWebMutableState
} from "../config/sceneWebMutableStateConfiguration.js";

import {
  getSceneSpanWebBehaviourConfiguration
} from "../config/sceneSpanWebBehaviourConfiguration.js";

import {
  getSceneWebPopulationConfiguration
} from "../config/sceneWebPopulationConfiguration.js";

import {
  getGeneratedSpanWallWebId,
  isGeneratedSpanWallDocument
} from "../foundry/webSpanWallCompatibility.js";


/** Restore every persisted destroyed wall-span web across the world. */
export async function restoreDestroyedSpanWebsAcrossWorld({
  scenes = collectWorldScenes(),
  runtime = null
} = {}) {
  requireGm();

  const results = [];

  for (const scene of normaliseSceneList(scenes)) {
    try {
      results.push(await restoreDestroyedSpanWebsForScene(scene, {
        runtime
      }));
    } catch (error) {
      results.push(createFailureResult(scene, error));
    }
  }

  return createWorldSummary("restore-destroyed-span-webs", results);
}

/**
 * Restore every persisted destroyed wall-span web in one Scene.
 *
 * The active Scene uses the runtime's incremental reset path. An inactive
 * Scene clears only its compact mutable-state flag and removes any retained
 * generated wall linked to a destroyed span; deterministic geometry is not
 * generated until that Scene is next opened.
 */
export async function restoreDestroyedSpanWebsForScene(scene, {
  runtime = null
} = {}) {
  validateScene(scene);
  requireGm();

  const sceneId = normaliseIdentifier(scene.id);
  const sceneName = normaliseIdentifier(scene.name);
  const service = runtime?.getWebRuntimeService?.() ?? null;
  const activeSceneId = normaliseIdentifier(globalThis.canvas?.scene?.id);
  const runtimeState = service?.getState?.() ?? null;
  const runtimeOwnsScene = Boolean(
    service &&
    sceneId &&
    activeSceneId === sceneId &&
    runtimeState?.active === true &&
    normaliseIdentifier(runtimeState.sceneId) === sceneId
  );

  const persistedState = getSceneWebMutableStateConfiguration(scene);

  if (runtimeOwnsScene) {
    const persistedIds = persistedState.valid === true
      ? persistedState.destroyedWebIds
      : [];
    const runtimeIds = service.getMutableState?.().destroyedWebIds ?? [];

    if (
      persistedState.valid !== true ||
      !identifierListsEqual(runtimeIds, persistedIds)
    ) {
      service.applyPersistedMutableState?.({
        scene,
        reason: "scene-config-restore-destroyed-span-webs-sync"
      });
    }

    const before = service.getMutableState?.() ?? {
      destroyedWebIds: []
    };

    const restoredWebCount = Array.isArray(before.destroyedWebIds)
      ? before.destroyedWebIds.length
      : 0;

    const reset = service.resetMutableState?.({
      cause: "scene-config-restore-destroyed-span-webs"
    }) ?? {
      changed: false
    };

    const persistenceDiagnostics =
      await service.flushMutableStatePersistence?.();

    if (persistenceDiagnostics?.lastError) {
      throw new Error(
        `${MODULE_TITLE} | Restored span state could not be persisted for Scene "${sceneId ?? "unknown"}": ${String(persistenceDiagnostics.lastError.message ?? "unknown persistence error")}`
      );
    }

    const diagnostics = await service.flushSpanWallReconciliation?.();

    return freezeResult({
      sceneId,
      sceneName,
      success: true,
      skippedReason: null,
      restoredSceneState:
        reset.changed === true ||
        persistedState.valid !== true,
      repairedInvalidState:
        persistedState.valid !== true,
      restoredWebCount,
      activeScene: true,
      regeneratedScene: false,
      inspectedWallCount: collectGeneratedWalls(scene).length,
      deletedWallCount: 0,
      createdWallCount:
        reset.changed === true
          ? Number(diagnostics?.createdCount) || 0
          : 0,
      updatedWallCount:
        reset.changed === true
          ? Number(diagnostics?.updatedCount) || 0
          : 0,
      deferredWallCount:
        reset.changed === true
          ? Number(diagnostics?.deferredCount) || 0
          : 0,
      malformedWallCount: 0,
      duplicateWallCount: 0,
      destroyedLinkedWallCount: 0,
      clearedSceneFlags: false,
      clearedRegionFlagCount: 0,
      error: null
    });
  }

  const destroyedWebIds = persistedState.destroyedWebIds;
  const needsRepair = persistedState.valid !== true;

  if (destroyedWebIds.length === 0 && !needsRepair) {
    return freezeResult({
      sceneId,
      sceneName,
      success: true,
      skippedReason: null,
      restoredSceneState: false,
      repairedInvalidState: false,
      restoredWebCount: 0,
      activeScene: activeSceneId === sceneId,
      regeneratedScene: false,
      inspectedWallCount: collectGeneratedWalls(scene).length,
      deletedWallCount: 0,
      createdWallCount: 0,
      updatedWallCount: 0,
      deferredWallCount: 0,
      malformedWallCount: 0,
      duplicateWallCount: 0,
      destroyedLinkedWallCount: 0,
      clearedSceneFlags: false,
      clearedRegionFlagCount: 0,
      error: null
    });
  }

  await service?.flushSpanWallReconciliation?.();

  const destroyedSet = new Set(destroyedWebIds);
  const retainedWallIds = new Set(
    collectGeneratedWalls(scene)
      .filter(wall => destroyedSet.has(getGeneratedSpanWallWebId(wall)))
      .map(getDocumentId)
      .filter(Boolean)
  );

  /**
   * Deleting retained derived walls before clearing the flag keeps an inactive
   * Scene consistent if the flag write fails. Missing walls are recreated in
   * the closed/default state during the next active Scene reconciliation.
   */
  await deleteWallIds(scene, retainedWallIds);
  invalidateRuntimeWallIndex(runtime, sceneId);

  await persistSceneWebMutableState(scene, {
    revision: Math.max(0, Number(persistedState.revision) || 0) + 1,
    destroyedWebIds: []
  });

  let regeneratedScene = false;
  let diagnostics = null;

  if (service && activeSceneId === sceneId) {
    const configuration = getSceneWebPopulationConfiguration(scene);

    if (configuration.hasActivePopulations) {
      service.generateForActiveScene({
        scene,
        populations: configuration.activePopulations,
        reason: "scene-config-restore-destroyed-span-webs"
      });
      regeneratedScene = true;
    } else {
      service.reconcileSpanWallsForScene?.({
        scene,
        webs: [],
        destroyedWebIds: [],
        behaviour: configuration.spanWebBehaviour,
        reason: "scene-config-restore-destroyed-span-webs-empty"
      });
    }

    diagnostics = await service.flushSpanWallReconciliation?.();
  }

  return freezeResult({
    sceneId,
    sceneName,
    success: true,
    skippedReason: null,
    restoredSceneState: true,
    repairedInvalidState: needsRepair,
    restoredWebCount: destroyedWebIds.length,
    activeScene: activeSceneId === sceneId,
    regeneratedScene,
    inspectedWallCount: collectGeneratedWalls(scene).length,
    deletedWallCount: retainedWallIds.size,
    createdWallCount: Number(diagnostics?.createdCount) || 0,
    updatedWallCount: Number(diagnostics?.updatedCount) || 0,
    deferredWallCount: Number(diagnostics?.deferredCount) || 0,
    malformedWallCount: 0,
    duplicateWallCount: 0,
    destroyedLinkedWallCount: retainedWallIds.size,
    clearedSceneFlags: false,
    clearedRegionFlagCount: 0,
    error: null
  });
}

/** Delete invalid, duplicate, or destroyed-span generated walls across the world. */
export async function cleanUpLingeringWebWallsAcrossWorld({
  scenes = collectWorldScenes(),
  runtime = null
} = {}) {
  requireGm();

  const results = [];

  for (const scene of normaliseSceneList(scenes)) {
    try {
      const result = await cleanUpLingeringWebWallsForScene(scene);
      results.push(result);
      invalidateRuntimeWallIndex(runtime, scene?.id);
    } catch (error) {
      results.push(createFailureResult(scene, error));
    }
  }

  return createWorldSummary("cleanup-lingering-web-walls", results);
}

/** Delete invalid, duplicate, or destroyed-span generated walls in one Scene. */
export async function cleanUpLingeringWebWallsForScene(scene) {
  validateScene(scene);
  requireGm();

  const generatedWalls = collectGeneratedWalls(scene);
  const mutableState = getSceneWebMutableStateConfiguration(scene);
  const destroyedIds = new Set(mutableState.destroyedWebIds);
  const retainedWebIds = new Set();
  const deleteIds = new Set();

  let malformedCount = 0;
  let duplicateCount = 0;
  let destroyedLinkedCount = 0;

  for (const wall of generatedWalls) {
    const wallId = getDocumentId(wall);
    const webId = getGeneratedSpanWallWebId(wall);

    if (!wallId) continue;

    if (!webId) {
      malformedCount += 1;
      deleteIds.add(wallId);
      continue;
    }

    if (destroyedIds.has(webId)) {
      destroyedLinkedCount += 1;
      deleteIds.add(wallId);
      continue;
    }

    if (retainedWebIds.has(webId)) {
      duplicateCount += 1;
      deleteIds.add(wallId);
      continue;
    }

    retainedWebIds.add(webId);
  }

  await deleteWallIds(scene, deleteIds);

  return freezeResult({
    sceneId: normaliseIdentifier(scene.id),
    sceneName: normaliseIdentifier(scene.name),
    success: true,
    inspectedWallCount: generatedWalls.length,
    deletedWallCount: deleteIds.size,
    malformedWallCount: malformedCount,
    duplicateWallCount: duplicateCount,
    destroyedLinkedWallCount: destroyedLinkedCount,
    clearedSceneFlags: false,
    clearedRegionFlagCount: 0,
    error: null
  });
}

/** Delete every Dynamic Webs generated WallDocument from one Scene. */
export async function deleteAllGeneratedWebWallsForScene(scene, {
  runtime = null
} = {}) {
  validateScene(scene);
  requireGm();

  await runtime
    ?.getWebRuntimeService?.()
    ?.flushSpanWallReconciliation?.();

  const walls = collectGeneratedWalls(scene);
  const ids = new Set(
    walls
      .map(getDocumentId)
      .filter(Boolean)
  );

  await deleteWallIds(scene, ids);
  invalidateRuntimeWallIndex(runtime, scene.id);

  return freezeResult({
    sceneId: normaliseIdentifier(scene.id),
    sceneName: normaliseIdentifier(scene.name),
    success: true,
    inspectedWallCount: walls.length,
    deletedWallCount: ids.size,
    malformedWallCount: 0,
    duplicateWallCount: 0,
    destroyedLinkedWallCount: 0,
    clearedSceneFlags: false,
    clearedRegionFlagCount: 0,
    error: null
  });
}

/** Reconcile generated walls for the active Scene from current saved state. */
export async function updateGeneratedWebWallsForScene(scene, {
  runtime = null
} = {}) {
  validateScene(scene);
  requireGm();

  const service = runtime?.getWebRuntimeService?.();
  const activeSceneId = normaliseIdentifier(globalThis.canvas?.scene?.id);
  const sceneId = normaliseIdentifier(scene.id);

  if (!service || !sceneId || activeSceneId !== sceneId) {
    return freezeResult({
      sceneId,
      sceneName: normaliseIdentifier(scene.name),
      success: false,
      skippedReason: "scene-not-active",
      inspectedWallCount: collectGeneratedWalls(scene).length,
      deletedWallCount: 0,
      malformedWallCount: 0,
      duplicateWallCount: 0,
      destroyedLinkedWallCount: 0,
      clearedSceneFlags: false,
      clearedRegionFlagCount: 0,
      error: null
    });
  }

  const state = service.getState?.();

  if (state?.active !== true || normaliseIdentifier(state.sceneId) !== sceneId) {
    const configuration = getSceneWebPopulationConfiguration(scene);

    if (configuration.hasActivePopulations) {
      service.generateForActiveScene({
        scene,
        populations: configuration.activePopulations,
        reason: "scene-config-update-web-walls"
      });
    } else {
      service.reconcileSpanWallsForScene?.({
        scene,
        webs: [],
        destroyedWebIds: [],
        behaviour: configuration.spanWebBehaviour,
        reason: "scene-config-update-web-walls-empty"
      });
    }
  } else {
    service.reconcileSpanWallsForScene?.({
      scene,
      webs: state.webs,
      destroyedWebIds: service.getMutableState?.().destroyedWebIds ?? [],
      behaviour: getSceneSpanWebBehaviourConfiguration(scene),
      reason: "scene-config-update-web-walls"
    });
  }

  const diagnostics = await service.flushSpanWallReconciliation?.();

  return freezeResult({
    sceneId,
    sceneName: normaliseIdentifier(scene.name),
    success: true,
    skippedReason: null,
    inspectedWallCount: collectGeneratedWalls(scene).length,
    deletedWallCount: Number(diagnostics?.deletedCount) || 0,
    createdWallCount: Number(diagnostics?.createdCount) || 0,
    updatedWallCount: Number(diagnostics?.updatedCount) || 0,
    deferredWallCount: Number(diagnostics?.deferredCount) || 0,
    malformedWallCount: 0,
    duplicateWallCount: 0,
    destroyedLinkedWallCount: 0,
    clearedSceneFlags: false,
    clearedRegionFlagCount: 0,
    error: null
  });
}

/** Remove generated walls and reset every Scene to an explicit no-web state before uninstall. */
export async function prepareDynamicWebsForUninstall({
  scenes = collectWorldScenes(),
  runtime = null
} = {}) {
  requireGm();

  const service =
    runtime?.getWebRuntimeService?.() ??
    null;

  await service?.flushSpanWallReconciliation?.();

  const sceneList =
    normaliseSceneList(
      scenes
    );

  const results = [];

  for (const scene of sceneList) {
    try {
      const wallsResult = await deleteAllGeneratedWebWallsForScene(scene, {
        runtime
      });

      const clearedRegionFlagCount = await clearRegionFlags(scene);
      await clearSceneFlags(scene);

      results.push(freezeResult({
        ...wallsResult,
        clearedSceneFlags: true,
        clearedRegionFlagCount
      }));
    } catch (error) {
      results.push(createFailureResult(scene, error));
    }
  }

  await service?.flushSpanWallReconciliation?.();

  /**
   * A Scene update can cause an already-running lifecycle pass to finish after
   * the first deletion. Perform one final authoritative wall sweep before the
   * local runtime is cleared so no generated document survives the action.
   */
  for (const scene of sceneList) {
    try {
      await deleteAllGeneratedWebWallsForScene(
        scene,
        {
          runtime:
            null
        }
      );
    } catch (_error) {
      // The primary per-Scene result already records any actionable failure.
    }
  }

  service?.clear?.("prepare-dynamic-webs-for-uninstall");

  return createWorldSummary("prepare-for-uninstall", results);
}

export function collectGeneratedWebWalls(scene) {
  return Object.freeze([...collectGeneratedWalls(scene)]);
}

function createWorldSummary(action, sceneResults) {
  const results = sceneResults.map(freezeResult);

  return Object.freeze({
    action,
    sceneCount: results.length,
    successfulSceneCount: results.filter(result => result.success === true).length,
    failedSceneCount: results.filter(result => result.success !== true).length,
    inspectedWallCount: sum(results, "inspectedWallCount"),
    deletedWallCount: sum(results, "deletedWallCount"),
    createdWallCount: sum(results, "createdWallCount"),
    updatedWallCount: sum(results, "updatedWallCount"),
    deferredWallCount: sum(results, "deferredWallCount"),
    restoredSceneCount: results.filter(result => result.restoredSceneState === true).length,
    restoredWebCount: sum(results, "restoredWebCount"),
    repairedInvalidStateCount: results.filter(result => result.repairedInvalidState === true).length,
    regeneratedSceneCount: results.filter(result => result.regeneratedScene === true).length,
    malformedWallCount: sum(results, "malformedWallCount"),
    duplicateWallCount: sum(results, "duplicateWallCount"),
    destroyedLinkedWallCount: sum(results, "destroyedLinkedWallCount"),
    clearedSceneCount: results.filter(result => result.clearedSceneFlags === true).length,
    clearedRegionFlagCount: sum(results, "clearedRegionFlagCount"),
    scenes: Object.freeze(results)
  });
}

function createFailureResult(scene, error) {
  return freezeResult({
    sceneId: normaliseIdentifier(scene?.id),
    sceneName: normaliseIdentifier(scene?.name),
    success: false,
    restoredSceneState: false,
    repairedInvalidState: false,
    restoredWebCount: 0,
    activeScene: false,
    regeneratedScene: false,
    inspectedWallCount: 0,
    deletedWallCount: 0,
    createdWallCount: 0,
    updatedWallCount: 0,
    deferredWallCount: 0,
    malformedWallCount: 0,
    duplicateWallCount: 0,
    destroyedLinkedWallCount: 0,
    clearedSceneFlags: false,
    clearedRegionFlagCount: 0,
    error: Object.freeze({
      name: String(error?.name ?? "Error"),
      message: String(error?.message ?? error)
    })
  });
}

async function deleteWallIds(scene, ids) {
  const values = Array.from(ids);

  if (values.length === 0) return;

  if (typeof scene.deleteEmbeddedDocuments !== "function") {
    throw new Error(`${MODULE_TITLE} | Scene "${String(scene.id ?? "unknown")}" cannot delete generated WallDocuments.`);
  }

  await scene.deleteEmbeddedDocuments("Wall", values);
}

async function clearSceneFlags(scene) {
  /**
   * Keep one explicit empty population array as an uninstall sentinel. A
   * completely missing population flag would immediately resolve the world's
   * implicit default population while the module is still enabled, causing
   * the webs to reappear before the GM can uninstall it.
   */
  if (typeof scene.update === "function") {
    const update = {
      [`flags.${MODULE_ID}.${SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS}`]: []
    };

    for (const key of Object.values(SCENE_WEB_FLAG_KEYS)) {
      if (key === SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS) continue;
      update[`flags.${MODULE_ID}.-=${key}`] = null;
    }

    await scene.update(update);
    return;
  }

  if (typeof scene.unsetFlag === "function" && typeof scene.setFlag === "function") {
    for (const key of Object.values(SCENE_WEB_FLAG_KEYS)) {
      if (key === SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS) continue;
      await scene.unsetFlag(MODULE_ID, key);
    }

    await scene.setFlag(
      MODULE_ID,
      SCENE_WEB_FLAG_KEYS.WEB_POPULATIONS,
      []
    );
    return;
  }

  throw new Error(`${MODULE_TITLE} | Scene "${String(scene.id ?? "unknown")}" cannot clear Dynamic Webs flags.`);
}

async function clearRegionFlags(scene) {
  const regions = collectValues(scene?.regions).filter(region => hasModuleFlags(region));

  if (regions.length === 0) return 0;

  if (typeof scene.updateEmbeddedDocuments === "function") {
    const updates = regions
      .map(region => getDocumentId(region))
      .filter(Boolean)
      .map(id => ({
        _id: id,
        [`flags.-=${MODULE_ID}`]: null
      }));

    if (updates.length > 0) {
      await scene.updateEmbeddedDocuments("Region", updates);
    }

    return updates.length;
  }

  let cleared = 0;

  for (const region of regions) {
    if (typeof region.update === "function") {
      await region.update({
        [`flags.-=${MODULE_ID}`]: null
      });
      cleared += 1;
    } else if (typeof region.unsetFlag === "function") {
      await region.unsetFlag(MODULE_ID, "regionTags");
      cleared += 1;
    }
  }

  return cleared;
}

function hasModuleFlags(document) {
  const value = document?.flags?.[MODULE_ID] ?? document?._source?.flags?.[MODULE_ID];
  return Boolean(value && typeof value === "object");
}

function collectGeneratedWalls(scene) {
  return collectValues(scene?.walls).filter(isGeneratedSpanWallDocument);
}

function collectWorldScenes() {
  return collectValues(globalThis.game?.scenes);
}

function normaliseSceneList(scenes) {
  return Array.from(new Map(
    collectValues(scenes)
      .filter(Boolean)
      .map(scene => [normaliseIdentifier(scene.id) ?? scene, scene])
  ).values());
}

function collectValues(collection) {
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (Array.isArray(collection)) return collection;
  if (typeof collection?.values === "function") return Array.from(collection.values());
  return [];
}

function getDocumentId(document) {
  return normaliseIdentifier(document?.id ?? document?._id ?? document?.document?.id);
}

function invalidateRuntimeWallIndex(runtime, sceneId) {
  runtime?.getWebRuntimeService?.().invalidateSpanWallIndex?.(sceneId);
}

function requireGm() {
  if (globalThis.game?.user?.isGM !== true) {
    throw new Error(`${MODULE_TITLE} | Generated web-wall maintenance is GM-only.`);
  }
}

function validateScene(scene) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    throw new TypeError(`${MODULE_TITLE} | Web-wall maintenance requires a Scene document.`);
  }
}

function normaliseIdentifier(value) {
  const text = String(value ?? "").trim();
  return text || null;
}


function identifierListsEqual(first, second) {
  const firstValues = Array.isArray(first)
    ? first.map(String).sort()
    : [];
  const secondValues = Array.isArray(second)
    ? second.map(String).sort()
    : [];

  return firstValues.length === secondValues.length &&
    firstValues.every((value, index) => value === secondValues[index]);
}

function sum(values, key) {
  return values.reduce((total, value) => total + (Number(value?.[key]) || 0), 0);
}

function freezeResult(value) {
  if (Object.isFrozen(value)) return value;
  return Object.freeze({ ...value });
}
