/** Create the transient runtime state owned by WebRuntimeService. */
export function createWebRuntimeState(generationId = 0) {
  return {
    active:
      false,
    sceneId:
      null,
    generationId,
    seed:
      null,
    densityId:
      null,
    configuration:
      null,
    webs:
      Object.freeze([]),
    counts:
      Object.freeze({
        total: 0,
        corner: 0,
        span: 0,
        ground: 0,
        strands: 0
      })
  };
}

/** Create a deeply frozen public/diagnostic snapshot without PIXI references. */
export function createWebRuntimeSnapshot(state, renderDiagnostics = null) {
  return deepFreeze({
    active:
      state?.active === true,
    sceneId:
      state?.sceneId ?? null,
    generationId:
      Number.isInteger(state?.generationId)
        ? state.generationId
        : 0,
    seed:
      state?.seed ?? null,
    densityId:
      state?.densityId ?? null,
    configuration:
      state?.configuration ?? null,
    counts:
      state?.counts ?? null,
    webs:
      state?.webs ?? [],
    rendering:
      renderDiagnostics
  });
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map(deepFreeze));
  }
  const clone = {};
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = deepFreeze(entry);
  }
  return Object.freeze(clone);
}


