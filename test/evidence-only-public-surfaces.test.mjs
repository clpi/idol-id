import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handle } from "../worker/entry.js";
import { isEvidenceNavigation, PUBLIC_EVIDENCE_SURFACES } from "../worker/public.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const authority = Object.freeze({
  language: Object.freeze({ commit: "1".repeat(40), source_law: Object.freeze({ sha256: "2".repeat(64) }) }),
  native: Object.freeze({ commit: "3".repeat(40) }),
});
const evidenceHtml = "<!doctype html><title>Idol — evidence only</title><main data-evidence-only>Experimental research.</main>";

function envWithEvidence() {
  const assets = new Map([
    ["/apps/evidence/index.html", ["text/html; charset=utf-8", evidenceHtml]],
    ["/runtime/authority.json", ["application/json; charset=utf-8", JSON.stringify(authority)]],
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
    for (const path of ["/__idol/version", "/__idol/health", "/__idol/manifest", "/runtime/manifest.json", "/api/analyze", "/v1/world/foreign", "/mcp", "/install", "/install.ps1", "/shared/evidence.css"])
      assert.equal(isEvidenceNavigation(new Request(`https://idol.id${path}`), { surface }, path), false, `${surface} ${path}`);
  }
  assert.equal(isEvidenceNavigation(new Request("https://live.idol.id/", { headers: { "sec-fetch-mode": "navigate" } }), { surface: "live" }, "/"), false);
  assert.equal(isEvidenceNavigation(new Request("https://platform.idol.id/", { headers: { "sec-fetch-mode": "navigate" } }), { surface: "platform" }, "/"), false);
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
  assert.doesNotMatch(html, /faster than|native compiler|self-hosted|published worlds|semantic observatory|registry|world atlas|run|analyze|lower/i);
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
