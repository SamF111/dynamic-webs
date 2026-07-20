/**
 * Run a non-destructive deterministic-generation comparison.
 *
 * The supplied generation service is called twice with the same plain context
 * and resolved configuration. No runtime state or PIXI rendering is changed.
 *
 * @param {object} options - Diagnostic values.
 * @param {object} options.generationService - WebGenerationService instance.
 * @param {object} options.context - Plain generation context.
 * @param {object} options.configuration - Resolved generation configuration.
 * @param {readonly object[]} [options.currentWebs=[]] - Current runtime webs.
 * @returns {Readonly<object>} Frozen determinism report.
 */
export function runDeterminismDiagnostic({
  generationService,
  context,
  configuration,
  currentWebs = []
}) {
  if (
    !generationService ||
    typeof generationService.generate !==
      "function"
  ) {
    throw new TypeError(
      "Dynamic Webs | Determinism diagnostics require a generation service."
    );
  }

  const first =
    generationService.generate(
      context,
      configuration
    );

  const second =
    generationService.generate(
      context,
      configuration
    );

  const firstProjection =
    createCanonicalPopulationProjection(
      first.webs
    );

  const secondProjection =
    createCanonicalPopulationProjection(
      second.webs
    );

  const runtimeProjection =
    createCanonicalPopulationProjection(
      currentWebs
    );

  const firstText =
    JSON.stringify(
      firstProjection
    );

  const secondText =
    JSON.stringify(
      secondProjection
    );

  const runtimeText =
    JSON.stringify(
      runtimeProjection
    );

  return deepFreeze({
    executed:
      true,
    deterministic:
      firstText ===
        secondText,
    matchesRuntimeState:
      runtimeProjection.length >
        0
        ? firstText ===
          runtimeText
        : null,
    firstHash:
      hashText(
        firstText
      ),
    secondHash:
      hashText(
        secondText
      ),
    runtimeHash:
      runtimeProjection.length >
        0
        ? hashText(
            runtimeText
          )
        : null,
    firstWebCount:
      firstProjection.length,
    secondWebCount:
      secondProjection.length,
    runtimeWebCount:
      runtimeProjection.length,
    mismatchedWebIds:
      findMismatchedWebIds(
        firstProjection,
        secondProjection
      ),
    runtimeMismatchedWebIds:
      runtimeProjection.length >
        0
        ? findMismatchedWebIds(
            firstProjection,
            runtimeProjection
          )
        : []
  });
}

/**
 * Create a stable plain-data projection of one web population.
 *
 * @param {unknown} webs - Candidate web array.
 * @returns {object[]} Canonical projection.
 */
export function createCanonicalPopulationProjection(
  webs
) {
  return (
    Array.isArray(
      webs
    )
      ? webs
      : []
  )
    .map(
      createCanonicalWebProjection
    )
    .sort(
      (
        first,
        second
      ) =>
        first.id.localeCompare(
          second.id
        )
    );
}

function createCanonicalWebProjection(
  web
) {
  return {
    schemaVersion:
      web?.schemaVersion ??
      null,
    id:
      String(
        web?.id ??
        ""
      ),
    kind:
      String(
        web?.kind ??
        ""
      ),
    colourProfileId:
      String(
        web?.colourProfileId ??
        ""
      ),
    sceneId:
      String(
        web?.sceneId ??
        ""
      ),
    seed:
      String(
        web?.seed ??
        ""
      ),
    sourceKey:
      String(
        web?.sourceKey ??
        ""
      ),
    hub:
      projectPoint(
        web?.hub
      ),
    bounds:
      {
        x:
          Number(
            web?.bounds?.x
          ),
        y:
          Number(
            web?.bounds?.y
          ),
        width:
          Number(
            web?.bounds?.width
          ),
        height:
          Number(
            web?.bounds?.height
          ),
        right:
          Number(
            web?.bounds?.right
          ),
        bottom:
          Number(
            web?.bounds?.bottom
          )
      },
    strands:
      (
        Array.isArray(
          web?.strands
        )
          ? web.strands
          : []
      )
        .map(
          (
            strand
          ) => ({
            schemaVersion:
              strand?.schemaVersion ??
              null,
            id:
              String(
                strand?.id ??
                ""
              ),
            localId:
              String(
                strand?.localId ??
                ""
              ),
            kind:
              String(
                strand?.kind ??
                ""
              ),
            points:
              (
                Array.isArray(
                  strand?.points
                )
                  ? strand.points
                  : []
              ).map(
                projectPoint
              ),
            baseAlpha:
              Number(
                strand?.baseAlpha ??
                strand?.alpha
              ),
            alpha:
              Number(
                strand?.alpha
              ),
            colour:
              Number(
                strand?.colour
              ),
            underColour:
              Number(
                strand?.underColour
              ),
            widthPx:
              Number(
                strand?.widthPx
              ),
            collisionWidthPx:
              Number(
                strand?.collisionWidthPx
              )
          })
        )
        .sort(
          (
            first,
            second
          ) =>
            first.id.localeCompare(
              second.id
            )
        ),
    perches:
      (
        Array.isArray(
          web?.perches
        )
          ? web.perches
          : []
      )
        .map(
          (
            perch
          ) => ({
            id:
              String(
                perch?.id ??
                ""
              ),
            x:
              Number(
                perch?.x
              ),
            y:
              Number(
                perch?.y
              ),
            rotation:
              Number(
                perch?.rotation
              )
          })
        )
        .sort(
          (
            first,
            second
          ) =>
            first.id.localeCompare(
              second.id
            )
        ),
    supportingWallIds:
      (
        Array.isArray(
          web?.supportingWallIds
        )
          ? web.supportingWallIds
          : []
      )
        .map(
          String
        )
        .sort()
  };
}

function projectPoint(
  point
) {
  return {
    x:
      Number(
        point?.x
      ),
    y:
      Number(
        point?.y
      )
  };
}

function findMismatchedWebIds(
  first,
  second
) {
  const firstById =
    new Map(
      first.map(
        (
          web
        ) => [
          web.id,
          JSON.stringify(
            web
          )
        ]
      )
    );

  const secondById =
    new Map(
      second.map(
        (
          web
        ) => [
          web.id,
          JSON.stringify(
            web
          )
        ]
      )
    );

  const allIds =
    new Set([
      ...firstById.keys(),
      ...secondById.keys()
    ]);

  return Array.from(
    allIds
  )
    .filter(
      (
        webId
      ) =>
        firstById.get(
          webId
        ) !==
        secondById.get(
          webId
        )
    )
    .sort();
}

/**
 * Stable non-cryptographic report hash.
 *
 * @param {string} text - Canonical JSON text.
 * @returns {string} Hexadecimal FNV-1a hash with input length.
 */
function hashText(
  text
) {
  let hash =
    0x811c9dc5;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    hash ^=
      text.charCodeAt(
        index
      );

    hash =
      Math.imul(
        hash,
        0x01000193
      );
  }

  return [
    (
      hash >>>
      0
    )
      .toString(
        16
      )
      .padStart(
        8,
        "0"
      ),
    text.length
  ].join(
    ":"
  );
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

  for (
    const child of
    Object.values(
      value
    )
  ) {
    deepFreeze(
      child
    );
  }

  return Object.isFrozen(
    value
  )
    ? value
    : Object.freeze(
        value
      );
}

