import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Universe workspace is packaged for authenticated Platform and public Worlds routes", async () => {
  const [html, app, worker, build, shell] = await Promise.all([
    read("apps/universe/index.html"),
    read("shared/universe-app.js"),
    read("worker/entry.js"),
    read("scripts/build.mjs"),
    read("shared/shell.js"),
  ]);
  assert.match(html, /Universe Views/i);
  assert.match(html, /id="universe-catalog"/);
  assert.match(html, /id="universe-constellation"/);
  assert.match(html, /id="universe-analysis"/);
  assert.match(html, /id="universe-boundary"/);
  assert.match(app, /\/v1\/universe\/browser\/views/);
  assert.match(app, /const PUBLIC_VIEWS = "\/v1\/universe\/public"/);
  assert.match(app, /\$\{PUBLIC_VIEWS\}\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(worker, /info\.surface === "platform" \|\| info\.surface === "worlds"/);
  assert.match(worker, /\/apps\/universe\/index\.html/);
  assert.match(build, /"universe"/);
  assert.match(build, /platform-universe-entry\.js/);
  assert.doesNotMatch(shell, /id:\s*"universe"/);
  assert.match(shell, /public universe views/i);
  assert.match(shell, /manage universe views/i);
});

test("local public Universe mode follows the routing query and canonical config object", async () => {
  const [app, worker] = await Promise.all([
    read("shared/universe-app.js"),
    read("worker/entry.js"),
  ]);
  assert.doesNotMatch(app, /IDOL_CONFIG/);
  assert.match(app, /new URLSearchParams\(location\.search\)\.get\("mode"\) === "public"/);
  assert.match(app, /window\.IDOL\?\.(?:app|surface) === "worlds"/);
  assert.match(worker, /url\.searchParams\.get\("mode"\) === "public"/);
});

test("Universe UI is mobile-first, touch-accessible, and typography-safe", async () => {
  const html = await read("apps/universe/index.html");
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /@media\s*\(max-width:\s*700px\)/);
  assert.match(html, /min-height:\s*44px/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /var\(--sans\)/);
  assert.match(html, /var\(--mono\)/);
  assert.match(html, /data-view="catalog"/);
  assert.match(html, /data-view="analysis"/);
  assert.match(html, /data-view="boundary"/);
});

test("Universe presentation names exact non-semantic boundaries", async () => {
  const [html, app, manifestBuild, platformEntry] = await Promise.all([
    read("apps/universe/index.html"),
    read("shared/universe-app.js"),
    read("scripts/build.mjs"),
    read("shared/platform-universe-entry.js"),
  ]);
  for (const source of [html, app, platformEntry]) {
    assert.match(source, /one semantic universe|operational[- ](?:view|projection)/i);
  }
  assert.match(html, /does not prove composition/i);
  assert.match(html, /does not grant authority/i);
  assert.match(manifestBuild, /universe/);
  assert.match(manifestBuild, /operational-projection/);
  assert.match(manifestBuild, /dispatcher_access:false/);
  assert.doesNotMatch(app, /semantic_id\s*:\s*["'][^"']+["']/);
});

test("Universe documentation and additive migration are present", async () => {
  const [docs, migration, scopes] = await Promise.all([
    read("content/docs/universe.md"),
    read("migrations/0006_universe_views.sql"),
    read("shared/platform-auth.js"),
  ]);
  assert.match(docs, /Universe Views/);
  assert.match(docs, /not a second semantic universe/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_universe_view/);
  assert.match(migration, /visibility/);
  assert.match(migration, /selection_count/);
  assert.match(migration, /violation_count/);
  assert.match(scopes, /"universe:read"/);
  assert.match(scopes, /"universe:write"/);
});
