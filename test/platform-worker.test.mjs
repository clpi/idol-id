import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/index.js";

function memoryRepository() {
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
    async listTokens(subject) { return [...tokens.values()].filter((x) => x.subject === subject).map(({ digest, ...x }) => x); },
    async getToken(id) { return tokens.has(id) ? { ...tokens.get(id) } : null; },
    async revokeToken(subject, id, now) { const token = tokens.get(id); if (!token || token.subject !== subject) return null; token.revoked_at = now; return { ...token }; },
    async touchToken(id, now) { const token = tokens.get(id); if (token) token.last_used_at = now; },
    async appendAudit(event) { audits.push({ ...event }); return event; },
    async listAudit(subject, limit) { return audits.filter((x) => x.subject === subject).slice(-limit).reverse(); },
  };
}

function envWithAssets() {
  const files = new Map([
    ["/apps/platform/index.html", ["text/html", "<html>platform</html>"]],
    ["/apps/site/index.html", ["text/html", "<html>site</html>"]],
    ["/manifest.json", ["application/json", "{\"ok\":true}"]],
  ]);
  return {
    IDOL_COMMIT: "program-k",
    IDOL_AUTHORITY: "authority",
    ACCESS_TEAM_DOMAIN: "idol-clpi.cloudflareaccess.com",
    ACCESS_AUD: "idol-platform-aud",
    ACCESS_EMAIL_DOMAIN: "pecunies.com",
    PLATFORM_DB: {},
    ASSETS: { async fetch(request) {
      const found = files.get(new URL(request.url).pathname);
      return found ? new Response(found[1], { headers: { "content-type": found[0] } }) : new Response("missing", { status: 404 });
    } },
  };
}

const identity = {
  subject: "access-user-1",
  email: "chris@pecunies.com",
  displayName: "Chris",
  issuer: "https://idol-clpi.cloudflareaccess.com",
  audience: "idol-platform-aud",
};

function dependencies(repository, authenticated = true) {
  let cursor = 0;
  return {
    platformRepository: repository,
    verifyAccess: async () => authenticated ? identity : null,
    now: () => "2026-08-25T20:00:00.000Z",
    randomBytes: (length) => Uint8Array.from({ length }, () => (cursor++ * 19 + 5) & 255),
  };
}

function browserRequest(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("origin", "https://platform.idol.id");
  headers.set("x-idol-request", "browser");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`https://platform.idol.id${path}`, { ...init, headers });
}

test("platform status is public and reports exact provisioning boundaries", async () => {
  const response = await handle(new Request("https://platform.idol.id/v1/platform/status"), envWithAssets(), dependencies(memoryRepository(), false));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.configured, { access: true, storage: true });
  assert.equal(body.authority, "transport identity only; no Idol world grant");
});

test("browser session requires independently verified Access identity", async () => {
  const response = await handle(new Request("https://platform.idol.id/v1/platform/browser/session"), envWithAssets(), dependencies(memoryRepository(), false));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "ACCESS_IDENTITY_REQUIRED");
});

test("Access login initializes the profile and redirects to the account console", async () => {
  const repository = memoryRepository();
  const response = await handle(new Request("https://platform.idol.id/v1/platform/browser/login"), envWithAssets(), dependencies(repository));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://platform.idol.id/#account");
  assert.equal(repository.profiles.get(identity.subject).email, identity.email);
  assert.equal(repository.audits.at(-1).type, "profile.created");
});

test("authenticated browser can create profile and manage digest-only tokens", async () => {
  const repository = memoryRepository();
  const deps = dependencies(repository);
  let response = await handle(new Request("https://platform.idol.id/v1/platform/browser/session"), envWithAssets(), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).profile.email, identity.email);

  response = await handle(browserRequest("/v1/platform/browser/profile", {
    method: "PATCH",
    body: JSON.stringify({ display_name: "Chris P" }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).display_name, "Chris P");

  response = await handle(browserRequest("/v1/platform/browser/tokens", {
    method: "POST",
    body: JSON.stringify({ name: "cli", scopes: ["profile:read", "world:read"], expires_in_days: 30 }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.match(created.token, /^idol_pat_/);
  assert.equal(repository.tokens.get(created.id).digest === created.token, false);

  response = await handle(new Request("https://platform.idol.id/v1/platform/browser/tokens"), envWithAssets(), deps);
  const listed = await response.json();
  assert.equal(listed.tokens.length, 1);
  assert.equal("token" in listed.tokens[0], false);
  assert.equal("digest" in listed.tokens[0], false);

  response = await handle(new Request("https://api.idol.id/v1/platform/api/whoami", {
    headers: { authorization: `Bearer ${created.token}` },
  }), envWithAssets(), dependencies(repository, false));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).principal.kind, "api-token");

  response = await handle(browserRequest(`/v1/platform/browser/tokens/${created.id}/revoke`, { method: "POST" }), envWithAssets(), deps);
  assert.equal(response.status, 200);

  response = await handle(new Request("https://api.idol.id/v1/platform/api/whoami", {
    headers: { authorization: `Bearer ${created.token}` },
  }), envWithAssets(), dependencies(repository, false));
  assert.equal(response.status, 401);

  response = await handle(new Request("https://platform.idol.id/v1/platform/browser/audit"), envWithAssets(), deps);
  const audit = await response.json();
  assert.deepEqual(audit.events.map((event) => event.type), ["token.revoked", "token.used", "token.created", "profile.updated", "profile.created"]);
});

test("browser mutations require same-origin custom-header CSRF evidence", async () => {
  const repository = memoryRepository();
  const deps = dependencies(repository);
  await handle(new Request("https://platform.idol.id/v1/platform/browser/session"), envWithAssets(), deps);
  const response = await handle(new Request("https://platform.idol.id/v1/platform/browser/tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "bad", scopes: ["profile:read"], expires_in_days: 30 }),
  }), envWithAssets(), deps);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "BROWSER_REQUEST_PROOF_REQUIRED");
});

test("private platform routes fail closed when D1 is not bound", async () => {
  const env = envWithAssets();
  delete env.PLATFORM_DB;
  const response = await handle(new Request("https://platform.idol.id/v1/platform/browser/session"), env, { verifyAccess: async () => identity });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PLATFORM_STORAGE_UNAVAILABLE");
});
