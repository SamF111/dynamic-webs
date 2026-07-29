import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  createSweptMovementBounds,
  sweptMovementIntersectsPolyline
} from "./spanWebMovementGeometry.js";

/** Generic movement query over currently intact wall-span web geometry. */
export class WebMovementInteractionService {
  constructor({
    webRuntimeService
  }) {
    if (
      !webRuntimeService ||
      typeof webRuntimeService.queryStrands !==
        "function"
    ) {
      throw new TypeError(
        `${MODULE_TITLE} | WebMovementInteractionService requires the web runtime service.`
      );
    }

    this.webRuntimeService =
      webRuntimeService;
  }

  queryMovement({
    from,
    to,
    levelId = null,
    elevation = null,
    elevationBand = null,
    collisionRadiusPx = 0,
    categories =
      [
        "wall-span"
      ],
    strandKinds = [],
    limit = 1000
  }) {
    const bounds =
      createSweptMovementBounds({
        from,
        to,
        collisionRadiusPx
      });

    const queryOptions = {
      levelId,
      elevation,
      elevationBand,
      categories,
      ...(
        Array.isArray(
          strandKinds
        ) &&
        strandKinds.length >
          0
          ? {
              strandKinds
            }
          : {}
      ),
      intactOnly:
        true,
      limit
    };

    const hitsByWebId =
      new Map();

    const visitStrand =
      (
        strand
      ) => {
        if (
          !sweptMovementIntersectsPolyline({
            from,
            to,
            collisionRadiusPx,
            points:
              strand.points,
            interactionWidthPx:
              strand.interactionWidthPx
          })
        ) {
          return;
        }

        const current =
          hitsByWebId.get(
            strand.webId
          );

        if (
          current
        ) {
          current.strandIds.add(
            strand.strandId
          );

          return;
        }

        hitsByWebId.set(
          strand.webId,
          {
            webId:
              strand.webId,
            sceneId:
              strand.sceneId,
            populationId:
              strand.populationId,
            levelId:
              strand.levelId,
            elevationBand:
              strand.elevationBand,
            webKind:
              strand.webKind,
            strandIds:
              new Set([
                strand.strandId
              ])
          }
        );
      };

    if (
      typeof this.webRuntimeService.visitStrands ===
        "function"
    ) {
      this.webRuntimeService.visitStrands(
        bounds,
        queryOptions,
        visitStrand
      );
    } else {
      const strands =
        this.webRuntimeService.queryStrands(
          bounds,
          queryOptions
        );

      for (
        const strand of
        strands
      ) {
        visitStrand(
          strand
        );
      }
    }

    return Object.freeze(
      Array.from(
        hitsByWebId.values()
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
          (
            hit
          ) =>
            Object.freeze({
              ...hit,
              strandIds:
                Object.freeze(
                  Array.from(
                    hit.strandIds
                  ).sort()
                )
            })
        )
    );
  }
}

