import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global chrome keeps Lib and Worlds distinct while Universe is contextual", async () => {
  const shell = await read("shared/shell.js");

  assert.match(shell, /id:\s*"worlds"[\s\S]*?href:\s*"https:\/\/worlds\.idol\.id\/"/);
  assert.match(shell, /id:\s*"lib"[\s\S]*?href:\s*"https:\/\/lib\.idol\.id\/"/);
  assert.doesNotMatch(shell, /id:\s*"universe"/);
  assert.match(shell, /https:\/\/worlds\.idol\.id\/universe/);
  assert.match(shell, /https:\/\/platform\.idol\.id\/universe/);
  assert.match(shell, /class="nav-toggle"/);
  assert.match(shell, /aria-expanded="false"/);
  assert.match(shell, /aria-controls="idol-nav-panel"/);
  assert.match(shell, /panel\.className\s*=\s*"nav-panel"/);
  assert.match(shell, /event\.key === "Escape"/);
});

test("shared mobile chrome replaces the overflowing desktop strip before it can obscure content", async () => {
  const surface = await read("shared/surface.css");

  assert.match(surface, /@media\s*\(max-width:\s*900px\)/);
  assert.match(surface, /\.topbar \.nav-desktop\s*\{\s*display:\s*none/);
  assert.match(surface, /\.nav-toggle\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(surface, /\.nav-panel\.open\s*\{\s*display:\s*block/);
  assert.match(surface, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(surface, /\.topbar \.nav\s*\{[^}]*overflow-x:\s*auto/);
});

test("homepage removes pseudo-semantic decoration and states the product boundaries", async () => {
  const site = await read("apps/site/index.html");

  assert.doesNotMatch(site, /<canvas\b/i);
  assert.doesNotMatch(site, /Math\.random\(/);
  assert.match(site, />Registry</);
  assert.match(site, />World Atlas</);
  assert.match(site, /package provenance/i);
  assert.match(site, /world identity/i);
  assert.match(site, /home[^<]*reach/i);
  assert.match(site, /https:\/\/lib\.idol\.id\//);
  assert.match(site, /https:\/\/worlds\.idol\.id\//);
  assert.match(site, /@media\s*\(max-width:\s*699px\)[\s\S]*?\.cell-a[\s\S]*?min-height:\s*0/);
});

test("Lib defaults to published records, preserves homes, and links to canonical World views", async () => {
  const lib = await read("apps/lib/index.html");

  assert.match(lib, /viewport-fit=cover/);
  assert.match(lib, /let set = requestedSet === "homes" \? "libs" : "worlds"/);
  assert.match(lib, /data-set="worlds"[^>]*class="here"|class="here"[^>]*data-set="worlds"/);
  assert.match(lib, /data-set="libs"/);
  assert.match(lib, /https:\/\/worlds\.idol\.id\//);
  assert.match(lib, /https:\/\/worlds\.idol\.id\/universe/);
  assert.match(lib, /data-mobile="list"/);
  assert.match(lib, /class="lib-mobile-nav"/);
  assert.match(lib, /data-mobile-view="list"/);
  assert.match(lib, /data-mobile-view="detail"/);
  assert.match(lib, /setMobileView/);
  assert.match(lib, /home is reach and provenance, not a world/i);
  assert.doesNotMatch(lib, /published Idol library is a world/i);
});

test("build publishes one non-authoritative product-boundary projection", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], {
    encoding: "utf8",
    timeout: 30000,
  });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
  const model = JSON.parse(await readFile("dist/runtime/product-model.json", "utf8"));
  const authority = JSON.parse(await readFile("runtime/authority.json", "utf8"));

  assert.equal(manifest.surfaces["lib.idol.id"], "lib");
  assert.equal(manifest.surfaces["worlds.idol.id"], "worlds");
  assert.equal(manifest.runtime.product_model, "/runtime/product-model.json");

  assert.equal(model.schema, "idol.web.product-model.v1");
  assert.equal(model.semantic_authority, false);
  assert.equal(model.semantic_universes, 1);
  assert.deepEqual(model.authority, {
    language: authority.language.commit,
    native: authority.native.commit,
    source_law: authority.language.source_law.sha256,
  });

  assert.equal(model.surfaces.lib.kind, "package-and-world-registry-projection");
  assert.equal(model.surfaces.lib.package_record_is_semantic_identity, false);
  assert.equal(model.surfaces.lib.default_lens, "published-worlds");
  assert.equal(model.surfaces.lib.home_lens, "reach-and-provenance");
  assert.equal(model.surfaces.worlds.kind, "world-atlas-projection");
  assert.equal(model.surfaces.worlds.canonical, "https://worlds.idol.id");
  assert.equal(model.surfaces.universe.kind, "operational-projection");
  assert.equal(model.surfaces.universe.manager, "https://platform.idol.id/universe");
  assert.equal(model.surfaces.universe.public, "https://worlds.idol.id/universe");
  assert.equal(model.surfaces.universe.mints_semantic_universe, false);

  assert.equal(model.entities.home.kind, "reach-and-provenance");
  assert.equal(model.entities.home.is_world, false);
  assert.equal(model.entities.home.is_subject, false);
  assert.equal(model.entities.path.is_identity, false);
  assert.equal(model.entities.package_provenance.is_authority, false);
  assert.equal(model.entities.package_provenance.is_semantic_identity, false);

  assert.equal(model.graph.structural_roles_source, "compiler-projection-only");
  assert.deepEqual(model.graph.web_declared_roles, []);
  assert.equal(model.graph.operations_are_relation_identities, true);
  assert.equal(model.graph.reverse_traversal, "derived-index");
});
