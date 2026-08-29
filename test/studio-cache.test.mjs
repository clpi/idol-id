import test from "node:test";
import assert from "node:assert/strict";
import { handle, isContentAddressedPath } from "../worker/index.js";

const authority = JSON.stringify({ language: { commit: "authority", source_law: { sha256: "law" } }, native: { commit: "native" } });
function environment() {
  return {
    IDOL_COMMIT: "web",
    ASSETS: { async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/runtime/authority.json") return new Response(authority, { headers: { "content-type": "application/json" } });
      if (path === "/shared/studio.css") return new Response("stable", { headers: { "content-type": "text/css" } });
      if (path === "/shared/studio.a94f11de.css") return new Response("hashed", { headers: { "content-type": "text/css" } });
      return new Response("missing", { status: 404 });
    } },
  };
}

test("only content-addressed assets qualify for immutable caching", () => {
  assert.equal(isContentAddressedPath("/shared/studio.css"), false);
  assert.equal(isContentAddressedPath("/shared/studio.a94f11de.css"), true);
  assert.equal(isContentAddressedPath("/shared/studio-a94f11de.js"), true);
  assert.equal(isContentAddressedPath("/runtime/authority.json"), false);
});

test("stable shared assets revalidate while content-addressed assets are immutable", async () => {
  let response = await handle(new Request("https://platform.idol.id/shared/studio.css"), environment());
  assert.match(response.headers.get("cache-control"), /no-cache/);
  assert.doesNotMatch(response.headers.get("cache-control"), /immutable/);

  response = await handle(new Request("https://platform.idol.id/shared/studio.a94f11de.css"), environment());
  assert.match(response.headers.get("cache-control"), /immutable/);
});
