import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createD1RepositoryStore } from "../shared/repository-d1.js";

function fakeDatabase() {
  const state = {
    batches: [],
    runs: [],
    listSql: "",
    observationRows: [],
    scaffoldRows: [],
  };
  const database = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async run() { state.runs.push(this); return { success: true }; },
        async all() {
          state.listSql = sql;
          return { results: /platform_repository_scaffold/i.test(sql) ? state.scaffoldRows : state.observationRows };
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
    resolved_revision: "abc123",
    file_count: 2,
    inventory_truncated: false,
    document: { ...observationDocument, id: "obs_atomic" },
    created_at: "2026-08-26T12:00:00.000Z",
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
    status: "preview",
    file_count: 4,
    refusal_code: null,
    document: {
      schema: "idol.web.repository.scaffold.v1",
      id: "scf_atomic",
      observation_id: observationRecord.id,
      status: "preview",
      files: [{ path: ".idol/authority.json" }],
      patch: "large patch body",
    },
    created_at: "2026-08-26T12:01:00.000Z",
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
  state.observationRows = [{
    id: "obs_summary",
    provider: "github",
    namespace: "acme",
    repository: "large",
    resolved_revision: "deadbeef",
    file_count: 5000,
    inventory_truncated: 1,
    created_at: "2026-08-26T12:00:00.000Z",
  }];
  const listed = await createD1RepositoryStore(database).listObservations("user-1", 50);
  assert.doesNotMatch(state.listSql, /\bdocument\b/i);
  assert.deepEqual(listed, [{
    schema: "idol.web.repository.observation.summary.v1",
    id: "obs_summary",
    provider: "github",
    namespace: "acme",
    repository: "large",
    coordinate: "github:acme/large",
    resolved_revision: "deadbeef",
    inventory: { file_count: 5000, truncated: true },
    created_at: "2026-08-26T12:00:00.000Z",
  }]);
});

test("D1 scaffold lists return bounded summaries without files or patches", async () => {
  const { database, state } = fakeDatabase();
  state.scaffoldRows = [{
    id: "scf_summary",
    observation_id: "obs_summary",
    status: "refused",
    file_count: 0,
    refusal_code: "SCAFFOLD_PATH_CONFLICT",
    created_at: "2026-08-26T12:01:00.000Z",
  }];
  const listed = await createD1RepositoryStore(database).listScaffolds("user-1", 50);
  assert.doesNotMatch(state.listSql, /\bdocument\b/i);
  assert.deepEqual(listed, [{
    schema: "idol.web.repository.scaffold.summary.v1",
    id: "scf_summary",
    observation_id: "obs_summary",
    status: "refused",
    file_count: 0,
    refusal_code: "SCAFFOLD_PATH_CONFLICT",
    created_at: "2026-08-26T12:01:00.000Z",
  }]);
  assert.equal("files" in listed[0], false);
  assert.equal("patch" in listed[0], false);
});

test("forward migration stores and backfills bounded repository summary facts", async () => {
  const [shipped, forward] = await Promise.all([
    readFile("migrations/0002_repository_observation.sql", "utf8"),
    readFile("migrations/0003_repository_summary_columns.sql", "utf8"),
  ]);
  assert.doesNotMatch(shipped, /file_count|inventory_truncated|refusal_code/);
  assert.match(forward, /file_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(forward, /inventory_truncated INTEGER NOT NULL DEFAULT 0/);
  assert.match(forward, /status TEXT NOT NULL DEFAULT 'preview'/);
  assert.match(forward, /refusal_code TEXT/);
  assert.match(forward, /json_extract\(document, '\$\.inventory\.file_count'\)/);
  assert.match(forward, /json_array_length\(document, '\$\.files'\)/);
});
