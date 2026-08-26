import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { repositoryScaffoldSummary } from "../shared/repository-core.js";
import { createD1RepositoryStore } from "../shared/repository-d1.js";
import { createMemoryRepositoryStore } from "../shared/repository-memory.js";
import { createRepositoryService } from "../shared/repository-service.js";

const timestamp = "2026-08-26T21:00:00.000Z";
const authorityPin = {
  language: { repository: "clpi/idol", commit: "language" },
  native: { repository: "clpi/idol-native", commit: "native" },
};

function audit(id) {
  return {
    id: `audit_${id}`,
    subject: "user",
    actor_email: "user@example.com",
    type: "repository.test",
    target: id,
    metadata: {},
    created_at: timestamp,
  };
}

function observation(index = 0) {
  return {
    schema: "idol.web.repository.observation.v1",
    semantic_id: null,
    identity_status: "not-published",
    authority: "repository provenance only",
    provider: "github",
    namespace: "acme",
    repository: `demo-${index}`,
    coordinate: `github:acme/demo-${index}`,
    source_url: `https://github.com/acme/demo-${index}`,
    requested_ref: "main",
    default_branch: "main",
    resolved_revision: `revision-${index}`,
    visibility: "public",
    observed_at: timestamp,
    inventory: {
      file_count: 1,
      truncated: false,
      paths: ["Cargo.toml"],
      bytes: { known: 10, sized_files: 1, total_files: 1 },
      languages: { other: 1 },
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
      provenance: { provider: "github", coordinate: `github:acme/demo-${index}`, revision: `revision-${index}` },
      requirements: [],
      uncertainty: [],
    },
  };
}

test("scaffold summaries exclude generated files and patches", () => {
  const summary = repositoryScaffoldSummary({
    id: "scf_summary",
    observation_id: "obs_summary",
    status: "refused",
    file_count: 0,
    refusal_code: "SCAFFOLD_PATH_CONFLICT",
    created_at: timestamp,
    files: [{ path: ".idol/authority.json", content: "large" }],
    patch: "large patch",
  });
  assert.deepEqual(summary, {
    schema: "idol.web.repository.scaffold.summary.v1",
    id: "scf_summary",
    observation_id: "obs_summary",
    status: "refused",
    file_count: 0,
    refusal_code: "SCAFFOLD_PATH_CONFLICT",
    created_at: timestamp,
  });
  assert.equal("files" in summary, false);
  assert.equal("patch" in summary, false);
});

test("repository service projects bounded scaffold fields into the atomic record", async () => {
  const observations = new Map();
  let scaffoldRecord;
  const store = {
    async commitObservation(record) {
      observations.set(record.id, record.document);
      return record.document;
    },
    async listObservations() { return []; },
    async getObservation(_subject, id) { return observations.get(id) || null; },
    async commitScaffold(record) {
      scaffoldRecord = record;
      return record.document;
    },
    async listScaffolds() { return []; },
    async getScaffold() { return null; },
  };
  const service = createRepositoryService({
    store,
    authorityPin,
    now: () => timestamp,
    randomBytes: () => new Uint8Array(12).fill(8),
  });
  const saved = await service.saveObservation({ subject: "user", email: "user@example.com" }, observation());
  const scaffold = await service.createScaffold({ subject: "user", email: "user@example.com" }, saved.id, { capabilities: ["authority"] });
  assert.equal(scaffold.status, "preview");
  assert.equal(scaffoldRecord.status, "preview");
  assert.equal(scaffoldRecord.file_count, 3);
  assert.equal(scaffoldRecord.refusal_code, null);
});

