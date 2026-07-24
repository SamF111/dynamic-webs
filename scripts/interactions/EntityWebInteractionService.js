import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  WEB_ENTITY_INTERACTION_HOOKS,
  WEB_ENTITY_INTERACTION_OUTCOMES,
  WEB_ENTITY_INTERACTION_SCHEMA_VERSION
} from "./webInteractionContract.js";

const DEFAULT_FUNCTIONAL_WEB_KINDS =
  Object.freeze([
    "wall-corner",
    "wall-span",
    "ground"
  ]);

/**
 * Read-only generic entity evaluation over current functional web strands.
 *
 * Dynamic Webs remains entity-agnostic: the consumer supplies movement,
 * identity and level compatibility. The service returns immutable geometry
 * outcomes and emits generic hooks, but does not decide AI, trapping or damage.
 */
export class EntityWebInteractionService {
  constructor({
    webRuntimeService,
    movementInteractionService
  }) {
    if (
      !webRuntimeService ||
      typeof webRuntimeService.queryNearby !==
        "function" ||
      typeof movementInteractionService?.queryMovement !==
        "function"
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | EntityWebInteractionService requires web spatial and movement services.`
      );
    }

    this.webRuntimeService =
      webRuntimeService;

    this.movementInteractionService =
      movementInteractionService;

    this.evaluationCount =
      0;

    this.positionQueryCount =
      0;

    this.lastResult =
      null;
  }

  queryPosition(
    request
  ) {
    const normalised =
      normalisePositionRequest(
        request
      );

    const hits =
      groupStrandsByWeb(
        this.webRuntimeService.queryNearby(
          normalised.point,
          createSpatialOptions(
            normalised
          )
        ),
        "position"
      );

    const result =
      deepFreeze({
        schemaVersion:
          WEB_ENTITY_INTERACTION_SCHEMA_VERSION,
        sceneId:
          resolveRuntimeSceneId(
            this.webRuntimeService
          ),
        entity:
          normalised.entity,
        point:
          normalised.point,
        collisionRadiusPx:
          normalised.collisionRadiusPx,
        levelId:
          normalised.levelId,
        elevation:
          normalised.elevation,
        elevationBand:
          normalised.elevationBand,
        webHits:
          hits,
        webIds:
          hits.map(
            hit =>
              hit.webId
          ),
        onWeb:
          hits.length >
          0
      });

    this.positionQueryCount +=
      1;

    return result;
  }

  evaluateMovement(
    request
  ) {
    const normalised =
      normaliseMovementRequest(
        request
      );

    const fromHits =
      groupStrandsByWeb(
        this.webRuntimeService.queryNearby(
          normalised.from,
          createSpatialOptions(
            normalised
          )
        ),
        "from"
      );

    const toHits =
      groupStrandsByWeb(
        this.webRuntimeService.queryNearby(
          normalised.to,
          createSpatialOptions(
            normalised
          )
        ),
        "to"
      );

    const movementHits =
      this.movementInteractionService.queryMovement({
        from:
          normalised.from,
        to:
          normalised.to,
        levelId:
          normalised.levelId,
        elevation:
          normalised.elevation,
        elevationBand:
          normalised.elevationBand,
        collisionRadiusPx:
          normalised.collisionRadiusPx,
        categories:
          normalised.categories,
        strandKinds:
          normalised.strandKinds,
        limit:
          normalised.limit
      });

    const fromIds =
      new Set(
        fromHits.map(
          hit =>
            hit.webId
        )
      );

    const toIds =
      new Set(
        toHits.map(
          hit =>
            hit.webId
        )
      );

    const intersectedWebIds =
      movementHits.map(
        hit =>
          hit.webId
      );

    const enteredWebIds =
      Array.from(
        toIds
      )
        .filter(
          webId =>
            !fromIds.has(
              webId
            )
        )
        .sort();

    const leftWebIds =
      Array.from(
        fromIds
      )
        .filter(
          webId =>
            !toIds.has(
              webId
            )
        )
        .sort();

    const currentWebIds =
      Array.from(
        toIds
      ).sort();

    const webHits =
      mergeMovementHits({
        fromHits,
        toHits,
        movementHits
      });

    const outcomes =
      createOutcomeList({
        enteredWebIds,
        leftWebIds,
        intersectedWebIds,
        currentWebIds
      });

    const result =
      deepFreeze({
        schemaVersion:
          WEB_ENTITY_INTERACTION_SCHEMA_VERSION,
        interactionId:
          createInteractionId(
            normalised.entity,
            normalised.from,
            normalised.to
          ),
        evaluatedAt:
          Date.now(),
        sceneId:
          resolveRuntimeSceneId(
            this.webRuntimeService
          ),
        entity:
          normalised.entity,
        movement: {
          from:
            normalised.from,
          to:
            normalised.to,
          collisionRadiusPx:
            normalised.collisionRadiusPx,
          levelId:
            normalised.levelId,
          elevation:
            normalised.elevation,
          elevationBand:
            normalised.elevationBand
        },
        primaryOutcome:
          outcomes[0],
        outcomes,
        webHits,
        enteredWebIds,
        leftWebIds,
        intersectedWebIds,
        currentWebIds,
        onWeb:
          currentWebIds.length >
          0
      });

    this.evaluationCount +=
      1;

    this.lastResult =
      result;

    if (
      normalised.emitHooks ===
      true &&
      result.primaryOutcome !==
        WEB_ENTITY_INTERACTION_OUTCOMES.NO_INTERACTION
    ) {
      emitInteractionHooks(
        result
      );
    }

    return result;
  }

  createDiagnosticSnapshot() {
    return deepFreeze({
      evaluationCount:
        this.evaluationCount,
      positionQueryCount:
        this.positionQueryCount,
      lastResult:
        this.lastResult
    });
  }
}

function normalisePositionRequest(
  request
) {
  const source =
    requirePlainObject(
      request,
      "entity position request"
    );

  return Object.freeze({
    entity:
      normaliseEntity(
        source
      ),
    point:
      requirePoint(
        source.point ??
        source.position,
        "entity position"
      ),
    ...normaliseSharedQueryFields(
      source
    )
  });
}

function normaliseMovementRequest(
  request
) {
  const source =
    requirePlainObject(
      request,
      "entity movement request"
    );

  return Object.freeze({
    entity:
      normaliseEntity(
        source
      ),
    from:
      requirePoint(
        source.from,
        "entity movement start"
      ),
    to:
      requirePoint(
        source.to,
        "entity movement end"
      ),
    ...normaliseSharedQueryFields(
      source
    ),
    emitHooks:
      source.emitHooks !==
        false
  });
}

function normaliseSharedQueryFields(
  source
) {
  const levelId =
    normaliseOptionalIdentifier(
      source.levelId
    );

  const elevation =
    normaliseOptionalFiniteNumber(
      source.elevation,
      "entity elevation"
    );

  const elevationBand =
    normaliseElevationBand(
      source.elevationBand
    );

  if (
    !levelId &&
    elevation ===
      null &&
    !elevationBand
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Generic entity web queries require levelId, elevation or elevationBand.`
    );
  }

