import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const site = await readFile(new URL("../apps/site/index.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../shared/shell.js", import.meta.url), "utf8");
const studio = await readFile(new URL("../shared/studio-app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../shared/studio.css", import.meta.url), "utf8");
const superseded = /\b(?:idsem|duo|duon)\b/i;

test("root is a working Idol semantic instrument rather than a product directory", () => {
  assert.match(site, /<title>Idol — semantic compiler studio<\/title>/);
  assert.match(site, /One graph\. Every <em>projection\.<\/em>/);
  assert.match(site, /id="studio-editor"/);
  assert.match(site, /data-action="analyze"/);
  assert.match(site, /data-action="lower"/);
  assert.match(site, /id="studio-graph"/);
  assert.match(site, /id="studio-facts-body"/);
  assert.match(site, /data-projection="machine"/);
  assert.doesNotMatch(site, superseded);
  assert.doesNotMatch(site, /Registry<\/div>[\s\S]*World Atlas<\/div>/);
});

test("studio uses real compiler transports and refuses browser-minted semantics", () => {
  assert.match(studio, /fetch\("\/api\/analyze"/);
  assert.match(studio, /fetch\("\/api\/lower"/);
  assert.match(studio, /remoteBundle/);
  assert.match(studio, /No semantic graph is inferred in the browser|Spelling is never upgraded into semantic identity/);
  assert.match(studio, /analysis refused/);
  assert.doesNotMatch(studio, /fake|mock semantic|demo graph/i);
});

test("shared chrome presents one bounded Idol product hierarchy", () => {
  for (const label of ["studio", "graph", "worlds", "registry", "docs", "platform"]) {
    assert.match(shell, new RegExp(`label: "${label}"`));
  }
  const primary = shell.match(/const SURFACES = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
  assert.equal((primary.match(/id:/g) || []).length, 6);
  assert.match(shell, /word\.textContent = "IDOL"/);
  assert.match(shell, /Idol command palette/);
  assert.match(shell, /metaKey \|\| event\.ctrlKey/);
  assert.doesNotMatch(shell, superseded);
  assert.match(shell, /global\.IdolShell/);
  assert.match(shell, /global\.IDOL/);
});

test("responsive system removes horizontal product strips and keeps touch controls", () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.idol-nav, \.idol-command \{ display: none; \}/);
  assert.match(css, /\.idol-menu \{ display: flex; \}/);
  assert.match(css, /@media \(max-width: 699px\)[\s\S]*min-height: 44px/);
  assert.match(css, /\.studio-mobile-tabs/);
  assert.match(css, /height: 100dvh/);
  assert.doesNotMatch(css, /white-space:\s*nowrap;\s*overflow-x:\s*visible/);
});

test("every active app consumes the same design system and current identity", async () => {
  const directory = new URL("../apps/", import.meta.url);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    const html = await readFile(new URL(`../apps/${entry.name}/index.html`, import.meta.url), "utf8");
    assert.match(html, /\/shared\/studio\.css/, `${entry.name} does not consume studio.css`);
    assert.doesNotMatch(html, superseded, `${entry.name} exposes superseded identity`);
  }
});
