import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const site = await readFile(new URL("../apps/site/index.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../shared/shell.js", import.meta.url), "utf8");

function visibleText(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

test("homepage presents Idol as the current language identity", () => {
  assert.match(site, /<title>Idol —/);
  assert.match(site, /<h1[^>]*>IDOL<\/h1>/);
  assert.match(site, /Idol keeps one graph of exact meaning/);
  assert.match(site, /<span>IDOL · \.ID<\/span>/);
  assert.match(site, /Shell\.boot\("site", \{ title: "Idol" \}\)/);
  assert.doesNotMatch(visibleText(site), /\bIdsem\b/i);
});

test("shared chrome presents Idol while preserving compatibility interfaces", () => {
  assert.match(shell, />IDOL<\/a>/);
  assert.match(shell, /aria-label="Idol products"/);
  assert.match(shell, /Open Idol navigation/);
  assert.doesNotMatch(shell, />IDSEM<\/a>/);
  assert.doesNotMatch(shell, /aria-label="Idsem products"/);

  // Domain and JS interface identities are compatibility/interface provenance.
  // The user-facing brand may change without silently forking callers.
  assert.match(shell, /https:\/\/idol\.id\//);
  assert.match(shell, /global\.IdolShell/);
  assert.match(shell, /global\.IDOL/);
});