  return {
    collisionRadiusPx:
      requireNonNegativeNumber(
        source.collisionRadiusPx ??
        source.radiusPx ??
        0,
        "entity collision radius"
      ),
    levelId,
    elevation,
    elevationBand,
    categories:
      normaliseIdentifierList(
        source.categories ??
        source.webKinds,
        DEFAULT_FUNCTIONAL_WEB_KINDS
      ),
    strandKinds:
      normaliseIdentifierList(
        source.strandKinds ??
        source.strandRoles,
        []
      ),
    limit:
      normalisePositiveInteger(
        source.limit ??
        1000,
        "entity interaction result limit",
        1000
      )
  };
}

function normaliseEntity(
  source
) {
  return deepFreeze({
    id:
      requireIdentifier(
        source.entityId ??
        source.entity?.id,
        "entity ID"
      ),
    type:
      normaliseOptionalIdentifier(
        source.entityType ??
        source.entity?.type
      ) ??
      "external-entity",
    sourceModuleId:
      normaliseOptionalIdentifier(
        source.sourceModuleId ??
        source.entity?.sourceModuleId
      ) ??
      "external"
  });
}

function createSpatialOptions(
  request
) {
  const options = {
    maximumDistancePx:
      request.collisionRadiusPx,
    categories:
      request.categories,
    intactOnly:
      true,
    limit:
      request.limit
  };

  if (
    request.strandKinds.length >
    0
  ) {
    options.strandKinds =
      request.strandKinds;
  }

  if (
    request.levelId
  ) {
    options.levelId =
      request.levelId;
  }

  if (
    request.elevation !==
      null
  ) {
    options.elevation =
      request.elevation;
  }

  if (
    request.elevationBand
  ) {
    options.elevationBand =
      request.elevationBand;
  }

  return options;
}

