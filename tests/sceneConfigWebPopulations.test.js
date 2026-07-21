import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createSceneConfigTemplateContext
} from "../scripts/ui/sceneConfigTemplateContext.js";

function installBaseEnvironment() {
  const previousGame = globalThis.game;
  const previousCanvas = globalThis.canvas;
  globalThis.game = {
    release: { generation: 13 },
    version: "13",
    modules: { get: () => ({ active: false }) },
    settings: { get: () => "base" },
    user: { isGM: true }
  };
  globalThis.canvas = { scene: null };
  return () => {
    globalThis.game = previousGame;
    globalThis.canvas = previousCanvas;
  };
}

test("Scene Configuration context exposes collapsed modular population cards", async () => {
  const restore = installBaseEnvironment();
  try {
    const scene = {
      id: "scene",
      getFlag(_namespace, key) {
        if (key === "webPopulations") return [{
          id: "red-webs",
          enabled: true,
          levelId: "base",
          confineRegionTags: ["crypt"],
          excludeRegionTags: ["altar"],
          categoryDensities: {
            "wall-corner": "dense",
            "wall-span": "sparse",
            ground: "disabled",
            "web-carpet": "disabled"
          },
          colourProfileId: "blood-red",
          thicknessMultiplier: 1.5
        }];
        return undefined;
      }
    };
    const context = await createSceneConfigTemplateContext({ application: { isEditable: true }, scene });
    assert.equal(context.populationCards.length, 1);
    assert.equal(context.populationCards[0].summaryTitle, "Web Population 1");
    assert.match(context.populationCards[0].summaryDetail, /Base level/u);
    assert.equal(context.populationCards[0].densityControls.length, 4);
    assert.equal(context.populationCards[0].confineRegionTagsInput, "crypt");
    assert.equal(context.populationCards[0].excludeRegionTagsInput, "altar");
    assert.match(context.populationCards[0].regionSummary, /Confine: 1/u);
    assert.equal(context.fieldNames.webPopulations, "flags.dynamic-webs.webPopulations");
  } finally { restore(); }
});

test("Scene Configuration templates contain population operations and no auto-open cards", async () => {
  const [template, card] = await Promise.all([
    readFile(new URL("../templates/ui/scene-config.hbs", import.meta.url), "utf8"),
    readFile(new URL("../templates/ui/web-population-card.hbs", import.meta.url), "utf8")
  ]);
  assert.match(template, /data-dynamic-webs-populations-value/u);
  assert.match(template, /data-dynamic-webs-add-population/u);
  assert.match(card, /data-dynamic-webs-duplicate-population/u);
  assert.match(card, /data-dynamic-webs-remove-population/u);
  assert.match(card, /data-dynamic-webs-population-field="levelId"/u);
  assert.match(card, /data-dynamic-webs-population-field="colourProfileId"/u);
  assert.match(card, /data-dynamic-webs-population-field="thicknessMultiplier"/u);
  assert.match(card, /data-dynamic-webs-regions-section/u);
  assert.match(card, /data-dynamic-webs-population-field="confineRegionTags"/u);
  assert.match(card, /data-dynamic-webs-population-field="excludeRegionTags"/u);
  assert.match(card, /data-dynamic-webs-web-options-section/u);
  assert.match(card, /<strong>Web options<\/strong>/u);
  assert.match(card, /data-dynamic-webs-appearance-section/u);
  assert.match(card, /<strong>Appearance<\/strong>/u);
  assert.match(card, /Colour and thickness/u);
  assert.doesNotMatch(card, /Population name/u);
  assert.doesNotMatch(card, /data-dynamic-webs-population-field="label"/u);
  assert.doesNotMatch(card, /<details[^>]+\sopen(?:\s|>)/u);
  assert.doesNotMatch(template, /name="flags\.dynamic-webs\.(?:webDensity|webColour|webThickness|cornerWebDensity|spanWebDensity|groundWebDensity)"/u);
});
