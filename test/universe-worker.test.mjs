import test from "node:test";
import assert from "node:assert/strict";
import { handleUniverseTransport } from "../worker/universe.js";

const platformInfo = { app: "platform", surface: "platform", origin: false };
const apiInfo = { app: "api", surface: "api", origin: true };
const worldsInfo = { app: "worlds", surface: "worlds", origin: false };
const libInfo = { app: "lib", surface: "lib", origin: true };
const identity = { subject: "user-1", email: "user@example.com", displayName: "User" };
const env = {
  ACCESS_TEAM_DOMAIN: "team.example",
  ACCESS_AUD: "platform-aud",
  ACCESS_EMAIL: "user@example.com",
  PLATFORM_DB: {},
};

function browserRequest(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("origin", "https://platform.idol.id");
  headers.set("x-idol-request", "browser");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return new Request(`https://platform.idol.id${path}`, { ...init, headers });
}

function fakeServices() {
  const views = new Map();
  const requiredScopes = [];
  let index = 0;
  const service = {
    async listViews(candidate) {
      return [...views.values()].filter((view) => view.subject === candidate.subject).map(({ subject, ...view }) => view);
    },
    async listPublicViews(limit = 50) {
      return [...views.values()].filter((view) => view.visibility === "public").slice(0, limit).map(({ subject, ...view }) => view);
    },
    async createView(candidate, input) {
      const id = `uv_test_identifier_${++index}`;
      const view = {
        schema: "idol.web.universe.view.v1",
        id,
        semantic_id: null,
        identity_status: "not-published",
        subject: candidate.subject,
        title: input.title,
        visibility: input.visibility || "private",
        lens: input.lens || "constellation",
        selections: input.selections,
        resolved: [],
        analysis: { selection_count: input.selections.length, violation_count: 0 },
        boundary: { composition: "not-proven", authority_grant: "none" },
      };
      views.set(id, view);
      const { subject, ...visible } = view;
      return visible;
    },
    async getView(candidate, id) {
      const view = views.get(id);
      if (!view || view.subject !== candidate.subject) throw Object.assign(new Error("not found"), { code: "UNIVERSE_VIEW_NOT_FOUND", status: 404 });
      const { subject, ...visible } = view;
      return visible;
    },
    async updateView(candidate, id, input) {
      const current = views.get(id);
      if (!current || current.subject !== candidate.subject) throw Object.assign(new Error("not found"), { code: "UNIVERSE_VIEW_NOT_FOUND", status: 404 });
      const selections = input.selections ?? current.selections;
      const updated = {
        ...current,
        ...input,
        id: current.id,
        subject: current.subject,
        title: input.title ?? current.title,
        visibility: input.visibility ?? current.visibility,
        lens: input.lens ?? current.lens,
        selections,
        analysis: { ...current.analysis, selection_count: selections.length },
      };
      views.set(id, updated);
      const { subject, ...visible } = updated;
      return visible;
    },
    async getPublicView(id) {
      const view = views.get(id);
      if (!view || view.visibility !== "public") throw Object.assign(new Error("not found"), { code: "UNIVERSE_VIEW_NOT_FOUND", status: 404 });
      const { subject, ...visible } = view;
      return visible;
    },
  };
  return {
    views,
    requiredScopes,
    universeService: service,
    verifyAccess: async () => identity,
    platformService: {
      async authenticateApiToken(token, scope) {
        assert.equal(token, "idol_pat_example.secret");
        requiredScopes.push(scope);
        return identity;
      },
    },
  };
}

const privateInput = {
  title: "Private constellation",
  visibility: "private",
  lens: "constellation",
  selections: [{ source: "published", key: "io@0.1.0" }],
};

test("universe status exposes one-universe and no-authority boundary on Platform", async () => {
  let response = await handleUniverseTransport(new Request("https://platform.idol.id/v1/universe/status"), env, "/v1/universe/status", platformInfo);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.semantic_universes, 1);
  assert.equal(body.view_kind, "operational-projection");
  assert.equal(body.composition, false);
  assert.equal(body.authority_grant, false);
  response = await handleUniverseTransport(new Request("https://api.idol.id/v1/universe/status"), env, "/v1/universe/status", apiInfo);
  assert.equal(response.status, 404);
});

