// D:/FoundryVTT/Data/modules/dynamic-webs/tests/webSpatialQueryNormalization.test.js
// Purpose: preserve public spatial filter coercion and independent query state
// while reducing temporary allocations; these tests run without other modules.
import test from "node:test";
import assert from "node:assert/strict";
import {normaliseWebSpatialQueryOptions} from "../scripts/spatial/webSpatialQueries.js";

const fields = ["levelIds", "populationIds", "webKinds", "regionIds", "regionTags", "strandKinds"];

test("spatial identifier normalization preserves scalar, array and sparse-array semantics", () => {
  const values = [undefined, null, "", " ", " wall-span ", 0, false, 7n, Symbol("tag"),
    [], ["a", " ", "a", null, undefined, 0, false], [, "a", , " b "],
    Object.freeze(["ground", "wall-span"]), {toString: () => " custom "}, new Set(["a"])];
  for (const field of fields) for (const value of values) {
    // Prior public behavior: trim/coerce array entries, drop blanks, deduplicate.
    const entries = Array.isArray(value) ? value
      : value === null || value === undefined || value === "" ? [] : [value];
    const expected = new Set(entries.map(entry => String(entry).trim()).filter(Boolean));
    assert.deepEqual(normaliseWebSpatialQueryOptions({[field]: value})[field], expected);
  }
});

test("normalized filters remain independent and observe input changes on the next query", () => {
  const categories = ["wall-span"];
  const first = normaliseWebSpatialQueryOptions({categories});
  categories.push("ground");
  const second = normaliseWebSpatialQueryOptions({categories});
  assert.deepEqual([...first.webKinds], ["wall-span"]);
  assert.deepEqual([...second.webKinds], ["wall-span", "ground"]);
  first.webKinds.add("custom");
  assert.deepEqual([...second.webKinds], ["wall-span", "ground"]);
  const blank = normaliseWebSpatialQueryOptions();
  blank.levelIds.add("private");
  assert.deepEqual([...normaliseWebSpatialQueryOptions().levelIds], []);
  assert.equal(Object.isFrozen(second), true);
});

test("spatial aliases retain their precedence and numeric validation still rejects invalid queries", () => {
  const normalized = normaliseWebSpatialQueryOptions({levelIds: [], levelId: "ignored",
    categories: ["ground"], category: "ignored", strandRoles: ["capture"],
    minimumCollisionWidthPx: "3", limit: 2000});
  assert.deepEqual([...normalized.levelIds], []);
  assert.deepEqual([...normalized.webKinds], ["ground"]);
  assert.deepEqual([...normalized.strandKinds], ["capture"]);
  assert.equal(normalized.minimumInteractionWidthPx, 3);
  assert.equal(normalized.limit, 1000);
  for (const options of [{limit: 0}, {limit: 1.5}, {maximumDistancePx: -1},
    {elevation: Infinity}, {elevationBand: {bottom: 10, top: 0}}]) {
    assert.throws(() => normaliseWebSpatialQueryOptions(options), TypeError);
  }
  const failure = new Error("caller coercion failure");
  assert.throws(() => normaliseWebSpatialQueryOptions({categories: [{toString() {throw failure;}}]}),
    error => error === failure);
});
