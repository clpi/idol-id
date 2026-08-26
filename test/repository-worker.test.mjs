import test from "node:test";
import assert from "node:assert/strict";
import { handleRepositoryTransport } from "../worker/repository.js";

const platformInfo = { app: "platform", surface: "platform", origin: false };
const apiInfo = { app: "api", surface: "api", origin: true };
const identity = { subject: "user-1", email: "user@example.com", displayName: "User" };

function fakeServices() {
  const observations = new Map();
  const scaffolds = new Map();
  const requiredScopes = [];
  let index = 0;
  return {
    requiredScopes,
    platformService: {
      async session(candidate) { assert.equal(candidate.subject, identity.subject); return { profile: candidate }; },
      async authenticateApiToken(token, scope) {
        assert.equal(token, "idol_pat_example.secret");
        requiredScopes.push(scope);
        return identity;
      },
    },
    repositoryService: {
      async listObservations() { return [...observations.values()]; },
      async listScaffolds() { return [...scaffolds.values()]; },
      async saveObservation(_identity, draft) { const saved = { ...draft, id: `obs_test_identifier_${++index}` }; observations.set(saved.id, saved); return saved; },
      async getObservation(_identity, id) { const value = observations.get(id); if (!value) throw Object.assign(new Error("not found"), { code: "REPOSITORY_OBSERVATION_NOT_FOUND", status: 404 }); return value; },
      async createScaffold(_identity, observationId, input) { const saved = { id: `scf_test_identifier_${++index}`, observation_id: observationId, status: "preview", capabilities: input.capabilities, files: [], patch: "", repository_written: false }; scaffolds.set(saved.id, saved); return saved; },
      async getScaffold(_identity, id) { return scaffolds.get(id); },
    },
  };
}

function providerFetch(url) {
  if (url === "https://api.github.com/repos/acme/demo") return Promise.resolve(new Response(JSON.stringify({ private: false, default_branch: "main" })));
  if (url === "https://api.github.com/repos/acme/demo/commits/main") return Promise.resolve(new Response(JSON.stringify({ sha: "abcdef123456" })));
  if (url === "https://api.github.com/repos/acme/demo/git/trees/abcdef123456?recursive=1") return Promise.resolve(new Response(JSON.stringify({ tree: [{ type: "blob", path: "Cargo.toml", size: 10 }] })));
  throw new Error(`unexpected ${url}`);
}

function browserRequest(path, init = {}) {
  return new Request(`https://platform.idol.id${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      origin: "https://platform.idol.id",
      "x-idol-request": "browser",
      ...(init.headers || {}),
    },
  });
}

const env = {
  ACCESS_TEAM_DOMAIN: "team.example",
  REPOSITORY_ACCESS_AUD: "repo-aud",
  ACCESS_EMAIL: "user@example.com",
  PLATFORM_DB: {},
};

test("repository status is public only on Platform and names exact boundaries", async () => {
  let response = await handleRepositoryTransport(new Request("https://platform.idol.id/v1/repository/status"), env, "/v1/repository/status", platformInfo);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.visibility, "public-only");
  assert.equal(body.mutation, false);
  assert.deepEqual(body.providers, ["github", "gitlab", "bitbucket"]);
  assert.equal(body.configured.access, true);
  response = await handleRepositoryTransport(new Request("https://api.idol.id/v1/repository/status"), env, "/v1/repository/status", apiInfo);
  assert.equal(response.status, 404);
});

test("browser observe requires Access and same-origin proof before provider fetch", async () => {
  let called = false;
  const services = fakeServices();
  let response = await handleRepositoryTransport(browserRequest("/v1/repository/browser/observe", {
    method: "POST",
    headers: { origin: "https://evil.example" },
    body: JSON.stringify({ url: "https://github.com/acme/demo" }),
  }), env, "/v1/repository/browser/observe", platformInfo, {
    ...services,
    verifyAccess: async () => identity,
    providerFetcher: async (...args) => { called = true; return providerFetch(...args); },
  });
  assert.equal(response.status, 403);
  assert.equal(called, false);

  response = await handleRepositoryTransport(browserRequest("/v1/repository/browser/observe", {
    method: "POST",
    body: JSON.stringify({ url: "https://github.com/acme/demo" }),
  }), env, "/v1/repository/browser/observe", platformInfo, {
    ...services,
    verifyAccess: async () => identity,
    providerFetcher: providerFetch,
    now: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.id, /^obs_test_/);
  assert.equal(body.semantic_id, null);
  assert.equal(body.resolved_revision, "abcdef123456");
});

test("browser scaffold is preview-only and bound to the subject observation", async () => {
  const services = fakeServices();
  const dependencies = { ...services, verifyAccess: async () => identity, providerFetcher: providerFetch, now: () => "2026-08-26T12:00:00.000Z" };
  let response = await handleRepositoryTransport(browserRequest("/v1/repository/browser/observe", { method: "POST", body: JSON.stringify({ url: "https://github.com/acme/demo" }) }), env, "/v1/repository/browser/observe", platformInfo, dependencies);
  const observation = await response.json();
  response = await handleRepositoryTransport(browserRequest(`/v1/repository/browser/observations/${observation.id}/scaffolds`, { method: "POST", body: JSON.stringify({ capabilities: ["authority", "ci"] }) }), env, `/v1/repository/browser/observations/${observation.id}/scaffolds`, platformInfo, dependencies);
  assert.equal(response.status, 201);
  const scaffold = await response.json();
  assert.equal(scaffold.status, "preview");
  assert.equal(scaffold.repository_written, false);
});

test("API token routes require operation-specific repository scopes", async () => {
  const services = fakeServices();
  const request = (path, init = {}) => new Request(`https://api.idol.id${path}`, {
    ...init,
    headers: { authorization: "Bearer idol_pat_example.secret", "content-type": "application/json", ...(init.headers || {}) },
  });
  let response = await handleRepositoryTransport(request("/v1/repository/api/observations"), env, "/v1/repository/api/observations", apiInfo, services);
  assert.equal(response.status, 200);
  response = await handleRepositoryTransport(request("/v1/repository/api/observe", { method: "POST", body: JSON.stringify({ url: "https://github.com/acme/demo" }) }), env, "/v1/repository/api/observe", apiInfo, { ...services, providerFetcher: providerFetch, now: () => "2026-08-26T12:00:00.000Z" });
  assert.equal(response.status, 201);
  const observation = await response.json();
  response = await handleRepositoryTransport(request(`/v1/repository/api/observations/${observation.id}/scaffolds`, { method: "POST", body: JSON.stringify({ capabilities: ["authority"] }) }), env, `/v1/repository/api/observations/${observation.id}/scaffolds`, apiInfo, services);
  assert.equal(response.status, 201);
  assert.deepEqual(services.requiredScopes, ["repository:read", "repository:observe", "repository:scaffold"]);
});

test("repository transport refuses unadmitted provider hosts without network access", async () => {
  let called = false;
  const services = fakeServices();
  const response = await handleRepositoryTransport(browserRequest("/v1/repository/browser/observe", { method: "POST", body: JSON.stringify({ url: "https://evil.example/repo" }) }), env, "/v1/repository/browser/observe", platformInfo, {
    ...services,
    verifyAccess: async () => identity,
    providerFetcher: async () => { called = true; throw new Error("must not fetch"); },
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "REPOSITORY_PROVIDER_UNSUPPORTED");
  assert.equal(called, false);
});
