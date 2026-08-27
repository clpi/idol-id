import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const LANGUAGE_COMMIT = "16ba848af17277b36137fd4ca308ffdb8a2730dd";
const NATIVE_COMMIT = "ad438a856daa8786e77ac9f033d38deb9e8f5c29";
const STALE = [
  "f33bb3773484e7d954a2975211e683dfa89edab5",
  "e33b0748f6cb8c092fa99368c31ec76c86673aa4",
  "d422ef33c88811b99523ef0cc19a03bd158dd3c0",
];

async function text(path) {
  return readFile(path, "utf8");
}

function assertNoStale(value, label) {
  for (const commit of STALE) assert.doesNotMatch(value, new RegExp(commit), `${label} retains stale ${commit}`);
}

test("one exact authority projection drives runtime, Worker, installers, and build", async () => {
  const authority = JSON.parse(await text("runtime/authority.json"));
  const sourceLaw = JSON.parse(await text("runtime/source-law.json"));
  const examples = JSON.parse(await text("content/source-examples.json"));
  assert.equal(authority.language.commit, LANGUAGE_COMMIT);
  assert.equal(authority.native.commit, NATIVE_COMMIT);
  assert.equal(sourceLaw.authority.commit, LANGUAGE_COMMIT);
  assert.equal(examples.authority.commit, LANGUAGE_COMMIT);

  for (const path of [
    "worker/index.js",
    "wrangler.jsonc",
    "content/install.sh",
    "content/install.ps1",
    "README.md",
  ]) assertNoStale(await text(path), path);

  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const manifest = JSON.parse(await text("dist/runtime/manifest.json"));
  const projected = JSON.parse(await text("dist/runtime/language-authority.json"));
  assert.equal(manifest.authority.commit, LANGUAGE_COMMIT);
  assert.equal(manifest.native.commit, NATIVE_COMMIT);
  assert.equal(projected.authority.language.commit, LANGUAGE_COMMIT);
  assert.equal(projected.authority.native.commit, NATIVE_COMMIT);
  assert.equal(projected.semantic_authority, false);
  assert.equal(projected.presentation_projection, true);
});

test("public presentation contains no invented Idol source and reserves Iosevka for exact text", async () => {
  const api = await text("apps/api/index.html");
  for (const spelling of ["stdout:write", "Io.", "Io:", "io.", "io:", "str.", "str:"]) {
    assert.equal(api.includes(spelling), false, `API page contains invented ${spelling}`);
  }

  const theme = await text("shared/theme.css");
  assert.match(theme, /body\s*\{[\s\S]*?font-family:\s*var\(--sans\)/);
  assert.match(theme, /code,\s*pre[\s\S]*?font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(theme, /\.tk-direct\b/);

  const semanticLayer = await text("shared/ide-semantic-layer.js");
  assert.doesNotMatch(semanticLayer, /directive:\s*"tk-direct"|direct:\s*"tk-direct"/);
});

test("Live and MCP authority documents are projections and never claim unavailable native execution", async () => {
  const native = JSON.parse(await text("runtime/native-runtime.json"));
  assert.equal(native.semantic_authority, false);
  assert.equal(native.admitted, false);
  assert.equal(native.wasm_available, false);

  const live = JSON.parse(await text("runtime/live.json"));
  assert.equal(live.semantic_authority, false);
  assert.equal(live.collaboration_truth, true);
  assert.equal(live.capabilities.realtime_store, false);

  const mcp = JSON.parse(await text("runtime/mcp.json"));
  assert.equal(mcp.semantic_authority, false);
  assert.equal(mcp.protocol, "2026-07-28");
  assert.equal(mcp.capabilities.mutation, false);
});
