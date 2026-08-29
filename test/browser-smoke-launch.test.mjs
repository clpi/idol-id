import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every real-Chrome gate allocates an ephemeral CDP port and reports early process failure", async () => {
  const sources = await Promise.all([
    read("scripts/browser-smoke.mjs"),
    read("scripts/live-mcp-browser-smoke.mjs"),
  ]);

  for (const source of sources) {
    assert.match(source, /--remote-debugging-port=0/);
    assert.match(source, /DevToolsActivePort/);
    assert.match(source, /chrome\.stderr\.on\("data"/);
    assert.match(source, /chrome\.exitCode/);
    assert.match(source, /exited before DevTools/i);
    assert.doesNotMatch(source, /IDOL_[A-Z_]*DEBUG_PORT/);
    assert.doesNotMatch(source, /remote-debugging-port=\$\{debugPort\}/);
  }
});
