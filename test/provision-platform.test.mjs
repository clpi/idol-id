import test from "node:test";
import assert from "node:assert/strict";
import {
  provisionPlatform,
  renderProductionWrangler,
} from "../scripts/platform-provision-lib.mjs";

const REQUIRED_DESTINATIONS = [
  { type: "public", uri: "platform.idol.id/ide*" },
  { type: "public", uri: "platform.idol.id/v1/ide/*" },
  { type: "public", uri: "platform.idol.id/v1/platform/browser/*" },
];

function response(result, status = 200) {
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, result, errors: [] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function platformFetcher(state, calls) {
  return async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method, body });

    if (path.endsWith("/d1/database") && method === "GET") return response(state.database ? [state.database] : []);
    if (path.endsWith("/d1/database") && method === "POST") {
      state.database = { uuid: "d1-uuid", name: body.name };
      return response(state.database);
    }
    if (path.endsWith("/access/organizations") && method === "GET") return state.organization ? response(state.organization) : response(null, 404);
    if (path.endsWith("/access/organizations") && method === "POST") {
      state.organization = { name: body.name, auth_domain: "idol-clpi.cloudflareaccess.com" };
      return response(state.organization);
    }
    if (path.endsWith("/access/identity_providers") && method === "GET") return response(state.idp ? [state.idp] : []);
    if (path.endsWith("/access/identity_providers") && method === "POST") {
      state.idp = { id: "otp-id", name: body.name, type: "onetimepin" };
      return response(state.idp);
    }
    if (path.endsWith("/access/apps") && method === "GET") return response(state.app ? [state.app] : []);
    if (path.endsWith("/access/apps") && method === "POST") {
      state.app = { id: "app-id", aud: "app-aud", name: body.name, type: body.type, destinations: body.destinations };
      return response(state.app);
    }
    if (path.endsWith("/access/apps/app-id") && method === "PUT") {
      state.app = { ...state.app, ...body, id: "app-id", aud: "app-aud" };
      return response(state.app);
    }
    if (path.endsWith("/access/apps/app-id/policies") && method === "GET") return response(state.policy ? [state.policy] : []);
    if (path.endsWith("/access/apps/app-id/policies") && method === "POST") {
      state.policy = { id: "policy-id", name: body.name, decision: body.decision, include: body.include };
      return response(state.policy);
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

function readyState(overrides = {}) {
  return {
    database: { uuid: "d1-uuid", name: "idol-platform" },
    organization: { name: "idol-clpi", auth_domain: "idol-clpi.cloudflareaccess.com" },
    idp: { id: "otp-id", name: "One-time PIN", type: "onetimepin" },
    app: {
      id: "app-id",
      aud: "app-aud",
      name: "Idol Platform Browser Identity",
      type: "self_hosted",
      destinations: REQUIRED_DESTINATIONS,
    },
    policy: {
      id: "policy-id",
      name: "Allow Idol owner email",
      decision: "allow",
      include: [{ email: { email: "chris@pecunies.com" } }],
    },
    ...overrides,
  };
}

test("platform provisioning creates missing D1 and exact-owner Access resources idempotently", async () => {
  const calls = [];
  const state = { database: null, organization: null, idp: null, app: null, policy: null };
  const fetcher = platformFetcher(state, calls);

  const input = {
    accountId: "account",
    apiToken: "secret",
    bootstrapEmail: "chris@pecunies.com",
    fetcher,
  };
  const first = await provisionPlatform(input);
  assert.deepEqual(first, {
    databaseId: "d1-uuid",
    databaseName: "idol-platform",
    teamDomain: "idol-clpi.cloudflareaccess.com",
    accessApplicationId: "app-id",
    accessAudience: "app-aud",
    bootstrapEmail: "chris@pecunies.com",
  });
  assert.ok(calls.some((call) => call.method === "POST" && call.path.endsWith("/d1/database")));
  assert.ok(calls.some((call) => call.method === "POST" && call.path.endsWith("/access/apps")));
  assert.deepEqual(state.app.destinations, REQUIRED_DESTINATIONS);
  assert.deepEqual(state.policy.include, [{ email: { email: "chris@pecunies.com" } }]);

  calls.length = 0;
  const second = await provisionPlatform(input);
  assert.deepEqual(second, first);
  assert.equal(calls.some((call) => ["POST", "PUT", "PATCH", "DELETE"].includes(call.method)), false);
});

test("platform provisioning upgrades the known browser-only Access destination set", async () => {
  const calls = [];
  const state = readyState({
    app: {
      id: "app-id",
      aud: "app-aud",
      name: "Idol Platform Browser Identity",
      type: "self_hosted",
      destinations: [{ type: "public", uri: "platform.idol.id/v1/platform/browser/*" }],
    },
  });
  const result = await provisionPlatform({
    accountId: "account",
    apiToken: "secret",
    bootstrapEmail: "chris@pecunies.com",
    fetcher: platformFetcher(state, calls),
  });
  assert.equal(result.accessApplicationId, "app-id");
  assert.deepEqual(state.app.destinations, REQUIRED_DESTINATIONS);
  const update = calls.find((call) => call.method === "PUT" && call.path.endsWith("/access/apps/app-id"));
  assert.ok(update);
  assert.deepEqual(update.body.destinations, REQUIRED_DESTINATIONS);
});

test("platform provisioning refuses unrelated Access destination drift", async () => {
  const calls = [];
  const state = readyState({
    app: {
      id: "app-id",
      aud: "app-aud",
      name: "Idol Platform Browser Identity",
      type: "self_hosted",
      destinations: [
        { type: "public", uri: "platform.idol.id/v1/platform/browser/*" },
        { type: "public", uri: "admin.example.com/*" },
      ],
    },
  });
  await assert.rejects(() => provisionPlatform({
    accountId: "account",
    apiToken: "secret",
    bootstrapEmail: "chris@pecunies.com",
    fetcher: platformFetcher(state, calls),
  }), /unknown destination/);
  assert.equal(calls.some((call) => call.method === "PUT"), false);
});

test("generated production Wrangler config binds D1, Access, and immutable web identity without secrets", () => {
  const base = {
    name: "idol-id",
    main: "./worker/index.js",
    vars: { IDOL_AUTHORITY: "authority" },
  };
  const rendered = renderProductionWrangler(base, {
    databaseId: "d1-uuid",
    databaseName: "idol-platform",
    teamDomain: "idol-clpi.cloudflareaccess.com",
    accessAudience: "app-aud",
    bootstrapEmail: "chris@pecunies.com",
  }, { webCommit: "web-sha" });
  assert.deepEqual(rendered.d1_databases, [{ binding: "PLATFORM_DB", database_name: "idol-platform", database_id: "d1-uuid", migrations_dir: "migrations" }]);
  assert.deepEqual(rendered.vars, {
    IDOL_AUTHORITY: "authority",
    IDOL_COMMIT: "web-sha",
    ACCESS_TEAM_DOMAIN: "idol-clpi.cloudflareaccess.com",
    ACCESS_AUD: "app-aud",
    ACCESS_EMAIL: "chris@pecunies.com",
  });
  assert.equal(JSON.stringify(rendered).includes("secret"), false);
});
