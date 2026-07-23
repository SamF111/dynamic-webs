import test from "node:test";
import assert from "node:assert/strict";

import {
  WebMutableStateService
} from "../scripts/interactions/WebMutableStateService.js";

const webs = Object.freeze([
  Object.freeze({ id: "span-a", kind: "wall-span" }),
  Object.freeze({ id: "corner-a", kind: "wall-corner" })
]);

test("mutable state preserves compatible destroyed spans across regeneration", () => {
  const service = new WebMutableStateService();
  service.reconcile({ sceneId: "scene-a", generationId: 1, webs });
  assert.equal(service.destroyWeb("span-a", { cause: "test" }), true);
  assert.equal(service.isWebIntact("span-a"), false);

  const snapshot = service.reconcile({ sceneId: "scene-a", generationId: 2, webs });
  assert.deepEqual(snapshot.destroyedWebIds, ["span-a"]);
  assert.equal(snapshot.generationId, 2);
});

test("mutable state prunes missing spans and resets on Scene replacement", () => {
  const service = new WebMutableStateService();
  service.reconcile({ sceneId: "scene-a", generationId: 1, webs });
  service.destroyWeb("span-a");

  service.reconcile({ sceneId: "scene-a", generationId: 2, webs: [] });
  assert.deepEqual(service.createSnapshot().destroyedWebIds, []);

  service.reconcile({ sceneId: "scene-a", generationId: 3, webs });
  service.destroyWeb("span-a");
  service.reconcile({ sceneId: "scene-b", generationId: 1, webs });
  assert.deepEqual(service.createSnapshot().destroyedWebIds, []);
});