test("browser view creation and update require Access, same-origin proof, and stable identity", async () => {
  const services = fakeServices();
  let response = await handleUniverseTransport(new Request("https://platform.idol.id/v1/universe/browser/views", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example", "x-idol-request": "browser" },
    body: JSON.stringify(privateInput),
  }), env, "/v1/universe/browser/views", platformInfo, services);
  assert.equal(response.status, 403);
  assert.equal(services.views.size, 0);

  response = await handleUniverseTransport(browserRequest("/v1/universe/browser/views", {
    method: "POST",
    body: JSON.stringify(privateInput),
  }), env, "/v1/universe/browser/views", platformInfo, services);
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.match(created.id, /^uv_test_identifier_/);
  assert.equal(created.semantic_id, null);
  assert.equal(created.boundary.composition, "not-proven");

  response = await handleUniverseTransport(browserRequest(`/v1/universe/browser/views/${created.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "Updated constellation" }),
  }), env, `/v1/universe/browser/views/${created.id}`, platformInfo, services);
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.id, created.id);
  assert.equal(updated.title, "Updated constellation");
  assert.equal(services.views.size, 1);
});

test("private views never cross into either public projection", async () => {
  const services = fakeServices();
  let response = await handleUniverseTransport(browserRequest("/v1/universe/browser/views", {
    method: "POST",
    body: JSON.stringify(privateInput),
  }), env, "/v1/universe/browser/views", platformInfo, services);
  const privateView = await response.json();

  for (const [host, info] of [["worlds.idol.id", worldsInfo], ["lib.idol.id", libInfo]]) {
    response = await handleUniverseTransport(new Request(`https://${host}/v1/universe/public/${privateView.id}`), env, `/v1/universe/public/${privateView.id}`, info, services);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "UNIVERSE_VIEW_NOT_FOUND");
  }
});

test("public views are readable through canonical Worlds and the Lib contextual lens", async () => {
  const services = fakeServices();
  let response = await handleUniverseTransport(browserRequest("/v1/universe/browser/views", {
    method: "POST",
    body: JSON.stringify({ ...privateInput, title: "Public constellation", visibility: "public" }),
  }), env, "/v1/universe/browser/views", platformInfo, services);
  const publicView = await response.json();

  for (const [host, info] of [["worlds.idol.id", worldsInfo], ["lib.idol.id", libInfo]]) {
    response = await handleUniverseTransport(new Request(`https://${host}/v1/universe/public/${publicView.id}`), env, `/v1/universe/public/${publicView.id}`, info, services);
    assert.equal(response.status, 200);
    const published = await response.json();
    assert.equal(published.visibility, "public");
    assert.equal("subject" in published, false);

    response = await handleUniverseTransport(new Request(`https://${host}/v1/universe/public`), env, "/v1/universe/public", info, services);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).views.length, 1);
  }

  response = await handleUniverseTransport(new Request("https://api.idol.id/v1/universe/public"), env, "/v1/universe/public", apiInfo, services);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "UNIVERSE_PUBLIC_HOST_REQUIRED");
});

test("API routes require operation-specific universe scopes", async () => {
  const services = fakeServices();
  const request = (path, init = {}) => new Request(`https://api.idol.id${path}`, {
    ...init,
    headers: { authorization: "Bearer idol_pat_example.secret", "content-type": "application/json", ...(init.headers || {}) },
  });
  let response = await handleUniverseTransport(request("/v1/universe/api/views"), env, "/v1/universe/api/views", apiInfo, services);
  assert.equal(response.status, 200);
  response = await handleUniverseTransport(request("/v1/universe/api/views", { method: "POST", body: JSON.stringify(privateInput) }), env, "/v1/universe/api/views", apiInfo, services);
  assert.equal(response.status, 201);
  const created = await response.json();
  response = await handleUniverseTransport(request(`/v1/universe/api/views/${created.id}`), env, `/v1/universe/api/views/${created.id}`, apiInfo, services);
  assert.equal(response.status, 200);
  assert.deepEqual(services.requiredScopes, ["universe:read", "universe:write", "universe:read"]);
});

test("Universe transport refuses wrong hosts without leaking private state", async () => {
  const services = fakeServices();
  const response = await handleUniverseTransport(browserRequest("/v1/universe/browser/views"), env, "/v1/universe/browser/views", worldsInfo, services);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "UNIVERSE_BROWSER_HOST_REQUIRED");
});
