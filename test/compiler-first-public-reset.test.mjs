import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const superseded = new RegExp(`\\b(?:${["Id"+"sem","ID"+"SEM","Du"+"o","DU"+"O","Du"+"on","DU"+"ON"].join("|")})\\b`);

test("homepage opens as a compiler product", async () => {
  const site = await read("apps/site/index.html");
  assert.match(site, /Dynamic by default/);
  assert.match(site, /Native when known/);
  assert.match(site, /Lua-derived native compiler/i);
  assert.match(site, /id="playground"/);
  assert.match(site, /id="install"/);
  assert.match(site, /curl -fsSL https:\/\/idol\.id\/install \| sh/);
  assert.match(site, /irm https:\/\/idol\.id\/install\.ps1 \| iex/);
  assert.doesNotMatch(site, /class="lawline"/);
  assert.doesNotMatch(site, superseded);
});

test("primary chrome names one compiler and four direct tools", async () => {
  const shell = await read("shared/shell.js");
  const primary = shell.match(/const APPS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
  for (const label of ["compiler", "playground", "graph", "docs", "live"]) assert.match(primary, new RegExp(`label:\\s*"${label}"`));
  assert.equal((primary.match(/label:/g) || []).length, 5);
  assert.match(shell, />IDOL<\/a>/);
  assert.doesNotMatch(shell, superseded);
});

test("homepage examples are compiler evidence", async () => {
  const manifest = JSON.parse(await read("content/source-examples.json"));
  assert.equal(manifest.schema, "idol.web.compiler-examples.v1");
  assert.ok(manifest.examples.length >= 2);
  assert.ok(manifest.examples.some((example) => example.featured === true));
  for (const example of manifest.examples) {
    assert.ok(["compiler-executed", "compiler-accepted"].includes(example.status));
    assert.equal(example.authority?.repository, "clpi/idol");
    assert.match(example.authority?.commit || "", /^[0-9a-f]{40}$/);
    assert.ok(example.source.trim().length > 0);
  }
});

test("stable assets revalidate and only content-addressed assets can be immutable", async () => {
  const worker = await read("worker/index.js");
  assert.match(worker, /function isContentAddressedPath\(/);
  assert.match(worker, /no-cache, must-revalidate/);
  assert.match(worker, /immutable:\s*isContentAddressedPath\(url\.pathname\)/);
});

test("the final HTML owns product structure", async () => {
  const web = await read("shared/web.js");
  assert.doesNotMatch(web, /site-product-convergence\.js/);
});

test("mobile chrome replaces the product strip", async () => {
  const [surface, shell] = await Promise.all([read("shared/surface.css"), read("shared/shell.js")]);
  assert.match(surface, /@media\s*\(max-width:\s*900px\)/);
  assert.match(surface, /\.topbar \.nav-desktop\s*\{\s*display:\s*none/);
  assert.match(shell, /class="nav-cta"/);
  assert.match(shell, /aria-controls="idol-nav-panel"/);
  assert.match(shell, /event\.key==="Escape"/);
});

test("browser admission covers the actual mobile range and compiler flow", async () => {
  const smoke = await read("scripts/public-browser-smoke.mjs");
  for (const [width, height] of [[320,568],[390,844],[430,932],[768,1024],[1440,900]]) assert.match(smoke, new RegExp(`${width}\\s*,\\s*${height}`));
  for (const marker of ["data-action=\\\"run\\\"", "data-action=\\\"analyze\\\"", "data-edge-id", "install-command", "scrollWidth", "height < 44"]) assert.match(smoke, new RegExp(marker));
});

test("immutable build preserves compiler-first public identity", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8", timeout: 30000 });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const built = await readFile("dist/apps/site/index.html", "utf8");
  assert.match(built, /Dynamic by default/);
  assert.doesNotMatch(built, superseded);
});
