import test from "node:test";
import assert from "node:assert/strict";
import {
  createRepositoryScaffold,
  observePublicRepository,
  parseRepositoryLocator,
  summarizeRepositoryFiles,
} from "../shared/repository.js";

function response(value, init = {}) {
  return new Response(JSON.stringify(value), { status: init.status || 200, headers: { "content-type": "application/json", ...(init.headers || {}) } });
}

const calls = [];
async function githubFetch(url, init) {
  calls.push({ url, init });
  if (url === "https://api.github.com/repos/acme/demo") return response({ private: false, default_branch: "main" });
  if (url === "https://api.github.com/repos/acme/demo/commits/main") return response({ sha: "0123456789abcdef" });
  if (url === "https://api.github.com/repos/acme/demo/git/trees/0123456789abcdef?recursive=1") {
    return response({ truncated: false, tree: [
      { type: "blob", path: "package.json", size: 400 },
      { type: "blob", path: "src/index.js", size: 1200 },
      { type: "blob", path: "test/index.test.js", size: 900 },
      { type: "blob", path: "bench/startup.js", size: 300 },
      { type: "blob", path: ".github/workflows/ci.yml", size: 800 },
    ] });
  }
  throw new Error(`unexpected ${url}`);
}

test("repository locator admits only exact public provider coordinates", () => {
  assert.deepEqual(parseRepositoryLocator({ url: "https://github.com/acme/demo.git", ref: "main" }), {
    provider: "github",
    namespace: "acme",
    repository: "demo",
    requested_ref: "main",
    coordinate: "github:acme/demo",
    source_url: "https://github.com/acme/demo",
  });
  assert.equal(parseRepositoryLocator("https://gitlab.com/group/sub/project").coordinate, "gitlab:group/sub/project");
  assert.equal(parseRepositoryLocator("https://bitbucket.org/team/repo").coordinate, "bitbucket:team/repo");
  assert.throws(() => parseRepositoryLocator("https://example.com/acme/demo"), /not admitted/);
  assert.throws(() => parseRepositoryLocator("https://user:secret@github.com/acme/demo"), /credential-free/);
});

test("repository inventory reports observed evidence without claiming behavior", () => {
  const summary = summarizeRepositoryFiles([
    { path: "Cargo.toml", bytes: 100 },
    { path: "src/lib.rs", bytes: 300 },
    { path: "tests/smoke.rs", bytes: 200 },
    { path: "benches/parse.rs", bytes: 250 },
  ]);
  assert.equal(summary.file_count, 4);
  assert.equal(summary.languages.rust, 3);
  assert.deepEqual(summary.build_systems[0], { id: "cargo", evidence: ["Cargo.toml"], status: "observed-marker" });
  assert.match(summary.commands.find((command) => command.phase === "build").command, /cargo build/);
  assert.equal(summary.commands.find((command) => command.phase === "bench").status, "unresolved");
});

