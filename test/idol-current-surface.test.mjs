import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const site = await readFile(new URL("../apps/site/index.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../shared/shell.js", import.meta.url), "utf8");

test("homepage presents IDOL as the current language identity", () => {
  assert.match(site, /<title>IDOL · semantic identity/);
  assert.match(site, /<h1>IDOL<\/h1>/);
  assert.match(site, /IDOL keeps one graph of exact meaning/);
  assert.match(site, /<span>IDOL · \.ID<\/span>/);
  assert.match(site, /Shell\.boot\("site", \{ title: "IDOL" \}\)/);
  assert.doesNotMatch(site, /aria-label="Idsem product surfaces"/);
  assert.doesNotMatch(site, />IDSEM </);
});

test("shared chrome presents IDOL while preserving compatibility interfaces", () => {
  assert.match(shell, />IDOL<\/a>/);
  assert.match(shell, /aria-label="IDOL instrument"/);
  assert.match(shell, /Open IDOL navigation/);
  assert.doesNotMatch(shell, /aria-label="Idsem products"/);
  assert.doesNotMatch(shell, />IDSEM<\/a>/);

  // Domain and JS interface identities are existing compatibility/interface
  // provenance, not current user-facing language branding. This migration must
  // not silently rename them and fork callers.
  assert.match(shell, /global\.IdolShell/);
  assert.match(shell, /global\.IDOL/);
});
