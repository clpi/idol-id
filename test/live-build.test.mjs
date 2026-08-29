import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("runner owns both browser smoke scripts and enforces ephemeral port contract", async () => {
  const [workflow, runner] = await Promise.all([
    read(".github/workflows/deploy.yml"),
    read("scripts/run-browser-smoke.mjs"),
  ]);

  // The runner imports both gate scripts by name
  assert.match(runner, /browser-smoke\.mjs/, "runner must own browser-smoke.mjs");
  assert.match(runner, /live-mcp-browser-smoke\.mjs/, "runner must own live-mcp-browser-smoke.mjs");

  // Runner docs specify ephemeral port policy — Chrome always starts with --remote-debugging-port=0
  assert.match(runner, /--remote-debugging-port=0/, "Chrome must launch with --remote-debugging-port=0");

  // No port pre-allocation anywhere in the runner (no debugPort env or fixed port variable)
  assert.doesNotMatch(runner, /debugPort\s*=\s*process\.env/, "must not pre-allocate debug port via env var");

  // Workflow invokes only the single owned runner
  assert.match(workflow, /node scripts\/run-browser-smoke\.mjs/);
});

test("live gate script uses admitted WSWebSocket and bounded stderr consumption", async () => {
  const liveSmoke = await read("scripts/live-mcp-browser-smoke.mjs");

  // Uses admitted WSWebSocket from ws package, not bare new WebSocket()
  assert.match(liveSmoke, /WSWebSocket/, "must use imported WSWebSocket class");
  assert.doesNotMatch(liveSmoke, /\bnew WebSocket\(/, "must not use bare global WebSocket constructor");

  // Ephemeral port contract — no pre-allocated port variable, reads DevToolsActivePort from profile
  assert.match(liveSmoke, /remote-debugging-port=0/, "Chrome must launch with ephemeral port");
  assert.doesNotMatch(liveSmoke, /debugPort\s*=/, "must not pre-allocate debug port variable");
  assert.match(liveSmoke, /DevToolsActivePort/, "must read DevToolsActivePort from Chrome profile");

  // Bounded stderr consumption — live-mcp delegates to consumeBoundedStderr helper
  assert.match(liveSmoke, /consumeBoundedStderr\s*\(\s*chrome/, "must delegate stderr to bounded consumer");

  // Early exit detection + teardown ordering: closeChrome before rm(profile)
  assert.match(liveSmoke, /exitCode !== null/, "must detect early exit via exitCode check");
  
  // In finally block: Chrome termination must occur before profile cleanup
  const finallyStart = liveSmoke.lastIndexOf("} finally {");
  const removeIdx = liveSmoke.indexOf("await rm(profile", finallyStart);
  const closeIdx = liveSmoke.indexOf("await closeChrome(chrome, cdp)", finallyStart);
  assert.notEqual(closeIdx, -1, "closeChrome must be awaited in teardown");
  assert.notEqual(removeIdx, -1, "profile cleanup must remain explicit");
  assert.ok(closeIdx < removeIdx, "Chrome must fully exit before its profile is removed");
  assert.match(liveSmoke, /maxRetries:\s*[1-9]/, "profile cleanup must tolerate late filesystem release");
});
