import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/index.js";

const identity = Object.freeze({
  subject: "access-user-1",
  email: "chris@pecunies.com",
  displayName: "Chris",
  issuer: "https://idol-clpi.cloudflareaccess.com",
  audience: "idol-platform-aud",
});

function envWithAssets() {
  return {
    IDOL_COMMIT: "program-l",
    IDOL_AUTHORITY: "f33bb3773484e7d954a2975211e683dfa89edab5",
    ACCESS_TEAM_DOMAIN: "idol-clpi.cloudflareaccess.com",
    ACCESS_AUD: "idol-platform-aud",
    ACCESS_EMAIL: "chris@pecunies.com",
    PLATFORM_DB: {},
    ASSETS: {
      async fetch() {
        return new Response("missing", { status: 404 });
      },
    },
  };
}

function browserRequest(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("origin", "https://platform.idol.id");
  headers.set("x-idol-request", "browser");
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request("https://platform.idol.id/v1/ide/analyze", {
    method: "POST",
    ...init,
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validBody(overrides = {}) {
  return {
    workspace_id: "workspace-1",
    file_id: "file-1",
    path: "src/main.id",
    source: "main() 0",
    ...overrides,
  };
}

function successfulDependencies(overrides = {}) {
  const calls = [];
  const audits = [];
  return {
    calls,
    audits,
    value: {
      verifyAccess: async () => identity,
      fetcher: async (request) => {
        calls.push(request);
        return new Response(JSON.stringify({
          graph: { nodes: [], edges: [], applications: [] },
          tokens: [{ span: [0, 4], lexical_identity: "name", binding_status: "not-published" }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
      audit: async (event) => { audits.push(structuredClone(event)); },
      now: () => "2026-08-26T07:00:00.000Z",
      idFactory: () => "audit-1",
      ...overrides,
    },
  };
}

test("IDE analysis requires independently verified Access identity on Platform", async () => {
  let response = await handle(browserRequest(validBody()), envWithAssets(), {
    verifyAccess: async () => null,
    fetcher: async () => { throw new Error("must not fetch"); },
    audit: async () => { throw new Error("must not audit"); },
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "ACCESS_IDENTITY_REQUIRED");

  response = await handle(new Request("https://api.idol.id/v1/ide/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validBody()),
  }), envWithAssets(), successfulDependencies().value);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "IDE_PLATFORM_HOST_REQUIRED");
});

test("IDE identity claims fail closed when subject email issuer or audience drift", async () => {
  const cases = [
    [{ ...identity, subject: "" }, 401, "ACCESS_IDENTITY_INVALID"],
    [{ ...identity, email: "other@example.com" }, 403, "ACCESS_IDENTITY_REFUSED"],
    [{ ...identity, audience: "other-aud" }, 401, "ACCESS_IDENTITY_INVALID"],
    [{ ...identity, issuer: "https://other.cloudflareaccess.com" }, 401, "ACCESS_IDENTITY_INVALID"],
  ];
  for (const [candidate, status, code] of cases) {
    const response = await handle(browserRequest(validBody()), envWithAssets(), {
      verifyAccess: async () => candidate,
      fetcher: async () => { throw new Error("must not fetch"); },
      audit: async () => { throw new Error("must not audit"); },
    });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, code);
  }
});

test("IDE analysis requires same-origin browser proof", async () => {
  const dependencies = successfulDependencies().value;
  let response = await handle(new Request("https://platform.idol.id/v1/ide/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validBody()),
  }), envWithAssets(), dependencies);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, "BROWSER_REQUEST_PROOF_REQUIRED");

  response = await handle(browserRequest(validBody(), {
    headers: { origin: "https://evil.example", "x-idol-request": "browser" },
  }), envWithAssets(), dependencies);
  assert.equal(response.status, 403);
  assert.equal(dependencies.calls?.length || 0, 0);
});

test("IDE analysis validates JSON bounds identifiers paths and source", async () => {
  const dependencies = successfulDependencies().value;
  let response = await handle(browserRequest("{}", { headers: { "content-type": "text/plain" } }), envWithAssets(), dependencies);
  assert.equal(response.status, 415);

  response = await handle(browserRequest("{"), envWithAssets(), dependencies);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "INVALID_JSON");

  for (const body of [
    validBody({ workspace_id: "" }),
    validBody({ file_id: "x".repeat(161) }),
    validBody({ path: "../secret" }),
    validBody({ source: "x".repeat(2 * 1024 * 1024 + 1) }),
    { ...validBody(), extra: true },
  ]) {
    response = await handle(browserRequest(body), envWithAssets(), dependencies);
    assert.ok([400, 413, 422].includes(response.status), `unexpected ${response.status}`);
  }

  response = await handle(browserRequest(validBody(), {
    headers: { "content-length": String(2 * 1024 * 1024 + 1000) },
  }), envWithAssets(), dependencies);
  assert.equal(response.status, 413);
});

test("admitted IDE analysis makes one fixed upstream call and audits metadata without source", async () => {
  const dependencies = successfulDependencies();
  const response = await handle(browserRequest(validBody()), envWithAssets(), dependencies.value);
  assert.equal(response.status, 200);
  assert.equal(dependencies.calls.length, 1);
  const upstream = dependencies.calls[0];
  assert.equal(upstream.url, "https://api.idol.id/api/analyze");
  assert.equal(upstream.method, "POST");
  assert.deepEqual(await upstream.json(), { source: "main() 0" });

  const body = await response.json();
  assert.equal(body.schema, "idol.web.ide.analysis.v1");
  assert.equal(body.capability, "remote-native");
  assert.equal(body.authority.repository, "clpi/idol");
  assert.equal(body.authority.commit, "f33bb3773484e7d954a297a6f2570475a89aa16cbda3a".replace("7021da878cf62a297a6f2570475a89aa16cbda3a", "f33bb3773484e7d954a2975211e683dfa89edab5"));
  assert.match(body.source_hash, /^[0-9a-f]{64}$/);
  assert.equal(body.result.graph.nodes.length, 0);
  assert.equal(response.headers.get("cache-control"), "no-store");

  assert.equal(dependencies.audits.length, 1);
  const audit = dependencies.audits[0];
  assert.equal(audit.type, "ide.analysis.requested");
  assert.equal(audit.subject, identity.subject);
  assert.deepEqual(audit.metadata, {
    workspace_id: "workspace-1",
    file_id: "file-1",
    path: "src/main.id",
    source_hash: body.source_hash,
    source_bytes: 8,
    upstream_status: 200,
  });
  assert.equal(JSON.stringify(audit).includes("main() 0"), false);
});

test("IDE upstream failures are bounded 502 evidence rather than Worker exceptions", async () => {
  let response = await handle(browserRequest(validBody()), envWithAssets(), successfulDependencies({
    fetcher: async () => new Response(JSON.stringify({ error: "compiler unavailable", internal: "x".repeat(5000) }), { status: 503 }),
  }).value);
  assert.equal(response.status, 502);
  let body = await response.json();
  assert.equal(body.error, "IDE_UPSTREAM_REFUSED");
  assert.equal(body.upstream_status, 503);
  assert.ok(JSON.stringify(body).length < 1500);

  response = await handle(browserRequest(validBody()), envWithAssets(), successfulDependencies({
    fetcher: async () => new Response("not json", { status: 200 }),
  }).value);
  assert.equal(response.status, 502);
  body = await response.json();
  assert.equal(body.error, "IDE_UPSTREAM_INVALID");
});

test("IDE analysis fails closed when audit storage is unavailable", async () => {
  const env = envWithAssets();
  delete env.PLATFORM_DB;
  const dependencies = successfulDependencies();
  delete dependencies.value.audit;
  const response = await handle(browserRequest(validBody()), env, dependencies.value);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "IDE_AUDIT_UNAVAILABLE");
  assert.equal(dependencies.calls.length, 0);
});