test("public GitHub observation is revision-pinned, bounded, and identity-safe", async () => {
  calls.length = 0;
  const observation = await observePublicRepository({ url: "https://github.com/acme/demo", ref: "HEAD" }, {
    fetcher: githubFetch,
    observedAt: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(observation.schema, "idol.web.repository.observation.v1");
  assert.equal(observation.semantic_id, null);
  assert.equal(observation.identity_status, "not-published");
  assert.equal(observation.resolved_revision, "0123456789abcdef");
  assert.equal(observation.inventory.file_count, 5);
  assert.equal(observation.inventory.build_systems[0].id, "node");
  assert.match(observation.candidate_world.uncertainty.join(" "), /provenance, not semantic identity/);
  assert.equal(calls.every((call) => call.init.redirect === "error"), true);
  assert.equal(calls.every((call) => !String(call.url).includes("example.com")), true);
});

test("Bitbucket observation requests bounded recursion and retains nested files", async () => {
  const seen = [];
  const base = "https://api.bitbucket.org/2.0/repositories/acme/demo";
  const observation = await observePublicRepository({ url: "https://bitbucket.org/acme/demo" }, {
    observedAt: () => "2026-08-26T12:00:00.000Z",
    fetcher: async (url, init) => {
      seen.push({ url, init });
      if (url === base) return response({ is_private: false, mainbranch: { name: "main" } });
      if (url === `${base}/commit/main`) return response({ hash: "0123456789abcdef" });
      if (url.startsWith(`${base}/src/0123456789abcdef/`)) return response({ values: [
        { type: "commit_directory", path: "src" },
        { type: "commit_file", path: "src/main.rs", size: 1200 },
        { type: "commit_file", path: "Cargo.toml", size: 200 },
      ] });
      throw new Error(`unexpected ${url}`);
    },
  });
  const treeUrl = new URL(seen.at(-1).url);
  assert.equal(treeUrl.searchParams.get("max_depth"), "25");
  assert.equal(treeUrl.searchParams.get("pagelen"), "100");
  assert.equal(observation.inventory.paths.includes("src/main.rs"), true);
  assert.equal(observation.inventory.truncated, false);
});

test("scaffold generates review-only files and a deterministic add patch", async () => {
  const observation = { ...(await observePublicRepository({ url: "https://github.com/acme/demo" }, { fetcher: githubFetch, observedAt: () => "2026-08-26T12:00:00.000Z" })), id: "obs_123" };
  const scaffold = createRepositoryScaffold(observation, { capabilities: ["ci", "test", "authority", "build"] }, {
    authorityPin: {
      language: { repository: "clpi/idol", commit: "lang123" },
      native: { repository: "clpi/idol-native", commit: "native123" },
    },
    createdAt: () => "2026-08-26T12:01:00.000Z",
  });
  assert.equal(scaffold.status, "preview");
  assert.equal(scaffold.executed, false);
  assert.equal(scaffold.repository_written, false);
  assert.equal(scaffold.semantic_id, null);
  assert.deepEqual(scaffold.capabilities, ["authority", "build", "ci", "test"]);
  assert.deepEqual(scaffold.files.map((file) => file.path), [
    ".idol/authority.json",
    ".idol/project.json",
    ".idol/README.md",
    ".github/workflows/idol.yml",
  ]);
  assert.match(scaffold.patch, /diff --git a\/\.idol\/authority\.json/);
  assert.match(scaffold.files.at(-1).content, /https:\/\/idol\.id\/install/);
  assert.match(scaffold.files.at(-1).content, /idol build/);
  assert.match(scaffold.files.at(-1).content, /idol test/);
});

test("scaffold refuses path conflicts rather than overwriting", () => {
  const observation = {
    schema: "idol.web.repository.observation.v1",
    id: "obs_conflict",
    provider: "github",
    coordinate: "github:acme/demo",
    resolved_revision: "abc",
    inventory: { paths: [".idol/authority.json"], build_systems: [], commands: [], tests: [], benchmarks: [] },
  };
  const scaffold = createRepositoryScaffold(observation, { capabilities: ["authority"] }, {
    authorityPin: { language: { commit: "a" }, native: { commit: "b" } },
    createdAt: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(scaffold.status, "refused");
  assert.equal(scaffold.refusal.code, "SCAFFOLD_PATH_CONFLICT");
  assert.deepEqual(scaffold.refusal.paths, [".idol/authority.json"]);
});

test("scaffold refuses incomplete inventories before claiming paths are unused", () => {
  const observation = {
    schema: "idol.web.repository.observation.v1",
    id: "obs_truncated",
    provider: "github",
    coordinate: "github:acme/large",
    resolved_revision: "abc",
    inventory: { truncated: true, paths: [], build_systems: [], commands: [], tests: [], benchmarks: [] },
  };
  const scaffold = createRepositoryScaffold(observation, { capabilities: ["authority"] }, {
    authorityPin: { language: { commit: "a" }, native: { commit: "b" } },
    createdAt: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(scaffold.status, "refused");
  assert.equal(scaffold.refusal.code, "SCAFFOLD_INCOMPLETE_INVENTORY");
  assert.deepEqual(scaffold.files, []);
  assert.equal(scaffold.patch, "");
});
