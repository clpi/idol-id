import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Live owns an independent Access application and audience instead of overflowing Platform destinations", async () => {
  const [provision, worker] = await Promise.all([
    read("scripts/provision-live-access.mjs"),
    read("worker/live.js"),
  ]);

  assert.match(provision, /Idol Live Browser Identity/);
  assert.match(provision, /LIVE_ACCESS_AUD/);
  assert.doesNotMatch(provision, /destinations\.push\(liveDestination\)/);
  assert.match(worker, /audience:\s*env\.LIVE_ACCESS_AUD/);
});
