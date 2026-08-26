import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { observePublicRepository } from "../shared/repository.js";
import { createRepositoryScaffold } from "../shared/repository-scaffold.js";
import { createD1RepositoryStore } from "../shared/repository-d1.js";
import { createRepositoryService } from "../shared/repository-service.js";

const authorityPin = {
  language: { repository: "clpi/idol", commit: "language" },
  native: { repository: "clpi/idol-native", commit: "native" },
};

function completeObservation(overrides = {}) {
  return {
    schema: "idol.web.repository.observation.v1",
    semantic_id: null,
    identity_status: "not-published",
    authority: "repository provenance only",
    provider: "github",
    namespace: "acme",
    repository: "demo",
    coordinate: "github:acme/demo",
    source_url: "https://github.com/acme/demo",
    requested_ref: "main",
    default_branch: "main",
    resolved_revision: "abcdef123456",
    visibility: "public",
    observed_at: "2026-08-26T12:00:00.000Z",
    inventory: {
      file_count: 2,
      truncated: false,
      paths: ["Cargo.toml", "src/main.rs"],
      bytes: { known: 20, sized_files: 2, total_files: 2 },
      languages: { rust: 1, other: 1 },
      build_systems: [],
      manifests: [],
      tests: [],
      benchmarks: [],
      ci: [],
      commands: [],
    },
    candidate_world: {
      semantic_id: null,
      identity_status: "not-published",
      provenance: { provider: "github", coordinate: "github:acme/demo", revision: "abcdef123456" },
      requirements: [],
      uncertainty: [],
    },
    ...overrides,
  };
}

function fixedBytes() {
  return new Uint8Array(12).fill(9);
}

test("Bitbucket observation requests a bounded recursive source projection", async () => {
  const expectedTree = "https://api.bitbucket.org/2.0/repositories/acme/demo/src/abcdef123456/?max_depth=20&pagelen=100";
  const responses = new Map([
    ["https://api.bitbucket.org/2.0/repositories/acme/demo", { is_private: false, mainbranch: { name: "main" } }],
    ["https://api.bitbucket.org/2.0/repositories/acme/demo/commit/main", { hash: "abcdef123456" }],
    [expectedTree, {
      values: [
        { type: "commit_directory", path: "src" },
        { type: "commit_file", path: "src/nested/module.rs", size: 12 },
      ],
    }],
  ]);
  const calls = [];
  const observed = await observePublicRepository({ url: "https://bitbucket.org/acme/demo" }, {
    fetcher: async (url) => {
      calls.push(url);
      if (!responses.has(url)) throw new Error(`unmapped Bitbucket request: ${url}`);
      return new Response(JSON.stringify(responses.get(url)), { headers: { "content-type": "application/json" } });
    },
    observedAt: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(calls.at(-1), expectedTree);
  assert.deepEqual(observed.inventory.paths, ["src/nested/module.rs"]);
  assert.equal(observed.inventory.truncated, false);
});

test("scaffolding refuses an incomplete provider inventory before asserting path absence", () => {
  const observation = completeObservation({
    inventory: { ...completeObservation().inventory, truncated: true, paths: [] },
  });
  const scaffold = createRepositoryScaffold(observation, { capabilities: ["authority", "ci"] }, {
    authorityPin,
    createdAt: () => "2026-08-26T12:00:00.000Z",
  });
  assert.equal(scaffold.status, "refused");
  assert.equal(scaffold.refusal.code, "SCAFFOLD_INVENTORY_INCOMPLETE");
  assert.equal(scaffold.patch, "");
  assert.deepEqual(scaffold.files, []);
});

test("repository service commits each record and its audit event through one store operation", async () => {
  const observations = new Map();
  const writes = [];
  const store = {
    async commitObservation(record, event) {
      writes.push({ kind: "observation", record, event });
      observations.set(record.id, record.document);
      return record.document;
    },
    async listObservations() { return [...observations.values()]; },
    async getObservation(_subject, id) { return observations.get(id) || null; },
    async commitScaffold(record, event) {
      writes.push({ kind: "scaffold", record, event });
      return record.document;
    },
    async listScaffolds() { return []; },
    async getScaffold() { return null; },
  };
  const service = createRepositoryService({
    store,
    authorityPin,
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: fixedBytes,
  });
  const observation = await service.saveObservation({ subject: "user", email: "user@example.com" }, completeObservation());
  await service.createScaffold({ subject: "user", email: "user@example.com" }, observation.id, { capabilities: ["authority"] });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].event.type, "repository.observed");
  assert.equal(writes[0].event.target, writes[0].record.id);
  assert.equal(writes[1].event.type, "repository.scaffold.previewed");
  assert.equal(writes[1].event.target, writes[1].record.id);
});

