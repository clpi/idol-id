import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

test("one immutable build packages repository workbench and bootstrap installers", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const [html, app, platform, manifest, unix, windows, nav] = await Promise.all([
    readFile("dist/apps/repository/index.html", "utf8"),
    readFile("dist/shared/repository-app.js", "utf8"),
    readFile("dist/apps/platform/index.html", "utf8"),
    readFile("dist/runtime/manifest.json", "utf8").then(JSON.parse),
    readFile("dist/content/install.sh", "utf8"),
    readFile("dist/content/install.ps1", "utf8"),
    readFile("dist/shared/repository-nav.js", "utf8"),
  ]);

  assert.match(html, /Repository Observatory/);
  assert.match(app, /v1\/repository\/browser/);
  assert.match(platform, /platform-repository-entry\.js/);
  assert.equal(manifest.repository.route, "https://platform.idol.id/repo");
  assert.equal(manifest.repository.mutation, false);
  assert.equal(manifest.repository.installer.self_hosted, false);
  assert.match(unix, /bootstrap seed/);
  assert.match(windows, /bootstrap-seed/);
  assert.match(nav, /platform\.idol\.id\/repo/);
});
