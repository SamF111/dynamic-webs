import {
  WEB_BLUEPRINT_SCHEMA_VERSION
} from "../../module/moduleConstants.js";

/**
 * Supported immutable generated-web blueprint kinds.
 */
export const WEB_BLUEPRINT_KINDS =
  Object.freeze({
    WALL_CORNER:
      "wall-corner",
    WALL_SPAN:
      "wall-span",
    GROUND:
      "ground",
    WEB_CARPET:
      "web-carpet"
  });

const SUPPORTED_WEB_KINDS =
  new Set(
    Object.values(
      WEB_BLUEPRINT_KINDS
    )
  );

const SUPPORTED_STRAND_KINDS =
  new Set([
    "structural",
    "capture",
    "decorative"
  ]);

const BOUNDS_TOLERANCE =
  0.000001;

/**
 * Create one stable Scene- and level-qualified web identifier.
 *
 * @param {object} options - Identifier values.
 * @param {string} options.sceneId - Owning Scene identifier.
 * @param {string} options.levelId - Owning level identifier.
 * @param {string} options.kind - Web blueprint kind.
 * @param {string|number} options.sourceKey - Stable category-local source key.
 * @returns {string} Stable web identifier.
 */
export function createStableWebId({
  sceneId,
  populationId = "default",
  levelId,
  kind,
  sourceKey
}) {
  const normalisedKind =
    requireIdentifier(
      kind,
      "web kind"
    );

  if (
    !SUPPORTED_WEB_KINDS.has(
      normalisedKind
    )
  ) {
    throw new Error(
      `Dynamic Webs | Unsupported web blueprint kind "${normalisedKind}".`
    );
  }

  return [
    normalisedKind,
    encodeIdentifierPart(
      requireIdentifier(
        sceneId,
        "Scene ID"
      )
    ),
    encodeIdentifierPart(
      requireIdentifier(
        populationId,
        "web population ID"
      )
    ),
    encodeIdentifierPart(
      requireIdentifier(
        levelId,
        "web level ID"
      )
    ),
    encodeIdentifierPart(
      requireIdentifier(
        sourceKey,
        "web source key"
      )
    )
  ].join(":");
}

/**
 * Create one stable web-qualified strand identifier.
 *
 * @param {string} webId - Owning web identifier.
 * @param {string|number} localStrandId - Stable web-local strand identifier.
 * @returns {string} Stable strand identifier.
 */
export function createStableStrandId(
  webId,
  localStrandId
) {
  return [
    requireIdentifier(
      webId,
      "web ID"
    ),
    encodeIdentifierPart(
      requireIdentifier(
        localStrandId,
        "local strand ID"
      )
    )
  ].join(":");
}

/**
 * Recursively freeze one generated-web value in place.
 *
 * Generated blueprints contain only plain arrays and objects. PIXI objects
 * must never be passed to this helper.
 *
 * @param {unknown} value - Generated-web value.
 * @returns {unknown} The same deeply frozen value.
 */
