import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("migration 0007 adds the Live causal-history and frontier store without rewriting shipped migrations", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const name of [
    "0001_platform_identity.sql",
    "0002_repository_observation.sql",
    "0003_repository_observation_summary.sql",
    "0004_repository_scaffold_summary.sql",
    "0005_repository_transformation.sql",
    "0006_universe_views.sql",
    "0007_live_control_plane.sql",
  ]) database.exec(await read(`migrations/${name}`));

  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
  for (const table of [
    "live_application",
    "live_event",
    "live_frontier",
    "live_node",
    "live_project",
    "live_project_member",
  ]) assert.ok(tables.includes(table), `missing ${table}`);

  const now = "2026-08-28T21:30:00.000Z";
  database.prepare("INSERT INTO platform_profile(subject,email,display_name,created_at,updated_at) VALUES(?1,?2,?3,?4,?4)")
    .run("subject-1", "owner@example.test", "Owner", now);
  database.prepare(`INSERT INTO live_project(id,subject,name,slug,summary,visibility,universe_view_id,document,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,NULL,?7,?8,?8)`).run(
      "lp_abcdefghijkl", "subject-1", "Project", "project", "summary", "private", "{}", now,
    );
  database.prepare("INSERT INTO live_project_member(project_id,subject,role,created_at) VALUES(?1,?2,?3,?4)")
    .run("lp_abcdefghijkl", "subject-1", "owner", now);
  database.prepare(`INSERT INTO live_event(id,project_id,subject,kind,predecessor_ids,intent_id,application_ids,payload,created_at)
    VALUES(?1,?2,?3,?4,?5,NULL,?6,?7,?8)`).run(
      "le_abcdefghijkl", "lp_abcdefghijkl", "subject-1", "attempted", "[]", "[]", "{}", now,
    );
  database.prepare(`INSERT INTO live_frontier(id,project_id,subject,event_id,state,reason,created_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7)`).run(
      "lf_abcdefghijkl", "lp_abcdefghijkl", "subject-1", "le_abcdefghijkl", "admitted", "witnessed", now,
    );

  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM live_project").get().count, 1);
  assert.equal(database.prepare("SELECT state FROM live_frontier").get().state, "admitted");
  assert.throws(() => database.prepare(`INSERT INTO live_project(id,subject,name,slug,summary,visibility,universe_view_id,document,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,NULL,?7,?8,?8)`).run(
      "lp_mnopqrstuvwx", "subject-1", "Duplicate", "project", "summary", "private", "{}", now,
    ), /UNIQUE constraint failed/);
  database.close();
});

test("Live migration keeps foreign keys and append-only frontier history enforceable", async () => {
  const source = await read("migrations/0007_live_control_plane.sql");
  assert.match(source, /PRAGMA foreign_keys = ON/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS live_frontier/);
  assert.match(source, /FOREIGN KEY\(event_id\) REFERENCES live_event\(id\)/);
  assert.doesNotMatch(source, /UPDATE\s+live_frontier|DELETE\s+FROM\s+live_frontier/i);
});
