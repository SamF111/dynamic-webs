import {
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../../module/moduleConstants.js";

/** Create the transient runtime state owned by WebRuntimeService. */
export function createWebRuntimeState(
  options = {}
) {
  const values =
    Number.isInteger(
      options
    )
      ? {
          generationId:
            options
        }
      : (
          options &&
          typeof options ===
            "object" &&
          !Array.isArray(
            options
          )
            ? options
            : {}
        );

  return {
    active:
      false,
    blueprintSchemaVersion:
      WEB_BLUEPRINT_SCHEMA_VERSION,
    sceneId:
      null,
    generationId:
      Number.isInteger(
        values.generationId
      )
        ? values.generationId
        : 0,
    presentationRevision:
      Number.isInteger(
        values.presentationRevision
      )
        ? values.presentationRevision
        : 0,
    generationReason:
      normaliseOptionalString(
        values.generationReason
      ),
    generatedAt:
      normaliseOptionalTimestamp(
        values.generatedAt
      ),
    lastOperationReason:
      normaliseOptionalString(
        values.lastOperationReason
      ),
    lastOperationAt:
      normaliseOptionalTimestamp(
        values.lastOperationAt
      ),
    seed:
      null,
    categorySeeds:
      null,
    densityId:
      null,
    categoryDensities:
      normaliseOptionalObject(
        values.categoryDensities
      ),
    categoryDensitySources:
      normaliseOptionalObject(
        values.categoryDensitySources
      ),
    colourProfileId:
      null,
    colourProfile:
      null,
    thicknessMultiplier:
      normaliseOptionalPositiveNumber(
        values.thicknessMultiplier
      ),
    sceneGeometry:
      null,
    configuration:
      null,
    webs:
      Object.freeze([]),
    counts:
      createEmptyCounts()
  };
}

/** Create a deeply frozen public/diagnostic snapshot without PIXI references. */
export function createWebRuntimeSnapshot(
  state,
  renderDiagnostics = null,
  {
    includeWebs = true
  } = {}
) {
  return deepFreeze({
    active:
      state?.active ===
        true,
    blueprintSchemaVersion:
      Number.isInteger(
        state?.blueprintSchemaVersion
      )
        ? state.blueprintSchemaVersion
        : WEB_BLUEPRINT_SCHEMA_VERSION,
    sceneId:
      state?.sceneId ??
      null,
    generationId:
      Number.isInteger(
        state?.generationId
      )
        ? state.generationId
        : 0,
    presentationRevision:
      Number.isInteger(
        state?.presentationRevision
      )
        ? state.presentationRevision
        : 0,
    generationReason:
      state?.generationReason ??
      null,
    generatedAt:
      state?.generatedAt ??
      null,
    lastOperationReason:
      state?.lastOperationReason ??
      null,
    lastOperationAt:
      state?.lastOperationAt ??
      null,
    seed:
      state?.seed ??
      null,
    categorySeeds:
      state?.categorySeeds ??
      null,
    densityId:
      state?.densityId ??
      null,
    categoryDensities:
      state?.categoryDensities ??
      null,
    categoryDensitySources:
      state?.categoryDensitySources ??
      null,
    colourProfileId:
      state?.colourProfileId ??
      null,
    colourProfile:
      state?.colourProfile ??
      null,
    thicknessMultiplier:
      Number.isFinite(
        Number(
          state?.thicknessMultiplier
        )
      ) &&
      Number(
        state?.thicknessMultiplier
      ) >
        0
        ? Number(
            state.thicknessMultiplier
          )
        : null,
    sceneGeometry:
      state?.sceneGeometry ??
      null,
    configuration:
      state?.configuration ??
      null,
    counts:
      state?.counts ??
      createEmptyCounts(),
    webs:
      includeWebs
        ? state?.webs ??
          []
        : null,
    rendering:
      renderDiagnostics
  });
}

function createEmptyCounts() {
  return Object.freeze({
    total:
      0,
    corner:
      0,
    span:
      0,
    ground:
      0,
    strands:
      0,
    byWebKind:
      Object.freeze({
        "wall-corner":
          0,
        "wall-span":
          0,
        ground:
          0
      }),
    byStrandKind:
      Object.freeze({
        structural:
          0,
        capture:
          0,
        decorative:
          0
      })
  });
}

function normaliseOptionalObject(
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
    return null;
  }

  return Object.freeze({
    ...value
  });
}

function normaliseOptionalString(
  value
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const text =
    value.trim();

  return text.length >
    0
    ? text
    : null;
}


function normaliseOptionalPositiveNumber(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }

  const numericValue =
    Number(
      value
    );

  return Number.isFinite(
    numericValue
  ) &&
    numericValue >
      0
    ? numericValue
    : null;
}

function normaliseOptionalTimestamp(
  value
) {
  const numericValue =
    Number(
      value
    );

  return Number.isFinite(
    numericValue
  ) &&
    numericValue >
      0
    ? numericValue
    : null;
}

function deepFreeze(
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
        deepFreeze
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
    clone[
      key
    ] =
      deepFreeze(
        entry
      );
  }

  return Object.freeze(
    clone
  );
}
