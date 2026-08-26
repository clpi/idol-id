import test from "node:test";
import assert from "node:assert/strict";
import {
  provisionPlatform,
  renderProductionWrangler,
} from "../scripts/platform-provision-lib.mjs";

function response(result, status = 200) {
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, result, errors: [] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("platform provisioning creates missing D1 and exact-owner Access resources idempotently", async () => {
  const calls = [];
  const state = { database: null, organization: null, idp: null, app: null, policy: null };
  const fetcher = async (url, init = {}) => {
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
      state.app = { id: "app-id", aud: "app-aud", name: body.name, destinations: body.destinations };
      return response(state.app);
    }
    if (path.endsWith("/access/apps/app-id/policies") && method === "GET") return response(state.policy ? [state.policy] : []);
    if (path.endsWith("/access/apps/app-id/policies") && method === "POST") {
      state.policy = { id: "policy-id", name: body.name, decision: body.decision, include: body.include };
      return response(state.policy);
    }
    throw new Error(`unexpected ${method} ${path}`);
  };

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
  assert.deepEqual(state.policy.include, [{ email: { email: "chris@pecunies.com" } }]);

  calls.length = 0;
  const second = await provisionPlatform(input);
  assert.deepEqual(second, first);
  assert.equal(calls.some((call) => call.method === "POST"), false);
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