export function deepFreezeWebValue(
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
    deepFreezeWebValue(
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

/**
 * Validate one complete immutable web blueprint.
 *
 * @param {unknown} blueprint - Candidate blueprint.
 * @param {object} [options={}] - Validation options.
 * @param {string|null} [options.expectedSceneId=null] - Expected owner Scene.
 * @returns {object} Validated blueprint.
 */
export function assertWebBlueprintIntegrity(
  blueprint,
  {
    expectedSceneId = null
  } = {}
) {
  if (
    !blueprint ||
    typeof blueprint !==
      "object" ||
    Array.isArray(
      blueprint
    )
  ) {
    throw new TypeError(
      "Dynamic Webs | A generated web blueprint must be an object."
    );
  }

  if (
    blueprint.schemaVersion !==
      WEB_BLUEPRINT_SCHEMA_VERSION
  ) {
    throw new Error(
      `Dynamic Webs | Web blueprint "${String(blueprint.id ?? "unknown")}" has schema version ${String(blueprint.schemaVersion)}; expected ${WEB_BLUEPRINT_SCHEMA_VERSION}.`
    );
  }

  const webId =
    requireIdentifier(
      blueprint.id,
      "web ID"
    );

  const sceneId =
    requireIdentifier(
      blueprint.sceneId,
      `Scene ID for web "${webId}"`
    );

  const populationId =
    requireIdentifier(
      blueprint.populationId,
      `population ID for web "${webId}"`
    );

  requireIdentifier(
    blueprint.populationLabel,
    `population label for web "${webId}"`
  );

  if (
    !Number.isFinite(
      Number(blueprint.thicknessMultiplier)
    ) ||
    Number(blueprint.thicknessMultiplier) <= 0
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" has an invalid population thickness multiplier.`
    );
  }

  const levelProviderMode =
    requireIdentifier(
      blueprint.levelProviderMode,
      `level provider mode for web "${webId}"`
    );

  const levelId =
    requireIdentifier(
      blueprint.levelId,
      `level ID for web "${webId}"`
    );

  assertElevationBand(
    blueprint.elevationBand,
    webId
  );

  const kind =
    requireIdentifier(
      blueprint.kind,
      `kind for web "${webId}"`
    );

  requireIdentifier(
    blueprint.seed,
    `generation seed for web "${webId}"`
  );

  requireIdentifier(
    blueprint.sourceKey,
    `source key for web "${webId}"`
  );

  if (
    expectedSceneId !==
      null &&
    sceneId !==
      String(
        expectedSceneId
      )
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" belongs to Scene "${sceneId}", not "${String(expectedSceneId)}".`
    );
  }

  if (
    !SUPPORTED_WEB_KINDS.has(
      kind
    )
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" has unsupported kind "${kind}".`
    );
  }

  if (
    kind ===
      WEB_BLUEPRINT_KINDS.WEB_CARPET
  ) {
    assertWebCarpetPresentation(
      blueprint.carpet,
      webId
    );
  } else if (
    blueprint.carpet !==
      undefined &&
    blueprint.carpet !==
      null
  ) {
    throw new Error(
      `Dynamic Webs | Non-carpet web "${webId}" cannot contain carpet presentation data.`
    );
  }

  const expectedWebId =
    createStableWebId({
      sceneId,
      populationId,
      levelId,
      kind,
      sourceKey:
        blueprint.sourceKey
    });

  if (
    webId !==
      expectedWebId
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" is not correctly qualified by Scene "${sceneId}", population "${populationId}" and level "${levelId}".`
    );
  }

  if (
    levelProviderMode.length ===
      0
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" has an invalid level provider mode.`
    );
  }

  if (
    blueprint.colourProfileId !==
      undefined
  ) {
    requireIdentifier(
      blueprint.colourProfileId,
      `colour profile for web "${webId}"`
    );
  }

  assertFinitePoint(
    blueprint.hub,
    `hub for web "${webId}"`
  );

  assertBounds(
    blueprint.bounds,
    webId
  );

  if (
    !Array.isArray(
      blueprint.strands
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | Web "${webId}" must contain a strand array.`
    );
  }

  const localStrandIds =
    new Set();

  const globalStrandIds =
    new Set();

  const allPoints =
    [
      blueprint.hub
    ];

  for (
    const strand of
    blueprint.strands
  ) {
    assertStrandIntegrity(
      strand,
      webId
    );

    if (
      localStrandIds.has(
        strand.localId
      )
    ) {
      throw new Error(
        `Dynamic Webs | Web "${webId}" contains duplicate local strand ID "${strand.localId}".`
      );
    }

    if (
      globalStrandIds.has(
        strand.id
      )
    ) {
      throw new Error(
        `Dynamic Webs | Web "${webId}" contains duplicate strand ID "${strand.id}".`
      );
    }

    localStrandIds.add(
      strand.localId
    );

    globalStrandIds.add(
      strand.id
    );

    allPoints.push(
      ...strand.points
    );
  }

  for (
    const point of
    allPoints
  ) {
    if (
      !boundsContainPoint(
        blueprint.bounds,
        point
      )
    ) {
      throw new Error(
        `Dynamic Webs | Bounds for web "${webId}" do not contain all generated points.`
      );
    }
  }

  if (
    !Array.isArray(blueprint.perches) ||
    !Array.isArray(blueprint.supportingWallIds) ||
    !Array.isArray(blueprint.regionIds) ||
    !Array.isArray(blueprint.regionTags)
  ) {
    throw new TypeError(
      `Dynamic Webs | Web "${webId}" must contain perch, supporting-wall, Region ID and Region tag arrays.`
    );
  }

  assertUniqueIdentifierArray(blueprint.regionIds, `Region IDs for web "${webId}"`);
  assertUniqueIdentifierArray(blueprint.regionTags, `Region tags for web "${webId}"`);

  for (
    const perch of
    blueprint.perches
  ) {
    requireIdentifier(
      perch?.id,
      `perch ID for web "${webId}"`
    );

    assertFinitePoint(
      perch,
      `perch for web "${webId}"`
    );

    if (
      !Number.isFinite(
        Number(
          perch.rotation
        )
      )
    ) {
      throw new TypeError(
        `Dynamic Webs | Perch "${String(perch.id)}" on web "${webId}" has an invalid rotation.`
      );
    }
  }

  if (
    !Object.isFrozen(
      blueprint
    ) ||
    !Object.isFrozen(
      blueprint.bounds
    ) ||
    !Object.isFrozen(
      blueprint.elevationBand
    ) ||
    !Object.isFrozen(
      blueprint.strands
    ) ||
    !Object.isFrozen(
      blueprint.perches
    ) ||
    !Object.isFrozen(blueprint.supportingWallIds) ||
    !Object.isFrozen(blueprint.regionIds) ||
    !Object.isFrozen(blueprint.regionTags) ||
    (
      blueprint.carpet &&
      !Object.isFrozen(
        blueprint.carpet
      )
    )
  ) {
    throw new Error(
      `Dynamic Webs | Web blueprint "${webId}" is not deeply immutable.`
    );
  }

  return blueprint;
}

/**
 * Validate one complete generated web population.
 *
 * @param {unknown} webs - Candidate blueprint array.
 * @param {object} [options={}] - Validation options.
 * @param {string|null} [options.expectedSceneId=null] - Expected owner Scene.
 * @returns {readonly object[]} Validated population.
 */
export function assertWebPopulationIntegrity(
  webs,
  {
    expectedSceneId = null
  } = {}
) {
  if (
    !Array.isArray(
      webs
    )
  ) {
    throw new TypeError(
      "Dynamic Webs | Generated web population must be an array."
    );
  }

  const webIds =
    new Set();

  const strandIds =
    new Set();

  for (
    const web of
    webs
  ) {
    assertWebBlueprintIntegrity(
      web,
      {
        expectedSceneId
      }
    );

    if (
      webIds.has(
        web.id
      )
    ) {
      throw new Error(
        `Dynamic Webs | Generated population contains duplicate web ID "${web.id}".`
      );
    }

    webIds.add(
      web.id
    );

    for (
      const strand of
      web.strands
    ) {
      if (
        strandIds.has(
          strand.id
        )
      ) {
        throw new Error(
          `Dynamic Webs | Generated population contains duplicate strand ID "${strand.id}".`
        );
      }

      strandIds.add(
        strand.id
      );
    }
  }

  if (
    !Object.isFrozen(
      webs
    )
  ) {
    throw new Error(
      "Dynamic Webs | Generated web population array is not immutable."
    );
  }

  return webs;
}

function assertStrandIntegrity(
  strand,
  webId
) {
  if (
    !strand ||
    typeof strand !==
      "object" ||
    Array.isArray(
      strand
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | Web "${webId}" contains an invalid strand.`
    );
  }

  if (
    strand.schemaVersion !==
      WEB_BLUEPRINT_SCHEMA_VERSION
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${String(strand.id ?? "unknown")}" has schema version ${String(strand.schemaVersion)}; expected ${WEB_BLUEPRINT_SCHEMA_VERSION}.`
    );
  }

  const strandId =
    requireIdentifier(
      strand.id,
      `strand ID for web "${webId}"`
    );

  const localId =
    requireIdentifier(
      strand.localId,
      `local strand ID for web "${webId}"`
    );

  if (
    strandId !==
      createStableStrandId(
        webId,
        localId
      )
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${strandId}" is not correctly qualified by web "${webId}".`
    );
  }

  if (
    !SUPPORTED_STRAND_KINDS.has(
      strand.kind
    )
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${strandId}" has unsupported kind "${String(strand.kind)}".`
    );
  }

  if (
    !Array.isArray(
      strand.points
    ) ||
    strand.points.length <
      2
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${strandId}" must contain at least two points.`
    );
  }

  for (
    const point of
    strand.points
  ) {
    assertFinitePoint(
      point,
      `point on strand "${strandId}"`
    );

    if (
      !Object.isFrozen(
        point
      )
    ) {
      throw new Error(
        `Dynamic Webs | Strand "${strandId}" contains a mutable point.`
      );
    }
  }

  if (
    !Number.isFinite(
      Number(
        strand.alpha
      )
    ) ||
    strand.alpha <=
      0 ||
    strand.alpha >
      1
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${strandId}" has invalid alpha.`
    );
  }

  if (
    strand.baseAlpha !==
      undefined &&
    (
      !Number.isFinite(
        Number(
          strand.baseAlpha
        )
      ) ||
      strand.baseAlpha <=
        0 ||
      strand.baseAlpha >
        1
    )
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${strandId}" has invalid base alpha.`
    );
  }

  for (
    const colourField of
    [
      "colour",
      "underColour"
    ]
  ) {
    if (
      strand[colourField] !==
        undefined &&
      (
        !Number.isInteger(
          strand[colourField]
        ) ||
        strand[colourField] <
          0 ||
        strand[colourField] >
          0xffffff
      )
    ) {
      throw new Error(
        `Dynamic Webs | Strand "${strandId}" has invalid ${colourField}.`
      );
    }
  }

  if (
    !Number.isFinite(
      Number(
        strand.widthPx
      )
    ) ||
    strand.widthPx <=
      0 ||
    !Number.isFinite(
      Number(
        strand.collisionWidthPx
      )
    ) ||
    strand.collisionWidthPx <=
      0
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${strandId}" has invalid visual or collision width.`
    );
  }

  if (
    !Object.isFrozen(
      strand
    ) ||
    !Object.isFrozen(
      strand.points
    )
  ) {
    throw new Error(
      `Dynamic Webs | Strand "${strandId}" is not deeply immutable.`
    );
  }
}

