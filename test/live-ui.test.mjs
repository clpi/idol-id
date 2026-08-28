import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Live UI is an interactive exact-record workbench, not decorative graph theatre", async () => {
  const [html, script, css] = await Promise.all([
    read("apps/live/index.html"),
    read("shared/live-app.js"),
    read("shared/live-app.css"),
  ]);
  for (const id of ["live-project-form", "live-node-form", "live-application-form", "live-event-form", "live-frontier-form", "live-world-form"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const view of ["projects", "graph", "history", "facts"]) assert.match(html, new RegExp(`data-mobile-view="${view}"`));
  assert.doesNotMatch(html + script, /Math\.random\(/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.match(script, /const API = "\/v1\/live\/browser"/);
  assert.match(script, /application\.relation/);
  assert.match(script, /edge\.role/);
  assert.match(script, /edge\.source/);
  assert.match(script, /edge\.target/);
  assert.match(script, /semantic id[\s\S]*?not published/i);
  assert.match(script, /none granted by this view/i);
  assert.match(script, /addEventListener\("keydown"/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.doesNotMatch(css, /overflow-x:\s*auto/);
});

test("hosted MCP page explains endpoint, auth, scopes, protocol, and transport boundaries", async () => {
  const html = await read("apps/mcp/index.html");
  assert.match(html, /https:\/\/mcp\.idol\.id\/mcp/);
  assert.match(html, /2026-07-28/);
  assert.match(html, /2025-11-25/);
  assert.match(html, /mcp:connect/);
  assert.match(html, /API token/i);
  assert.match(html, /stateless/i);
  assert.match(html, /HTTP projection/i);
  assert.match(html, /semantic authority/i);
  assert.match(html, /platform\.idol\.id/);
  assert.match(html, /localStorage/);
  assert.match(html, /sessionStorage/);
});

test("shared chrome and immutable-build adapters expose Live and hosted MCP without duplicating semantic authority", async () => {
  const [shell, platformEntry, siteEntry, buildLive] = await Promise.all([
    read("shared/shell.js"),
    read("shared/platform-live-entry.js"),
    read("shared/site-live-entry.js"),
    read("scripts/build-live.mjs"),
  ]);
  assert.match(shell, /id:\s*"live"[\s\S]*?https:\/\/live\.idol\.id\//);
  assert.match(shell, /https:\/\/mcp\.idol\.id\//);
  for (const scope of ["live:read", "live:write", "mcp:connect", "world:write"]) assert.match(platformEntry, new RegExp(scope.replace(":", "\\:")));
  assert.match(siteEntry, /Live/);
  assert.match(siteEntry, /MCP/);
  assert.match(buildLive, /platform-live-entry\.js/);
  assert.match(buildLive, /site-live-entry\.js/);
});

test("required real-Chrome gate covers Live and MCP on mobile and desktop", async () => {
  const smoke = await read("scripts/live-mcp-browser-smoke.mjs");
  assert.match(smoke, /live-mobile\.png/);
  assert.match(smoke, /live-desktop\.png/);
  assert.match(smoke, /mcp-mobile\.png/);
  assert.match(smoke, /mcp-desktop\.png/);
  assert.match(smoke, /390, 844/);
  assert.match(smoke, /1440, 900/);
  assert.match(smoke, /scrollWidth/);
  assert.match(smoke, /height\s*<\s*44|height<44/);
  assert.match(smoke, /Runtime\.exceptionThrown/);
});
