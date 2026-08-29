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
