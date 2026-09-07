import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { API_ENDPOINTS, resolveEndpointPath } from "../shared/api-endpoints.js";
import { MCP_TOOLS } from "../shared/mcp.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.id = "";
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.style = { cssText: "" };
    this.dataset = {};
    this.attributes = {};
  }
  appendChild(node) {
    if (node === null || node === undefined) return node;
    this.children.push(node);
    return node;
  }
  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }
  prepend(node) {
    if (node === null || node === undefined) return;
    this.children.unshift(node);
  }
  replaceChildren(...nodes) {
    this.children = [];
    for (const node of nodes) this.appendChild(node);
  }
}

function fakeAnchor(text, href) {
  const link = new FakeElement("a");
  link.textContent = text;
  link.attributes.href = href;
  Object.defineProperty(link, "href", {
    get() { return link.attributes.href ?? ""; },
    set(value) { link.attributes.href = String(value); },
  });
  return link;
}

function createRegistryFixture() {
  const documentElement = new FakeElement("html");
  const head = new FakeElement("head");
  const lensbar = new FakeElement("nav");
  lensbar.className = "lensbar";
  const published = fakeAnchor("published", "https://worlds.idol.id/");
  const atlas = fakeAnchor("atlas", "https://worlds.idol.id/");
  const homes = fakeAnchor("homes", "https://worlds.idol.id/");
  const universe = fakeAnchor("universe", "https://worlds.idol.id/");
  lensbar.appendChild(published);
  lensbar.appendChild(atlas);
  lensbar.appendChild(homes);
  lensbar.appendChild(universe);
  const links = [published, atlas, homes, universe];
  lensbar.querySelectorAll = (selector) => {
    if (selector === "a") return links;
    return [];
  };
  const boundary = new FakeElement("div");
  boundary.className = "boundary-note";
  boundary.appendChild(new FakeElement("strong"));
  const document = {
    readyState: "complete",
    documentElement,
    head,
    createElement(tag) {
      if (tag === "link") return new FakeElement("link");
      if (tag === "strong") return new FakeElement("strong");
      return new FakeElement(tag);
    },
    createTextNode(text) { return { nodeType: "text", textContent: String(text) }; },
    querySelector(selector) {
      if (selector === ".lensbar") return lensbar;
      if (selector === ".boundary-note") return boundary;
      if (selector === "html") return documentElement;
      if (selector === "head") return head;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'link[rel="stylesheet"]') return [...head.children];
      return [];
    },
    addEventListener() {},
  };
  return { document, documentElement, lensbar, boundary, published, atlas, homes, universe, links };
}

function createAtlasFixture() {
  const documentElement = new FakeElement("html");
  const title = new FakeElement("title");
  title.textContent = "Worlds — idol.id";
  const head = new FakeElement("head");
  head.appendChild(title);
  const eyebrow = new FakeElement("div");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "@ · compiler-published projection";
  const heading = new FakeElement("h1");
  heading.textContent = "Worlds";
  const atlasHead = new FakeElement("header");
  atlasHead.className = "atlas-head";
  atlasHead.appendChild(eyebrow);
  atlasHead.appendChild(heading);
  const rail = new FakeElement("section");
  rail.className = "rail";
  rail.appendChild(atlasHead);
  const atlas = new FakeElement("main");
  atlas.className = "atlas";
  atlas.appendChild(rail);
  const staticBoundary = new FakeElement("section");
  staticBoundary.className = "boundary";
  atlas.appendChild(staticBoundary);
  const staticNodes = [eyebrow, heading, atlasHead, rail, atlas, staticBoundary];
  const document = {
    readyState: "complete",
    title: title.textContent,
    documentElement,
    head,
    createElement(tag) { return new FakeElement(tag); },
    createTextNode(text) { return { nodeType: "text", textContent: String(text) }; },
    querySelector(selector) {
      if (selector === ".atlas") return atlas;
      if (selector === "html") return documentElement;
      if (selector === "head") return head;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'link[rel="stylesheet"]') return [...head.children];
      return [];
    },
    addEventListener() {},
  };
  return { document, documentElement, head, title, atlas, staticBoundary, eyebrow, heading, atlasHead, rail, staticNodes };
}

