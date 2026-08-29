import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global chrome keeps the compiler primary and Lib, world, and Universe views contextual", async () => {
  const shell = await read("shared/shell.js");
  const primary = shell.match(/const APPS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
  const contextual = shell.match(/const CONTEXTUAL = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
  assert.match(primary, /id:\s*"site"[\s\S]*?label:\s*"compiler"/);
  assert.doesNotMatch(primary, /id:\s*"lib"/);
  assert.match(contextual, /id:\s*"lib"[\s\S]*?href:\s*"https:\/\/lib\.idol\.id\/"/);
  assert.doesNotMatch(shell, /id:\s*"worlds"/);
  assert.doesNotMatch(shell, /id:\s*"universe"/);
  assert.match(shell, /https:\/\/lib\.idol\.id\/atlas/);
  assert.match(shell, /https:\/\/lib\.idol\.id\/universe/);
  assert.match(shell, /https:\/\/platform\.idol\.id\/universe/);
  assert.match(shell, /https:\/\/platform\.idol\.id\/repo/);
  assert.match(shell, /class="nav-toggle"/);
  assert.match(shell, /aria-expanded="false"/);
  assert.match(shell, /aria-controls="idol-nav-panel"/);
  assert.match(shell, /event\.key === "Escape"/);
});

test("shared mobile chrome replaces the overflowing product strip before it can obscure content", async () => {
  const surface = await read("shared/surface.css");
  assert.match(surface, /@media\s*\(max-width:\s*900px\)/);
  assert.match(surface, /\.topbar \.nav-desktop\s*\{\s*display:\s*none/);
  assert.match(surface, /\.nav-toggle\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(surface, /\.nav-panel\.open\s*\{\s*display:\s*block/);
  assert.match(surface, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(surface, /\.topbar \.nav\s*\{[^}]*overflow-x:\s*auto/);
});

test("homepage is compiler-first and is not rewritten after load by a convergence patch", async () => {
  const [site, home, web] = await Promise.all([read("apps/site/index.html"), read("shared/site-home.css"), read("shared/web.js")]);
  assert.doesNotMatch(site, /<canvas\b/i);
  assert.doesNotMatch(site, /Math\.random\(/);
  assert.match(site, /Dynamic by default\./);
  assert.match(site, /Native when known\./);
  assert.match(site, /id="install"/);
  assert.doesNotMatch(site, /current law projection/i);
  assert.doesNotMatch(web, /site-product-convergence\.js/);
  assert.match(home, /@media\s*\(max-width:\s*680px\)/);
  assert.match(home, /overflow-x:\s*hidden/);
});

test("Lib preserves mobile list/detail navigation and exact home boundary", async () => {
  const [lib, canonical] = await Promise.all([read("apps/lib/index.html"), read("shared/lib-canonical.js")]);
  assert.match(lib, /viewport-fit=cover/);
  assert.match(lib, /let set = requestedSet === "homes" \? "libs" : "worlds"/);
  assert.match(lib, /data-set="worlds"[^>]*class="here"|class="here"[^>]*data-set="worlds"/);
  assert.match(lib, /data-set="libs"/);
  assert.match(lib, /data-mobile="list"/);
  assert.match(lib, /class="lib-mobile-nav"/);
  assert.match(lib, /data-mobile-view="list"/);
  assert.match(lib, /data-mobile-view="detail"/);
  assert.match(lib, /setMobileView/);
  assert.match(canonical, /home is reach and provenance, not a world/i);
  assert.match(canonical, /package coordinate is provenance, not semantic identity or authority/i);
});

test("build publishes one non-authoritative Lib/world product-boundary projection", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8", timeout: 30000 });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
  const model = JSON.parse(await readFile("dist/runtime/product-model.json", "utf8"));
  const authority = JSON.parse(await readFile("runtime/authority.json", "utf8"));

  assert.equal(manifest.surfaces["lib.idol.id"], "lib");
  assert.equal(manifest.surfaces["worlds.idol.id"], "lib:compatibility-alias");
  assert.equal(manifest.runtime.product_model, "/runtime/product-model.json");
  assert.equal(model.semantic_authority, false);
  assert.equal(model.semantic_universes, 1);
  assert.deepEqual(model.authority, { language: authority.language.commit, native: authority.native.commit, source_law: authority.language.source_law.sha256 });
  assert.equal(model.surfaces.lib.kind, "admitted-world-registry-projection");
  assert.equal(model.surfaces.lib.package_coordinate_is_semantic_identity, false);
  assert.equal(model.surfaces.worlds.kind, "compatibility-alias");
  assert.equal(model.surfaces.universe.public, "https://lib.idol.id/universe");
  assert.equal(model.entities.home.kind, "reach-and-provenance");
  assert.equal(model.entities.home.is_world, false);
  assert.equal(model.entities.path.is_identity, false);
  assert.equal(model.entities.package_provenance.is_authority, false);
  assert.equal(model.graph.roles.owner, "compiler-published-projection");
  assert.deepEqual(model.graph.roles.web_declared, []);
  assert.equal(model.graph.operations_are_relation_identities, true);
  assert.equal(model.graph.reverse_traversal, "derived-index");
});
