import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { handle as edgeHandle } from "../worker/entry.js";
import { resolveHost } from "../worker/index.js";

const STRUCTURAL_ROLES = [
  "binding",
  "capture",
  "demand",
  "descriptor",
  "member",
  "operand",
  "origin",
  "projection",
  "provenance",
  "relation",
  "result",
  "subject",
  "target",
  "witness",
];
const OPERATION_WORDS = ["compile", "dispatch", "execute", "parse", "read", "transform", "write"];

function envWithAssets() {
  const authority = JSON.stringify({
    language: { commit: "authority", source_law: { sha256: "source-law" } },
    native: { commit: "native" },
  });
  const files = new Map([
    ["/apps/lib/index.html", ["text/html", "<html>lib</html>"]],
    ["/apps/worlds/index.html", ["text/html", "<html>atlas</html>"]],
    ["/apps/universe/index.html", ["text/html", "<html>universe</html>"]],
    ["/runtime/authority.json", ["application/json", authority]],
  ]);
  return {
    IDOL_COMMIT: "web",
    ASSETS: {
      async fetch(request) {
        const found = files.get(new URL(request.url).pathname);
        return found
          ? new Response(found[1], { headers: { "content-type": found[0] } })
          : new Response("missing", { status: 404 });
      },
    },
  };
}

test("worlds.idol.id is a compatibility alias for the canonical Lib world registry", async () => {
  const info = resolveHost("worlds.idol.id");
  assert.equal(info.app, "lib");
  assert.equal(info.surface, "lib");
  assert.equal(info.redirect, "https://lib.idol.id");

  const response = await edgeHandle(new Request("https://worlds.idol.id/world/std?lens=facts"), envWithAssets());
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://lib.idol.id/world/std?lens=facts");
});

test("Lib owns the world atlas and public Universe lenses", async () => {
  let response = await edgeHandle(new Request("https://lib.idol.id/atlas", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>atlas</html>");

  response = await edgeHandle(new Request("https://lib.idol.id/world/std", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(await response.text(), "<html>atlas</html>");

  response = await edgeHandle(new Request("https://lib.idol.id/universe", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(await response.text(), "<html>universe</html>");
});

test("the deployed product model obeys one universe and standardized structural edges", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const model = JSON.parse(await readFile("dist/runtime/product-model.json", "utf8"));

  assert.equal(model.semantic_authority, false);
  assert.equal(model.semantic_universes, 1);
  assert.equal(model.library.kind, "world");
  assert.equal(model.library.canonical_registry, "https://lib.idol.id");
  assert.equal(model.home.kind, "reach-and-provenance");
  assert.equal(model.home.is_world, false);
  assert.equal(model.universe.kind, "operational-projection");
  assert.equal(model.universe.mints_semantic_universe, false);
  assert.deepEqual(model.graph.structural_roles, STRUCTURAL_ROLES);
  assert.equal(model.graph.reverse_traversal, "derived-index");
  assert.equal(model.graph.operations_are_relation_identities, true);
  for (const word of OPERATION_WORDS) assert.equal(model.graph.structural_roles.includes(word), false);
});

test("global chrome has one Lib entry and an accessible compact mobile menu", async () => {
  const shell = await readFile("shared/shell.js", "utf8");
  const surface = await readFile("shared/surface.css", "utf8");

  assert.doesNotMatch(shell, /id:\s*"worlds"/);
  assert.doesNotMatch(shell, /id:\s*"universe"/);
  assert.match(shell, /id:\s*"lib"[\s\S]*?href:\s*"https:\/\/lib\.idol\.id\/"/);
  assert.match(shell, /class="nav-toggle"/);
  assert.match(shell, /aria-expanded="false"/);
  assert.match(shell, /class="nav-panel"/);
  assert.match(shell, /Escape/);
  assert.match(surface, /@media\s*\(max-width:\s*699px\)[\s\S]*?\.nav-toggle/);
  assert.match(surface, /\.nav-panel\.open/);
});

test("homepage and Lib UI present one world product without mobile-only dead space", async () => {
  const site = await readFile("apps/site/index.html", "utf8");
  const lib = await readFile("apps/lib/index.html", "utf8");

  assert.doesNotMatch(site, /<canvas\b/i);
  assert.doesNotMatch(site, />World Atlas</);
  assert.doesNotMatch(site, /https:\/\/worlds\.idol\.id/);
  assert.match(site, /Library worlds/);
  assert.match(site, /https:\/\/lib\.idol\.id\/atlas/);
  assert.match(site, /@media\s*\(max-width:\s*699px\)[\s\S]*?\.cell-a[\s\S]*?min-height:\s*0/);

  assert.match(lib, /let set = "worlds"/);
  assert.match(lib, /data-set="worlds"[^>]*class="here"|class="here"[^>]*data-set="worlds"/);
  assert.match(lib, /data-set="libs"/);
  assert.match(lib, />worlds</);
  assert.match(lib, />homes</);
  assert.match(lib, /href="\/atlas"/);
  assert.match(lib, /href="\/universe"/);
  assert.match(lib, /@media\s*\(max-width:\s*699px\)/);
  assert.match(lib, /class="lib-mobile-nav"/);
});
