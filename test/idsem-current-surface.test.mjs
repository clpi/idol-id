import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const site = await readFile(new URL("../apps/site/index.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../shared/shell.js", import.meta.url), "utf8");

test("homepage presents Idol as the current language identity", () => {
  assert.match(site, /<title>Idol — semantic identity/);
  assert.match(site, /<h1>IDOL<\/h1>/);
  assert.match(site, /Idol keeps one graph of exact meaning/);
  assert.match(site, /<span>IDOL · \.ID<\/span>/);
  assert.match(site, /Shell\.boot\("site", \{ title: "Idol" \}\)/);
  assert.doesNotMatch(site, /aria-label="Idol product surfaces"/);
  assert.doesNotMatch(site, />IDOL · \.ID</);
});

test("shared chrome presents Idol while preserving compatibility interfaces", () => {
  assert.match(shell, />IDOL<\/a>/);
  assert.match(shell, /aria-label="Idol products"/);
  assert.match(shell, /Open Idol navigation/);
  assert.doesNotMatch(shell, /aria-label="Idol products"/);
  assert.doesNotMatch(shell, />IDOL<\/a>/);

  // Domain and JS interface identities are existing compatibility/interface
  // provenance, not current user-facing language branding. This migration must
  // not silently rename them and fork callers.
  assert.match(shell, /https:\/\/idol\.id\//);
  assert.match(shell, /global\.IdolShell/);
  assert.match(shell, /global\.IDOL/);
});
