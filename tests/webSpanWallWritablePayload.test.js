import test from "node:test";
import assert from "node:assert/strict";
import { WebSpanWallService } from "../scripts/runtime/webs/WebSpanWallService.js";
import { createGeneratedSpanWallData, generatedSpanWallMatches } from "../scripts/foundry/webSpanWallCompatibility.js";
import { FoundryV14NativeWebLevelProvider } from "../scripts/foundry/webLevelProviderV14Native.js";
import { collectStructuralWallSegments } from "../scripts/foundry/webSceneCompatibility.js";

test("Foundry can clean span wall creation, updates and restoration in place", async () => {
  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const web = {
      id: "cleaner-span", kind: "wall-span", levelProviderMode: "levels-v13",
      levelId: "lower", elevationBand: { bottom: 0, top: 10 },
      spanAsset: { target: {
        firstWallStart: { x: 0, y: 0 }, firstWallEnd: { x: 0, y: 100 },
        secondWallStart: { x: 100, y: 0 }, secondWallEnd: { x: 100, y: 100 }
      } }
    };
    const behaviour = { visionMode: "blocked", secretDoor: true, crossingAction: "open-secret-door" };
    const blueprint = createGeneratedSpanWallData({ web, behaviour });
    assert.ok(Object.isFrozen(blueprint));
    assert.ok(Object.isFrozen(blueprint.c));
    const writes = [];
    const clean = entry => {
      // ArrayField._cleanType assigns each coordinate, even when already numeric.
      entry.c.forEach((value, i) => { entry.c[i] = Number(value); });
      entry.flags["cleaner-test"] = { cleaned: true };
      writes.push(structuredClone(entry));
    };
    const scene = {
      id: "cleaner-scene", walls: { contents: [] },
      async createEmbeddedDocuments(type, entries) {
        assert.equal(type, "Wall");
        for (const entry of entries) {
          clean(entry);
          this.walls.contents.push({ id: "generated-wall", ...entry, _source: structuredClone(entry) });
        }
        return this.walls.contents;
      },
      async updateEmbeddedDocuments(type, entries) {
        assert.equal(type, "Wall");
        for (const entry of entries) {
          clean(entry);
          Object.assign(this.walls.contents[0], entry, { _source: structuredClone(entry) });
        }
        return this.walls.contents;
      },
      async deleteEmbeddedDocuments() { this.walls.contents = []; }
    };
    const service = new WebSpanWallService();
    service.requestReconciliation({ scene, webs: [web], behaviour });
    assert.equal((await service.flush()).createdCount, 1);
    service.requestReconciliation({ scene, webs: [web], behaviour: { ...behaviour, visionMode: "limited" } });
    assert.equal((await service.flush()).updatedCount, 1);
    scene.walls.contents[0].ds = 1;
    scene.walls.contents[0]._source.ds = 1;
    service.requestWebRestoration({ scene, webs: [web], behaviour });
    assert.equal((await service.flush()).updatedCount, 1);
    assert.equal(scene.walls.contents[0].ds, 0);
    service.requestWebRemoval({ scene, webIds: [web.id] });
    await service.flush();
    service.requestWebRestoration({ scene, webs: [web], behaviour });
    assert.equal((await service.flush()).createdCount, 1);
    assert.equal(writes.length, 4);
    assert.deepEqual(blueprint.c, [0, 50, 100, 50]);
    assert.equal(blueprint.flags["cleaner-test"], undefined);
    assert.equal(blueprint.flags["wall-height"].top, 10);
  } finally { globalThis.game = previousGame; }
});

test("modern edge constants avoid deprecated aliases and v13 remains supported", () => {
  const previous = globalThis.CONST;
  const web = {
    id: "constants-span", kind: "wall-span", levelProviderMode: "base", levelId: "base",
    spanAsset: { target: {
      firstWallStart: { x: 0, y: 0 }, firstWallEnd: { x: 0, y: 100 },
      secondWallStart: { x: 100, y: 0 }, secondWallEnd: { x: 100, y: 100 }
    } }
  };
  try {
    globalThis.CONST = {
      EDGE_SENSE_TYPES: { NONE: 0, LIMITED: 11, NORMAL: 21 }, EDGE_DIRECTIONS: { BOTH: 3 },
      get WALL_SENSE_TYPES() { throw new Error("deprecated sense getter"); },
      get WALL_DIRECTIONS() { throw new Error("deprecated direction getter"); }
    };
    let data = createGeneratedSpanWallData({ web, behaviour: { visionMode: "limited" } });
    assert.equal(data.sight, 11);
    assert.equal(data.dir, 3);
    globalThis.CONST = { WALL_SENSE_TYPES: { NONE: 0, LIMITED: 12, NORMAL: 22 }, WALL_DIRECTIONS: { BOTH: 4 } };
    data = createGeneratedSpanWallData({ web, behaviour: { visionMode: "blocked" } });
    assert.equal(data.sight, 22);
    assert.equal(data.dir, 4);
  } finally { globalThis.CONST = previous; }
});

