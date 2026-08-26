import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  createRepositoryScaffold,
  observePublicRepository,
  parseRepositoryLocator,
} from "../shared/repository.js";

test("repository coordinates are provider-admitted and exact", () => {
  assert.deepEqual(parseRepositoryLocator({ url: "https://github.com/acme/demo", ref: "main" }), {
    provider: "github",
    namespace: "acme",
    repository: "demo",
    requested_ref: "main",
    coordinate: "github:acme/demo",
    source_url: "https://github.com/acme/demo",
  });
  assert.throws(() => parseRepositoryLocator("https://evil.example/acme/demo"), /not admitted/i);
});

test("observation pins a revision and scaffold remains review-only", async () => {
  const responses = new Map([
    ["https://api.github.com/repos/acme/demo", { private: false, default_branch: "main" }],
    ["https://api.github.com/repos/acme/demo/commits/main", { sha: "abcdef123456" }],
    ["https://api.github.com/repos/acme/demo/git/trees/abcdef123456?recursive=1", { tree: [
      { type: "blob", path: "Cargo.toml", size: 12 },
      { type: "blob", path: ".github/workflows/test.yml", size: 15 },
    ] }],
  ]);
  const observed = await observePublicRepository({ url: "https://github.com/acme/demo" }, {
    fetcher: async (url) => new Response(JSON.stringify(responses.get(url))),
    observedAt: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(observed.resolved_revision, "abcdef123456");
  assert.equal(observed.semantic_id, null);
  const scaffold = createRepositoryScaffold({ ...observed, id: "obs_contract_identifier" }, { capabilities: ["authority", "ci"] }, {
    authorityPin: { language: { commit: "language" }, native: { commit: "native" } },
    createdAt: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(scaffold.status, "preview");
  assert.equal(scaffold.repository_written, false);
  assert.match(scaffold.patch, /\.idol\/authority\.json/);
});

test("build packages protected repository workbench and honest installers", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const manifest = JSON.parse(await readFile("dist/runtime/manifest.json", "utf8"));
  assert.equal(manifest.repository.route, "https://platform.idol.id/repo");
  assert.equal(manifest.repository.mutation, false);
  assert.equal(manifest.repository.installer.self_hosted, false);
  assert.match(await readFile("dist/apps/repository/index.html", "utf8"), /Repository Observatory/);
  assert.match(await readFile("dist/content/install.sh", "utf8"), /bootstrap seed/);
  assert.match(await readFile("dist/content/install.ps1", "utf8"), /bootstrap-seed/);
});
