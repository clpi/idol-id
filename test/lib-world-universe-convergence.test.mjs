import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { handle as edgeHandle } from "../worker/entry.js";
import { resolveHost } from "../worker/index.js";

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

test("worlds.idol.id is a compatibility alias for the Lib-owned world registry", async () => {
  assert.deepEqual(resolveHost("lib.idol.id"), { app: "lib", surface: "lib", origin: true });
  assert.deepEqual(resolveHost("worlds.idol.id"), {
    app: "lib",
    surface: "lib",
    origin: false,
    redirect: "https://lib.idol.id",
  });

  const response = await edgeHandle(new Request("https://worlds.idol.id/world/std?lens=facts", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://lib.idol.id/world/std?lens=facts");
});

test("Lib owns the Atlas and public Universe lenses", async () => {
  let response = await edgeHandle(new Request("https://lib.idol.id/atlas", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>atlas</html>");

  response = await edgeHandle(new Request("https://lib.idol.id/world/std", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>atlas</html>");

  response = await edgeHandle(new Request("https://lib.idol.id/universe", {
    headers: { "sec-fetch-mode": "navigate" },
  }), envWithAssets());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>universe</html>");
});

test("the deployed product model obeys one universe and canonical structural edge roles", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], {
    encoding: "utf8",
    timeout: 30000,
  });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const model = JSON.parse(await readFile("dist/runtime/product-model.json", "utf8"));
  const authority = JSON.parse(await readFile("runtime/authority.json", "utf8"));

  assert.equal(model.semantic_authority, false);
  assert.equal(model.semantic_universes, 1);
  assert.deepEqual(model.authority, {
    language: authority.language.commit,
    native: authority.native.commit,
    source_law: authority.language.source_law.sha256,
  });

  assert.equal(model.surfaces.lib.kind, "world-registry-projection");
  assert.equal(model.surfaces.lib.canonical, "https://lib.idol.id");
  assert.equal(model.surfaces.lib.published_library_is_world, true);
  assert.deepEqual(model.surfaces.lib.lenses, ["worlds", "atlas", "homes", "universe"]);
  assert.equal(model.surfaces.worlds.kind, "compatibility-alias");
  assert.equal(model.surfaces.worlds.canonical, "https://lib.idol.id");
  assert.equal(model.surfaces.universe.kind, "operational-projection");
  assert.equal(model.surfaces.universe.public, "https://lib.idol.id/universe");
  assert.equal(model.surfaces.universe.mints_semantic_universe, false);

  assert.equal(model.entities.library.kind, "published-world");
  assert.equal(model.entities.library.is_world, true);
  assert.equal(model.entities.home.kind, "reach-and-provenance");
  assert.equal(model.entities.home.is_world, false);
  assert.equal(model.entities.path.is_identity, false);
  assert.equal(model.entities.package_provenance.is_authority, false);

  assert.equal(model.graph.structural_roles_source, "clpi/idol-compact-law-projection");
  assert.deepEqual(model.graph.structural_roles, STRUCTURAL_ROLES);
  assert.equal(model.graph.operations_are_relation_identities, true);
  assert.equal(model.graph.reverse_traversal, "derived-index");
});

test("global chrome has one Lib product and an accessible compact mobile menu", async () => {
  const shell = await readFile("shared/shell.js", "utf8");
  const surface = await readFile("shared/surface.css", "utf8");

  assert.match(shell, /id:\s*"lib"[\s\S]*?href:\s*"https:\/\/lib\.idol\.id\/"/);
  assert.doesNotMatch(shell, /id:\s*"worlds"/);
  assert.doesNotMatch(shell, /id:\s*"universe"/);
  assert.match(shell, /https:\/\/lib\.idol\.id\/atlas/);
  assert.match(shell, /https:\/\/lib\.idol\.id\/universe/);
  assert.match(shell, /class="nav-toggle"/);
  assert.match(shell, /aria-expanded="false"/);
  assert.match(shell, /panel\.className\s*=\s*"nav-panel"/);
  assert.match(shell, /Escape/);
  assert.match(surface, /@media\s*\(max-width:\s*699px\)[\s\S]*?\.nav-toggle/);
  assert.match(surface, /\.nav-panel\.open/);
  assert.match(surface, /\.topbar \.nav-desktop\s*\{\s*display:\s*none/);
  assert.doesNotMatch(surface, /@media\s*\(max-width:\s*699px\)[\s\S]*?\.topbar \.nav[^\{]*\{[^}]*overflow-x:\s*auto/);
});

test("homepage presents one Library worlds product without pseudo-graph decoration", async () => {
  const site = await readFile("apps/site/index.html", "utf8");

  assert.doesNotMatch(site, /<canvas\b/i);
  assert.match(site, /Library worlds/);
  assert.match(site, /A published Idol library is a world/i);
  assert.match(site, /home is reach and provenance/i);
  assert.match(site, /https:\/\/lib\.idol\.id\//);
  assert.match(site, /https:\/\/lib\.idol\.id\/atlas/);
  assert.doesNotMatch(site, /https:\/\/worlds\.idol\.id\//);
  assert.doesNotMatch(site, />World Atlas</);
  assert.match(site, /@media\s*\(max-width:\s*699px\)[\s\S]*?\.cell-a[\s\S]*?min-height:\s*0/);
});

test("Lib defaults to worlds, exposes contextual lenses, and uses a mobile list-detail state", async () => {
  const lib = await readFile("apps/lib/index.html", "utf8");

  assert.match(lib, /let set = "worlds"/);
  assert.match(lib, /data-set="worlds"[^>]*class="here"|class="here"[^>]*data-set="worlds"/);
  assert.match(lib, /data-set="libs"/);
  assert.match(lib, />worlds</);
  assert.match(lib, />homes</);
  assert.match(lib, /A published Idol library is a world/i);
  assert.match(lib, /home is reach and provenance, not a world/i);
  assert.match(lib, /href="\/atlas"/);
  assert.match(lib, /href="\/universe"/);
  assert.match(lib, /data-mobile="list"/);
  assert.match(lib, /class="lib-mobile-nav"/);
  assert.match(lib, /data-mobile-view="list"/);
  assert.match(lib, /data-mobile-view="detail"/);
  assert.match(lib, /setMobileView/);
  assert.match(lib, /@media\s*\(max-width:\s*699px\)/);
});
