import test from "node:test";
import assert from "node:assert/strict";

import {
  createRegionTagsFormValue,
  doesRegionTagMatchConfiguredTag,
  doesRegionUpdateAffectWebs,
  getRegionTags,
  normaliseRegionRoleTags,
  normaliseRegionTags,
  validateRegionTagListsAreUnique
} from "../scripts/config/regionTagConfiguration.js";

test("Region tags match Ambient Critters syntax and wildcard role behaviour", () => {
  assert.deepEqual(normaliseRegionTags("Area 1, area_1\nSafe Zone"), ["area-1", "safe-zone"]);
  assert.deepEqual(normaliseRegionRoleTags("crypt-*, Altar"), ["crypt-*", "altar"]);
  assert.equal(doesRegionTagMatchConfiguredTag("crypt-room", "crypt-*"), true);
  assert.equal(doesRegionTagMatchConfiguredTag("cave-room", "crypt-*"), false);
  assert.equal(createRegionTagsFormValue("Area 1, Area 1"), '["area-1"]');
});

test("Dynamic Webs recognises its own and Ambient Critters Region tags", () => {
  const region = {
    getFlag(namespace, key) {
      assert.equal(key, "regionTags");
      if (namespace === "dynamic-webs") return ["Crypt", "shared"];
      if (namespace === "ambient-critters") return ["Water Dock", "shared"];
      return undefined;
    }
  };

  assert.deepEqual(getRegionTags(region), ["crypt", "shared", "water-dock"]);
});

test("Region tags survive Foundry rejecting an inactive Ambient Critters flag scope", () => {
  const region = {
    flags: { "ambient-critters": { regionTags: ["Area 2"] } },
    getFlag(namespace) {
      if (namespace === "dynamic-webs") return ["Crypt"];
      throw new Error(`Flag scope "${namespace}" is not valid or not currently active`);
    }
  };

  assert.deepEqual(getRegionTags(region), ["crypt", "area-2"]);
});

test("Confine and Exclude reject exact role reuse", () => {
  assert.throws(() => validateRegionTagListsAreUnique({
    confine: ["Crypt"],
    exclude: ["crypt"]
  }), /cannot be reused/u);

  assert.equal(validateRegionTagListsAreUnique({
    confine: ["crypt-*"],
    exclude: ["altar"]
  }), true);
});

test("Region geometry, elevation, and either module's tags trigger rebuild detection", () => {
  assert.equal(doesRegionUpdateAffectWebs({ shapes: [] }), true);
  assert.equal(doesRegionUpdateAffectWebs({ elevation: { bottom: 10 } }), true);
  assert.equal(doesRegionUpdateAffectWebs({ flags: { "dynamic-webs": { regionTags: [] } } }), true);
  assert.equal(doesRegionUpdateAffectWebs({ flags: { "ambient-critters": { regionTags: [] } } }), true);
  assert.equal(doesRegionUpdateAffectWebs({ name: "Renamed" }), false);
});
