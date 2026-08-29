import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  LIVE_ACCESS_APPLICATION_NAME,
  LIVE_ACCESS_DESTINATION,
  LIVE_ACCESS_POLICY_NAME,
  provisionLiveAccess,
  renderLiveAccessWrangler,
} from "../scripts/live-access-lib.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function response(result, status = 200) {
  return new Response(JSON.stringify({ success: status >= 200 && status < 300, result, errors: [] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readyState(overrides = {}) {
  return {
    platform: {
      id: "platform-app",
      name: "Idol Platform Browser Identity",
      aud: "platform-aud",
      allowed_idps: ["otp-id"],
      destinations: [{ type: "public", uri: "platform.idol.id/ide*" }],
    },
    live: {
      id: "live-app",
      aud: "live-aud",
      name: LIVE_ACCESS_APPLICATION_NAME,
      type: "self_hosted",
      destinations: [{ ...LIVE_ACCESS_DESTINATION }],
      session_duration: "24h",
      allowed_idps: ["otp-id"],
      auto_redirect_to_identity: true,
      app_launcher_visible: false,
      skip_interstitial: true,
      custom_deny_message: "This private Idol Live surface requires the admitted owner identity.",
    },
    policy: {
      id: "live-policy",
      name: LIVE_ACCESS_POLICY_NAME,
      decision: "allow",
      include: [{ email: { email: "chris@pecunies.com" } }],
    },
    ...overrides,
  };
}

function liveFetcher(state, calls) {
  return async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method, body });

    if (path.endsWith("/access/apps/platform-app") && method === "GET") return response(state.platform);
    if (path.endsWith("/access/apps") && method === "GET") return response([state.platform, ...(state.live ? [state.live] : [])]);
    if (path.endsWith("/access/apps") && method === "POST") {
      state.live = { ...body, id: "live-app", aud: "live-aud" };
      return response(state.live);
    }
    if (path.endsWith("/access/apps/live-app") && method === "PUT") {
      state.live = { ...body, id: "live-app", aud: "live-aud" };
      return response(state.live);
    }
    if (path.endsWith("/access/apps/live-app/policies") && method === "GET") return response(state.policy ? [state.policy] : []);
    if (path.endsWith("/access/apps/live-app/policies") && method === "POST") {
      state.policy = { id: "live-policy", ...body };
      return response(state.policy);
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
}

async function provision(state, calls = []) {
  return provisionLiveAccess({
    accountId: "account",
    apiToken: "secret",
    bootstrapEmail: "chris@pecunies.com",
    platformApplicationId: "platform-app",
    fetcher: liveFetcher(state, calls),
  });
}

test("Live creates an independent one-destination Access application and exact-owner policy", async () => {
  const calls = [];
  const state = readyState({ live: null, policy: null });
  const result = await provision(state, calls);

  assert.deepEqual(result, {
    accessApplicationId: "live-app",
    accessAudience: "live-aud",
    bootstrapEmail: "chris@pecunies.com",
    destination: "live.idol.id/*",
  });
  assert.equal(state.live.name, LIVE_ACCESS_APPLICATION_NAME);
  assert.deepEqual(state.live.destinations, [LIVE_ACCESS_DESTINATION]);
  assert.deepEqual(state.live.allowed_idps, ["otp-id"]);
  assert.deepEqual(state.policy.include, [{ email: { email: "chris@pecunies.com" } }]);
  assert.equal(calls.some((call) => call.method === "PUT" && call.path.endsWith("/access/apps/platform-app")), false);
});

test("Live Access provisioning is idempotent and never mutates the Platform application", async () => {
  const calls = [];
  const state = readyState();
  const result = await provision(state, calls);

  assert.equal(result.accessAudience, "live-aud");
  assert.equal(calls.some((call) => ["POST", "PUT", "PATCH", "DELETE"].includes(call.method)), false);
  assert.equal(calls.filter((call) => call.path.endsWith("/access/apps/platform-app")).length, 1);
});

test("Live Access refuses unrelated destination drift before updating anything", async () => {
  const calls = [];
  const state = readyState({
    live: {
      ...readyState().live,
      destinations: [{ type: "public", uri: "admin.example.com/*" }],
    },
  });

  await assert.rejects(() => provision(state, calls), /unknown destination/);
  assert.equal(calls.some((call) => call.method === "PUT"), false);
});

test("Live Access repairs admitted application drift without broadening its destination", async () => {
  const calls = [];
  const state = readyState({ live: { ...readyState().live, session_duration: "1h", allowed_idps: ["other"] } });
  await provision(state, calls);

  const update = calls.find((call) => call.method === "PUT" && call.path.endsWith("/access/apps/live-app"));
  assert.ok(update);
  assert.deepEqual(update.body.destinations, [LIVE_ACCESS_DESTINATION]);
  assert.deepEqual(update.body.allowed_idps, ["otp-id"]);
});

test("production Wrangler keeps Platform and Live JWT audiences distinct", () => {
  const rendered = renderLiveAccessWrangler({
    name: "idol-id",
    vars: { ACCESS_AUD: "platform-aud", ACCESS_TEAM_DOMAIN: "idol-clpi.cloudflareaccess.com" },
  }, { accessAudience: "live-aud" });

  assert.equal(rendered.vars.ACCESS_AUD, "platform-aud");
  assert.equal(rendered.vars.LIVE_ACCESS_AUD, "live-aud");
});

test("deployment and Worker consume the separate Live audience without destination append logic", async () => {
  const [provisionSource, worker] = await Promise.all([
    read("scripts/provision-live-access.mjs"),
    read("worker/live.js"),
  ]);

  assert.match(provisionSource, /LIVE_ACCESS_APPLICATION_NAME/);
  assert.match(provisionSource, /LIVE_ACCESS_AUD/);
  assert.doesNotMatch(provisionSource, /destinations\.push\(liveDestination\)/);
  assert.match(worker, /audience:\s*env\.LIVE_ACCESS_AUD/);
  assert.doesNotMatch(worker, /audience:\s*env\.ACCESS_AUD/);
});