function executeController(fixture, mutate) {
  const sourcePath = new URL("../shared/lib-canonical.js", import.meta.url);
  let source = readFileSync(sourcePath, "utf8");
  if (typeof mutate === "function") source = mutate(source);
  const context = {
    document: fixture.document,
    location: { href: "https://lib.idol.id/" },
    URL,
    console,
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: "shared/lib-canonical.js" });
  return context;
}

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

  function assertRegistryConverged(reg) {
    assert.equal(reg.published.href, "/");
    assert.equal(reg.atlas.href, "/atlas");
    assert.equal(reg.homes.href, "/?set=homes");
    assert.equal(reg.universe.href, "/universe");
    assert.equal(reg.documentElement.dataset.idolProduct, "admitted-world-registry-projection");
    assert.equal(reg.boundary.children.length, 2);
  }

  function assertAtlasConverged(atl) {
    assert.equal(atl.documentElement.dataset.idolProduct, "compiler-published-world-projection");
    assert.equal(atl.title.textContent, "Worlds — idol.id");
    assert.equal(atl.heading.textContent, "Worlds");
    assert.equal(atl.eyebrow.textContent, "@ · compiler-published projection");
    assert.equal(atl.atlas.className, "atlas");
    assert.equal(atl.staticBoundary.className, "boundary");
    assert.equal(atl.staticNodes.length, 6);
    assert.ok(atl.atlas.children.includes(atl.staticBoundary), "static boundary preserved inside .atlas after repeated convergence");
    assert.ok(atl.atlasHead.children.includes(atl.eyebrow), "static eyebrow preserved inside .atlas-head");
    assert.ok(atl.atlasHead.children.includes(atl.heading), "static h1 preserved inside .atlas-head");
  }

  const reg = createRegistryFixture();
  executeController(reg);
  assertRegistryConverged(reg);
  executeController(reg);
  assertRegistryConverged(reg);

  const atl = createAtlasFixture();
  executeController(atl);
  assertAtlasConverged(atl);
  executeController(atl);
  assertAtlasConverged(atl);

  const baseSource = readFileSync(new URL("../shared/lib-canonical.js", import.meta.url), "utf8");
  assert.ok(baseSource.includes("admitted-world-registry-projection"), "unmutated source contains the registry product string");
  assert.ok(baseSource.includes("compiler-published-world-projection"), "unmutated source contains the atlas product string");
  assert.ok(baseSource.includes("boundary.replaceChildren();"), "unmutated source clears the boundary before rewriting");

  const missingIdentity = createRegistryFixture();
  const missingIdentitySource = baseSource.replace('document.documentElement.dataset.idolProduct = "admitted-world-registry-projection";', "");
  assert.notEqual(missingIdentitySource, baseSource, "missing-identity mutation must change the source bytes");
  executeController(missingIdentity, () => missingIdentitySource);
  assert.throws(() => assertRegistryConverged(missingIdentity), /admitted-world-registry-projection/);

  const wrongIdentity = createRegistryFixture();
  const wrongIdentitySource = baseSource.replace('"admitted-world-registry-projection"', '"wrong-product"');
  assert.notEqual(wrongIdentitySource, baseSource, "wrong-identity mutation must change the source bytes");
  executeController(wrongIdentity, () => wrongIdentitySource);
  assert.throws(() => assertRegistryConverged(wrongIdentity), /admitted-world-registry-projection/);

  const accumulate = createRegistryFixture();
  const accumulateSource = baseSource.replace("boundary.replaceChildren();", "/* skipped */");
  assert.notEqual(accumulateSource, baseSource, "accumulating-boundary mutation must change the source bytes");
  executeController(accumulate, () => accumulateSource);
  executeController(accumulate, () => accumulateSource);
  assert.throws(() => assertRegistryConverged(accumulate), /2/);
});

test("Lib registry and Atlas retain distinct presentation product identities", async () => {
  const canonical = await read("shared/lib-canonical.js");
  assert.match(canonical, /function convergeRegistry\(\)[\s\S]*?return true;/);
  assert.match(canonical, /function convergeAtlas\(\) \{\s*if \(!document\.querySelector\("\.atlas"\)\) return false;/);
  assert.match(canonical, /function apply\(\) \{\s*if \(!convergeRegistry\(\)\) convergeAtlas\(\);\s*\}/);
  assert.doesNotMatch(canonical, /function apply\(\) \{\s*convergeRegistry\(\);\s*convergeAtlas\(\);\s*\}/);
});