function assertWebCarpetPresentation(
  carpet,
  webId
) {
  if (
    !carpet ||
    typeof carpet !==
      "object" ||
    Array.isArray(
      carpet
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | Carpet web "${webId}" requires carpet presentation data.`
    );
  }

  requireIdentifier(
    carpet.regionId,
    `carpet Region ID for web "${webId}"`
  );

  if (
    !Array.isArray(
      carpet.patches
    ) ||
    carpet.patches.length ===
      0
  ) {
    throw new Error(
      `Dynamic Webs | Carpet web "${webId}" requires at least one patch descriptor.`
    );
  }

  const patchIds =
    new Set();

  for (
    const patch of
    carpet.patches
  ) {
    const patchId =
      requireIdentifier(
        patch?.id,
        `carpet patch ID for web "${webId}"`
      );

    if (
      patchIds.has(
        patchId
      )
    ) {
      throw new Error(
        `Dynamic Webs | Carpet web "${webId}" contains duplicate patch ID "${patchId}".`
      );
    }

    patchIds.add(
      patchId
    );

    requireIdentifier(
      patch?.assetId,
      `carpet asset ID for patch "${patchId}"`
    );

    const modulePath =
      requireIdentifier(
        patch?.modulePath,
        `carpet asset path for patch "${patchId}"`
      );

    if (
      !modulePath.toLowerCase().endsWith(
        ".webp"
      )
    ) {
      throw new Error(
        `Dynamic Webs | Carpet patch "${patchId}" must reference a WebP asset.`
      );
    }

    for (
      const field of
      [
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "alpha"
      ]
    ) {
      if (
        !Number.isFinite(
          Number(
            patch?.[
              field
            ]
          )
        )
      ) {
        throw new TypeError(
          `Dynamic Webs | Carpet patch "${patchId}" has invalid ${field}.`
        );
      }
    }

    if (
      Number(
        patch.width
      ) <=
        0 ||
      Number(
        patch.height
      ) <=
        0 ||
      Number(
        patch.alpha
      ) <=
        0 ||
      Number(
        patch.alpha
      ) >
        1
    ) {
      throw new Error(
        `Dynamic Webs | Carpet patch "${patchId}" has invalid dimensions or alpha.`
      );
    }

    if (
      typeof patch.flipX !==
        "boolean" ||
      typeof patch.flipY !==
        "boolean"
    ) {
      throw new TypeError(
        `Dynamic Webs | Carpet patch "${patchId}" requires boolean flip flags.`
      );
    }
  }

  const mask =
    carpet.mask;

  if (
    !mask ||
    typeof mask !==
      "object" ||
    Array.isArray(
      mask
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | Carpet web "${webId}" requires mask data.`
    );
  }

  requireIdentifier(
    mask.cacheKey,
    `carpet mask cache key for web "${webId}"`
  );

  assertBounds(
    mask.bounds,
    `${webId}:mask`
  );

  if (
    !Number.isInteger(
      Number(
        mask.resolutionPx
      )
    ) ||
    Number(
      mask.resolutionPx
    ) <
      64 ||
    Number(
      mask.resolutionPx
    ) >
      1024
  ) {
    throw new Error(
      `Dynamic Webs | Carpet web "${webId}" has invalid mask resolution.`
    );
  }

  for (
    const key of
    [
      "confineShapes",
      "excludeShapes"
    ]
  ) {
    if (
      !Array.isArray(
        mask[
          key
        ]
      )
    ) {
      throw new TypeError(
        `Dynamic Webs | Carpet web "${webId}" mask ${key} must be an array.`
      );
    }
  }

  if (
    !Object.isFrozen(
      carpet
    ) ||
    !Object.isFrozen(
      carpet.patches
    ) ||
    !Object.isFrozen(
      mask
    )
  ) {
    throw new Error(
      `Dynamic Webs | Carpet presentation for web "${webId}" is not deeply immutable.`
    );
  }
}

