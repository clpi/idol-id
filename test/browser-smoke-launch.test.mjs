import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the real-Chrome orchestrator allocates ephemeral CDP ports and preserves bounded diagnostics", async () => {
  const [runner, workflow] = await Promise.all([
    read("scripts/run-browser-smoke.mjs"),
    read(".github/workflows/deploy.yml"),
  ]);

  assert.match(runner, /server\.listen\(0, "127\.0\.0\.1"/);
  assert.match(runner, /IDOL_BROWSER_DEBUG_PORT/);
  assert.match(runner, /IDOL_LIVE_BROWSER_DEBUG_PORT/);
  assert.match(runner, /MAX_ATTEMPTS = 3/);
  assert.match(runner, /STARTUP_FAILURE/);
  assert.match(runner, /Chrome stderr/);
  assert.match(runner, /OUTPUT_LIMIT/);
  assert.match(runner, /scripts\/browser-smoke\.mjs/);
  assert.match(runner, /scripts\/live-mcp-browser-smoke\.mjs/);
  assert.match(workflow, /node scripts\/run-browser-smoke\.mjs/);
  assert.doesNotMatch(workflow, /^\s*node scripts\/(?:browser-smoke|live-mcp-browser-smoke)\.mjs\s*$/m);
});
