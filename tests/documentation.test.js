import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("README locks the v0.4.0 Region-aware modular-population contract", async () => {
  const [readme, manifest] = await Promise.all([
    readText("README.md"),
    readJson("module.json")
  ]);

  assert.ok(readme.includes("**Current version:** `" + manifest.version + "`"));
  assert.match(readme, /Blueprint schema version:\*\* `5`/u);
  assert.match(readme, /flags\.dynamic-webs\.webPopulations/u);
  assert.match(readme, /An empty population array means that the Scene generates no webs/u);
  assert.match(readme, /There is no implicit population/u);
  assert.match(readme, /No population card is expanded automatically/u);
  assert.match(readme, /Confine to Region tags/u);
  assert.match(readme, /Exclude Region tags/u);
  assert.match(readme, /every visible strand segment/u);
  assert.match(readme, /unassigned gap/u);
  assert.match(readme, /above tiles and drawings but below tokens/u);
  assert.match(readme, /separate sibling containers/u);
});

test("README documents population-qualified IDs and v4 seeds", async () => {
  const readme = await readText("README.md");
  assert.match(readme, /dynamic-webs:web-generation:v4:<scene-id>:<encoded-population-id>/u);
  assert.match(readme, /<web-kind>:<encoded-scene-id>:<encoded-population-id>:<encoded-level-id>:<encoded-source-key>/u);
  assert.match(readme, /populationId/u);
  assert.match(readme, /hidden opaque ID/u);
  assert.match(readme, /middle `standard` state/u);
  assert.match(readme, /nested \*\*Web options\*\* section/u);
  assert.match(readme, /nested \*\*Appearance\*\* section/u);
  assert.match(readme, /active viewed level plus every detected level below it/u);
  assert.doesNotMatch(readme, /render all stored levels/u);
  assert.doesNotMatch(readme, /- Population name/u);
  assert.match(readme, /thicknessMultiplier/u);
});

test("README documents the modular public API", async () => {
  const readme = await readText("README.md");
  for (const method of [
    "dynamicWebs.api.scene.getPopulations()",
    "dynamicWebs.api.scene.getPopulation",
    "dynamicWebs.api.scene.setPopulations"
  ]) {
    assert.ok(readme.includes(method));
  }
});

test("README preserves the Ambient Critters-compatible provider interface", async () => {
  const readme = await readText("README.md");
  assert.match(readme, /Foundry v14 and later.*hidden/u);
  assert.match(readme, /Base Level only/u);
  assert.match(readme, /theripper93's Levels/u);
  assert.match(readme, /disabled and visually muted/u);
});

test("README lists all authored density states and colour profiles", async () => {
  const [readme, presets, colours] = await Promise.all([
    readText("README.md"),
    readJson("data/webs/presets.json"),
    readJson("data/webs/colours.json")
  ]);

  for (const id of presets.presets.map((entry) => entry.id)) assert.ok(readme.includes(id));
  for (const id of colours.profiles.map((entry) => entry.id)) assert.ok(readme.includes(id));
});

test("roadmap records v0.4.0 Region awareness before spatial indexing and retains later milestones", async () => {
  const roadmap = await readText("roadmap.md");
  assert.match(roadmap, /Current baseline — v0\.4\.0/u);
  assert.match(roadmap, /Milestone 4 — Region-aware webs — complete/u);
  assert.match(roadmap, /\*\*Delivered:\*\* v0\.4\.0/u);
  assert.ok(roadmap.indexOf("Region-aware webs") < roadmap.indexOf("Spatial index and read-only query API"));
  for (const phrase of [
    "Spatial index and read-only query API",
    "Web carpets",
    "Mutable web state",
    "Optional web barriers",
    "Tokens destroying webs",
    "Persistence and network state",
    "Generic trapping and occupancy",
    "Ambient Critters adapter and release hardening"
  ]) assert.ok(roadmap.includes(phrase));
});
