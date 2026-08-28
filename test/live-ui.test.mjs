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
  assert.match(html, /id="project-form"/);
  assert.match(html, /data-live-view="catalog"/);
  assert.match(html, /data-live-view="graph"/);
  assert.match(html, /data-live-view="history"/);
  assert.match(html, /data-live-view="facts"/);
  assert.match(html, /id="world-view-form"/);
  assert.match(html, /id="frontier-form"/);
  assert.match(html, /id="application-form"/);
  assert.match(html, /id="event-form"/);
  assert.doesNotMatch(html + script, /Math\.random\(/);
  assert.doesNotMatch(html, /<canvas\b/i);
  assert.match(script, /\/v1\/live\/browser\/projects/);
  assert.match(script, /application\.relation/);
  assert.match(script, /edge\.role/);
  assert.match(script, /semantic identity not published/i);
  assert.match(script, /authority grant[^\n]*none/i);
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
  assert.match(html, /transport projection/i);
  assert.match(html, /semantic authority/i);
  assert.match(html, /platform\.idol\.id/);
});

test("shared product chrome and root/platform surfaces expose Live and hosted MCP without duplicating semantic authority", async () => {
  const [shell, site, platform] = await Promise.all([
    read("shared/shell.js"),
    read("apps/site/index.html"),
    read("apps/platform/index.html"),
  ]);
  assert.match(shell, /id:\s*"live"[\s\S]*?https:\/\/live\.idol\.id\//);
  assert.match(shell, /id:\s*"mcp"[\s\S]*?https:\/\/mcp\.idol\.id\//);
  assert.match(site, /Live/);
  assert.match(site, /MCP/);
  assert.match(platform, /live:read/);
  assert.match(platform, /live:write/);
  assert.match(platform, /mcp:connect/);
  assert.match(platform, /world:write/);
});

test("required browser gate covers Live and MCP on mobile and desktop", async () => {
  const smoke = await read("scripts/browser-smoke.mjs");
  assert.match(smoke, /live-mobile\.png/);
  assert.match(smoke, /live-desktop\.png/);
  assert.match(smoke, /mcp-mobile\.png/);
  assert.match(smoke, /390, 844/);
  assert.match(smoke, /1440, 900/);
  assert.match(smoke, /scrollWidth/);
  assert.match(smoke, /height < 44/);
  assert.match(smoke, /Runtime\.exceptionThrown/);
});
