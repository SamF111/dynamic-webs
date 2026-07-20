import {
  createBaseWebLevel,
  createWebLevelDescriptor
} from "./webLevelContract.js";

export function createWebLevelGenerationContexts(
  context
) {
  const levels =
    Array.isArray(
      context?.levels
    ) &&
    context.levels.length >
      0
      ? context.levels
      : [
          createBaseWebLevel()
        ];

  const wallSegments =
    Array.isArray(
      context?.wallSegments
    )
      ? context.wallSegments
      : [];

  return Object.freeze(
    levels.map(
      (
        level
      ) => {
        const descriptor =
          createWebLevelDescriptor(
            level
          );

        return Object.freeze({
          sceneId:
            context.sceneId,
          sceneRect:
            context.sceneRect,
          gridSize:
            context.gridSize,
          level:
            descriptor,
          wallSegments:
            Object.freeze(
              wallSegments.filter(
                (
                  segment
                ) =>
                  String(
                    segment?.levelId ??
                    "base"
                  ) ===
                  descriptor.id
              )
            )
        });
      }
    )
  );
}
