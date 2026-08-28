import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/index.js";

const foreign = {
  schema: "idol.web.foreign.v1",
  revision: "test",
  authority: {
    language: { repository: "clpi/idol", commit: "language" },
    native: { repository: "clpi/idol-native", commit: "native" },
  },
  worlds: [{
    slug: "c17",
    name: "C17",
    version: "2018",
    semantic_id: null,
    identity_status: "not-published",
    category: "foreign",
    provenance: { origin: { family: "c" } },
    uncertainty: [{ fact: "implementation", status: "unresolved", detail: "pin compiler" }],
    requirements: ["target"],
    projections: [{
      id: "c17-cabi",
      world: "c17",
      target: "c-abi",
      status: "not-admitted",
      available: false,
      artifact: null,
      obligations: { abi: ["calling convention"], ownership: [], failure: [], threading: [], effect: [], world: [] },
      evidence: { status: "missing", required: ["round trip"], references: [] },
      refusal: { code: "ARTIFACT_NOT_ADMITTED", detail: "missing" },
    }],
  }],
  import_kinds: [{
    kind: "repository",
    stages: ["ingest provenance"],
    required_grants: ["metadata read"],
    missing_facts: ["semantic identity"],
    refusals: ["no fetch without grant"],
  }],
};

function envWithForeign() {
  const files = new Map([
    ["/runtime/foreign.json", ["application/json", JSON.stringify(foreign)]],
    ["/apps/lib/index.html", ["text/html", "<html>lib</html>"]],
    ["/apps/api/index.html", ["text/html", "<html>api</html>"]],
  ]);
  return {
    IDOL_COMMIT: "web",
    IDOL_AUTHORITY: "language",
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        const found = files.get(path);
        if (!found) return new Response("missing", { status: 404 });
        return new Response(found[1], { headers: { "content-type": found[0] } });
      },
    },
  };
}

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test("foreign world index is available on Lib and API surfaces without origin fetch", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("unexpected"); };
  for (const host of ["lib.idol.id", "api.idol.id"]) {
    const response = await handle(new Request(`https://${host}/v1/world/foreign`), envWithForeign());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schema, "idol.web.foreign.v1");
    assert.equal(body.worlds[0].semantic_id, null);
  }
  assert.equal(called, false);
});

test("worlds compatibility host redirects before foreign transport", async () => {
  const response = await handle(new Request("https://worlds.idol.id/v1/world/foreign"), envWithForeign());
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://lib.idol.id/v1/world/foreign");
});

test("one integration record is returned by provenance slug", async () => {
  const response = await handle(new Request("https://lib.idol.id/v1/world/c17/integration"), envWithForeign());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.world.slug, "c17");
  assert.equal(body.world.projections[0].target, "c-abi");
  assert.equal(body.world.projections[0].available, false);
});

test("unknown foreign integration slug fails closed", async () => {
  const response = await handle(new Request("https://lib.idol.id/v1/world/unknown/integration"), envWithForeign());
  assert.equal(response.status, 404);
});

test("import plan is deterministic, plan-only, and performs no fetch", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("unexpected"); };
  const request = new Request("https://lib.idol.id/v1/world/import-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "repository", locator: "https://example.invalid/repo", version: "abc" }),
  });
  const response = await handle(request, envWithForeign());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "plan-only");
  assert.equal(body.executed, false);
  assert.equal(body.semantic_id, null);
  assert.equal(called, false);
});

test("invalid import JSON and unsupported kinds fail exactly", async () => {
  let response = await handle(new Request("https://lib.idol.id/v1/world/import-plan", {
    method: "POST", body: "{", headers: { "content-type": "application/json" },
  }), envWithForeign());
  assert.equal(response.status, 400);

  response = await handle(new Request("https://lib.idol.id/v1/world/import-plan", {
    method: "POST",
    body: JSON.stringify({ kind: "magic", locator: "x" }),
    headers: { "content-type": "application/json" },
  }), envWithForeign());
  assert.equal(response.status, 422);
});

test("import plan body is bounded", async () => {
  const response = await handle(new Request("https://lib.idol.id/v1/world/import-plan", {
    method: "POST",
    body: JSON.stringify({ kind: "repository", locator: "x".repeat(33000) }),
    headers: { "content-type": "application/json" },
  }), envWithForeign());
  assert.equal(response.status, 413);
});
