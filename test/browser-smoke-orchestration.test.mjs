import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("one bounded orchestrator runs every real-Chrome gate on operating-system-selected ports", async () => {
  const [orchestrator, workflow, ...gates] = await Promise.all([
    read("scripts/run-browser-smoke.mjs"),
    read(".github/workflows/deploy.yml"),
    read("scripts/browser-smoke.mjs"),
    read("scripts/studio-browser-smoke.mjs"),
    read("scripts/live-mcp-browser-smoke.mjs"),
  ]);
  assert.match(workflow, /node scripts\/run-browser-smoke\.mjs/);
  assert.match(orchestrator, /createServer/);
  assert.match(orchestrator, /listen\(0, "127\.0\.0\.1"/);
  assert.match(orchestrator, /const MAX_ATTEMPTS = 3/);
  assert.match(orchestrator, /Chrome stderr/);
  assert.doesNotMatch(orchestrator, /\b(?:9222|9223|9224)\b/);
  assert.doesNotMatch(orchestrator, /\b(?:pkill|killall)\b/);
  const variables = new Set(gates.flatMap((source) => [...source.matchAll(/process\.env\.([A-Z0-9_]*DEBUG_PORT[A-Z0-9_]*)/g)].map((match) => match[1])));
  assert.ok(variables.size >= 1, "smoke gates must expose their CDP port coordinates");
  for (const variable of variables) assert.match(orchestrator, new RegExp(variable));
});
