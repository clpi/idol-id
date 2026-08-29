import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const site = await readFile(new URL("../apps/site/index.html", import.meta.url), "utf8");
const shell = await readFile(new URL("../shared/shell.js", import.meta.url), "utf8");

const superseded = /\b(?:Idsem|IDSEM|Duo|DUO|Duon|DUON)\b/;

test("homepage is the Idol compiler product rather than an ontology dashboard", () => {
  assert.match(site, /<title>Idol — Lua-derived native compiler<\/title>/);
  assert.match(site, /Dynamic by default\./);
  assert.match(site, /Native when known\./);
  assert.match(site, /experimental Lua-derived native compiler/i);
  assert.match(site, /id="install"/);
  assert.match(site, /curl -fsSL https:\/\/idol\.id\/install \| sh/);
  assert.match(site, /irm https:\/\/idol\.id\/install\.ps1 \| iex/);

  assert.doesNotMatch(site, superseded);
  assert.doesNotMatch(site, /current law projection/i);
  assert.doesNotMatch(site, />Registry</);
  assert.doesNotMatch(site, />World Atlas</);
});

test("homepage does not advertise public compiler actions that are not admitted", () => {
  assert.doesNotMatch(site, /data-action="(?:run|analyze|lower)"/);
  assert.match(site, /Browser execution is not currently admitted/i);
});

test("shared chrome names Idol and exposes a bounded primary navigation", () => {
  const primary = shell.match(/const APPS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
  for (const label of ["compiler", "graph", "docs", "live", "install"]) {
    assert.match(primary, new RegExp(`label:\\s*"${label}"`));
  }
  assert.equal((primary.match(/label:/g) || []).length, 5);
  assert.match(shell, />IDOL<\/a>/);
  assert.match(shell, /aria-label="Idol products"/);
  assert.match(shell, /Open Idol navigation/);
  assert.doesNotMatch(shell, superseded);

  // Domain and JavaScript interface identities are compatibility boundaries,
  // not user-facing language branding; keep them stable.
  assert.match(shell, /https:\/\/idol\.id\//);
  assert.match(shell, /global\.IdolShell/);
  assert.match(shell, /global\.IDOL/);
});
