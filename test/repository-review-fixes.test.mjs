import test from "node:test";
import assert from "node:assert/strict";
import { observePublicRepository } from "../shared/repository.js";
import { handleRepositoryTransport } from "../worker/repository.js";
import { handle as handleEntry } from "../worker/entry.js";

const platformInfo = { app: "platform", surface: "platform", origin: false };
const identity = { subject: "review-user", email: "review@example.com", displayName: "Review user" };

function providerFetch(url) {
  if (url === "https://api.github.com/repos/acme/demo") return Promise.resolve(new Response(JSON.stringify({ private: false, default_branch: "main" })));
  if (url === "https://api.github.com/repos/acme/demo/commits/main") return Promise.resolve(new Response(JSON.stringify({ sha: "abcdef123456" })));
  if (url === "https://api.github.com/repos/acme/demo/git/trees/abcdef123456?recursive=1") return Promise.resolve(new Response(JSON.stringify({ tree: [{ type: "blob", path: "Cargo.toml", size: 10 }] })));
  throw new Error(`unexpected provider request: ${url}`);
}

function fakeServices() {
  const observations = [];
  return {
    platformService: { async session() { return { profile: identity }; } },
    repositoryService: {
      async listObservations() { return observations; },
      async listScaffolds() { return []; },
      async saveObservation(_identity, draft) { const saved = { ...draft, id: "obs_review_identifier" }; observations.push(saved); return saved; },
    },
  };
}

test("repository provider requests time out through the admitted AbortSignal", async () => {
  let signal;
  await assert.rejects(
    () => observePublicRepository({ url: "https://github.com/acme/demo" }, {
      timeoutMs: 10,
      fetcher: async (_url, init) => {
        signal = init.signal;
        return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }));
      },
    }),
    (error) => error?.code === "REPOSITORY_PROVIDER_TIMEOUT" && error?.status === 504,
  );
  assert.equal(signal.aborted, true);
});

test("repository POST bodies are streamed and cancelled above the byte limit", async () => {
  let cancelled = false;
  let providerCalled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(10_000));
      controller.enqueue(new Uint8Array(10_000));
      controller.close();
    },
    cancel() { cancelled = true; },
  });
  const response = await handleRepositoryTransport(
    new Request("https://platform.idol.id/v1/repository/browser/observe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://platform.idol.id",
        "x-idol-request": "browser",
      },
      body,
      duplex: "half",
    }),
    {
      ACCESS_TEAM_DOMAIN: "team.example",
      REPOSITORY_ACCESS_AUD: "repo-aud",
      ACCESS_EMAIL: identity.email,
      PLATFORM_DB: {},
    },
    "/v1/repository/browser/observe",
    platformInfo,
    {
      ...fakeServices(),
      verifyAccess: async () => identity,
      providerFetcher: async () => { providerCalled = true; throw new Error("provider must not be called"); },
    },
  );
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "REPOSITORY_REQUEST_TOO_LARGE");
  assert.equal(cancelled, true);
  assert.equal(providerCalled, false);
});

function localEnv() {
  const files = new Map([
    ["/apps/repository/index.html", ["text/html", "<html>repository-local</html>"]],
    ["/runtime/manifest.json", ["application/json", JSON.stringify({
      authority: { repository: "clpi/idol", commit: "language" },
      native: { repository: "clpi/idol-native", commit: "native" },
    })]],
  ]);
  return {
    IDOL_LOCAL_DEVELOPMENT: "1",
    ASSETS: {
      async fetch(request) {
        const found = files.get(new URL(request.url).pathname);
        return found ? new Response(found[1], { headers: { "content-type": found[0] } }) : new Response("missing", { status: 404 });
      },
    },
  };
}

test("local Wrangler repository shell and browser API preserve one local context", async () => {
  let response = await handleEntry(new Request("http://localhost:8787/repo", { headers: { "sec-fetch-mode": "navigate" } }), localEnv());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>repository-local</html>");

  response = await handleEntry(new Request("http://localhost:8787/v1/repository/status"), localEnv());
  const status = await response.json();
  assert.equal(response.status, 200);
  assert.equal(status.configured.local_development, true);
  assert.equal(status.configured.storage, true);

  response = await handleEntry(new Request("http://localhost:8787/v1/repository/browser/observations"), localEnv());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { observations: [] });

  response = await handleEntry(new Request("http://localhost:8787/v1/repository/browser/observe", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:8787", "x-idol-request": "browser" },
    body: JSON.stringify({ url: "https://github.com/acme/demo" }),
  }), localEnv(), { providerFetcher: providerFetch, now: () => "2026-08-26T12:00:00.000Z" });
  assert.equal(response.status, 201);
  const observed = await response.json();
  assert.equal(observed.resolved_revision, "abcdef123456");
  assert.equal(observed.semantic_id, null);
});
