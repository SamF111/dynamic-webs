import {
  MODULE_TITLE
} from "../module/moduleConstants.js";

import {
  getSceneRect
} from "./canvasCompatibility.js";

/** Build the plain active-Scene context consumed by web generation. */
export function createActiveWebSceneContext(
  scene = globalThis.canvas?.scene
) {
  const sceneId =
    typeof scene?.id === "string"
      ? scene.id.trim()
      : "";

  const sceneRect =
    getSceneRect();

  const gridSize =
    resolveGridSize(scene);

  if (!sceneId || !sceneRect || gridSize === null) {
    throw new Error(
      `${MODULE_TITLE} | The active Scene cannot provide web-generation geometry.`
    );
  }

  return Object.freeze({
    sceneId,
    sceneRect,
    gridSize,
    wallSegments:
      Object.freeze(
        collectStructuralWallSegments(scene)
      )
  });
}

/** Collect non-door structural wall segments from the active canvas/Scene. */
export function collectStructuralWallSegments(
  scene = globalThis.canvas?.scene
) {
  const candidates =
    resolveWallCandidates(scene);

  return candidates
    .map((candidate, index) => normaliseWallSegment(candidate, index))
    .filter(Boolean)
    .sort((first, second) => first.wallId.localeCompare(second.wallId));
}

function resolveWallCandidates(scene) {
  const placeables =
    globalThis.canvas?.walls?.placeables;

  if (Array.isArray(placeables)) return placeables;

  const walls = scene?.walls;
  if (Array.isArray(walls?.contents)) return walls.contents;
  if (Array.isArray(walls)) return walls;
  if (typeof walls?.values === "function") return Array.from(walls.values());
  return [];
}

function normaliseWallSegment(candidate, index) {
  const document = candidate?.document ?? candidate;
  const coordinates =
    document?.c ??
    document?.coords ??
    document?._source?.c ??
    document?._source?.coords;

  if (!Array.isArray(coordinates) || coordinates.length < 4) return null;

  const door = Number(
    document?.door ??
    document?._source?.door ??
    0
  );
  if (door !== 0) return null;

  const [x1, y1, x2, y2] = coordinates.slice(0, 4).map(Number);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;

  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length <= 0) return null;

  const wallId = String(
    document?.id ??
    document?._id ??
    candidate?.id ??
    `wall-${index}`
  );

  return Object.freeze({
    wallId,
    x1,
    y1,
    x2,
    y2,
    a: Object.freeze({ x: x1, y: y1 }),
    b: Object.freeze({ x: x2, y: y2 }),
    length
  });
}

function resolveGridSize(scene) {
  const candidates = [
    globalThis.canvas?.dimensions?.size,
    globalThis.canvas?.grid?.size,
    scene?.grid?.size,
    scene?.grid?.distance
  ];

  for (const candidate of candidates) {
    const numericValue = Number(candidate);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
  }

  return 100;
}

