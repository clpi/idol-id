PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS platform_profile (
  subject TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_profile_email
  ON platform_profile(email);

CREATE TABLE IF NOT EXISTS platform_token (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  digest TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS platform_token_subject_created
  ON platform_token(subject, created_at DESC);

CREATE INDEX IF NOT EXISTS platform_token_active
  ON platform_token(subject, revoked_at, expires_at);

CREATE TABLE IF NOT EXISTS platform_audit (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  type TEXT NOT NULL,
  target TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS platform_audit_subject_created
  ON platform_audit(subject, created_at DESC);
