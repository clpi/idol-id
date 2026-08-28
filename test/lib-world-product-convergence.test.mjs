import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { handle } from "../worker/entry.js";
import { resolveHost } from "../worker/index.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function envWithAssets() {
  const files = new Map([
    ["/apps/lib/index.html", ["text/html", "<html>lib</html>"]],
    ["/apps/worlds/index.html", ["text/html", "<html>worlds</html>"]],
    ["/apps/universe/index.html", ["text/html", "<html>universe</html>"]],
    ["/runtime/authority.json", ["application/json", JSON.stringify({ language: { commit: "law", source_law: { sha256: "source-law" } }, native: { commit: "native" } })]],
  ]);
  return {
    IDOL_COMMIT: "web",
    ASSETS: {
      async fetch(request) {
        const found = files.get(new URL(request.url).pathname);
        return found ? new Response(found[1], { headers: { "content-type": found[0] } }) : new Response("missing", { status: 404 });
      },
    },
  };
}

test("Lib owns the public admitted-world registry and Worlds preserves compatibility as an alias", async () => {
  assert.deepEqual(resolveHost("lib.idol.id"), { app: "lib", surface: "lib", origin: true });
  assert.deepEqual(resolveHost("worlds.idol.id"), { app: "lib", surface: "lib", origin: false, redirect: "https://lib.idol.id" });
  const response = await handle(new Request("https://worlds.idol.id/world/std?lens=projection", { headers: { "sec-fetch-mode": "navigate" } }), envWithAssets());
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://lib.idol.id/world/std?lens=projection");
});

test("Lib owns Atlas and public Universe lenses while Platform keeps private Universe management", async () => {
  const env = envWithAssets();
  let response = await handle(new Request("https://lib.idol.id/atlas", { headers: { "sec-fetch-mode": "navigate" } }), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>worlds</html>");

  response = await handle(new Request("https://lib.idol.id/world/std", { headers: { "sec-fetch-mode": "navigate" } }), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>worlds</html>");

  response = await handle(new Request("https://lib.idol.id/universe?mode=public", { headers: { "sec-fetch-mode": "navigate" } }), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<html>universe</html>");
});

test("global chrome exposes one Lib product and contextual Atlas, homes, and Universe projections", async () => {
  const shell = await read("shared/shell.js");
  assert.match(shell, /id:\s*"lib"[\s\S]*?href:\s*"https:\/\/lib\.idol\.id\/"/);
  assert.doesNotMatch(shell, /id:\s*"worlds"/);
  assert.doesNotMatch(shell, /id:\s*"universe"/);
  assert.match(shell, /https:\/\/lib\.idol\.id\/atlas/);
  assert.match(shell, /https:\/\/lib\.idol\.id\/\?set=homes/);
  assert.match(shell, /https:\/\/lib\.idol\.id\/universe/);
  assert.match(shell, /https:\/\/platform\.idol\.id\/universe/);
});

test("runtime product model keeps world identity separate from package coordinate and web presentation", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8", timeout: 30000 });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
  const model = JSON.parse(await readFile("dist/runtime/product-model.json", "utf8"));

  assert.equal(manifest.surfaces["lib.idol.id"], "lib");
  assert.equal(manifest.surfaces["worlds.idol.id"], "lib:compatibility-alias");
  assert.equal(manifest.runtime.product_model, "/runtime/product-model.json");
  assert.equal(model.semantic_authority, false);
  assert.equal(model.semantic_universes, 1);
  assert.equal(model.surfaces.lib.kind, "admitted-world-registry-projection");
  assert.equal(model.surfaces.lib.package_coordinate_is_semantic_identity, false);
  assert.equal(model.surfaces.lib.package_coordinate_is_authority, false);
  assert.equal(model.surfaces.lib.default_lens, "worlds");
  assert.equal(model.surfaces.worlds.kind, "compatibility-alias");
  assert.equal(model.surfaces.universe.kind, "operational-projection");
  assert.equal(model.surfaces.universe.mints_semantic_universe, false);
  assert.equal(model.graph.roles.owner, "compiler-published-projection");
  assert.deepEqual(model.graph.roles.web_declared, []);
  assert.equal(model.graph.reverse_traversal, "derived-index");
});

test("Lib defaults to published worlds, keeps homes secondary, and canonicalizes contextual links beneath Lib", async () => {
  const [lib, canonical, web] = await Promise.all([read("apps/lib/index.html"), read("shared/lib-canonical.js"), read("shared/web.js")]);
  assert.match(lib, /const requestedSet = new URLSearchParams\(location\.search\)\.get\("set"\)/);
  assert.match(lib, /let set = requestedSet === "homes" \? "libs" : "worlds"/);
  assert.match(lib, /data-set="worlds"[^>]*class="here"|class="here"[^>]*data-set="worlds"/);
  assert.match(lib, /data-set="libs"/);
  assert.match(lib, /data-mobile="list"/);
  assert.match(lib, /class="lib-mobile-nav"/);
  assert.match(canonical, /atlas\.href = "\/atlas"/);
  assert.match(canonical, /universe\.href = "\/universe"/);
  assert.match(canonical, /package coordinate is provenance, not semantic identity or authority/i);
  assert.match(canonical, /home is reach and provenance, not a world/i);
  assert.match(web, /lib-canonical\.js/);
  assert.match(web, /product-canonical\.js/);
});
