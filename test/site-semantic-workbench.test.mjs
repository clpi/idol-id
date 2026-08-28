import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const site = await read("apps/site/index.html");
const playground = await read("shared/site-playground.js");
const install = await read("shared/site-install-entry.js");
const examples = JSON.parse(await read("content/source-examples.json"));
const worker = await read("worker/entry.js");

function visibleText(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test("homepage presents the current Idol identity without visible Idsem residue", () => {
  const visible = visibleText(site);
  assert.match(site, /<title>Idol —/);
  assert.match(site, /<h1[^>]*>IDOL<\/h1>/);
  assert.match(site, /Shell\.boot\("site", \{ title: "Idol" \}\)/);
  assert.match(site, /<span>IDOL · \.ID<\/span>/);
  assert.doesNotMatch(visible, /\bIdsem\b/i);
  assert.doesNotMatch(visible, /\bDuo(?:n)?\b/i);
});

test("homepage ships a static, inspectable installer before JavaScript runs", () => {
  assert.match(site, /id="install"/);
  assert.match(site, /curl -fsSL https:\/\/idol\.id\/install \| sh/);
  assert.match(site, /irm https:\/\/idol\.id\/install\.ps1 \| iex/);
  assert.match(site, /href="\/install\.sh"/);
  assert.match(site, /href="\/install\.ps1"/);
  assert.match(site, /Zig-built bootstrap seed/i);
  assert.match(site, /not yet a self-hosted release/i);
  assert.doesNotMatch(install, /createElement\("section"\)/, "installer JavaScript must enhance static markup, not manufacture it");
  assert.match(install, /data-copy-command/);
  assert.match(worker, /url\.pathname === "\/install" \|\| url\.pathname === "\/install\.sh"/);
  assert.match(worker, /url\.pathname === "\/install\.ps1"/);
});

test("homepage exposes one coherent source-to-graph-to-facts workbench", () => {
  for (const asset of [
    "/shared/observatory.css",
    "/shared/site.css",
    "/shared/idol.js",
    "/shared/graph.js",
    "/shared/site-playground.js",
  ]) assert.match(site, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const id of ["example-list", "demo-editor", "demo-graph", "demo-facts", "demo-output"]) {
    assert.match(site, new RegExp(`id="${id}"`));
  }
  for (const action of ["analyze", "run", "lower", "reset"]) {
    assert.match(site, new RegExp(`data-demo-action="${action}"`));
  }
  for (const mode of ["source", "graph", "facts"]) {
    assert.match(site, new RegExp(`data-demo-mode="${mode}"`));
  }
  assert.match(site, /Open in the full Observatory/);
  assert.match(site, /Open in the browser IDE/);
});

test("homepage examples distinguish compiler evidence from lawful frontier source", () => {
  assert.equal(examples.schema, "idol.web.source-examples.v2");
  assert.ok(examples.examples.length >= 3);
  const classes = new Set(examples.examples.map((example) => example.capability));
  assert.ok(classes.has("compiler-evidence"));
  assert.ok(classes.has("law-projection"));
  assert.ok(examples.examples.every((example) => typeof example.source === "string" && example.source.trim()));
  assert.ok(examples.examples.every((example) => Array.isArray(example.actions) && example.actions.includes("analyze")));
  assert.ok(examples.examples.some((example) => example.actions.includes("run")));
  assert.ok(examples.examples.some((example) => example.actions.includes("lower")));
  assert.ok(examples.examples.some((example) => example.capability === "law-projection" && !example.actions.includes("run")));
  assert.ok(examples.examples.every((example) => example.authority?.repository === "clpi/idol"));
  assert.ok(examples.examples.every((example) => /^[0-9a-f]{40}$/.test(example.authority?.commit || "")));
});

test("playground uses compiler-published graph records and refuses browser-owned semantics", () => {
  assert.match(playground, /Idol\.api\.post\("\/api\/analyze"/);
  assert.match(playground, /Idol\.api\.post\("\/api\/run"/);
  assert.match(playground, /Idol\.api\.post\("\/api\/lower"/);
  assert.match(playground, /new GraphView/);
  assert.match(playground, /setGraph\(graph\)/);
  assert.match(playground, /onSelectNode/);
  assert.match(playground, /onSelectEdge/);
  assert.match(playground, /semantic identity not published/i);
  assert.doesNotMatch(playground, /application:weight|relation:weight|edge:weight/, "homepage code must not hard-code example semantic identities");
  assert.doesNotMatch(playground, /find\([^\n]*name|match\([^\n]*name/i, "homepage must not reconstruct graph identity from names");
});