test("D1 scaffold lists select bounded columns rather than full documents", async () => {
  let sql = "";
  const database = {
    prepare(statement) {
      sql = statement;
      return {
        bind() {
          return {
            async all() {
              return { results: [{
                id: "scf_summary",
                observation_id: "obs_summary",
                status: "preview",
                file_count: 4,
                refusal_code: null,
                created_at: timestamp,
              }] };
            },
          };
        },
      };
    },
  };
  const listed = await createD1RepositoryStore(database).listScaffolds("user", 50);
  assert.doesNotMatch(sql, /\bdocument\b/i);
  assert.deepEqual(listed, [{
    schema: "idol.web.repository.scaffold.summary.v1",
    id: "scf_summary",
    observation_id: "obs_summary",
    status: "preview",
    file_count: 4,
    refusal_code: null,
    created_at: timestamp,
  }]);
});

test("memory histories retain newest records when timestamps tie", async () => {
  const store = createMemoryRepositoryStore();
  for (let index = 0; index < 55; index += 1) {
    const observationId = `obs_${String(index).padStart(2, "0")}`;
    await store.commitObservation({
      id: observationId,
      subject: "user",
      provider: "github",
      namespace: "acme",
      repository: `demo-${index}`,
      coordinate: `github:acme/demo-${index}`,
      requested_ref: "main",
      default_branch: "main",
      resolved_revision: `revision-${index}`,
      file_count: index,
      truncated: false,
      document: { ...observation(index), id: observationId, created_at: timestamp },
      created_at: timestamp,
    }, audit(observationId));

    const scaffoldId = `scf_${String(index).padStart(2, "0")}`;
    await store.commitScaffold({
      id: scaffoldId,
      subject: "user",
      observation_id: observationId,
      status: "preview",
      file_count: index,
      refusal_code: null,
      document: {
        schema: "idol.web.repository.scaffold.v1",
        id: scaffoldId,
        observation_id: observationId,
        status: "preview",
        files: [{ path: ".idol/authority.json", content: "large" }],
        patch: "large patch",
        created_at: timestamp,
      },
      created_at: timestamp,
    }, audit(scaffoldId));
  }

  const observations = await store.listObservations("user", 50);
  const scaffolds = await store.listScaffolds("user", 50);
  assert.equal(observations[0].id, "obs_54");
  assert.equal(observations.at(-1).id, "obs_05");
  assert.equal(scaffolds[0].id, "scf_54");
  assert.equal(scaffolds.at(-1).id, "scf_05");
  assert.equal("files" in scaffolds[0], false);
  assert.equal("patch" in scaffolds[0], false);
});

test("forward migration 0004 adds and backfills bounded scaffold history fields", async () => {
  const migration = await readFile(new URL("../migrations/0004_repository_scaffold_summary.sql", import.meta.url), "utf8");
  assert.match(migration, /ALTER TABLE platform_repository_scaffold\s+ADD COLUMN status\b/);
  assert.match(migration, /ADD COLUMN file_count\b/);
  assert.match(migration, /ADD COLUMN refusal_code\b/);
  assert.match(migration, /UPDATE platform_repository_scaffold/);
  assert.match(migration, /json_extract\(document, '\$\.status'\)/);
  assert.match(migration, /json_array_length\(document, '\$\.files'\)/);
  assert.match(migration, /json_extract\(document, '\$\.refusal\.code'\)/);
});

test("forward migration 0004 tolerates malformed historical scaffold JSON", async () => {
  const migration = await readFile(new URL("../migrations/0004_repository_scaffold_summary.sql", import.meta.url), "utf8");
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`
      CREATE TABLE platform_repository_scaffold (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        observation_id TEXT NOT NULL,
        document TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO platform_repository_scaffold(id, subject, observation_id, document, created_at)
      VALUES ('scf_invalid', 'user', 'obs_invalid', '{', '${timestamp}');
    `);
    database.exec(migration);
    const row = database.prepare(`
      SELECT status, file_count, refusal_code
      FROM platform_repository_scaffold
      WHERE id = 'scf_invalid'
    `).get();
    assert.deepEqual({ ...row }, { status: "preview", file_count: 0, refusal_code: null });
  } finally {
    database.close();
  }
});
