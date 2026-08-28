import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/entry.js";
import { createMemoryLiveStore } from "../shared/live-memory.js";
import { createPlatformService } from "../shared/platform.js";

function memoryPlatformRepository() {
  const profiles = new Map();
  const tokens = new Map();
  const audits = [];
  return {
    profiles, tokens, audits,
    async upsertProfile(identity, now) {
      const existed = profiles.has(identity.subject);
      const current = profiles.get(identity.subject) || { subject: identity.subject, created_at: now };
      const next = { ...current, email: identity.email, display_name: current.display_name || identity.displayName || identity.email, updated_at: now };
      profiles.set(identity.subject, next);
      return { profile: { ...next }, created: !existed };
    },
    async getProfile(subject) { return profiles.has(subject) ? { ...profiles.get(subject) } : null; },
    async updateProfile(subject, patch, now) { const next = { ...profiles.get(subject), ...patch, updated_at: now }; profiles.set(subject, next); return { ...next }; },
    async insertToken(record) { tokens.set(record.id, { ...record }); return { ...record }; },
    async listTokens(subject) { return [...tokens.values()].filter((record) => record.subject === subject).map(({ digest, ...record }) => ({ ...record })); },
    async getToken(id) { return tokens.has(id) ? { ...tokens.get(id) } : null; },
    async revokeToken(subject, id, now) { const record = tokens.get(id); if (!record || record.subject !== subject) return null; record.revoked_at = now; return { ...record }; },
    async touchToken(id, now) { const record = tokens.get(id); if (record) record.last_used_at = now; },
    async appendAudit(event) { audits.push(structuredClone(event)); return event; },
    async listAudit(subject, limit) { return audits.filter((event) => event.subject === subject).slice(-limit).reverse(); },
  };
}

const identity = Object.freeze({
  subject: "mcp-owner",
  email: "chris@pecunies.com",
  displayName: "Chris",
  issuer: "https://idol-clpi.cloudflareaccess.com",
  audience: "idol-platform-aud",
});

function envWithAssets() {
  const authority = { language: { commit: "authority", source_law: { sha256: "law" } }, native: { commit: "native" } };
  const files = new Map([
    ["/runtime/authority.json", ["application/json", JSON.stringify(authority)]],
    ["/runtime/worlds.json", ["application/json", JSON.stringify({ schema: "idol.web.worlds.v1", worlds: [] })]],
    ["/runtime/foreign.json", ["application/json", JSON.stringify({ schema: "idol.web.foreign.v1", worlds: [] })]],
    ["/apps/mcp/index.html", ["text/html", "<html>mcp</html>"]],
    ["/apps/site/index.html", ["text/html", "<html>site</html>"]],
  ]);
  return {
    IDOL_COMMIT: "mcp-control-plane",
    PLATFORM_DB: {},
    ASSETS: { async fetch(request) {
      const found = files.get(new URL(request.url).pathname);
      return found ? new Response(found[1], { headers: { "content-type": found[0] } }) : new Response("missing", { status: 404 });
    } },
  };
}

function randomBytesFactory() { let cursor = 13; return (length) => Uint8Array.from({ length }, () => (cursor++ * 23 + 5) & 255); }
function clock() { return "2026-08-28T21:00:00.000Z"; }
function dependencies(platformRepository) {
  return {
    platformRepository,
    liveStore: createMemoryLiveStore(),
    universeService: {
      async listViews() { return []; },
      async getView(identityValue, id) { return { id, subject: identityValue.subject, semantic_id: null, identity_status: "not-published", boundary: { semantic_universes: 1, authority_grant: "none" } }; },
    },
    now: clock,
    randomBytes: randomBytesFactory(),
    analyzeFetcher: async (url, init) => {
      assert.equal(url, "https://api.idol.id/api/analyze");
      assert.equal(init.redirect, "manual");
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify({ authority: "authority", source_size: body.source.length, graph: { nodes: [], edges: [] }, check: { ok: true } }), { headers: { "content-type": "application/json" } });
    },
  };
}

async function tokenFor(repository, scopes) {
  const service = createPlatformService({ repository, now: clock, randomBytes: randomBytesFactory() });
  await service.session(identity);
  return service.createToken(identity, { name: "hosted mcp", scopes, expires_in_days: 30 });
}

function rpc(method, params = undefined, id = 1) {
  const value = { jsonrpc: "2.0", id, method };
  if (params !== undefined) value.params = params;
  return value;
}

function mcpRequest(token, body, headers = {}) {
  const requestHeaders = new Headers({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json",
    "mcp-protocol-version": "2026-07-28",
    ...headers,
  });
  return new Request("https://mcp.idol.id/mcp", { method: "POST", headers: requestHeaders, body: JSON.stringify(body) });
}

