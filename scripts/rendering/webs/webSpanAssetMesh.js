import {
  configureWebDisplayObject
} from "./webDrawingCompatibility.js";

import {
  createWebSpanAssetQuadMapping
} from "./webSpanAssetTransform.js";

/** Create one four-anchor, two-triangle textured span mesh. */
export function createWebSpanAssetMesh({
  pixi,
  texture,
  presentation,
  name,
  zIndex = 0,
  filter = null
}) {
  const mapping =
    createWebSpanAssetQuadMapping(
      presentation
    );

  const vertices =
    new Float32Array(
      mapping.vertices.flatMap(
        (
          point
        ) => [
          point.x,
          point.y
        ]
      )
    );

  const uvs =
    new Float32Array(
      mapping.uvs.flatMap(
        (
          point
        ) => [
          point.x,
          point.y
        ]
      )
    );

  const indices =
    new Uint32Array(
      mapping.indices
    );

  let mesh =
    null;

  let implementation =
    null;

  if (
    typeof pixi?.MeshSimple ===
      "function"
  ) {
    mesh =
      new pixi.MeshSimple({
        texture,
        vertices,
        uvs,
        indices
      });

    implementation =
      "pixi-v8-mesh-simple";
  } else if (
    typeof pixi?.SimpleMesh ===
      "function"
  ) {
    mesh =
      new pixi.SimpleMesh(
        texture,
        vertices,
        uvs,
        indices,
        pixi.DRAW_MODES?.TRIANGLES
      );

    implementation =
      "pixi-v7-simple-mesh";
  }

  if (!mesh) {
    return null;
  }

  configureWebDisplayObject(
    mesh
  );

  mesh.name =
    name;

  mesh.zIndex =
    zIndex;

  mesh.alpha =
    1;

  if (
    filter
  ) {
    mesh.filters =
      [
        filter
      ];
  }

  mesh.dynamicWebsSpanAssetWarp =
    Object.freeze({
      mode:
        "piecewise-affine-quad",
      implementation,
      vertices:
        Object.freeze(
          Array.from(
            vertices
          )
        ),
      uvs:
        Object.freeze(
          Array.from(
            uvs
          )
        ),
      indices:
        Object.freeze(
          Array.from(
            indices
          )
        )
    });

  return mesh;
}

/** Replace the texture on either supported mesh implementation. */
export function setWebSpanAssetMeshTexture(
  mesh,
  texture
) {
  if (
    !mesh ||
    !texture ||
    mesh.destroyed ===
      true
  ) {
    return false;
  }

  try {
    mesh.texture =
      texture;

    return true;
  } catch (_error) {
    return false;
  }
}
