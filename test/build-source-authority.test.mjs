import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("immutable build ships exact language authority, source law, and source examples", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const sourceAuthority = await readJson("runtime/authority.json");
  const sourceLaw = await readJson("runtime/source-law.json");
  const sourceExamples = await readJson("content/source-examples.json");
  const deployedAuthority = await readJson("dist/runtime/authority.json");
  const deployedLaw = await readJson("dist/runtime/source-law.json");
  const deployedExamples = await readJson("dist/content/source-examples.json");
  const runtime = await readJson("dist/runtime/manifest.json");

  assert.deepEqual(deployedAuthority, sourceAuthority);
  assert.deepEqual(deployedLaw, sourceLaw);
  assert.deepEqual(deployedExamples, sourceExamples);
  assert.equal(runtime.authority_projection, "/runtime/authority.json");
  assert.equal(runtime.source_law, "/runtime/source-law.json");
  assert.equal(runtime.source_examples, "/content/source-examples.json");
  assert.deepEqual(runtime.browser_preview, {
    kind: "lexical-provenance",
    semantic_identity: false,
    exact_span_only: true,
    shadow_grammar: false,
  });
  assert.equal(runtime.authority.commit, deployedAuthority.language.commit);
  assert.equal(runtime.native.commit, deployedAuthority.native.commit);
  assert.equal(deployedLaw.authority.commit, deployedAuthority.language.commit);
  assert.equal(deployedLaw.source_law.sha256, deployedAuthority.language.source_law.sha256);
  assert.equal(deployedExamples.authority.commit, deployedAuthority.language.commit);
  assert.equal(deployedExamples.authority.source_law, deployedAuthority.language.source_law.sha256);
});
