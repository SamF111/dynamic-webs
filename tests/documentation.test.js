import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("README is a public landing page with the author's motivation", async () => {
  const readme = await readText("README.md");

  for (const phrase of [
    "fills Foundry Virtual Tabletop scenes with procedurally generated spider webs",
    "I built Dynamic Webs for my own game",
    "scenes to feel more lived-in",
    "large spider battle",
    "originally lived inside another module",
    "decided to share it"
  ]) {
    assert.ok(readme.includes(phrase));
  }

  assert.match(readme, /## What it adds/u);
  assert.match(readme, /## Getting started/u);
  assert.match(readme, /## Compatibility/u);
  assert.match(readme, /## Documentation/u);
});

test("README presents the four web types and principal GM-facing features", async () => {
  const readme = await readText("README.md");

  for (const phrase of [
    "### Corner webs",
    "### Passage webs",
    "### Ground webs",
    "### Web carpets",
    "disabled, sparse, standard, dense or infested",
    "Confine",
    "Exclude",
    "closed Foundry secret door",
    "destructible or indestructible",
    "Foundry v14",
    "theripper93's Levels"
  ]) {
    assert.ok(readme.includes(phrase));
  }
});

test("README links specialist documentation instead of carrying internal contracts", async () => {
  const readme = await readText("README.md");

  for (const link of [
    "docs/CONFIGURATION.md",
    "docs/PUBLIC-API.md",
    "docs/TECHNICAL-DESIGN.md",
    "docs/DEVELOPMENT.md",
    "roadmap.md"
  ]) {
    assert.ok(readme.includes(link));
  }

  for (const technicalDetail of [
    "flags.dynamic-webs.webPopulations",
    "dynamic-webs:web-generation:v4",
    "two-triangle textured mesh",
    'flags["dynamic-webs"].mutableState',
    "PrimaryCanvasGroup",
    "Blueprint schema version"
  ]) {
    assert.equal(readme.includes(technicalDetail), false);
  }
});

test("configuration guide owns populations, defaults, Regions, levels and span behaviour", async () => {
  const configuration = await readText("docs/CONFIGURATION.md");

  for (const phrase of [
    "flags.dynamic-webs.webPopulations",
    "An explicitly saved empty array means that the Scene intentionally generates no webs",
    "missing population flag",
    "disabled → sparse → standard → dense → infested",
    "Confine to Region tags",
    "Exclude Region tags",
    "flags.dynamic-webs.regionTags",
    "theripper93's Levels",
    "natural-white",
    "toxic-green",
    "1×, 2×, 3×, 4×",
    "0.35–10",
    "None** — no vision restriction",
    "closed secret-door",
    "indestructible",
    "Clear All Webs and Prepare for Uninstall"
  ]) {
    assert.ok(configuration.includes(phrase));
  }
});

test("technical design preserves deterministic geometry, rendering and destruction contracts", async () => {
  const design = await readText("docs/TECHNICAL-DESIGN.md");

  for (const phrase of [
    "Blueprint schema version:** `8`",
    "dynamic-webs:web-generation:v4:<scene-id>:<encoded-population-id>",
    "<web-kind>:<encoded-scene-id>:<encoded-population-id>:<encoded-level-id>:<encoded-source-key>",
    "complete generated strand polylines",
    "destination-out",
    "separate sibling containers",
    "above tiles and drawings but below tokens",
    "active viewed level plus every detected level below it",
    "two-triangle textured mesh",
    "all stored levels",
    "uniform-grid spatial index",
    "swept centre path",
    "whole span",
    "Scene-owned destroyed-span state",
    "client-local transient presentation"
  ]) {
    assert.ok(design.includes(phrase));
  }
});

test("public API guide locks the version-1 integration and capture ownership boundary", async () => {
  const api = await readText("docs/PUBLIC-API.md");

  for (const method of [
    "api.getWebs()",
    "api.getWeb(webId)",
    "api.queryNearby(point, options = {})",
    "api.queryStrands(bounds, options = {})",
    "api.findCompatibleWebs(options = {})",
    "api.findPerches(options = {})",
    "api.interactions.queryMovement(request)",
    "api.interactions.queryEntityPosition(request)",
    "api.interactions.evaluateEntityMovement(request)",
    "api.interactions.destroyWebs(webIds, options = {})",
    "api.captures.show(request)",
    "api.captures.clearByEntity(entityId, options = {})"
  ]) {
    assert.ok(api.includes(method));
  }

  for (const phrase of [
    "Public API version:** `1`",
    "aboveTokens",
    "defaults to `false` and renders below tokens",
    "preserves its previous placement",
    "moves the same capture between layers without creating a duplicate",
    "Moving or deleting the external entity does not automatically move or remove the overlay",
    "The consumer decides"
  ]) {
    assert.ok(api.includes(phrase));
  }
});

test("development guide owns validation, asset tooling and architecture rules", async () => {
  const development = await readText("docs/DEVELOPMENT.md");

  for (const phrase of [
    "npm run validate",
    "node --test tests/documentation.test.js",
    "Foundry v13 and v14",
    "generate_span_web_assets.py",
    "validate_span_web_assets.py",
    "generate_captured_web_assets.py",
    "validate_captured_web_assets.py",
    "Do not add AI-generated image files",
    "Atomic spatial replacement",
    "Visibility is presentation-only",
    "Capture lifecycle belongs to the consumer",
    "Do not move low-level implementation detail back into the landing-page README"
  ]) {
    assert.ok(development.includes(phrase));
  }
});

test("configuration documentation lists every authored density and colour profile", async () => {
  const [configuration, presets, colours] = await Promise.all([
    readText("docs/CONFIGURATION.md"),
    readJson("data/webs/presets.json"),
    readJson("data/webs/colours.json")
  ]);

  for (const id of presets.presets.map((entry) => entry.id)) {
    assert.ok(configuration.includes(id));
  }

  for (const id of colours.profiles.map((entry) => entry.id)) {
    assert.ok(configuration.includes(id));
  }
});

test("roadmap retains completed milestones and later integration scope", async () => {
  const roadmap = await readText("roadmap.md");

  for (const phrase of [
    "Current baseline — v0.7.0",
    "Milestone 4 — Region-aware webs — complete",
    "Milestone 5 — Spatial index and read-only query API — complete",
    "Milestone 6 — Web carpets — complete",
    "Milestone 7 — Span assets and whole-span destruction — complete",
    "Milestone 7.1 — Persistent span-destruction hardening — complete",
    "Milestone 7.2 — Categorised GM defaults and Scene span reach — complete",
    "Milestone 8 — Scene wall-span behaviour and derived walls — complete",
    "Milestone 8.1 — Generic entity interaction and captured-web visuals — complete",
    "Ambient Critters adapter and release hardening"
  ]) {
    assert.ok(roadmap.includes(phrase));
  }

  assert.ok(
    roadmap.indexOf("Region-aware webs") <
    roadmap.indexOf("Spatial index and read-only query API")
  );
});
