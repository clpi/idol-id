import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Repository Observatory publishes a responsive fourth transformation lens", async () => {
  const [html, app, css] = await Promise.all([
    readFile("apps/repository/index.html", "utf8"),
    readFile("shared/repository-app.js", "utf8"),
    readFile("shared/repository-app.css", "utf8"),
  ]);
  assert.match(html, /isolated derived-world delta/i);
  assert.match(html, /without executing or writing/i);
  assert.match(app, /data-lens="transform"/);
  assert.match(app, /\/repo\/\$\{kind\}/);
  assert.match(app, /observation\|scaffold\|transformation/);
  assert.match(app, /scaffolds\/\$\{encodeURIComponent\(state\.scaffold\.id\)\}\/transformations/);
  assert.match(app, /Derived-world preview recorded/);
  assert.match(app, /source_world_mutated/);
  assert.match(app, /world_published/);
  assert.match(app, /required_grants/);
  assert.match(app, /download-transform-patch/);
  assert.match(app, /\["inventory", "world", "scaffold", "transform"\]/);
  assert.match(css, /\.transform-options/);
  assert.match(css, /@media\(max-width:699px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("Platform and build projections describe preview authority without execution claims", async () => {
  const [entry, build, docs, migration] = await Promise.all([
    readFile("shared/platform-repository-entry.js", "utf8"),
    readFile("scripts/build.mjs", "utf8"),
    readFile("content/docs/repository.md", "utf8"),
    readFile("migrations/0005_repository_transformation.sql", "utf8"),
  ]);
  assert.match(entry, /programCard\("N"\)/);
  assert.match(entry, /preview live/);
  assert.match(entry, /repository:transform/);
  assert.match(entry, /Nothing executes/);
  assert.match(build, /derived-world-preview-only/);
  assert.match(build, /world_publication:false/);
  assert.match(docs, /Derived-world transformation previews/);
  assert.match(docs, /repository:transform/);
  assert.match(docs, /not-granted/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_repository_transformation/);
});
