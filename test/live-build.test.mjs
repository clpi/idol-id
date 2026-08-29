import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("immutable build contains Live, hosted MCP, exact routes, and honest implementation status", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8", timeout: 30000 });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const [manifest, runtime, contract, sourceManifest] = await Promise.all([
    readFile("dist/manifest.json", "utf8").then(JSON.parse),
    readFile("dist/runtime/manifest.json", "utf8").then(JSON.parse),
    readFile("dist/runtime/live-contract.json", "utf8").then(JSON.parse),
    readFile("dist/runtime/idol-source-manifest.json", "utf8").then(JSON.parse),
  ]);
  assert.equal(manifest.surfaces["live.idol.id"], "live");
  assert.equal(manifest.surfaces["mcp.idol.id"], "mcp");
  assert.equal(runtime.live, "/runtime/live-contract.json");
  assert.equal(runtime.mcp.endpoint, "https://mcp.idol.id/mcp");
  assert.equal(runtime.mcp.transport, "streamable-http-stateless");
  assert.equal(runtime.mcp.authentication, "platform-api-token");

  assert.equal(contract.schema, "idol.web.live.contract.v1");
  assert.equal(contract.semantic_authority, false);
  assert.equal(contract.collaboration_truth, true);
  assert.equal(contract.semantic_universes, 1);
  assert.equal(contract.accepted_frontiers_per_project, 1);
  assert.equal(contract.dispatcher_access, false);
  assert.equal(contract.implementation, "host-reference");
  assert.equal(contract.idol_source_present, true);
  assert.equal(contract.idol_execution_admitted, false);
  assert.match(contract.deletion_gate, /artifact-bound Idol\/Wasm realization/i);

  const sourcePaths = (sourceManifest.sources || sourceManifest.files || []).map((record) => typeof record === "string" ? record : record.path);
  assert.ok(sourcePaths.includes("live/model.id"));
  assert.ok(sourcePaths.includes("live/projection.id"));
  assert.match(await readFile("dist/apps/live/index.html", "utf8"), /Live/);
  assert.match(await readFile("dist/apps/mcp/index.html", "utf8"), /mcp\.idol\.id\/mcp/);
  assert.match(await readFile("dist/apps/platform/index.html", "utf8"), /platform-live-entry\.js/);
  assert.match(await readFile("dist/apps/site/index.html", "utf8"), /site-live-entry\.js/);
});

test("Worker, Wrangler, Access, navigation, verification, and CI own the two new surfaces", async () => {
  const [worker, entry, wrangler, provision, verify, shell, workflow] = await Promise.all([
    read("worker/index.js"),
    read("worker/entry.js"),
    read("wrangler.jsonc"),
    read("scripts/provision-live-access.mjs"),
    read("scripts/verify-production.mjs"),
    read("shared/shell.js"),
    read(".github/workflows/deploy.yml"),
  ]);
  assert.match(worker, /"live\.idol\.id"/);
  assert.match(worker, /"mcp\.idol\.id"/);
  assert.match(entry, /handleLiveTransport/);
  assert.match(entry, /handleMcpTransport/);
  assert.match(wrangler, /"pattern": "live\.idol\.id"[\s\S]*?"custom_domain": true/);
  assert.match(wrangler, /"pattern": "mcp\.idol\.id"[\s\S]*?"custom_domain": true/);
  assert.match(provision, /live\.idol\.id\/\*/);
  assert.match(verify, /live\.idol\.id/);
  assert.match(verify, /mcp\.idol\.id/);
  assert.match(verify, /server\/discover/);
  assert.match(shell, /https:\/\/live\.idol\.id\//);
  assert.match(shell, /https:\/\/mcp\.idol\.id\//);
  assert.match(workflow, /scripts\/browser-smoke\.mjs/);
  assert.match(workflow, /scripts\/live-mcp-browser-smoke\.mjs/);
  assert.match(workflow, /scripts\/provision-platform\.mjs/);
});

test("Idol Live source bridge is admitted only as exact authored source, never as the executing implementation", async () => {
  const [model, projection, contract] = await Promise.all([
    read("live/model.id"),
    read("live/projection.id"),
    read("runtime/live-contract.json").then(JSON.parse),
  ]);
  assert.ok(model.trim().length > 0);
  assert.ok(projection.trim().length > 0);
  assert.doesNotMatch(model + projection, /\bclass\b|\bstruct\b|\bnamespace\b|\bmodule\b|\bself\b|\|>/);
  assert.equal(contract.idol_source_present, true);
  assert.equal(contract.idol_execution_admitted, false);
});