function groupStrandsByWeb(
  strands,
  phase
) {
  const byWebId =
    new Map();

  for (
    const strand of
    Array.isArray(
      strands
    )
      ? strands
      : []
  ) {
    const webId =
      normaliseOptionalIdentifier(
        strand?.webId
      );

    if (!webId) {
      continue;
    }

    let hit =
      byWebId.get(
        webId
      );

    if (!hit) {
      hit = {
        webId,
        sceneId:
          normaliseOptionalIdentifier(
            strand?.sceneId
          ),
        populationId:
          normaliseOptionalIdentifier(
            strand?.populationId
          ),
        levelId:
          normaliseOptionalIdentifier(
            strand?.levelId
          ),
        elevationBand:
          strand?.elevationBand ??
          null,
        webKind:
          normaliseOptionalIdentifier(
            strand?.webKind
          ),
        strandIds:
          new Set(),
        phases:
          new Set()
      };

      byWebId.set(
        webId,
        hit
      );
    }

    const strandId =
      normaliseOptionalIdentifier(
        strand?.strandId
      );

    if (
      strandId
    ) {
      hit.strandIds.add(
        strandId
      );
    }

    hit.phases.add(
      phase
    );
  }

  return Array.from(
    byWebId.values()
  )
    .sort(
      (
        first,
        second
      ) =>
        first.webId.localeCompare(
          second.webId
        )
    )
    .map(
      hit =>
        deepFreeze({
          ...hit,
          strandIds:
            Array.from(
              hit.strandIds
            ).sort(),
          phases:
            Array.from(
              hit.phases
            ).sort()
        })
    );
}

function mergeMovementHits({
  fromHits,
  toHits,
  movementHits
}) {
  const byWebId =
    new Map();

  const add =
    (
      hit,
      phase
    ) => {
      const webId =
        normaliseOptionalIdentifier(
          hit?.webId
        );

      if (!webId) {
        return;
      }

      let current =
        byWebId.get(
          webId
        );

      if (!current) {
        current = {
          webId,
          sceneId:
            hit.sceneId ??
            null,
          populationId:
            hit.populationId ??
            null,
          levelId:
            hit.levelId ??
            null,
          elevationBand:
            hit.elevationBand ??
            null,
          webKind:
            hit.webKind ??
            null,
          strandIds:
            new Set(),
          phases:
            new Set()
        };

        byWebId.set(
          webId,
          current
        );
      }

      for (
        const strandId of
        Array.isArray(
          hit?.strandIds
        )
          ? hit.strandIds
          : []
      ) {
        current.strandIds.add(
          strandId
        );
      }

      current.phases.add(
        phase
      );
    };

  for (
    const hit of
    fromHits
  ) {
    add(
      hit,
      "from"
    );
  }

  for (
    const hit of
    toHits
  ) {
    add(
      hit,
      "to"
    );
  }

  for (
    const hit of
    movementHits
  ) {
    add(
      hit,
      "swept"
    );
  }

  return Array.from(
    byWebId.values()
  )
    .sort(
      (
        first,
        second
      ) =>
        first.webId.localeCompare(
          second.webId
        )
    )
    .map(
      hit =>
        deepFreeze({
          ...hit,
          strandIds:
            Array.from(
              hit.strandIds
            ).sort(),
          phases:
            Array.from(
              hit.phases
            ).sort()
        })
    );
}

function createOutcomeList({
  enteredWebIds,
  leftWebIds,
  intersectedWebIds,
  currentWebIds
}) {
  const outcomes =
    [];

  if (
    enteredWebIds.length >
    0
  ) {
    outcomes.push(
      WEB_ENTITY_INTERACTION_OUTCOMES.ENTERED_WEB
    );
  }

  if (
    intersectedWebIds.length >
    0
  ) {
    outcomes.push(
      WEB_ENTITY_INTERACTION_OUTCOMES.INTERSECTED_WEB
    );
  }

  if (
    currentWebIds.length >
    0
  ) {
    outcomes.push(
      WEB_ENTITY_INTERACTION_OUTCOMES.ON_WEB
    );
  }

  if (
    leftWebIds.length >
    0
  ) {
    outcomes.push(
      WEB_ENTITY_INTERACTION_OUTCOMES.LEFT_WEB
    );
  }

  if (
    outcomes.length ===
    0
  ) {
    outcomes.push(
      WEB_ENTITY_INTERACTION_OUTCOMES.NO_INTERACTION
    );
  }

  return Object.freeze(
    outcomes
  );
}

