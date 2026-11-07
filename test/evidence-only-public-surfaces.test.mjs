import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executableChrome, dumpDom } from "./helpers/chromium.mjs";
import { handle } from "../worker/entry.js";
import { isEvidenceNavigation, PUBLIC_EVIDENCE_SURFACES } from "../worker/public.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const authority = Object.freeze({
  language: Object.freeze({ commit: "1".repeat(40), source_law: Object.freeze({ sha256: "2".repeat(64) }) }),
  native: Object.freeze({ commit: "3".repeat(40) }),
});
const evidenceHtml = "<!doctype html><title>Idol — evidence only</title><main data-evidence-only>Experimental research.</main>";

function envWithEvidence(extra = []) {
  const assets = new Map([
    ["/apps/evidence/index.html", ["text/html; charset=utf-8", evidenceHtml]],
    ["/runtime/authority.json", ["application/json; charset=utf-8", JSON.stringify(authority)]],
    ...extra,
  ]);
  return {
    IDOL_COMMIT: "4".repeat(40),
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

test("all unauthenticated public presentation surfaces converge on one evidence-only shell", async () => {
  const hosts = [
    "idol.id",
    "docs.idol.id",
    "lib.idol.id",
    "api.idol.id",
    "graph.idol.id",
    "mcp.idol.id",
    "r8a.idol.id",
    "r8b.idol.id",
    "r16.idol.id",
  ];
  for (const host of hosts) {
    const response = await handle(new Request(`https://${host}/`, { headers: { "sec-fetch-mode": "navigate" } }), envWithEvidence());
    assert.equal(response.status, 200, host);
    assert.equal(await response.text(), evidenceHtml, host);
    assert.match(response.headers.get("cache-control") || "", /no-cache/);
    assert.doesNotMatch(response.headers.get("cache-control") || "", /immutable/);
  }
});

test("every public navigation path is evidence-only but machine coordinates remain outside the freeze", () => {
  assert.deepEqual([...PUBLIC_EVIDENCE_SURFACES].sort(), ["api", "docs", "graph", "lib", "mcp", "r16", "r8a", "r8b", "site"]);
  for (const surface of PUBLIC_EVIDENCE_SURFACES) {
    assert.equal(isEvidenceNavigation(new Request("https://idol.id/research", { headers: { "sec-fetch-mode": "navigate" } }), { surface }, "/research"), true);
    assert.equal(isEvidenceNavigation(new Request("https://idol.id/apps/site/index.html", { headers: { "sec-fetch-mode": "navigate" } }), { surface }, "/apps/site/index.html"), true);
    for (const path of ["/__idol/version", "/__idol/health", "/__idol/manifest", "/runtime/manifest.json", "/api/analyze", "/v1/world/foreign", "/mcp", "/install", "/install.sh", "/install.ps1", "/shared/evidence.css", "/config.js", "/content/install.sh", "/apps/api/app.js", "/favicon.ico", "/health", "/origin-info"])
      assert.equal(isEvidenceNavigation(new Request(`https://idol.id${path}`, { headers: { "sec-fetch-mode": "navigate" } }), { surface }, path), false, `${surface} ${path}`);
  }
  assert.equal(isEvidenceNavigation(new Request("https://live.idol.id/", { headers: { "sec-fetch-mode": "navigate" } }), { surface: "live" }, "/"), false);
  assert.equal(isEvidenceNavigation(new Request("https://platform.idol.id/", { headers: { "sec-fetch-mode": "navigate" } }), { surface: "platform" }, "/"), false);
  for (const info of [null, {}, { surface: "unknown" }, { surface: "book" }])
    assert.equal(isEvidenceNavigation(new Request("https://idol.id/", { headers: { "sec-fetch-mode": "navigate" } }), info, "/"), false);
});

test("actual entry preserves machine assets, identity, transports, methods and excluded surfaces", async (t) => {
  const headers = { "sec-fetch-mode": "navigate" };
  const files = ["/runtime/manifest.json", "/content/install.sh", "/content/install.ps1", "/shared/evidence.css", "/apps/api/app.js", "/favicon.ico", "/manifest.json"];
  const env = envWithEvidence(files.map((path) => [path, ["application/octet-stream", `asset:${path}`]]));
  for (const [path, target] of [...files.map((path) => [path, path]), ["/__idol/manifest", "/manifest.json"], ["/install", "/content/install.sh"], ["/install.sh", "/content/install.sh"], ["/install.ps1", "/content/install.ps1"]]) {
    const response = await handle(new Request(`https://idol.id${path}`, { headers }), env);
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), `asset:${target}`, path);
  }
  for (const path of ["/__idol/version", "/__idol/health", "/runtime/authority.json"]) {
    const response = await handle(new Request(`https://api.idol.id${path}`, { headers }), env);
    assert.equal(response.status, 200, path);
    const value = await response.json();
    assert.equal(path === "/runtime/authority.json" ? value.language.commit : value.authority, authority.language.commit);
  }
  let response = await handle(new Request("https://api.idol.id/config.js", { headers }), env);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.match(await response.text(), new RegExp(authority.language.commit));
  response = await handle(new Request("https://mcp.idol.id/mcp", { headers }), env);
  assert.equal(response.status, 405);
  response = await handle(new Request("https://api.idol.id/v1/live/status", { headers }), env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "LIVE_STATUS_HOST_REQUIRED");
  const calls = [];
  t.mock.method(globalThis, "fetch", async (request) => {
    calls.push([request.method, new URL(request.url).pathname, await request.text()]);
    return new Response("origin", { status: 202 });
  });
  for (const path of ["/api/analyze", "/health", "/info", "/origin-health", "/origin-info"]) {
    response = await handle(new Request(`https://api.idol.id${path}`, { headers }), env);
    assert.equal(response.status, 202, path);
    assert.equal(await response.text(), "origin", path);
  }
  response = await handle(new Request("https://api.idol.id/research", { method: "POST", headers, body: "payload" }), env);
  assert.equal(response.status, 202);
  assert.deepEqual(calls, [["GET", "/api/analyze", ""], ["GET", "/health", ""], ["GET", "/info", ""], ["GET", "/health", ""], ["GET", "/info", ""], ["POST", "/research", "payload"]]);
  response = await handle(new Request("https://api.idol.id/research", { method: "HEAD", headers }), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.match(response.headers.get("cache-control"), /no-cache/);
  for (const surface of ["book", "live", "platform"]) {
    const body = `<html>${surface}</html>`;
    response = await handle(new Request(`https://${surface}.idol.id/`, { headers }), envWithEvidence([[`/apps/${surface}/index.html`, ["text/html", body]]]));
    assert.equal(response.status, 200, surface);
    assert.equal(await response.text(), body, surface);
  }
  response = await handle(new Request("https://unknown.idol.id/", { headers }), env);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "unknown idol.id surface");
});

