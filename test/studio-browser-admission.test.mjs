import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("deployment admits the Studio across the complete responsive viewport range", async () => {
  const [deploy, orchestrator, smoke, app, css] = await Promise.all([
    read(".github/workflows/deploy.yml"),
    read("scripts/run-browser-smoke.mjs"),
    read("scripts/studio-browser-smoke.mjs"),
    read("shared/studio-app.js"),
    read("shared/studio.css"),
  ]);
  assert.match(deploy, /node scripts\/run-browser-smoke\.mjs/);
  assert.match(orchestrator, /scripts\/studio-browser-smoke\.mjs/);
  assert.match(deploy, /\.artifacts\/studio-browser-smoke/);
  for (const viewport of ["[320, 568]", "[390, 844]", "[430, 932]", "[768, 1024]", "[1440, 900]"]) {
    assert.match(smoke, new RegExp(viewport.replace(/[\[\]]/g, "\\$&")));
  }
  assert.match(smoke, /scrollWidth > metrics\.clientWidth/);
  assert.match(smoke, /controls below 44px/);
  assert.match(smoke, /explicit analysis refusal/);
  assert.match(smoke, /minted graph presentation after refused analysis/);
  assert.match(smoke, /Idol command palette|command palette/);
  assert.match(smoke, /Page\.captureScreenshot/);
  assert.match(app, /const graphEmpty = graphView\.empty/);
  assert.doesNotMatch(app, /const graphEmpty = q\("#studio-graph-empty"\)/);
  assert.match(css, /\.idol-drawer \{[\s\S]*?transform: translateY\(7px\)/);
  assert.doesNotMatch(css, /translateX\(102%\)/);
});