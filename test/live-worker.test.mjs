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
      const current = profiles.get(identity.subject) || { subject: identity.subject, created_at: now };
      const next = { ...current, email: identity.email, display_name: current.display_name || identity.displayName || identity.email, updated_at: now };
      profiles.set(identity.subject, next);
      return { profile: { ...next }, created: !current.email };
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
  subject: "access-live-owner",
  email: "chris@pecunies.com",
  displayName: "Chris",
  issuer: "https://idol-clpi.cloudflareaccess.com",
  audience: "idol-platform-aud",
});

function envWithAssets() {
  const files = new Map([
    ["/apps/live/index.html", ["text/html", "<html>live</html>"]],
    ["/apps/site/index.html", ["text/html", "<html>site</html>"]],
    ["/runtime/authority.json", ["application/json", JSON.stringify({ language: { commit: "authority", source_law: { sha256: "law" } }, native: { commit: "native" } })]],
    ["/runtime/worlds.json", ["application/json", JSON.stringify({ worlds: [] })]],
    ["/runtime/foreign.json", ["application/json", JSON.stringify({ worlds: [] })]],
    ["/manifest.json", ["application/json", "{\"ok\":true}"]],
  ]);
  return {
    IDOL_COMMIT: "live-control-plane",
    ACCESS_TEAM_DOMAIN: "idol-clpi.cloudflareaccess.com",
    ACCESS_AUD: "idol-platform-aud",
    ACCESS_EMAIL: "chris@pecunies.com",
    PLATFORM_DB: {},
    ASSETS: { async fetch(request) {
      const found = files.get(new URL(request.url).pathname);
      return found ? new Response(found[1], { headers: { "content-type": found[0] } }) : new Response("missing", { status: 404 });
    } },
  };
}

function clock() { return "2026-08-28T20:00:00.000Z"; }
function randomBytesFactory() { let cursor = 3; return (length) => Uint8Array.from({ length }, () => (cursor++ * 17 + 11) & 255); }
function dependencies(platformRepository, authenticated = true) {
  return {
    platformRepository,
    liveStore: createMemoryLiveStore(),
    universeService: {
      async getView(rawIdentity, id) {
        if (rawIdentity.subject !== identity.subject || id !== "uv_live_worlds") throw new Error("universe view not found");
        return { id, semantic_id: null, identity_status: "not-published", boundary: { semantic_universes: 1, authority_grant: "none" } };
      },
    },
    verifyAccess: async () => authenticated ? identity : null,
    now: clock,
    randomBytes: randomBytesFactory(),
  };
}

function browserRequest(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("origin", "https://live.idol.id");
  headers.set("x-idol-request", "browser");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`https://live.idol.id${path}`, { ...init, headers });
}

async function createToken(platformRepository, scopes) {
  const platform = createPlatformService({ repository: platformRepository, now: clock, randomBytes: randomBytesFactory() });
  await platform.session(identity);
  return platform.createToken(identity, { name: "live integration", scopes, expires_in_days: 30 });
}

test("Live status is public only on the Live surface and publishes exact authority boundaries", async () => {
  const repo = memoryPlatformRepository();
  let response = await handle(new Request("https://live.idol.id/v1/live/status"), envWithAssets(), dependencies(repo, false));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schema, "idol.web.live.status.v1");
  assert.equal(body.semantic_authority, false);
  assert.equal(body.semantic_universes, 1);
  assert.equal(body.accepted_frontiers_per_project, 1);
  assert.equal(body.dispatcher_access, false);

  response = await handle(new Request("https://api.idol.id/v1/live/status"), envWithAssets(), dependencies(repo, false));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "LIVE_STATUS_HOST_REQUIRED");
});

test("Live browser routes require Access identity and exact same-origin mutation proof", async () => {
  const repo = memoryPlatformRepository();
  let response = await handle(new Request("https://live.idol.id/v1/live/browser/session"), envWithAssets(), dependencies(repo, false));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "ACCESS_IDENTITY_REQUIRED");

  const deps = dependencies(repo, true);
  response = await handle(new Request("https://live.idol.id/v1/live/browser/session"), envWithAssets(), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).profile.email, identity.email);

  response = await handle(new Request("https://live.idol.id/v1/live/browser/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "bad", slug: "bad", summary: "missing proof", visibility: "private" }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "BROWSER_REQUEST_PROOF_REQUIRED");
});

test("authenticated browser can create a project, populate its exact graph, and bind a Universe View", async () => {
  const repo = memoryPlatformRepository();
  const deps = dependencies(repo, true);
  let response = await handle(browserRequest("/v1/live/browser/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Idol", slug: "idol", summary: "one canon", visibility: "private" }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 201);
  const project = await response.json();

  response = await handle(browserRequest(`/v1/live/browser/projects/${project.id}/nodes`, {
    method: "POST",
    body: JSON.stringify({ category: "goal", label: "one graph", summary: "one exact semantic graph", data: {} }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 201);
  const goal = await response.json();

  response = await handle(browserRequest(`/v1/live/browser/projects/${project.id}/nodes`, {
    method: "POST",
    body: JSON.stringify({ category: "task", label: "publish facts", summary: "publish application facts", data: {} }),
  }), envWithAssets(), deps);
  const task = await response.json();

  response = await handle(browserRequest(`/v1/live/browser/projects/${project.id}/applications`, {
    method: "POST",
    body: JSON.stringify({ relation: "requires", subject: task.id, target: goal.id, operands: [], results: [], worlds: [], witnesses: [], demand: {}, provenance: {} }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 201);
  const application = await response.json();

  response = await handle(browserRequest(`/v1/live/browser/projects/${project.id}/events`, {
    method: "POST",
    body: JSON.stringify({ kind: "attempted", predecessor_ids: [], intent_id: null, application_ids: [application.id], payload: {} }),
  }), envWithAssets(), deps);
  const event = await response.json();

  response = await handle(browserRequest(`/v1/live/browser/projects/${project.id}/frontier`, {
    method: "POST",
    body: JSON.stringify({ event_id: event.id, state: "admitted", reason: "reviewed" }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 200);

  response = await handle(browserRequest(`/v1/live/browser/projects/${project.id}/world-view`, {
    method: "PUT",
    body: JSON.stringify({ universe_view_id: "uv_live_worlds" }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).world_binding.authority_grant, "none");

  response = await handle(new Request(`https://live.idol.id/v1/live/browser/projects/${project.id}/graph`), envWithAssets(), deps);
  const graph = await response.json();
  assert.equal(graph.edges.some((edge) => edge.role === "requires"), false);
  assert.equal(graph.frontier.admitted_event_ids.length, 1);
});

test("API tokens with live scopes can manage only their subject-owned projects", async () => {
  const repo = memoryPlatformRepository();
  const token = await createToken(repo, ["live:read", "live:write", "mcp:connect", "profile:read"]);
  const deps = dependencies(repo, false);

  let response = await handle(new Request("https://api.idol.id/v1/live/api/projects", {
    method: "POST",
    headers: { authorization: `Bearer ${token.token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "API project", slug: "api-project", summary: "created by exact token", visibility: "private" }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 201);
  const project = await response.json();

  response = await handle(new Request("https://api.idol.id/v1/live/api/projects", {
    headers: { authorization: `Bearer ${token.token}` },
  }), envWithAssets(), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).projects[0].id, project.id);

  response = await handle(new Request("https://live.idol.id/v1/live/api/projects", {
    headers: { authorization: `Bearer ${token.token}` },
  }), envWithAssets(), deps);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "LIVE_API_HOST_REQUIRED");
});
