import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global chrome exposes observe, worlds, law, work as local lens roots", async () => {
  const shell = await read("shared/shell.js");
  assert.match(shell, /id:\s*"observe"/);
  assert.match(shell, /id:\s*"worlds"/);
  assert.match(shell, /id:\s*"law"/);
  assert.match(shell, /id:\s*"work"/);
  assert.doesNotMatch(shell, /aria-label="Idsem products"/);
});

test("shared mobile chrome replaces the overflowing product strip before it can obscure content", async () => {
  const surface = await read("shared/surface.css");
  assert.match(surface, /@media\s*\(max-width:\s*900px\)/);
  assert.match(surface, /\.topbar\s+\.nav-desktop\s*\{[\s\S]*?display:\s*none/);
  assert.match(surface, /\.nav-toggle\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(surface, /\.nav-panel\.open\s*\{\s*display:\s*block/);
  assert.match(surface, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(surface, /\.topbar\.nav\s*\{[^}]*overflow-x:\s*auto/);
});

test("homepage presents four quiet axes and no pseudo-semantic decoration", async () => {
  const [site, web] = await Promise.all([read("apps/site/index.html"), read("shared/web.js")]);
  assert.doesNotMatch(site, /<canvas\b/i);
  assert.doesNotMatch(site, /Math\.random\(/);
  assert.match(site, />Observe</);
  assert.match(site, />Worlds</);
  assert.match(site, />Law</);
  assert.match(site, />Work</);
  assert.doesNotMatch(web, /site-product-convergence\.js/);
  assert.match(site, /@media\s*\(max-width:\s*699px\)[\s\S]*?\.cell-a[\s\S]*?min-height:\s*0/);
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
  // build.mjs is a side-effect-only bootstrap (import() of build-base + build-live),
  // not a module with default export. Run it via spawn instead of import().
  const { spawnSync } = await import("node:child_process");
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: process.cwd(), encoding: "utf8", timeout: 60000 });
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
  assert.equal(model.graph.operations_are_relation_identities, true);
  assert.equal(model.graph.reverse_traversal, "derived-index");
});
