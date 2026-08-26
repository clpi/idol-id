import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const originalMigration = `CREATE TABLE IF NOT EXISTS platform_repository_observation (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL,
  namespace TEXT NOT NULL,
  repository TEXT NOT NULL,
  resolved_revision TEXT NOT NULL,
  document TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_repository_observation_subject_created
  ON platform_repository_observation(subject, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_repository_scaffold (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  document TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(observation_id) REFERENCES platform_repository_observation(id)
);

CREATE INDEX IF NOT EXISTS platform_repository_scaffold_subject_created
  ON platform_repository_scaffold(subject, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_repository_scaffold_observation
  ON platform_repository_scaffold(subject, observation_id);
`;

test("applied repository migration 0002 remains byte-for-byte immutable", async () => {
  assert.equal(await readFile("migrations/0002_repository_observation.sql", "utf8"), originalMigration);
});

test("follow-up migration 0003 adds and backfills every bounded observation summary field", async () => {
  const migration = await readFile("migrations/0003_repository_observation_summary.sql", "utf8");
  for (const column of ["coordinate", "requested_ref", "default_branch", "file_count", "truncated"]) {
    assert.match(migration, new RegExp(`ALTER TABLE platform_repository_observation\\s+ADD COLUMN ${column}\\b`), column);
  }
  assert.match(migration, /UPDATE platform_repository_observation/);
  assert.match(migration, /json_extract\(document, '\$\.coordinate'\)/);
  assert.match(migration, /json_extract\(document, '\$\.requested_ref'\)/);
  assert.match(migration, /json_extract\(document, '\$\.default_branch'\)/);
  assert.match(migration, /json_extract\(document, '\$\.inventory\.file_count'\)/);
  assert.match(migration, /json_extract\(document, '\$\.inventory\.truncated'\)/);
});