test("modern hosted MCP is stateless, authenticated, discoverable, and cacheable", async () => {
  const repository = memoryPlatformRepository();
  const token = await tokenFor(repository, ["mcp:connect", "profile:read", "world:read", "universe:read", "live:read", "live:write", "analysis:read"]);
  const response = await handle(mcpRequest(token.token, rpc("server/discover"), { "mcp-method": "server/discover" }), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 200);
  assert.equal(response.headers.has("mcp-session-id"), false);
  const document = await response.json();
  assert.equal(document.result.protocolVersion, "2026-07-28");
  assert.equal(document.result.capabilities.tools.listChanged, false);
  assert.equal(document.result.cacheScope, "private");
  assert.ok(document.result.ttlMs > 0);
  assert.ok(document.result.supportedProtocolVersions.includes("2025-11-25"));
});

test("tools/list is deterministic and keeps operation names as tool relations, not graph edge kinds", async () => {
  const repository = memoryPlatformRepository();
  const token = await tokenFor(repository, ["mcp:connect", "profile:read", "world:read", "universe:read", "live:read", "live:write", "analysis:read"]);
  const response = await handle(mcpRequest(token.token, rpc("tools/list"), { "mcp-method": "tools/list" }), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 200);
  const document = await response.json();
  const names = document.result.tools.map((tool) => tool.name);
  assert.deepEqual(names, [...names].sort());
  for (const required of [
    "idsem.analyze",
    "idsem.authority",
    "idsem.live.application.create",
    "idsem.live.event.append",
    "idsem.live.frontier.set",
    "idsem.live.graph.get",
    "idsem.live.node.create",
    "idsem.live.project.create",
    "idsem.live.project.get",
    "idsem.live.projects.list",
    "idsem.live.world.bind",
    "idsem.profile",
    "idsem.universe.list",
    "idsem.worlds.list",
  ]) assert.ok(names.includes(required), `missing ${required}`);
});

test("tools/call delegates to one authenticated Live service and an exact fixed analysis upstream", async () => {
  const repository = memoryPlatformRepository();
  const token = await tokenFor(repository, ["mcp:connect", "profile:read", "world:read", "universe:read", "live:read", "live:write", "analysis:read"]);
  const deps = dependencies(repository);

  let response = await handle(mcpRequest(token.token, rpc("tools/call", {
    name: "idsem.live.project.create",
    arguments: { name: "MCP project", slug: "mcp-project", summary: "created through hosted MCP", visibility: "private" },
  }), { "mcp-method": "tools/call", "mcp-name": "idsem.live.project.create" }), envWithAssets(), deps);
  assert.equal(response.status, 200);
  let document = await response.json();
  assert.equal(document.result.isError, false);
  const project = document.result.structuredContent;
  assert.match(project.id, /^lp_/);

  response = await handle(mcpRequest(token.token, rpc("tools/call", {
    name: "idsem.analyze",
    arguments: { source: "answer = 42" },
  }, 2), { "mcp-method": "tools/call", "mcp-name": "idsem.analyze" }), envWithAssets(), deps);
  document = await response.json();
  assert.equal(document.result.structuredContent.source_size, 11);
  assert.equal(document.result.structuredContent.check.ok, true);
});

test("hosted MCP rejects missing scopes, unsafe origins, mismatched routing headers, oversized bodies, and arbitrary upstreams", async () => {
  const repository = memoryPlatformRepository();
  const noMcp = await tokenFor(repository, ["profile:read"]);
  let response = await handle(mcpRequest(noMcp.token, rpc("tools/list"), { "mcp-method": "tools/list" }), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "API_TOKEN_SCOPE_REFUSED");

  const token = await tokenFor(repository, ["mcp:connect", "profile:read"]);
  response = await handle(mcpRequest(token.token, rpc("tools/list"), { origin: "https://attacker.invalid", "mcp-method": "tools/list" }), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "MCP_ORIGIN_REFUSED");

  response = await handle(mcpRequest(token.token, rpc("tools/list"), { "mcp-method": "tools/call", "mcp-name": "idsem.profile" }), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "MCP_ROUTING_MISMATCH");

  response = await handle(new Request("https://mcp.idol.id/mcp", { method: "GET" }), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 405);

  const huge = "x".repeat(70 * 1024);
  response = await handle(mcpRequest(token.token, rpc("tools/call", { name: "idsem.profile", arguments: { huge } }), { "mcp-method": "tools/call", "mcp-name": "idsem.profile" }), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 413);
});

test("legacy initialize remains compatible without creating a server session", async () => {
  const repository = memoryPlatformRepository();
  const token = await tokenFor(repository, ["mcp:connect", "profile:read"]);
  const request = new Request("https://mcp.idol.id/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.token}`,
      "content-type": "application/json",
      accept: "application/json",
      "mcp-protocol-version": "2025-11-25",
    },
    body: JSON.stringify(rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } })),
  });
  const response = await handle(request, envWithAssets(), dependencies(repository));
  assert.equal(response.status, 200);
  assert.equal(response.headers.has("mcp-session-id"), false);
  const body = await response.json();
  assert.equal(body.result.protocolVersion, "2025-11-25");
  assert.equal(body.result.serverInfo.name, "idsem-hosted-mcp");
});
