/** PIXI-version-tolerant web drawing helpers. */

export function drawWebPolyline(
  graphics,
  points,
  style
) {
  if (
    !graphics ||
    !Array.isArray(points) ||
    points.length < 2
  ) {
    return false;
  }

  if (typeof graphics.stroke === "function") {
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.stroke({
      width: style.width,
      color: style.colour,
      alpha: style.alpha,
      pixelLine: false
    });
    return true;
  }

  if (typeof graphics.lineStyle === "function") {
    graphics.lineStyle(
      style.width,
      style.colour,
      style.alpha
    );
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    return true;
  }

  throw new Error(
    "Dynamic Webs | The active PIXI.Graphics API cannot draw web strands."
  );
}

export function configureWebDisplayObject(displayObject) {
  if (!displayObject || typeof displayObject !== "object") return;
  if ("eventMode" in displayObject) displayObject.eventMode = "none";
  if ("interactive" in displayObject) displayObject.interactive = false;
  if ("interactiveChildren" in displayObject) displayObject.interactiveChildren = false;
  if ("cursor" in displayObject) displayObject.cursor = null;
}

