import test from "node:test";
import assert from "node:assert/strict";
import { handle } from "../worker/entry.js";

function envWithAssets() {
  const authority = JSON.stringify({
    language: { commit: "language", source_law: { sha256: "source-law" } },
    native: { commit: "native" },
  });
  const assets = new Map([
    ["/runtime/authority.json", ["application/json", authority]],
    ["/shared/shell.js", ["application/javascript", "window.shell=true"]],
    ["/shared/shell.0123456789abcdef.js", ["application/javascript", "window.shell=true"]],
    ["/apps/site/index.html", ["text/html", "<!doctype html><title>Idol</title>"]],
  ]);
  return {
    IDOL_COMMIT: "web",
    ASSETS: {
      async fetch(request) {
        const found = assets.get(new URL(request.url).pathname);
        return found
          ? new Response(found[1], { headers: { "content-type": found[0] } })
          : new Response("missing", { status: 404 });
      },
    },
  };
}

test("stable public asset paths revalidate instead of remaining stale for a year", async () => {
  const response = await handle(new Request("https://idol.id/shared/shell.js?v=compiler-20260829"), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-cache, must-revalidate");
  assert.doesNotMatch(response.headers.get("cache-control") || "", /immutable/);
});

test("only content-addressed asset names receive immutable caching", async () => {
  const response = await handle(new Request("https://idol.id/shared/shell.0123456789abcdef.js"), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
});

test("the root document always revalidates", async () => {
  const response = await handle(new Request("https://idol.id/", { headers: { "sec-fetch-mode": "navigate" } }), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-cache, must-revalidate");
});
