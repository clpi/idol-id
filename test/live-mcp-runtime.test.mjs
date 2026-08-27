import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { handle, resolveHost } from "../worker/index.js";
import { runIdolWasmBytes } from "../shared/wasm-runtime.mjs";

function runtimeDocuments() {
  const graph = {
    schema: "idol.semantic.graph.contract.v1",
    authority: { repository: "clpi/idol", commit: "authority123", semantic_authority: true },
    identity: { exact: true, spelling_is_provenance: true },
    structural_roles: ["binding", "capture", "demand", "descriptor", "member", "operand", "origin", "projection", "provenance", "relation", "result", "subject", "target", "witness"],
    forbidden_operational_roles: ["compile", "dispatch", "execute", "parse", "read", "transform", "write"],
  };
  const live = {
    schema: "idol.live.projection.v1",
    semantic_authority: false,
    collaboration_truth: true,
    history: [{ id: "history:root", kind: "history", status: "observed" }],
    frontier: ["history:root"],
    state: { materialized_from: { history: 1, frontier: 1 }, canonical_frontiers: 1 },
    lenses: ["canon", "diff", "evidence", "git", "history", "live-map", "review", "risk", "why", "work"],
    capabilities: { realtime_store: false, git_roundtrip: false, agent_scheduler: false },
  };
  const mcp = {
    schema: "idol.mcp.projection.v1",
    protocol: "2026-07-28",
    semantic_authority: false,
    tools: [
      "idol.authority",
      "idol.graph.contract",
      "idol.graph.query",
      "idol.live.project",
      "idol.live.status",
      "idol.orientation",
      "idol.wasm.run",
      "idol.wasm.status",
    ],
  };
  const authority = { schema: "idol.web.authority.v1", language: { repository: "clpi/idol", commit: "authority123" }, native: { repository: "clpi/idol-native", commit: "native123" } };
  const runtime = { schema: "idol.web.runtime.v1", wasm: { available: false, file: null, source: "/native/semantic/runtime.id" } };
  return { graph, live, mcp, authority, runtime };
}

function envWithAssets() {
  const docs = runtimeDocuments();
  const files = new Map([
    ["/apps/live/index.html", ["text/html", "<html>Idol Live</html>"]],
    ["/apps/mcp/index.html", ["text/html", "<html>Idol MCP</html>"]],
    ["/runtime/semantic-graph-contract.json", ["application/json", JSON.stringify(docs.graph)]],
    ["/runtime/live.json", ["application/json", JSON.stringify(docs.live)]],
    ["/runtime/mcp.json", ["application/json", JSON.stringify(docs.mcp)]],
    ["/runtime/authority.json", ["application/json", JSON.stringify(docs.authority)]],
    ["/runtime/manifest.json", ["application/json", JSON.stringify(docs.runtime)]],
    ["/manifest.json", ["application/json", JSON.stringify({ schema: "idol.web.deploy.v1" })]],
  ]);
  return {
    IDOL_COMMIT: "web123",
    IDOL_AUTHORITY: "authority123",
    ASSETS: {
      async fetch(request) {
        const found = files.get(new URL(request.url).pathname);
        if (!found) return new Response("missing", { status: 404 });
        return new Response(found[1], { headers: { "content-type": found[0] } });
      },
    },
  };
}

function meta() {
  return {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { name: "idol-test", version: "1" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
}

function mcpRequest(method, params = {}, name = "") {
  const headers = {
    "content-type": "application/json",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
    origin: "https://mcp.idol.id",
  };
  if (name) headers["mcp-name"] = name;
  return new Request("https://mcp.idol.id/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { ...params, _meta: meta() } }),
  });
}

test("Live and MCP are distinct originless product surfaces", async () => {
  assert.deepEqual(resolveHost("live.idol.id"), { app: "live", surface: "live", origin: false });
  assert.deepEqual(resolveHost("mcp.idol.id"), { app: "mcp", surface: "mcp", origin: false });
  let response = await handle(new Request("https://live.idol.id/"), envWithAssets());
  assert.match(await response.text(), /Idol Live/);
  response = await handle(new Request("https://mcp.idol.id/"), envWithAssets());
  assert.match(await response.text(), /Idol MCP/);
});

test("modern MCP discovery and tool lists are stateless deterministic projections", async () => {
  let response = await handle(mcpRequest("server/discover"), envWithAssets());
  assert.equal(response.status, 200);
  let document = await response.json();
  assert.equal(document.result.resultType, "complete");
  assert.deepEqual(document.result.supportedVersions, ["2026-07-28"]);
  assert.deepEqual(document.result.capabilities, { tools: { listChanged: false } });

  response = await handle(mcpRequest("tools/list"), envWithAssets());
  document = await response.json();
  assert.equal(document.result.resultType, "complete");
  assert.equal(document.result.ttlMs, 300000);
  assert.equal(document.result.cacheScope, "public");
  const names = document.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, [...names].sort());
  assert.ok(names.includes("idol.graph.query"));
  assert.ok(names.includes("idol.live.project"));
  assert.ok(names.includes("idol.wasm.run"));
});