function assertElevationBand(
  band,
  webId
) {
  if (
    !band ||
    typeof band !==
      "object" ||
    Array.isArray(
      band
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | Web "${webId}" requires an elevation-band object.`
    );
  }

  for (
    const key of
    [
      "bottom",
      "top"
    ]
  ) {
    const value =
      band[key];

    if (
      value !==
        null &&
      !Number.isFinite(
        Number(
          value
        )
      )
    ) {
      throw new TypeError(
        `Dynamic Webs | Web "${webId}" has an invalid elevation-band ${key}.`
      );
    }
  }

  if (
    band.bottom !==
      null &&
    band.top !==
      null &&
    Number(
      band.top
    ) <
      Number(
        band.bottom
      )
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" has an inverted elevation band.`
    );
  }
}

function assertBounds(
  bounds,
  webId
) {
  if (
    !bounds ||
    typeof bounds !==
      "object" ||
    Array.isArray(
      bounds
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | Web "${webId}" has invalid bounds.`
    );
  }

  for (
    const property of
    [
      "x",
      "y",
      "width",
      "height",
      "right",
      "bottom"
    ]
  ) {
    if (
      !Number.isFinite(
        Number(
          bounds[property]
        )
      )
    ) {
      throw new TypeError(
        `Dynamic Webs | Bounds property "${property}" for web "${webId}" must be finite.`
      );
    }
  }

  if (
    bounds.width <
      0 ||
    bounds.height <
      0
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" has negative bounds dimensions.`
    );
  }

  if (
    Math.abs(
      bounds.right -
      (
        bounds.x +
        bounds.width
      )
    ) >
      BOUNDS_TOLERANCE ||
    Math.abs(
      bounds.bottom -
      (
        bounds.y +
        bounds.height
      )
    ) >
      BOUNDS_TOLERANCE
  ) {
    throw new Error(
      `Dynamic Webs | Web "${webId}" has internally inconsistent bounds.`
    );
  }
}

