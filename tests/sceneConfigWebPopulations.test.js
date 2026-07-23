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
    assert.equal(context.fieldNames.spanWebBehaviour, "flags.dynamic-webs.spanWebBehaviour");
    assert.equal(context.spanWebBehaviour.useWorldMaximumSpanWidth, true);
    assert.equal(context.spanWebBehaviour.visionOptions.find((option) => option.selected)?.value, "limited");
    assert.equal(context.spanWebBehaviour.secretDoor, false);
    assert.equal(context.spanWebBehaviour.destructible, true);
  } finally { restore(); }
});


test("an unconfigured Scene previews one world-default population without treating an empty array as missing", async () => {
  const restore = installBaseEnvironment();
  try {
    const unconfigured = await createSceneConfigTemplateContext({
      application: { isEditable: true },
      scene: {
        id: "unconfigured-scene",
        getFlag: () => undefined
      }
    });

    assert.equal(unconfigured.populationCards.length, 1);
    assert.equal(unconfigured.usesWorldPopulationDefaults, true);
    assert.match(unconfigured.populationDefaultsHint, /world defaults/u);
    assert.match(unconfigured.populationCards[0].id, /^web-default-[0-9a-f]{8}$/u);

    const explicitEmpty = await createSceneConfigTemplateContext({
      application: { isEditable: true },
      scene: {
        id: "empty-scene",
        getFlag(_namespace, key) {
          return key === "webPopulations" ? [] : undefined;
        }
      }
    });

    assert.equal(explicitEmpty.populationCards.length, 0);
    assert.equal(explicitEmpty.usesWorldPopulationDefaults, false);
    assert.equal(explicitEmpty.populationDefaultsHint, null);
  } finally { restore(); }
});

test("Scene Configuration templates contain population operations and no auto-open cards", async () => {
  const [template, card] = await Promise.all([
    readFile(new URL("../templates/ui/scene-config.hbs", import.meta.url), "utf8"),
    readFile(new URL("../templates/ui/web-population-card.hbs", import.meta.url), "utf8")
  ]);
  assert.match(template, /data-dynamic-webs-populations-value/u);
  assert.match(template, /data-dynamic-webs-add-population/u);
  assert.match(template, /data-dynamic-webs-span-behaviour-value/u);
  assert.match(template, /data-dynamic-webs-span-behaviour-section/u);
  assert.match(template, /<strong>Span behaviour<\/strong>/u);
  assert.match(template, /data-dynamic-webs-use-world-span-width/u);
  assert.match(template, /data-dynamic-webs-span-vision-mode/u);
  assert.match(template, /data-dynamic-webs-span-secret-door/u);
  assert.match(template, /closed secret doors/u);
  assert.match(template, /data-dynamic-webs-span-destructible/u);
  assert.match(template, /data-dynamic-webs-restore-destroyed-spans/u);
  assert.match(template, /Restore Destroyed Span Webs/u);
  assert.match(template, /data-dynamic-webs-update-span-walls/u);
  assert.match(template, /data-dynamic-webs-delete-span-walls/u);
  assert.match(template, /Update Web Walls/u);
  assert.match(template, /Delete Web Walls/u);
  assert.match(card, /data-dynamic-webs-duplicate-population/u);
  assert.match(card, /data-dynamic-webs-remove-population/u);
  assert.match(card, /data-dynamic-webs-population-field="levelId"/u);
  assert.match(card, /data-dynamic-webs-population-field="colourProfileId"/u);
  assert.match(card, /data-dynamic-webs-population-field="thicknessMultiplier"/u);
  assert.match(card, /<select[^>]*data-dynamic-webs-population-field="thicknessMultiplier"/su);
  assert.match(card, /\{\{#each thicknessOptions\}\}/u);
  assert.doesNotMatch(card, /<input[^>]*type="number"[^>]*data-dynamic-webs-population-field="thicknessMultiplier"/su);
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



