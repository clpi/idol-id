CREATE TABLE IF NOT EXISTS platform_repository_transformation (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  scaffold_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('preview', 'refused')),
  selected_file_count INTEGER NOT NULL DEFAULT 0,
  evidence_status TEXT NOT NULL DEFAULT 'unexecuted',
  refusal_code TEXT,
  document TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (observation_id) REFERENCES platform_repository_observation(id),
  FOREIGN KEY (scaffold_id) REFERENCES platform_repository_scaffold(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_repository_transformation_subject_created
  ON platform_repository_transformation(subject, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_repository_transformation_scaffold
  ON platform_repository_transformation(subject, scaffold_id, created_at DESC);
