import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live audit covers every intended non-agent surface and hard-excludes agent consoles", async () => {
  const source = await read("scripts/audit-live-surfaces.mjs");
  for (const host of ["idol.id", "www.idol.id", "docs.idol.id", "lib.idol.id", "api.idol.id", "graph.idol.id", "worlds.idol.id", "platform.idol.id", "r8a.idol.id", "r8b.idol.id", "r16.idol.id", "live.idol.id", "mcp.idol.id"]) {
    assert.match(source, new RegExp(host.replaceAll(".", "\\.")));
  }
  assert.match(source, /excludedHosts = new Set\(\["hermes\.idol\.id", "claw\.idol\.id"\]\)/);
  assert.doesNotMatch(source, /TinyFish|Railway|browser automation plugin/i);
});

test("live audit proves mobile, desktop, identity, overflow, interaction size, and screenshots", async () => {
  const source = await read("scripts/audit-live-surfaces.mjs");
  assert.match(source, /\[390, 844\]/);
  assert.match(source, /\[1440, 1000\]/);
  assert.match(source, /scrollWidth/);
  assert.match(source, /height < 44/);
  assert.match(source, /superseded identity visible/);
  assert.match(source, /Page\.captureScreenshot/);
  assert.match(source, /console\/runtime errors/);
  assert.match(source, /optionalAbsent/);
});

test("post-deploy workflow runs and retains public surface evidence", async () => {
  const workflow = await read(".github/workflows/public-surfaces-audit.yml");
  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /deploy idol\.id/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /node scripts\/audit-live-surfaces\.mjs/);
  assert.match(workflow, /\.artifacts\/live-surfaces/);
});