test("MCP rejects cross-origin calls and routing headers that disagree with the body", async () => {
  let request = mcpRequest("tools/list");
  request = new Request(request, { headers: { ...Object.fromEntries(request.headers), origin: "https://evil.example" } });
  let response = await handle(request, envWithAssets());
  assert.equal(response.status, 403);

  request = mcpRequest("tools/list");
  request = new Request(request, { headers: { ...Object.fromEntries(request.headers), "mcp-method": "tools/call" } });
  response = await handle(request, envWithAssets());
  assert.equal(response.status, 400);
});

test("MCP exposes exact authority, structural graph queries, and Live projections without inferring identity", async () => {
  let response = await handle(mcpRequest("tools/call", { name: "idol.authority", arguments: {} }, "idol.authority"), envWithAssets());
  let document = await response.json();
  assert.equal(document.result.isError, false);
  assert.equal(document.result.structuredContent.language.commit, "authority123");

  response = await handle(mcpRequest("tools/call", {
    name: "idol.graph.query",
    arguments: { role: "subject" },
  }, "idol.graph.query"), envWithAssets());
  document = await response.json();
  assert.equal(document.result.structuredContent.role, "subject");
  assert.equal(document.result.structuredContent.admitted, true);

  response = await handle(mcpRequest("tools/call", {
    name: "idol.graph.query",
    arguments: { role: "read" },
  }, "idol.graph.query"), envWithAssets());
  document = await response.json();
  assert.equal(document.result.structuredContent.admitted, false);
  assert.match(document.result.structuredContent.reason, /relation identity/i);

  response = await handle(mcpRequest("tools/call", {
    name: "idol.live.project",
    arguments: { lens: "history" },
  }, "idol.live.project"), envWithAssets());
  document = await response.json();
  assert.equal(document.result.structuredContent.lens, "history");
  assert.equal(document.result.structuredContent.canonical_frontiers, 1);
});

test("Idol Wasm runner captures WASI stdout and exit without granting host authority", async () => {
  const bytes = new Uint8Array([
    0,97,115,109,1,0,0,0,
    1,8,2,96,1,127,0,96,0,0,
    2,43,1,22,119,97,115,105,95,115,110,97,112,115,104,111,116,95,112,114,101,118,105,101,119,49,9,112,114,111,99,95,101,120,105,116,0,0,
    3,2,1,1,
    7,10,1,6,95,115,116,97,114,116,0,1,
    10,8,1,6,0,65,7,16,0,11,
  ]);
  const result = await runIdolWasmBytes(bytes);
  assert.equal(result.exitCode, 7);
  assert.equal(result.stdout, "");
  assert.equal(result.hostAuthority, "wasi-fd-write-and-proc-exit-only");
});

test("immutable build packages canonical Idol source, runtime projections, and both surfaces", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  for (const path of [
    "dist/apps/live/index.html",
    "dist/apps/mcp/index.html",
    "dist/native/semantic/runtime.id",
    "dist/runtime/semantic-graph-contract.json",
    "dist/runtime/live.json",
    "dist/runtime/mcp.json",
    "dist/shared/wasm-runtime.mjs",
  ]) await readFile(path);

  const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
  assert.equal(manifest.surfaces["live.idol.id"], "live");
  assert.equal(manifest.surfaces["mcp.idol.id"], "mcp");
  assert.equal(manifest.runtime.semantic_graph, "/runtime/semantic-graph-contract.json");
  assert.equal(manifest.runtime.live.route, "https://live.idol.id");
  assert.equal(manifest.runtime.mcp.endpoint, "https://mcp.idol.id/mcp");
});
