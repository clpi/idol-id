import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

test("build emits worlds and platform in one deployment", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
  assert.equal(manifest.surfaces["worlds.idol.id"], "worlds");
  assert.equal(manifest.surfaces["platform.idol.id"], "platform");

  const worldsHtml = await readFile("dist/apps/worlds/index.html", "utf8");
  const platformHtml = await readFile("dist/apps/platform/index.html", "utf8");
  assert.match(worldsHtml, /World Atlas/);
  assert.match(worldsHtml, /type="module"/);
  assert.match(worldsHtml, /runtime\/worlds\.json/);
  assert.match(worldsHtml, /compare/i);
  assert.match(worldsHtml, /@media \(max-width: 699px\)/);
  assert.match(platformHtml, /Platform/);
  assert.match(platformHtml, /not yet enabled/i);

  const snapshot = JSON.parse(await readFile("dist/runtime/worlds.json", "utf8"));
  assert.equal(snapshot.schema, "idol.web.worlds.v1");
  assert.ok(snapshot.worlds.length > 0);
});
