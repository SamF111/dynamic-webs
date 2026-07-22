import test from "node:test";
import assert from "node:assert/strict";

import {
  WebSpatialIndex
} from "../scripts/spatial/WebSpatialIndex.js";

function createWeb({
  id,
  levelId = "level-0",
  bottom = 0,
  top = 9,
  kind = "ground",
  populationId = "population-a",
  regionIds = [],
  regionTags = [],
  x = 0,
  y = 0,
  strandKind = "structural",
  collisionWidthPx = 4,
  colour = 0xffffff
}) {
  const strandId = `${id}:strand-0`;
  return deepFreeze({
    schemaVersion: 6,
    id,
    sceneId: "scene",
    populationId,
    populationLabel: populationId,
    thicknessMultiplier: 1,
    levelProviderMode: "levels-v13",
    levelId,
    elevationBand: { bottom, top },
    seed: `seed:${id}`,
    sourceKey: id,
    kind,
    colourProfileId: "natural-white",
    hub: { x, y },
    bounds: {
      x,
      y,
      width: 40,
      height: 20,
      right: x + 40,
      bottom: y + 20
    },
    strands: [{
      schemaVersion: 6,
      id: strandId,
      localId: "strand-0",
      kind: strandKind,
      points: [
        { x, y },
        { x: x + 40, y: y + 20 }
      ],
      alpha: 0.7,
      baseAlpha: 0.7,
      colour,
      underColour: 0,
      widthPx: 1,
      collisionWidthPx
    }],
    perches: [{ id: "hub", x, y, rotation: 0 }],
    supportingWallIds: [],
    regionIds,
    regionTags
  });
}

test("spatial index builds immutable web, strand, and perch records", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  const first = createWeb({ id: "web-b", x: 100, y: 100 });
  const second = createWeb({ id: "web-a", x: 0, y: 0 });

  const diagnostics = index.rebuild([first, second], {
    sceneId: "scene",
    generationId: 3
  });

  assert.equal(diagnostics.active, true);
  assert.equal(diagnostics.generationId, 3);
  assert.equal(diagnostics.counts.webs, 2);
  assert.equal(diagnostics.counts.strands, 2);
  assert.equal(diagnostics.counts.perches, 2);
  assert.deepEqual(index.getWebs().map((web) => web.id), ["web-a", "web-b"]);
  assert.equal(index.getWeb("web-a").id, "web-a");
  assert.equal(index.getWeb("missing"), null);
  assert.equal(Object.isFrozen(index.getWebs()), true);
  assert.equal(Object.isFrozen(index.getWeb("web-a")), true);
  assert.notEqual(index.getWeb("web-a"), second);
});

test("nearby strand queries use functional width and explicit level filters", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  index.rebuild([
    createWeb({
      id: "lower",
      levelId: "level-0",
      bottom: 0,
      top: 9,
      x: 0,
      y: 0,
      regionTags: ["crypt"],
      strandKind: "capture",
      collisionWidthPx: 10
    }),
    createWeb({
      id: "upper",
      levelId: "level-10",
      bottom: 10,
      top: 19,
      x: 0,
      y: 0,
      strandKind: "structural"
    })
  ]);

  const results = index.queryNearby({ x: 20, y: 13 }, {
    maximumDistancePx: 0,
    levelId: "level-0",
    regionTag: "crypt",
    strandKind: "capture"
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].webId, "lower");
  assert.equal(results[0].distancePx, 0);
  assert.equal(results[0].interactionWidthPx, 10);
  assert.equal(results[0].intact, true);
  assert.equal(Object.isFrozen(results[0].points), true);

  assert.deepEqual(
    index.queryNearby({ x: 20, y: 13 }, {
      maximumDistancePx: 0,
      levelId: "level-10",
      strandKind: "capture"
    }),
    []
  );
});

test("strand rectangle queries use spatial cells instead of scanning every strand", () => {
  const index = new WebSpatialIndex({ cellSizePx: 40 });
  const webs = [];

  for (let indexValue = 0; indexValue < 400; indexValue += 1) {
    const column = indexValue % 20;
    const row = Math.floor(indexValue / 20);
    webs.push(createWeb({
      id: `web-${String(indexValue).padStart(3, "0")}`,
      x: column * 200,
      y: row * 200
    }));
  }

  index.rebuild(webs, { sceneId: "scene", generationId: 8 });
  const results = index.queryStrands({ x: -5, y: -5, width: 60, height: 40 }, {
    limit: 20
  });
  const diagnostics = index.createDiagnosticSnapshot();

  assert.equal(results.length, 1);
  assert.equal(results[0].webId, "web-000");
  assert.ok(diagnostics.queries.last.candidateCount < diagnostics.counts.strands);
  assert.equal(diagnostics.queries.last.kind, "strands");
});

test("compatible web and perch queries support metadata and elevation filters", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  index.rebuild([
    createWeb({
      id: "corner-lower",
      kind: "wall-corner",
      levelId: "level-0",
      bottom: 0,
      top: 9,
      x: 0,
      y: 0,
      regionIds: ["region-a"],
      regionTags: ["crypt"]
    }),
    createWeb({
      id: "span-upper",
      kind: "wall-span",
      levelId: "level-10",
      bottom: 10,
      top: 19,
      x: 200,
      y: 200,
      regionIds: ["region-b"],
      regionTags: ["tower"]
    })
  ]);

  const webs = index.findCompatibleWebs({
    category: "wall-corner",
    elevation: 5,
    regionId: "region-a"
  });

  assert.deepEqual(webs.map((web) => web.id), ["corner-lower"]);

  const perches = index.findPerches({
    point: { x: 0, y: 0 },
    maximumDistancePx: 5,
    levelId: "level-0",
    regionTag: "crypt"
  });

  assert.equal(perches.length, 1);
  assert.equal(perches[0].webId, "corner-lower");
  assert.equal(perches[0].perchId, "hub");
  assert.equal(perches[0].distancePx, 0);
});

test("presentation snapshot refresh does not rebuild spatial geometry", () => {
  const index = new WebSpatialIndex({ cellSizePx: 50 });
  const web = createWeb({ id: "web", colour: 0xffffff });
  index.rebuild([web], { sceneId: "scene", generationId: 1 });
  const before = index.createDiagnosticSnapshot();

  const recoloured = createWeb({ id: "web", colour: 0xff0000 });
  assert.equal(index.refreshSnapshots([recoloured]), true);
  const after = index.createDiagnosticSnapshot();

  assert.equal(after.revision, before.revision);
  assert.equal(after.snapshotRevision, before.snapshotRevision + 1);
  assert.equal(index.getWeb("web").strands[0].colour, 0xff0000);
});

test("clear removes all indexed geometry", () => {
  const index = new WebSpatialIndex();
  index.rebuild([createWeb({ id: "web" })], { sceneId: "scene" });

  assert.equal(index.clear(), true);
  assert.deepEqual(index.getWebs(), []);
  assert.equal(index.createDiagnosticSnapshot().active, false);
  assert.equal(index.clear(), false);
});

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
