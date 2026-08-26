import test from "node:test";
import assert from "node:assert/strict";
import { attachRepositoryAccess, provisionRepositoryAccess } from "../scripts/repository-access-lib.mjs";

const destinations = [
  { type: "public", uri: "platform.idol.id/repo*" },
  { type: "public", uri: "platform.idol.id/v1/repository/browser/*" },
];

function reply(result, status = 200) {
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, result, errors: [] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function exactPolicy(email = "owner@example.com") {
  return {
    id: "repo-policy",
    name: "Allow Idol owner email",
    decision: "allow",
    precedence: 1,
    session_duration: "24h",
    include: [{ email: { email } }],
    require: [],
    exclude: [],
  };
}

function accessFetcher(state, calls) {
  return async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method, body });
    if (path.endsWith("/access/identity_providers")) return reply([{ id: "otp", type: "onetimepin" }]);
    if (path.endsWith("/access/apps") && method === "GET") return reply(state.app ? [state.app] : []);
    if (path.endsWith("/access/apps") && method === "POST") {
      state.app = { ...body, id: "repo-app", aud: "repo-aud" };
      return reply(state.app);
    }
    if (path.endsWith("/access/apps/repo-app") && method === "PUT") {
      state.app = { ...body, id: "repo-app", aud: "repo-aud" };
      return reply(state.app);
    }
    if (path.endsWith("/access/apps/repo-app/policies") && method === "GET") return reply(state.policies || []);
    if (path.endsWith("/access/apps/repo-app/policies") && method === "POST") {
      state.policies = [{ ...body, id: "repo-policy" }];
      return reply(state.policies[0]);
    }
    if (path.endsWith("/access/apps/repo-app/policies/repo-policy") && method === "PUT") {
      state.policies = [{ ...body, id: "repo-policy" }];
      return reply(state.policies[0]);
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

test("repository Access is exact-owner, destination-bounded, and idempotent", async () => {
  const state = {};
  const calls = [];
  const first = await provisionRepositoryAccess({
    accountId: "account",
    apiToken: "token",
    bootstrapEmail: "owner@example.com",
    fetcher: accessFetcher(state, calls),
  });
  assert.equal(first.audience, "repo-aud");
  assert.deepEqual(state.app.destinations, destinations);
  assert.equal(state.app.allowed_idps[0], "otp");
  assert.deepEqual(state.policies, [exactPolicy()]);

  calls.length = 0;
  const second = await provisionRepositoryAccess({
    accountId: "account",
    apiToken: "token",
    bootstrapEmail: "owner@example.com",
    fetcher: accessFetcher(state, calls),
  });
  assert.equal(second.audience, first.audience);
  assert.equal(calls.some((call) => ["POST", "PUT"].includes(call.method)), false);
});

test("repository Access repairs drift in the named owner policy", async () => {
  const state = {
    app: {
      id: "repo-app",
      aud: "repo-aud",
      name: "Idol Repository Observatory",
      type: "self_hosted",
      destinations,
      session_duration: "24h",
      allowed_idps: ["otp"],
      auto_redirect_to_identity: true,
      app_launcher_visible: false,
      skip_interstitial: true,
      custom_deny_message: "This private Idol repository surface requires the admitted owner identity.",
    },
    policies: [{ ...exactPolicy(), include: [{ email: { email: "other@example.com" } }], require: [{ email_domain: { domain: "example.com" } }] }],
  };
  const calls = [];
  await provisionRepositoryAccess({ accountId: "account", apiToken: "token", bootstrapEmail: "owner@example.com", fetcher: accessFetcher(state, calls) });
  assert.deepEqual(state.policies, [exactPolicy()]);
  assert.equal(calls.some((call) => call.method === "PUT" && call.path.endsWith("/policies/repo-policy")), true);
});

test("repository Access rejects unrelated allow policies", async () => {
  const state = {
    app: {
      id: "repo-app",
      aud: "repo-aud",
      name: "Idol Repository Observatory",
      type: "self_hosted",
      destinations,
      session_duration: "24h",
      allowed_idps: ["otp"],
      auto_redirect_to_identity: true,
      app_launcher_visible: false,
      skip_interstitial: true,
      custom_deny_message: "This private Idol repository surface requires the admitted owner identity.",
    },
    policies: [exactPolicy(), { id: "broad", name: "Allow everyone", decision: "allow", include: [{ everyone: {} }], require: [], exclude: [] }],
  };
  await assert.rejects(
    () => provisionRepositoryAccess({ accountId: "account", apiToken: "token", bootstrapEmail: "owner@example.com", fetcher: accessFetcher(state, []) }),
    /unrelated allow policy/i,
  );
});

test("repository Access refuses destination drift rather than inheriting authority", async () => {
  const state = {
    app: {
      id: "repo-app",
      aud: "repo-aud",
      name: "Idol Repository Observatory",
      destinations: [...destinations, { type: "public", uri: "admin.example.com/*" }],
    },
  };
  await assert.rejects(
    () => provisionRepositoryAccess({ accountId: "account", apiToken: "token", bootstrapEmail: "owner@example.com", fetcher: accessFetcher(state, []) }),
    /unknown destination/,
  );
});

test("production config receives only repository Access audience", () => {
  const config = attachRepositoryAccess({ vars: { IDOL_AUTHORITY: "authority" } }, { audience: "repo-aud" });
  assert.deepEqual(config.vars, { IDOL_AUTHORITY: "authority", REPOSITORY_ACCESS_AUD: "repo-aud" });
  assert.equal(JSON.stringify(config).includes("token"), false);
});
