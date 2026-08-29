import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("production verification treats Worlds as a 308 compatibility alias to canonical Lib", async () => {
  const source = await read("scripts/verify-production.mjs");

  assert.match(source, /host === "worlds\.idol\.id"/);
  assert.match(source, /response\.status === 308/);
  assert.match(source, /https:\/\/lib\.idol\.id/);
  assert.match(source, /__idol\/version/);
});

test("production verification refuses the stale homepage and immutable stable assets", async () => {
  const source = await read("scripts/verify-production.mjs");

  assert.match(source, /async function verifyHomepage/);
  assert.match(source, /Dynamic by default\./);
  assert.match(source, /Native when known\./);
  assert.match(source, /content\/source-examples\.json/);
  assert.match(source, /current law projection/);
  assert.match(source, />Registry</);
  assert.match(source, /World Atlas/);
  assert.match(source, /cachePolicy\(shell\.response/);
  assert.match(source, /cachePolicy\(style\.response/);
  assert.match(source, /!\/immutable\//);
  assert.match(source, /example\.id === "projection-faces"/);
  assert.match(source, /const homepage = await verifyHomepage\(\)/);
});
