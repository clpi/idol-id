CREATE TABLE IF NOT EXISTS platform_repository_observation (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL,
  namespace TEXT NOT NULL,
  repository TEXT NOT NULL,
  resolved_revision TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  inventory_truncated INTEGER NOT NULL CHECK (inventory_truncated IN (0, 1)),
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
