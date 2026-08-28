import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("verified builds execute a real Chrome semantic-interaction gate", async () => {
  const [workflow, smoke] = await Promise.all([
    read(".github/workflows/deploy.yml"),
    read("scripts/browser-smoke.mjs"),
  ]);

  assert.match(workflow, /node scripts\/browser-smoke\.mjs/);
  assert.match(workflow, /idol-browser-smoke-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /\.artifacts\/browser-smoke/);
  assert.match(smoke, /390, 844/);
  assert.match(smoke, /1440, 900/);
  assert.match(smoke, /\.semantic-token/);
  assert.match(smoke, /#analyze/);
  assert.match(smoke, /relation:weight/);
  assert.match(smoke, /\.graph-edge/);
  for (const lens of ["identity", "edges", "occurrences", "worlds", "projection", "witness", "realization", "raw"]) {
    assert.match(smoke, new RegExp(`"${lens}"`));
  }
  assert.match(smoke, /scrollWidth/);
  assert.match(smoke, /height < 44/);
  assert.match(smoke, /Runtime\.exceptionThrown/);
  assert.match(smoke, /observatory-mobile\.png/);
  assert.match(smoke, /observatory-desktop\.png/);
});