function boundsContainPoint(
  bounds,
  point
) {
  return (
    point.x >=
      bounds.x -
      BOUNDS_TOLERANCE &&
    point.x <=
      bounds.right +
      BOUNDS_TOLERANCE &&
    point.y >=
      bounds.y -
      BOUNDS_TOLERANCE &&
    point.y <=
      bounds.bottom +
      BOUNDS_TOLERANCE
  );
}

function assertFinitePoint(
  point,
  label
) {
  if (
    !point ||
    !Number.isFinite(
      Number(
        point.x
      )
    ) ||
    !Number.isFinite(
      Number(
        point.y
      )
    )
  ) {
    throw new TypeError(
      `Dynamic Webs | ${label} must contain finite x and y coordinates.`
    );
  }
}

function requireIdentifier(
  value,
  label
) {
  const identifier =
    String(
      value ??
      ""
    ).trim();

  if (
    identifier.length ===
      0
  ) {
    throw new TypeError(
      `Dynamic Webs | ${label} must be a non-empty identifier.`
    );
  }

  return identifier;
}

function encodeIdentifierPart(
  value
) {
  return encodeURIComponent(
    value
  );
}


function assertUniqueIdentifierArray(value, label) {
  const seen = new Set();
  for (const entry of value) {
    const identifier = requireIdentifier(entry, label);
    if (seen.has(identifier)) {
      throw new Error(`Dynamic Webs | ${label} contains duplicate identifier "${identifier}".`);
    }
    seen.add(identifier);
  }
}