function emitInteractionHooks(
  result
) {
  const hooks =
    globalThis.Hooks;

  if (
    typeof hooks?.callAll !==
      "function"
  ) {
    return false;
  }

  hooks.callAll(
    WEB_ENTITY_INTERACTION_HOOKS.INTERACTION,
    result
  );

  for (
    const [
      hookName,
      webIds
    ] of [
      [
        WEB_ENTITY_INTERACTION_HOOKS.ENTERED_WEB,
        result.enteredWebIds
      ],
      [
        WEB_ENTITY_INTERACTION_HOOKS.LEFT_WEB,
        result.leftWebIds
      ],
      [
        WEB_ENTITY_INTERACTION_HOOKS.INTERSECTED_WEB,
        result.intersectedWebIds
      ],
      [
        WEB_ENTITY_INTERACTION_HOOKS.ON_WEB,
        result.currentWebIds
      ]
    ]
  ) {
    if (
      webIds.length >
      0
    ) {
      hooks.callAll(
        hookName,
        result,
        webIds
      );
    }
  }

  return true;
}

function createInteractionId(
  entity,
  from,
  to
) {
  return [
    "interaction",
    entity.sourceModuleId,
    entity.type,
    entity.id,
    `${from.x},${from.y}`,
    `${to.x},${to.y}`,
    Date.now().toString(
      36
    )
  ].map(
    encodeURIComponent
  ).join(
    ":"
  );
}

function resolveRuntimeSceneId(
  service
) {
  return normaliseOptionalIdentifier(
    service?.getState?.()?.sceneId
  );
}

function requirePlainObject(
  value,
  label
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be an object.`
    );
  }

  return value;
}

function requirePoint(
  value,
  label
) {
  const x =
    Number(
      value?.x
    );

  const y =
    Number(
      value?.y
    );

  if (
    !Number.isFinite(
      x
    ) ||
    !Number.isFinite(
      y
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} requires finite x and y coordinates.`
    );
  }

  return Object.freeze({
    x,
    y
  });
}

function normaliseElevationBand(
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

  const bottom =
    normaliseOptionalFiniteNumber(
      value?.bottom,
      "entity elevation-band bottom"
    );

  const top =
    normaliseOptionalFiniteNumber(
      value?.top,
      "entity elevation-band top"
    );

  if (
    bottom !==
      null &&
    top !==
      null &&
    top <
      bottom
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | Entity elevation band must not be inverted.`
    );
  }

  return Object.freeze({
    bottom,
    top
  });
}

function normaliseOptionalFiniteNumber(
  value,
  label
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

  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be finite.`
    );
  }

  return number;
}

function requireNonNegativeNumber(
  value,
  label
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <
      0
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a non-negative finite number.`
    );
  }

  return number;
}

function normalisePositiveInteger(
  value,
  label,
  maximum
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isInteger(
      number
    ) ||
    number <
      1
  ) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a positive integer.`
    );
  }

  return Math.min(
    number,
    maximum
  );
}

function normaliseIdentifierList(
  value,
  fallback
) {
  const values =
    value ===
      null ||
    value ===
      undefined
      ? fallback
      : Array.isArray(
          value
        )
        ? value
        : [
            value
          ];

  return Object.freeze(
    Array.from(
      new Set(
        values
          .map(
            normaliseOptionalIdentifier
          )
          .filter(
            Boolean
          )
      )
    ).sort()
  );
}

function requireIdentifier(
  value,
  label
) {
  const identifier =
    normaliseOptionalIdentifier(
      value
    );

  if (!identifier) {
    throw new TypeError(
      `${MODULE_TITLE} | ${label} must be a non-empty identifier.`
    );
  }

  return identifier;
}

function normaliseOptionalIdentifier(
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
    clone[key] =
      deepFreeze(
        entry
      );
  }

  return Object.freeze(
    clone
  );
}
