PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS live_project (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK(visibility IN ('private', 'public')),
  universe_view_id TEXT,
  document TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE,
  FOREIGN KEY(universe_view_id) REFERENCES platform_universe_view(id) ON DELETE SET NULL,
  UNIQUE(subject, slug)
);

CREATE INDEX IF NOT EXISTS live_project_subject_updated
  ON live_project(subject, updated_at DESC);

CREATE TABLE IF NOT EXISTS live_project_member (
  project_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'member', 'viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(project_id, subject),
  FOREIGN KEY(project_id) REFERENCES live_project(id) ON DELETE CASCADE,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_node (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES live_project(id) ON DELETE CASCADE,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS live_node_project_created
  ON live_node(project_id, created_at);

CREATE TABLE IF NOT EXISTS live_application (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  relation_identity TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES live_project(id) ON DELETE CASCADE,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS live_application_project_created
  ON live_application(project_id, created_at);

CREATE TABLE IF NOT EXISTS live_event (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  predecessor_ids TEXT NOT NULL,
  intent_id TEXT,
  application_ids TEXT NOT NULL,
  payload TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES live_project(id) ON DELETE CASCADE,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE,
  FOREIGN KEY(intent_id) REFERENCES live_node(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS live_event_project_created
  ON live_event(project_id, created_at);

CREATE TABLE IF NOT EXISTS live_frontier (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  event_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('held', 'admitted', 'rejected', 'superseded', 'reversed')),
  reason TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES live_project(id) ON DELETE CASCADE,
  FOREIGN KEY(subject) REFERENCES platform_profile(subject) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES live_event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS live_frontier_project_created
  ON live_frontier(project_id, created_at);
CREATE INDEX IF NOT EXISTS live_frontier_event_created
  ON live_frontier(project_id, event_id, created_at);