test("the evidence shell states only exact non-claims and machine-readable identities", async () => {
  const [html, css, script] = await Promise.all([
    read("apps/evidence/index.html"),
    read("shared/evidence.css"),
    read("shared/evidence.js"),
  ]);
  assert.match(html, /data-evidence-only/);
  assert.match(html, /No public capability or performance claim is made here\./);
  assert.match(html, /UNMEASURED/);
  assert.match(html, /NOT IMPLEMENTED/);
  assert.match(html, /NOT ADMITTED/);
  assert.match(html, /RESEARCH HYPOTHESIS/);
  for (const coordinate of ["/__idol/version", "/__idol/manifest", "/runtime/authority.json", "/runtime/manifest.json"])
    assert.match(html, new RegExp(coordinate.replaceAll("/", "\\/")));
  assert.match(script, /fetch\("\/__idol\/version"/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML|localStorage|sessionStorage|document\.cookie|indexedDB/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
});

test("worlds remains only a strict path-and-query preserving compatibility alias", async () => {
  const response = await handle(new Request("https://worlds.idol.id/atlas/world/c17?lens=origin", { headers: { "sec-fetch-mode": "navigate" } }), envWithEvidence());
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://lib.idol.id/atlas/world/c17?lens=origin");
});

async function browserEvidence(input) {
  const results = [];
  for (const entry of input.cases) {
    const parsed = new DOMParser().parseFromString(entry.html, "text/html");
    for (const node of parsed.querySelectorAll("script,link")) node.remove();
    const frame = document.createElement("iframe");
    frame.srcdoc = "<!doctype html>" + parsed.documentElement.outerHTML;
    await new Promise((resolve) => { frame.onload = resolve; document.body.append(frame); });
    const doc = frame.contentDocument;
    const calls = [];
    frame.contentWindow.fetch = async (path) => {
      calls.push(path);
      return { ok: entry.identityOk, json: async () => input.identity };
    };
    frame.contentWindow.eval(input.script);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const controls = [...doc.querySelectorAll("button,input,[role=button],a")]
      .map((node) => [node.innerText, node.getAttribute("aria-label"), node.getAttribute("title"), node.value].filter(Boolean).join(" "));
    const visible = [doc.title, doc.body.innerText, ...controls].join(" ");
    results.push({
      name: entry.name,
      admitted: !/faster than|native compiler|self-hosted|published worlds|semantic observatory|registry|world atlas|\b(?:run|analyze|lower)\b/i.test(visible),
      calls,
      identity: doc.querySelector("#identity")?.textContent,
      injectedElements: doc.querySelectorAll("#identity img, #identity script").length,
      coordinates: [...doc.querySelectorAll("a")].map((node) => node.getAttribute("href")),
    });
    frame.remove();
  }
  const output = document.createElement("output");
  output.id = "evidence-proof";
  output.textContent = encodeURIComponent(JSON.stringify(results));
  document.body.append(output);
}

test("real browser distinguishes machine links from capability actions and renders observed identity as text", { timeout: 60000 }, async (t) => {
  const chrome = await executableChrome();
  if (!chrome) {
    assert.ok(!process.env.CI && process.env.LIVE_BROWSER_REQUIRED !== "1", "Set CHROME_BIN: public evidence browser proof is required");
    return t.skip("Set CHROME_BIN to run public evidence browser proof");
  }
  const [html, script] = await Promise.all([read("apps/evidence/index.html"), read("shared/evidence.js")]);
  const identity = { commit: "observed-test-commit", untrusted: "<img src=x onerror=alert(1)>" };
  const cases = [
    { name: "observed-identity", html, identityOk: true },
    { name: "unavailable-identity", html, identityOk: false },
    ...[
      ["visible-run", "<button><span>Run</span></button>"],
      ["visible-analyze", "<button>Analyze</button>"],
      ["encoded-action", '<input type="button" value="R&#117;n">'],
      ["accessible-action", '<button aria-label="Run">▶</button>'],
      ["false-performance", "<p>Faster than all others</p>"],
    ].map(([name, addition]) => ({ name, html: html.replace("</main>", `${addition}</main>`), identityOk: true })),
  ];
  const input = JSON.stringify({ cases, script, identity }).replaceAll("<", "\\u003c");
  const page = `<!doctype html><html><body><script>(${browserEvidence.toString()})(${input});</script></body></html>`;
  const directory = await mkdtemp(join(tmpdir(), "idol-evidence-"));
  const server = createServer((request, response) => {
    response.writeHead(request.url === "/" ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
    response.end(request.url === "/" ? page : "");
  });
  t.after(async () => {
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const { stdout } = await dumpDom(chrome, `http://127.0.0.1:${server.address().port}/`, join(directory, "chrome"));
  const encoded = stdout.match(/<output id="evidence-proof">([^<]+)<\/output>/)?.[1];
  assert.ok(encoded, "browser completed actual shell and reader checks");
  const results = JSON.parse(decodeURIComponent(encoded));
  assert.deepEqual(results.map((result) => result.name), cases.map((entry) => entry.name));
  assert.deepEqual(results.map((result) => result.admitted), [true, true, false, false, false, false, false]);
  for (const [index, result] of results.entries()) {
    assert.deepEqual(result.calls, ["/__idol/version"]);
    assert.equal(result.identity, index === 1 ? "identity unavailable" : JSON.stringify(identity, null, 2));
    assert.equal(result.injectedElements, 0);
    for (const path of ["/runtime/authority.json", "/runtime/manifest.json", "/__idol/version", "/__idol/manifest"])
      assert.ok(result.coordinates.includes(path), path);
  }
});