test("D1 record and audit writes use one transactional batch", async () => {
  const batches = [];
  let directRuns = 0;
  const database = {
    prepare(sql) {
      return {
        sql,
        bind(...parameters) { return { sql, parameters }; },
        async run() { directRuns += 1; },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
  const store = createD1RepositoryStore(database);
  const document = { ...completeObservation(), id: "obs_atomic_identifier", created_at: "2026-08-26T12:00:00.000Z" };
  const event = {
    id: "audit_atomic_identifier",
    subject: "user",
    actor_email: "user@example.com",
    type: "repository.observed",
    target: document.id,
    metadata: { file_count: 2 },
    created_at: document.created_at,
  };
  const saved = await store.commitObservation({
    id: document.id,
    subject: "user",
    provider: document.provider,
    namespace: document.namespace,
    repository: document.repository,
    coordinate: document.coordinate,
    requested_ref: document.requested_ref,
    default_branch: document.default_branch,
    resolved_revision: document.resolved_revision,
    file_count: document.inventory.file_count,
    truncated: document.inventory.truncated,
    document,
    created_at: document.created_at,
  }, event);
  assert.equal(saved.id, document.id);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.match(batches[0][0].sql, /INSERT INTO platform_repository_observation/);
  assert.match(batches[0][1].sql, /INSERT INTO platform_audit/);
  assert.equal(directRuns, 0);
});

test("D1 observation lists select bounded summary columns instead of full documents", async () => {
  const queries = [];
  const database = {
    prepare(sql) {
      queries.push(sql);
      return {
        bind() {
          return {
            async all() {
              return { results: [{
                id: "obs_summary_identifier",
                provider: "github",
                namespace: "acme",
                repository: "demo",
                coordinate: "github:acme/demo",
                requested_ref: "main",
                default_branch: "main",
                resolved_revision: "abcdef123456",
                file_count: 5000,
                truncated: 1,
                created_at: "2026-08-26T12:00:00.000Z",
              }] };
            },
          };
        },
      };
    },
  };
  const summaries = await createD1RepositoryStore(database).listObservations("user", 50);
  assert.doesNotMatch(queries[0], /\bdocument\b/i);
  assert.deepEqual(summaries, [{
    schema: "idol.web.repository.observation.summary.v1",
    id: "obs_summary_identifier",
    provider: "github",
    namespace: "acme",
    repository: "demo",
    coordinate: "github:acme/demo",
    requested_ref: "main",
    default_branch: "main",
    resolved_revision: "abcdef123456",
    inventory: { file_count: 5000, truncated: true },
    created_at: "2026-08-26T12:00:00.000Z",
  }]);
});

test("follow-up migration stores the canonical bounded observation summary facts", async () => {
  const migration = await readFile("migrations/0003_repository_observation_summary.sql", "utf8");
  for (const column of ["coordinate", "requested_ref", "default_branch", "file_count", "truncated"]) {
    assert.match(migration, new RegExp(`ALTER TABLE platform_repository_observation\\s+ADD COLUMN ${column}\\b`), column);
  }
  assert.match(migration, /UPDATE platform_repository_observation/);
});
