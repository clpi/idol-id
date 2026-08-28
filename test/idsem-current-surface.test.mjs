import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const site = await readFile(new URL("../apps/site/index.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../shared/shell.js", import.meta.url), "utf8");

test("homepage presents Idsem as the current language identity", () => {
  assert.match(site, /<title>Idsem — semantic identity/);
  assert.match(site, /<h1>IDSEM<\/h1>/);
  assert.match(site, /Idsem keeps one graph of exact meaning/);
  assert.match(site, /<span>IDSEM · \.ID<\/span>/);
  assert.match(site, /Shell\.boot\("site", \{ title: "Idsem" \}\)/);
  assert.doesNotMatch(site, /aria-label="Idol product surfaces"/);
  assert.doesNotMatch(site, />IDOL · \.ID</);
});

test("shared chrome presents Idsem while preserving compatibility interfaces", () => {
  assert.match(shell, />IDSEM<\/a>/);
  assert.match(shell, /aria-label="Idsem products"/);
  assert.match(shell, /Open Idsem navigation/);
  assert.doesNotMatch(shell, /aria-label="Idol products"/);
  assert.doesNotMatch(shell, />IDOL<\/a>/);

  // Domain and JS interface identities are existing compatibility/interface
  // provenance, not current user-facing language branding. This migration must
  // not silently rename them and fork callers.
  assert.match(shell, /https:\/\/idol\.id\//);
  assert.match(shell, /global\.IdolShell/);
  assert.match(shell, /global\.IDOL/);
});
