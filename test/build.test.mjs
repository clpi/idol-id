import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

test("build emits Lib-owned world projections, foreign integrations, authenticated platform, and local-first IDE", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
  assert.equal(manifest.surfaces["worlds.idol.id"], "lib:compatibility-alias");
  assert.equal(manifest.surfaces["lib.idol.id"], "lib");
  assert.equal(manifest.surfaces["platform.idol.id"], "platform");
  assert.equal(manifest.runtime.universe.public, "https://lib.idol.id/universe");
  assert.equal(manifest.runtime.product_model, "/runtime/product-model.json");
  assert.deepEqual(manifest.runtime.ide, {
    route: "https://platform.idol.id/ide",
    local_storage: "indexeddb",
    source_upload: "explicit-remote-analysis-only",
    remote_analysis: "/v1/ide/analyze",
    browser_wasm: manifest.runtime.wasm.admitted,
  });

  const worldsHtml = await readFile("dist/apps/worlds/index.html", "utf8");
  const platformHtml = await readFile("dist/apps/platform/index.html", "utf8");
  const ideHtml = await readFile("dist/apps/ide/index.html", "utf8");
  const platformIdeEntry = await readFile("dist/shared/platform-ide-entry.js", "utf8");
  const ideDirectory = await readFile("dist/shared/ide-directory.js", "utf8");
  const ideSemanticLayer = await readFile("dist/shared/ide-semantic-layer.js", "utf8");
  const surfaceCss = await readFile("dist/shared/surface.css", "utf8");
  const shellJs = await readFile("dist/shared/shell.js", "utf8");
  const productModel = JSON.parse(await readFile("dist/runtime/product-model.json", "utf8"));

  assert.match(worldsHtml, /World Atlas/);
  assert.match(worldsHtml, /runtime\/worlds\.json/);
  assert.match(worldsHtml, /runtime\/foreign\.json/);
  assert.match(worldsHtml, /shared\/foreign\.js/);
  assert.match(worldsHtml, /Integration obligations/);
  assert.match(worldsHtml, /Import plan/);
  assert.match(worldsHtml, /plan-only/);
  assert.match(worldsHtml, /identity not published/i);
  assert.match(worldsHtml, /@media \(max-width: 699px\)/);
  assert.match(shellJs, /function decodeWorldHash\(/);
  assert.match(shellJs, /function worldFromPath\(/);
  assert.match(shellJs, /function worldLensFromPath\(/);
  assert.match(shellJs, /platform\.idol\.id\/ide/);
  assert.match(shellJs, /lib\.idol\.id\/atlas/);
  assert.match(shellJs, /lib\.idol\.id\/universe/);
  assert.doesNotMatch(shellJs, /id:\s*"worlds"/);
  assert.doesNotMatch(shellJs, /id:\s*"universe"/);
  assert.equal(productModel.semantic_universes, 1);
  assert.equal(productModel.surfaces.lib.kind, "admitted-world-registry-projection");
  assert.equal(productModel.surfaces.worlds.kind, "compatibility-alias");
  assert.match(surfaceCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.detail\s*\{\s*transition:\s*none/);

  assert.match(platformHtml, /Platform/);
  assert.match(platformHtml, /Sign in with Access/);
  assert.match(platformHtml, /API tokens/);
  assert.match(platformHtml, /Audit trail/);
  assert.match(platformHtml, /\/v1\/platform\/browser\/session/);
  assert.match(platformHtml, /transport identity/i);
  assert.match(platformHtml, /\/shared\/platform-ide-entry\.js/);
  assert.doesNotMatch(platformHtml, /<a[^>]+href="\/ide"/i);
  assert.match(platformIdeEntry, /signed-in/);
  assert.match(platformIdeEntry, /container\.hidden = signedIn\.hidden/);
  assert.match(platformIdeEntry, /Open browser IDE/);
  assert.match(platformIdeEntry, /href = "\/ide"/);

  assert.match(ideHtml, /Idol Browser IDE/);
  for (const script of ["workspace.js", "semantic-bundle.js", "idol.js", "graph.js", "wasm.js", "ide-semantic-layer.js", "ide-directory.js"]) assert.match(ideHtml, new RegExp(`/shared/${script.replace(".", "\\.")}`));
  assert.match(ideHtml, /IndexedDB/);
  assert.match(ideHtml, /Analyze remotely/);
  assert.match(ideHtml, /lexical preview/i);
  assert.match(ideHtml, /browser Wasm/i);
  assert.match(ideHtml, /remote native/i);
  assert.match(ideHtml, /semantic identity not published/i);
  assert.match(ideHtml, /source remains local/i);
  assert.match(ideHtml, /@media\s*\(max-width:\s*699px\)/);
  assert.match(ideHtml, /@media\s*\(max-width:\s*360px\)/);
  assert.match(ideHtml, /prefers-reduced-motion/);
  assert.match(ideDirectory, /webkitRelativePath/);
  assert.match(ideDirectory, /import-directory/);
  assert.match(ideDirectory, /fileInput\.onchange/);
  assert.match(ideSemanticLayer, /replaceChildren\(fragment\)/);
  assert.match(ideSemanticLayer, /source\.slice\(token\.span\[0\],token\.span\[1\]\)/);
  assert.match(ideSemanticLayer, /compiler token spans overlap/);
  assert.match(ideSemanticLayer, /IDE_ANALYSIS_STALE/);
  assert.match(ideSemanticLayer, /source_hash/);
  assert.match(ideSemanticLayer, /currentEditor\.source !== snapshot\.source/);
  assert.match(ideSemanticLayer, /mergeDisplayTokens/);

  assert.match(surfaceCss, /@font-face/);
  assert.match(surfaceCss, /font-family:\s*["']Iosevka["']/);
  assert.match(surfaceCss, /cdn\.jsdelivr\.net\/fontsource\/fonts\/iosevka@5\.3\.0\/latin-400-normal\.woff2/);

  const platformDocs = await readFile("dist/content/docs/platform.md", "utf8");
  assert.match(platformDocs, /browser IDE/i);
  assert.match(platformDocs, /IndexedDB/);
  assert.match(platformDocs, /remote analysis is explicit/i);
  assert.match(platformDocs, /not a cloud workspace/i);

  const readme = await readFile("README.md", "utf8");
  assert.match(readme, /platform\.idol\.id\/ide/);
  assert.match(readme, /local-first/);
  assert.match(readme, /remote-native/);

  const snapshot = JSON.parse(await readFile("dist/runtime/worlds.json", "utf8"));
  assert.equal(snapshot.schema, "idol.web.worlds.v1");
  assert.ok(snapshot.worlds.length > 0);
  const snapshotAuthority = JSON.parse(await readFile("runtime/authority.json", "utf8"));
  const foreign = JSON.parse(await readFile("dist/runtime/foreign.json", "utf8"));
  assert.equal(foreign.schema, "idol.web.foreign.v1");
  assert.equal(foreign.authority.language.commit, snapshotAuthority.language.commit);
  assert.equal(foreign.authority.native.commit, snapshotAuthority.native.commit);
  assert.ok(foreign.worlds.length >= 6);
  assert.ok(foreign.worlds.every((world) => world.semantic_id === null));
  assert.ok(foreign.worlds.every((world) => world.identity_status === "not-published"));
  assert.ok(foreign.worlds.flatMap((world) => world.projections).every((projection) => projection.status !== "available" || (projection.artifact?.sha256 && projection.evidence?.status === "verified")));
  assert.ok(foreign.worlds.flatMap((world) => world.projections).every((projection) => projection.artifact || !("copy_command" in projection)));

  const migration = await readFile("migrations/0001_platform_identity.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_profile/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_token/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_audit/);
});
