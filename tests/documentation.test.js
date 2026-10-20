// Purpose: Verify documentation links and data/API references without constraining prose.
import test from "node:test";
import assert from "node:assert/strict";
import {access, readFile, readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {createPublicApi} from "../scripts/api.js";

const readText = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("local documentation links resolve to existing files", async () => {
  const guides = (await readdir(new URL("../docs/", import.meta.url)))
    .filter(name => name.endsWith(".md")).map(name => `docs/${name}`);
  for (const page of ["README.md", "roadmap.md", ...guides]) {
    const source = new URL(`../${page}`, import.meta.url);
    for (const [, href] of (await readText(page)).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/gu)) {
      if (/^(?:[a-z][\w+.-]*:|#)/iu.test(href)) continue;
      const target = fileURLToPath(new URL(href, source));
      await assert.doesNotReject(() => access(target), `Broken link in ${page}: ${href}`);
    }
  }
});

test("documented API method references exist on the public API", async () => {
  const guide = await readText("docs/PUBLIC-API.md"), api = createPublicApi({});
  const references = [...guide.matchAll(/\bapi\.([\w.]+)\s*\(/gu)];
  assert.ok(references.length > 0, "No public API method references were found");
  for (const [, method] of references) {
    const value = method.split(".").reduce((owner, key) => owner?.[key], api);
    assert.equal(typeof value, "function", `Documented API method does not exist: api.${method}`);
  }
});

test("configuration documentation lists every authored density and colour profile", async () => {
  const [configuration, presets, colours] = await Promise.all([
    readText("docs/CONFIGURATION.md"),
    readJson("data/webs/presets.json"),
    readJson("data/webs/colours.json")
  ]);
  for (const id of presets.presets.map(entry => entry.id)) assert.ok(configuration.includes(id));
  for (const id of colours.profiles.map(entry => entry.id)) assert.ok(configuration.includes(id));
});
