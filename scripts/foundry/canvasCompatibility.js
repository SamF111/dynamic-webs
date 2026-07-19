// D:\FoundryVTT\Data\modules\dynamic-webs\scripts\foundry\canvasCompatibility.js

import {
  firstFiniteNumber,
  firstFinitePositiveNumber
} from "./compatibilityNumbers.js";

/**
 * Return the active Scene rectangle in world-space pixels.
 *
 * @returns {{x:number,y:number,width:number,height:number,right:number,bottom:number}|null}
 *   Active Scene rectangle or null.
 */
export function getSceneRect() {
  const dimensions =
    globalThis.canvas?.dimensions;

  if (!dimensions) {
    return null;
  }

  const sceneRect =
    dimensions.sceneRect;

  const x =
    firstFiniteNumber(
      sceneRect?.x,
      dimensions.sceneX,
      0
    );

  const y =
    firstFiniteNumber(
      sceneRect?.y,
      dimensions.sceneY,
      0
    );

  const width =
    firstFinitePositiveNumber(
      sceneRect?.width,
      dimensions.sceneWidth,
      dimensions.width
    );

  const height =
    firstFinitePositiveNumber(
      sceneRect?.height,
      dimensions.sceneHeight,
      dimensions.height
    );

  if (
    x === null ||
    y === null ||
    width === null ||
    height === null
  ) {
    return null;
  }

  return Object.freeze({
    x,
    y,
    width,
    height,
    right:
      x +
      width,
    bottom:
      y +
      height
  });
}
