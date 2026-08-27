import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../scripts/platform-provision-lib.mjs", import.meta.url), "utf8");

test("Platform Access admits the private Universe manager and browser API", () => {
  assert.match(source, /platform\.idol\.id\/universe\*/);
  assert.match(source, /platform\.idol\.id\/v1\/universe\/browser\/\*/);
});

test("Universe status and public Worlds transport remain outside the private Access destination set", () => {
  assert.doesNotMatch(source, /platform\.idol\.id\/v1\/universe\/status/);
  assert.doesNotMatch(source, /worlds\.idol\.id\/v1\/universe\/public/);
});
