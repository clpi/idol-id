import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { API_ENDPOINTS, resolveEndpointPath } from "../shared/api-endpoints.js";
import { MCP_TOOLS } from "../shared/mcp.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Docs keep document identity in the query, heading identity in the hash, and search every deployed projection", async () => {
  const [html, script, css, apiDoc, mcpDoc, universeDoc] = await Promise.all([
    read("apps/docs/index.html"),
    read("shared/docs-app.js"),
    read("shared/docs-app.css"),
    read("content/docs/api.md"),
    read("content/docs/mcp.md"),
    read("content/docs/universe.md"),
  ]);
  assert.match(html, /id="docs-search"/);
  assert.match(html, /shared\/docs-app\.js/);
  assert.match(html, /shared\/studio\.css/);
  assert.match(script, /searchParams\.get\("doc"\)/);
  assert.match(script, /url\.hash = heading/);
  assert.match(script, /addEventListener\("hashchange", scrollToHash\)/);
  assert.doesNotMatch(script, /hashchange[\s\S]{0,80}loadDocument/);
  assert.match(script, /Promise\.all\(DOCUMENTS\.map/);
  assert.match(script, /id: "api"/);
  assert.match(script, /id: "mcp"/);
  assert.match(script, /let documentGeneration = 0/);
  assert.match(script, /const generation = \+\+documentGeneration/);
  assert.match(script, /if \(generation !== documentGeneration\) return/);
  assert.match(script, /function invalidateSearch\(\) \{\s*clearTimeout\(searchTimer\);\s*searchGeneration \+= 1;\s*\}/);
  assert.match(script, /async function loadDocument\(\) \{\s*invalidateSearch\(\);/);
  assert.match(script, /function decodedHash\(\)/);
  assert.match(script, /try \{ return decodeURIComponent\(raw\); \} catch \{ return ""; \}/);
  assert.match(script, /if \(cache\.has\(entry\.id\)\)/);
  assert.match(script, /try \{ await cache\.get\(entry\.id\); \} catch \{ cache\.delete\(entry\.id\); \}/);
  assert.match(script, /const promise = fetch\(`/);
  assert.match(script, /cache\.set\(entry\.id, promise\)/);
  assert.match(css, /@media\s*\(max-width:\s*820px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(css, /\.docs-nav\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(apiDoc, /api\.idol\.id/);
  assert.match(apiDoc, /semantic authority/i);
  assert.match(mcpDoc, /idol\.analyze/);
  assert.match(mcpDoc, /Only exact canonical coordinates are accepted/i);
  assert.match(universeDoc, /https:\/\/lib\.idol\.id\/universe\/?:id|https:\/\/lib\.idol\.id\/universe\/:id/);
  assert.match(universeDoc, /worlds\.idol\.id[\s\S]{0,180}path-preserving compatibility alias/i);
});

test("API inventory is unique, owner-explicit, editable, byte-bounded, and terminating", async () => {
  const ids = API_ENDPOINTS.map((record) => record.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(API_ENDPOINTS.every((record) => ["edge", "compiler-origin"].includes(record.owner)));
  for (const path of ["/__idol/version", "/runtime/authority.json", "/api/analyze", "/api/run", "/v1/world/foreign", "/v1/world/:slug/integration", "/v1/world/import-plan"]) {
    assert.ok(API_ENDPOINTS.some((record) => record.path === path), `missing ${path}`);
  }
  const integration = API_ENDPOINTS.find((record) => record.id === "integration");
  assert.equal(resolveEndpointPath(integration), "/v1/world/c17/integration");

  const [html, script, css, endpointsSource] = await Promise.all([
    read("apps/api/index.html"),
    read("shared/api-console.js"),
    read("shared/api-console.css"),
    read("shared/api-endpoints.js"),
  ]);
  assert.match(html, /id="api-token"/);
  assert.match(html, /localStorage/);
  assert.match(html, /sessionStorage/);
  assert.match(html, /semantic authority false/i);
  assert.match(html, /data-source-manifest="\/content\/source-examples\.json"/);
  assert.match(html, /shared\/studio\.css/);
  assert.match(script, /dataset\.sourceManifest/);
  assert.match(script, /authorization/);
  assert.match(script, /record\.auth === "bearer"/);
  assert.match(script, /response\.headers\.get\("cache-control"\)/);
  assert.match(script, /const REQUEST_TIMEOUT_MS = 30_000/);
  assert.match(script, /AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)/);
  assert.match(script, /response\.type === "opaqueredirect"/);
  assert.match(script, /redirect not followed/i);
  assert.match(script, /const encoder = new TextEncoder\(\)/);
  assert.match(script, /new Uint8Array\(MAX_RENDER_BYTES\)/);
  assert.match(script, /encoder\.encodeInto\(source, buffer\)/);
  assert.match(script, /new TextDecoder\(\)/);
  assert.doesNotMatch(script, /source\.slice\(0, MAX_RENDER_BYTES\)/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|document\.cookie|indexedDB/);
  assert.doesNotMatch(endpointsSource, /\blegacy\b/i);
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(html + script, /r2-canonical/i);
});

test("MCP publishes and accepts only canonical Idol tool coordinates", async () => {
  const names = MCP_TOOLS.map((tool) => tool.name);
  assert.deepEqual(names, [...names].sort());
  assert.ok(names.every((name) => name.startsWith("idol.")));

  const [html, controller, worker, build] = await Promise.all([
    read("apps/mcp/index.html"),
    read("shared/mcp-console.js"),
    read("worker/mcp.js"),
    read("scripts/build-live.mjs"),
  ]);
  assert.match(html, /Idol MCP/);
  assert.match(html, /idol\.\*/);
  assert.match(html, /exact tool coordinates only/i);
  assert.match(html, /shared\/studio\.css/);
  assert.match(controller, /runtime\/mcp-tools\.json/);
  assert.match(controller, /textContent/);
  assert.match(controller, /MAX_RENDER_BYTES/);
  assert.match(controller, /new TextEncoder/);
  assert.match(controller, /const decoder = new TextDecoder\(\)/);
  assert.match(controller, /const \{ read, written \} = encoder\.encodeInto\(source, buffer\)/);
  assert.match(controller, /if \(read === source\.length\) return source/);
  assert.match(controller, /decoder\.decode\(buffer\.subarray\(0, written\)\)/);
  assert.doesNotMatch(controller, /source\.slice\(0, read\)/);
  assert.doesNotMatch(controller, /if \(written === source\.length\)/);
  assert.match(controller, /const invalid = new Error\("MCP response was not valid JSON\."\)/);
  assert.match(controller, /invalid\.body = \{ error: \{ code: "MCP_INVALID_RESPONSE"/);
  assert.match(controller, /invalid\.status = response\.status/);
  assert.match(controller, /throw invalid/);
  assert.doesNotMatch(controller, /catch \{ body = \{ error: \{ code: "MCP_INVALID_RESPONSE"/);
  assert.match(controller, /response display truncated/);
  assert.doesNotMatch(controller, /innerHTML/);
  assert.doesNotMatch(controller, /localStorage|sessionStorage|document\.cookie|indexedDB/);
  assert.match(worker, /case "idol\.analyze"/);
  assert.match(worker, /const tool = MCP_TOOL_INDEX\[name\]/);
  assert.match(build, /mcp-tools\.json/);
  assert.match(build, /namespace: "idol"/);
  assert.doesNotMatch(build, /legacy_tool_prefix|accepted-not-advertised/);
});

test("MCP forget aborts active requests and invalidates stale completions", async () => {
  const controller = await read("shared/mcp-console.js");
  assert.match(controller, /let requestGeneration = 0/);
  assert.match(controller, /let activeRequest = null/);
  assert.match(controller, /const generation = \+\+requestGeneration/);
  assert.match(controller, /activeRequest\?\.abort\(\)/);
  assert.match(controller, /signal: request\.signal/);
  assert.match(controller, /if \(generation !== requestGeneration\) return null/);
  assert.match(controller, /requestGeneration \+= 1/);
  assert.match(controller, /setBusy\(false\)/);
});

test("Worlds converge on canonical Lib routes and state the non-authority boundary", async () => {
  const [canonical, css, html, docs, web] = await Promise.all([
    read("shared/lib-canonical.js"),
    read("shared/worlds-canonical.css"),
    read("apps/worlds/index.html"),
    read("content/docs/worlds.md"),
    read("shared/web.js"),
  ]);
  assert.match(web, /host === "lib\.idol\.id"[\s\S]*?lib-canonical\.js/);
  assert.match(canonical, /atlas\.href = "\/atlas"/);
  assert.match(canonical, /universe\.href = "\/universe"/);
  assert.match(canonical, /idempotent data attribute/i);
  assert.match(canonical, /compiler-published-world-projection/);
  assert.match(html, /compiler-published projection/);
  assert.match(html, /does not mint semantic identity, equivalence, or authority/i);
  assert.match(css, /min-height:\s*44px/);
  assert.match(docs, /https:\/\/lib\.idol\.id\/atlas/);
  assert.match(docs, /path-preserving compatibility alias/i);
  assert.match(docs, /does not mint semantic identity/i);
});
