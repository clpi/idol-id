import test from "node:test";
import assert from "node:assert/strict";
import { configSource, handle, resolveHost } from "../worker/index.js";

function envWithAssets() {
  const files = new Map([
    ["/apps/site/index.html", ["text/html", "<html>site</html>"]],
    ["/apps/docs/index.html", ["text/html", "<html>docs</html>"]],
    ["/apps/lib/index.html", ["text/html", "<html>lib</html>"]],
    ["/apps/api/index.html", ["text/html", "<html>api</html>"]],
    ["/apps/graph/index.html", ["text/html", "<html>graph</html>"]],
    ["/shared/web.js", ["application/javascript", "web"]],
    ["/manifest.json", ["application/json", "{\"ok\":true}"]],
  ]);
  return {
    IDOL_COMMIT: "abc123",
    IDOL_AUTHORITY: "authority123",
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
test.after(() => {
  globalThis.fetch = originalFetch;
});

test("host map uses one graph application for graph and architecture aliases", () => {
  assert.deepEqual(resolveHost("graph.idol.id"), { app: "graph", surface: "graph" });
  assert.deepEqual(resolveHost("r16.idol.id"), { app: "graph", surface: "r16" });
});

test("root serves the site shell with security headers", async () => {
  const response = await handle(new Request("https://idol.id/"), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>site</html>");
  assert.match(response.headers.get("content-security-policy"), /default-src/);
});

test("graph aliases receive the graph shell", async () => {
  const response = await handle(new Request("https://r8a.idol.id/explore", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(await response.text(), "<html>graph</html>");
});

test("config reports the precise host surface and authority", async () => {
  const env = envWithAssets();
  const response = await handle(new Request("https://docs.idol.id/config.js"), env);
  const text = await response.text();
  assert.match(text, /\"app\":\"docs\"/);
  assert.match(text, /\"authority\":\"authority123\"/);
  assert.equal(text, configSource(resolveHost("docs.idol.id"), "docs.idol.id", "abc123", "authority123"));
});

test("api requests preserve the existing tunnel origin", async () => {
  globalThis.fetch = async (request) => new Response(`origin:${new URL(request.url).pathname}`);
  const response = await handle(new Request("https://api.idol.id/api/authority"), envWithAssets());
  assert.equal(await response.text(), "origin:/api/authority");
});

test("legacy health remains the compiler origin while edge health is explicit", async () => {
  globalThis.fetch = async (request) => new Response(`origin:${new URL(request.url).pathname}`);
  let response = await handle(new Request("https://idol.id/health"), envWithAssets());
  assert.equal(await response.text(), "origin:/health");
  response = await handle(new Request("https://idol.id/__idol/health"), envWithAssets());
  const body = await response.json();
  assert.equal(body.edge, true);
});

test("unknown hosts fail closed", async () => {
  const response = await handle(new Request("https://unknown.example/"), envWithAssets());
  assert.equal(response.status, 404);
});
