import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createD1RepositoryStore } from "../shared/repository-d1.js";

function fakeDatabase() {
  const state = {
    batches: [],
    runs: [],
    listSql: "",
    observationRow: null,
    scaffoldRow: null,
    summaryRows: [],
  };
  const database = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async run() { state.runs.push(this); return { success: true }; },
        async first() {
          if (/platform_repository_scaffold/i.test(sql)) return state.scaffoldRow;
          if (/platform_repository_observation/i.test(sql)) return state.observationRow;
          return null;
        },
        async all() {
          state.listSql = sql;
          return { results: state.summaryRows };
        },
      };
    },
    async batch(statements) {
      state.batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
  return { database, state };
}

const observationDocument = {
  schema: "idol.web.repository.observation.v1",
  provider: "github",
  namespace: "acme",
  repository: "demo",
  coordinate: "github:acme/demo",
  requested_ref: "HEAD",
  default_branch: "main",
  resolved_revision: "abc123",
  inventory: { file_count: 2, truncated: false, paths: ["package.json", "src/index.js"] },
};

function audit(target, type) {
  return {
    id: `audit_${target}`,
    subject: "user-1",
    actor_email: "user@example.com",
    type,
    target,
    metadata: { exact: true },
    created_at: "2026-08-26T12:00:00.000Z",
  };
}

test("D1 commits repository records and audit events in one database batch", async () => {
  const { database, state } = fakeDatabase();
  const store = createD1RepositoryStore(database);
  const observationRecord = {
    id: "obs_atomic",
    subject: "user-1",
    provider: "github",
    namespace: "acme",
    repository: "demo",
    coordinate: "github:acme/demo",
    requested_ref: "HEAD",
    default_branch: "main",
    resolved_revision: "abc123",
    file_count: 2,
    truncated: false,
    document: { ...observationDocument, id: "obs_atomic" },
    created_at: "2026-08-26T12:00:00.000Z",
  };
  state.observationRow = {
    id: observationRecord.id,
    document: JSON.stringify(observationRecord.document),
    created_at: observationRecord.created_at,
  };
  const savedObservation = await store.commitObservation(observationRecord, audit(observationRecord.id, "repository.observed"));
  assert.equal(savedObservation.id, observationRecord.id);
  assert.equal(state.batches.length, 1);
  assert.equal(state.batches[0].length, 2);
  assert.match(state.batches[0][0].sql, /INSERT INTO platform_repository_observation/i);
  assert.match(state.batches[0][1].sql, /INSERT INTO platform_audit/i);

  const scaffoldRecord = {
    id: "scf_atomic",
    subject: "user-1",
    observation_id: observationRecord.id,
    document: { schema: "idol.web.repository.scaffold.v1", id: "scf_atomic", observation_id: observationRecord.id, status: "preview" },
    created_at: "2026-08-26T12:01:00.000Z",
  };
  state.scaffoldRow = {
    id: scaffoldRecord.id,
    observation_id: observationRecord.id,
    document: JSON.stringify(scaffoldRecord.document),
    created_at: scaffoldRecord.created_at,
  };
  const savedScaffold = await store.commitScaffold(scaffoldRecord, audit(scaffoldRecord.id, "repository.scaffold.previewed"));
  assert.equal(savedScaffold.id, scaffoldRecord.id);
  assert.equal(state.batches.length, 2);
  assert.equal(state.batches[1].length, 2);
  assert.match(state.batches[1][0].sql, /INSERT INTO platform_repository_scaffold/i);
  assert.match(state.batches[1][1].sql, /INSERT INTO platform_audit/i);
  assert.equal(state.runs.length, 0);
});

test("D1 observation lists return bounded summaries without selecting full documents", async () => {
  const { database, state } = fakeDatabase();
  state.summaryRows = [{
    id: "obs_summary",
    provider: "github",
    namespace: "acme",
    repository: "large",
    coordinate: "github:acme/large",
    requested_ref: "HEAD",
    default_branch: "main",
    resolved_revision: "deadbeef",
    file_count: 5000,
    truncated: 1,
    created_at: "2026-08-26T12:00:00.000Z",
  }];
  const store = createD1RepositoryStore(database);
  const listed = await store.listObservations("user-1", 50);
  assert.doesNotMatch(state.listSql, /\bdocument\b/i);
  assert.deepEqual(listed, [{
    schema: "idol.web.repository.observation.summary.v1",
    id: "obs_summary",
    provider: "github",
    namespace: "acme",
    repository: "large",
    coordinate: "github:acme/large",
    requested_ref: "HEAD",
    default_branch: "main",
    resolved_revision: "deadbeef",
    inventory: { file_count: 5000, truncated: true },
    created_at: "2026-08-26T12:00:00.000Z",
  }]);
});

test("follow-up migration stores and backfills every bounded observation summary field", async () => {
  const migration = await readFile("migrations/0003_repository_observation_summary.sql", "utf8");
  for (const column of ["coordinate", "requested_ref", "default_branch", "file_count", "truncated"]) {
    assert.match(migration, new RegExp(`ALTER TABLE platform_repository_observation\\s+ADD COLUMN ${column}\\b`), column);
  }
  assert.match(migration, /UPDATE platform_repository_observation/);
  assert.match(migration, /json_extract\(document, '\$\.inventory\.file_count'\)/);
});
