CREATE TABLE IF NOT EXISTS platform_universe_view (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  lens TEXT NOT NULL DEFAULT 'constellation'
    CHECK (lens IN ('constellation', 'reach', 'authority', 'projection', 'security')),
  selection_count INTEGER NOT NULL DEFAULT 0,
  violation_count INTEGER NOT NULL DEFAULT 0,
  document TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_universe_view_subject_updated
  ON platform_universe_view(subject, updated_at DESC);

CREATE INDEX IF NOT EXISTS platform_universe_view_public_updated
  ON platform_universe_view(visibility, updated_at DESC)
  WHERE visibility = 'public';
