import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { executableChrome, dumpDom } from "./helpers/chromium.mjs";
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

test("API documentation uses the exact published foreign candidate coordinate", async () => {
  const apiDoc = await read("content/docs/api.md");
  assert.match(apiDoc, /v1\/world\/c17\/integration/);
  assert.doesNotMatch(apiDoc, /v1\/world\/c\/integration/);
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

test("API Forget aborts active requests and invalidates stale completions", async () => {
  const controller = await read("shared/api-console.js");
  assert.match(controller, /let requestGeneration = 0/);
  assert.match(controller, /const activeRequests = new Set\(\)/);
  assert.match(controller, /const generation = requestGeneration/);
  assert.match(controller, /const request = new AbortController\(\)/);
  assert.match(controller, /activeRequests\.add\(request\)/);
  assert.match(controller, /AbortSignal\.any\(\[request\.signal, AbortSignal\.timeout\(REQUEST_TIMEOUT_MS\)\]\)/);
  assert.match(controller, /if \(generation !== requestGeneration\) return/);
  assert.match(controller, /requestGeneration \+= 1/);
  assert.match(controller, /for \(const request of activeRequests\) request\.abort\(\)/);
  assert.match(controller, /activeRequests\.clear\(\)/);
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
  assert.match(canonical, /compiler-published-world-projection/);
  assert.match(html, /compiler-published projection/);
  assert.match(html, /does not mint semantic identity, equivalence, or authority/i);
  assert.match(css, /min-height:\s*44px/);
  assert.match(docs, /https:\/\/lib\.idol\.id\/atlas/);
  assert.match(docs, /path-preserving compatibility alias/i);
  assert.match(docs, /does not mint semantic identity/i);

});

test("Lib registry and Atlas retain distinct presentation product identities", async () => {
  const canonical = await read("shared/lib-canonical.js");
  assert.match(canonical, /function convergeRegistry\(\)[\s\S]*?return true;/);
  assert.match(canonical, /function convergeAtlas\(\) \{\s*if \(!document\.querySelector\("\.atlas"\)\) return false;/);
  assert.match(canonical, /function apply\(\) \{\s*if \(!convergeRegistry\(\)\) convergeAtlas\(\);\s*\}/);
  assert.doesNotMatch(canonical, /function apply\(\) \{\s*convergeRegistry\(\);\s*convergeAtlas\(\);\s*\}/);
});

async function browserIdempotence(input) {
  const report = [];
  const require = (condition, code) => {
    if (!condition) throw new Error(code);
  };
  const reachable = (root) => {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ALL);
    const nodes = [root];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  };
  const fixture = async (surface) => {
    const parsed = new DOMParser().parseFromString(input.html[surface], "text/html");
    for (const node of parsed.querySelectorAll("script,link,style,iframe,object,embed,base,meta[http-equiv]")) node.remove();
    for (const node of parsed.querySelectorAll("*")) {
      for (const attribute of [...node.attributes]) {
        if (/^on/i.test(attribute.name) || ["src", "srcset", "poster", "ping", "style"].includes(attribute.name)) node.removeAttribute(attribute.name);
      }
    }
    const policy = parsed.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "default-src 'none'; script-src 'unsafe-eval'";
    parsed.head.prepend(policy);
    const frame = document.createElement("iframe");
    frame.srcdoc = "<!doctype html>" + parsed.documentElement.outerHTML;
    await new Promise((resolve) => {
      frame.onload = resolve;
      document.body.append(frame);
    });
    const doc = frame.contentDocument;
    const root = doc.documentElement;
    const boundary = doc.querySelector(surface === "registry" ? ".boundary-note" : ".atlas-head p");
    require(boundary?.isConnected, "source-boundary");
    const heading = doc.querySelector(".atlas-head h1");
    const expected = {
      title: doc.title,
      heading: heading?.textContent,
      boundary: boundary.textContent,
      count: reachable(root).length - (surface === "registry" ? reachable(boundary).length - 4 : 0),
    };
    const anchors = [...doc.querySelectorAll(".lensbar a")];
    if (surface === "registry") require(anchors.length === 4, "source-links");
    else require(heading?.isConnected, "source-heading");
    return { frame, doc, root, boundary, heading, anchors, expected, surface };
  };
  const assertConverged = (value) => {
    const { doc, root, boundary, heading, anchors, expected, surface } = value;
    require(doc.title === expected.title, "document-title");
    require(doc.documentElement === root && root.isConnected, "document-root");
    require(boundary.isConnected, "boundary-connected");
    require(reachable(root).length === expected.count, "reachable-nodes");
    if (surface === "registry") {
      require(root.dataset.idolProduct === "admitted-world-registry-projection", "registry-identity");
      const links = [...doc.querySelectorAll(".lensbar a")];
      require(links.length === 4 && links.every((node, index) => node === anchors[index] && node.isConnected), "registry-links");
      require(JSON.stringify(links.map((node) => node.getAttribute("href"))) === JSON.stringify(["/", "/atlas", "/?set=homes", "/universe"]), "registry-routes");
      require(doc.querySelector(".boundary-note") === boundary && boundary.childNodes.length === 2, "registry-boundary-nodes");
      require(boundary.firstChild.tagName === "STRONG" && boundary.textContent === "Lib publishes admitted world projections and their package provenance. A package coordinate is provenance, not semantic identity or authority. A home is reach and provenance, not a world.", "registry-boundary-text");
    } else {
      require(root.dataset.idolProduct === "compiler-published-world-projection", "atlas-identity");
      require(heading.isConnected && doc.querySelector(".atlas-head h1") === heading && heading.textContent === expected.heading, "atlas-heading");
      require(doc.querySelector(".atlas-head p") === boundary && boundary.textContent === expected.boundary, "atlas-boundary");
    }
  };
  try {
    for (const entry of input.cases) {
      const value = await fixture(entry.surface);
      const result = { name: entry.name, iterations: 0, checks: 0, failure: null };
      try {
        for (let iteration = 0; iteration < 2; iteration++) {
          try { value.frame.contentWindow.eval(entry.source); }
          catch (error) { result.failure = { kind: "execution", code: String(error.message) }; break; }
          result.iterations++;
          try { assertConverged(value); }
          catch (error) { result.failure = { kind: "assertion", code: String(error.message) }; break; }
          result.checks++;
        }
      } finally {
        value.frame.remove();
      }
      report.push(result);
    }
  } catch (error) {
    report.push({ name: "fixture-failure", failure: { kind: "fixture", code: String(error.message) } });
  }
  const output = document.createElement("output");
  output.id = "idol-idempotence-proof";
  output.textContent = encodeURIComponent(JSON.stringify(report));
  document.body.append(output);
}

test("real Registry and Atlas DOM preserves repeated convergence and rejects destructive mutations", { timeout: 60000 }, async (t) => {
  const chrome = await executableChrome();
  if (!chrome) {
    assert.ok(!process.env.CI && process.env.LIVE_BROWSER_REQUIRED !== "1", "Set CHROME_BIN: real DOM idempotence proof is required");
    return t.skip("Set CHROME_BIN to run real DOM idempotence proof");
  }
  const [registry, atlas, source] = await Promise.all([
    read("apps/lib/index.html"), read("apps/worlds/index.html"), read("shared/lib-canonical.js"),
  ]);
  const cases = [
    { name: "registry-positive", surface: "registry", source },
    { name: "atlas-positive", surface: "atlas", source },
  ];
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, "mutation target is unique in the actual controller");
    return source.replace(before, after);
  };
  const negative = (name, surface, changed) => {
    assert.notEqual(changed, source, "negative control changes actual controller bytes");
    cases.push({ name, surface, source: changed });
  };
  negative("missing-registry-identity", "registry", replace('document.documentElement.dataset.idolProduct = "admitted-world-registry-projection";', ""));
  negative("wrong-registry-identity", "registry", replace('"admitted-world-registry-projection"', '"wrong-product"'));
  negative("registry-boundary-accumulation", "registry", replace("boundary.replaceChildren();", ""));
  for (const [name, surface, change] of [
    ["atlas-title", "atlas", 'document.title = "mutated title";'],
    ["atlas-extra-child", "atlas", 'document.querySelector(".atlas").appendChild(document.createElement("div"));'],
    ["atlas-heading", "atlas", 'document.querySelector("h1").textContent = "mutated heading";'],
    ["atlas-boundary", "atlas", 'document.querySelector(".atlas-head p").textContent = "mutated boundary";'],
    ["registry-links-removed", "registry", 'document.querySelector(".lensbar").replaceChildren();'],
    ["atlas-body-cleared", "atlas", 'document.body.textContent = "";'],
  ]) negative(name, surface, `${source}\n${change}`);
  const input = JSON.stringify({ html: { registry, atlas }, cases }).replaceAll("<", "\\u003c");
  const html = `<!doctype html><html><head><title>Idempotence controls</title></head><body><script>(${browserIdempotence.toString()})(${input});</script></body></html>`;
  const directory = await mkdtemp(join(tmpdir(), "idol-idempotence-"));
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  server = createServer((request, response) => {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const { stdout } = await dumpDom(chrome, `http://127.0.0.1:${server.address().port}/`, join(directory, "chrome"));
  const encoded = stdout.match(/<output id="idol-idempotence-proof">([^<]+)<\/output>/)?.[1];
  assert.ok(encoded, "real browser completed the bounded control bundle");
  const results = JSON.parse(decodeURIComponent(encoded));
  assert.deepEqual(results.map((result) => result.name), cases.map((entry) => entry.name));
  for (const result of results.slice(0, 2)) {
    assert.equal(result.failure, null, JSON.stringify(result));
    assert.equal(result.iterations, 2);
    assert.equal(result.checks, 2);
  }
  for (const result of results.slice(2)) {
    assert.equal(result.failure?.kind, "assertion", JSON.stringify(result));
    assert.ok(result.iterations > 0, JSON.stringify(result));
  }
  t.diagnostic(JSON.stringify(results));
});
