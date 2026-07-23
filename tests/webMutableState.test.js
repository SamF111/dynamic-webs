import test from "node:test";
import assert from "node:assert/strict";

import {
  WebMutableStateService
} from "../scripts/interactions/WebMutableStateService.js";

const webs = Object.freeze([
  Object.freeze({ id: "span-a", kind: "wall-span" }),
  Object.freeze({ id: "span-b", kind: "wall-span" }),
  Object.freeze({ id: "corner-a", kind: "wall-corner" }),
  Object.freeze({ id: "ground-a", kind: "ground" }),
  Object.freeze({ id: "carpet-a", kind: "web-carpet" })
]);

test("mutable state hydrates persisted destroyed spans and preserves them across regeneration", () => {
  const service = new WebMutableStateService();

  const initial = service.reconcile({
    sceneId: "scene-a",
    generationId: 1,
    webs,
    persistedState: {
      schemaVersion: 1,
      revision: 4,
      destroyedWebIds: ["span-a"]
    }
  });

  assert.equal(initial.schemaVersion, 1);
  assert.equal(initial.revision, 4);
  assert.deepEqual(initial.destroyedWebIds, ["span-a"]);
  assert.equal(initial.eligibleWebCount, 2);
  assert.equal(service.isWebIntact("span-a"), false);

  assert.equal(service.destroyWeb("span-b", { cause: "test" }), true);
  assert.equal(service.destroyWeb("corner-a", { cause: "test" }), false);
  assert.equal(service.destroyWeb("ground-a", { cause: "test" }), false);
  assert.equal(service.destroyWeb("carpet-a", { cause: "test" }), false);

  const snapshot = service.reconcile({
    sceneId: "scene-a",
    generationId: 2,
    webs,
    persistedState: {
      revision: 1,
      destroyedWebIds: []
    }
  });

  assert.deepEqual(snapshot.destroyedWebIds, ["span-a", "span-b"]);
  assert.equal(snapshot.generationId, 2);
  assert.equal(snapshot.revision, 5);
});

test("mutable state prunes missing spans and loads the next Scene flag on Scene replacement", () => {
  const service = new WebMutableStateService();

  service.reconcile({
    sceneId: "scene-a",
    generationId: 1,
    webs,
    persistedState: {
      revision: 7,
      destroyedWebIds: ["span-a", "missing-span"]
    }
  });

  const pruned = service.createSnapshot();
  assert.deepEqual(pruned.destroyedWebIds, ["span-a"]);
  assert.equal(pruned.revision, 8);
  assert.deepEqual(pruned.lastReconciliation.prunedWebIds, ["missing-span"]);

  const replacement = service.reconcile({
    sceneId: "scene-b",
    generationId: 1,
    webs,
    persistedState: {
      revision: 3,
      destroyedWebIds: ["span-b"]
    }
  });

  assert.equal(replacement.sceneId, "scene-b");
  assert.equal(replacement.revision, 3);
  assert.deepEqual(replacement.destroyedWebIds, ["span-b"]);
  assert.equal(replacement.lastReconciliation.hydratedFromPersistence, true);
});

test("remote snapshots are revision-ordered and filtered to eligible spans", () => {
  const service = new WebMutableStateService();
  service.reconcile({ sceneId: "scene-a", generationId: 1, webs });

  assert.equal(service.applySnapshot({
    schemaVersion: 1,
    sceneId: "scene-a",
    generationId: 1,
    revision: 2,
    destroyedWebIds: ["span-a", "corner-a"]
  }), true);

  assert.deepEqual(service.createSnapshot().destroyedWebIds, ["span-a"]);

  assert.equal(service.applySnapshot({
    schemaVersion: 1,
    sceneId: "scene-a",
    generationId: 1,
    revision: 1,
    destroyedWebIds: []
  }), false);

  assert.deepEqual(service.createSnapshot().destroyedWebIds, ["span-a"]);
});

test("internal rollback restores the earlier eligibility set after a failed regeneration", () => {
  const service = new WebMutableStateService();
  service.reconcile({
    sceneId: "scene-a",
    generationId: 1,
    webs
  });
  service.destroyWeb("span-a");

  const stable = service.createSnapshot();

  service.reconcile({
    sceneId: "scene-a",
    generationId: 2,
    webs: [
      Object.freeze({ id: "span-b", kind: "wall-span" })
    ]
  });

  assert.equal(service.createSnapshot().revision, 2);
  assert.deepEqual(service.createSnapshot().destroyedWebIds, []);
  assert.deepEqual(service.createSnapshot().eligibleWebIds, ["span-b"]);

  assert.equal(service.applySnapshot(stable, {
    allowRevisionRollback: true
  }), true);

  assert.equal(service.createSnapshot().revision, 1);
  assert.deepEqual(service.createSnapshot().destroyedWebIds, ["span-a"]);
  assert.deepEqual(service.createSnapshot().eligibleWebIds, ["span-a", "span-b"]);
});


test("indestructible Scene policy restores persisted spans and disables all destruction", () => {
  const service = new WebMutableStateService();

  const snapshot = service.reconcile({
    sceneId: "scene-a",
    generationId: 1,
    webs,
    destroyable: false,
    persistedState: {
      revision: 6,
      destroyedWebIds: ["span-a", "span-b"]
    }
  });

  assert.equal(snapshot.destroyable, false);
  assert.equal(snapshot.eligibleWebCount, 0);
  assert.deepEqual(snapshot.eligibleWebIds, []);
  assert.deepEqual(snapshot.destroyedWebIds, []);
  assert.equal(snapshot.revision, 7);
  assert.deepEqual(snapshot.lastReconciliation.prunedWebIds, ["span-a", "span-b"]);
  assert.equal(service.destroyWeb("span-a", { cause: "test" }), false);
  assert.deepEqual(service.destroyWebs(["span-a", "span-b"], { cause: "test" }), []);
});