test("native span walls use the v14 levels field and reconcile floor changes", () => {
  const web = {
    id: "native-span", kind: "wall-span", levelProviderMode: "native-v14", levelId: "upper",
    spanAsset: { target: {
      firstWallStart: { x: 0, y: 0 }, firstWallEnd: { x: 0, y: 100 },
      secondWallStart: { x: 100, y: 0 }, secondWallEnd: { x: 100, y: 100 }
    } }
  };
  const desired = createGeneratedSpanWallData({ web, behaviour: { visionMode: "limited" } });
  assert.deepEqual(desired.levels, ["upper"]);
  assert.ok(Object.isFrozen(desired.levels));
  assert.equal(generatedSpanWallMatches({ ...desired, levels: new Set(["upper"]) }, desired), true);
  assert.equal(generatedSpanWallMatches({ ...desired, levels: ["lower"] }, desired), false);
  assert.equal(generatedSpanWallMatches({ ...desired, levels: ["upper", "lower"] }, desired), false);
  assert.equal(generatedSpanWallMatches({ ...desired, levels: undefined, _source: { levels: ["upper"] } }, desired), true);
});

test("native wall geometry belongs to each assigned level, with empty assignments applying everywhere", () => {
  const scene = { levels: [
    { id: "lower", elevation: { bottom: 0, top: 10 } },
    { id: "upper", elevation: { bottom: 10, top: 20 } }
  ], walls: [
    { id: "upper-only", c: [0, 0, 0, 100], levels: new Set(["upper"]) },
    { id: "both", c: [100, 0, 100, 100], _source: { levels: ["lower", "upper"] } },
    { id: "unrestricted", c: [200, 0, 200, 100], levels: new Set() }
  ] };
  const provider = new FoundryV14NativeWebLevelProvider({ game: { version: "14.361" }, canvas: { scene } });
  const levels = provider.resolveLevels(scene);
  const segments = collectStructuralWallSegments(scene, { providerResolution: {
    levels, resolveWallLevelMetadata: wall => provider.resolveWallLevelMetadata(wall, levels)
  } });
  assert.deepEqual(segments.filter(w => w.wallId === "upper-only").map(w => w.levelId), ["upper"]);
  for (const id of ["both", "unrestricted"]) {
    assert.deepEqual(segments.filter(w => w.wallId === id).map(w => w.levelId), ["lower", "upper"]);
  }
  assert.equal(segments.find(w => w.wallId === "upper-only").elevationBand.bottom, 10);
});

test("fractional spans use Foundry integer coordinates and unchanged reconciliation performs no write", async () => {
  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const web = { id: "fractional-span", kind: "wall-span", levelProviderMode: "native-v14", levelId: "upper",
      spanAsset: { target: {
        firstWallStart: { x: 1.2, y: 1.8 }, firstWallEnd: { x: 1.2, y: 1.8 },
        secondWallStart: { x: 2.5, y: -2.5 }, secondWallEnd: { x: 2.5, y: -2.5 }
      } }
    };
    const behaviour = { visionMode: "limited", secretDoor: false };
    const desired = createGeneratedSpanWallData({ web, behaviour });
    assert.deepEqual(desired.c, [1, 2, 3, -2]);
    const existing = { id: "existing", ...desired, c: [1, 2, 3, -2], levels: new Set(["upper"]) };
    const scene = { id: "fractional-scene", walls: { contents: [existing] },
      async createEmbeddedDocuments() { assert.fail("Unchanged wall must not be created"); },
      async updateEmbeddedDocuments() { assert.fail("Unchanged wall must not be updated"); },
      async deleteEmbeddedDocuments() { assert.fail("Unchanged wall must not be deleted"); }
    };
    const service = new WebSpanWallService();
    for (let i = 0; i < 2; i++) {
      service.requestReconciliation({ scene, webs: [web], behaviour });
      const diagnostics = await service.flush();
      assert.equal(diagnostics.updatedCount, 0);
      assert.equal(diagnostics.lastError, null);
    }
  } finally { globalThis.game = previousGame; }
});
