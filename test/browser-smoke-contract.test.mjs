import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("verified builds execute real Chrome gates for the homepage and semantic products", async () => {
  const [workflow, runner, smoke, home] = await Promise.all([
    read(".github/workflows/deploy.yml"),
    read("scripts/run-browser-smoke.mjs"),
    read("scripts/browser-smoke.mjs"),
    read("scripts/home-browser-smoke.mjs"),
  ]);

  assert.match(workflow, /node scripts\/run-browser-smoke\.mjs/);
  assert.match(runner, /scripts\/browser-smoke\.mjs/);
  assert.match(runner, /scripts\/live-mcp-browser-smoke\.mjs/);
  assert.match(runner, /scripts\/home-browser-smoke\.mjs/);
  assert.match(workflow, /idol-browser-smoke-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /\.artifacts\/browser-smoke/);
  assert.match(smoke, /390, 844/);
  assert.match(smoke, /1440, 900/);
  assert.match(smoke, /\.semantic-token/);
  assert.match(smoke, /#analyze/);
  assert.match(smoke, /relation:weight/);
  assert.match(smoke, /\.graph-edge/);
  for (const lens of ["identity", "edges", "occurrences", "worlds", "projection", "witness", "realization", "raw"]) {
    assert.match(smoke, new RegExp(`"${lens}"`));
  }
  assert.match(smoke, /scrollWidth/);
  assert.match(smoke, /height < 44/);
  assert.match(smoke, /Runtime\.exceptionThrown/);
  assert.match(smoke, /observatory-mobile\.png/);
  assert.match(smoke, /observatory-desktop\.png/);

  for (const viewport of ["320, 568", "390, 844", "430, 932", "768, 1024", "1440, 900"]) assert.match(home, new RegExp(viewport.replace(" ", "\\s*")));
  assert.match(home, /Dynamic by default/);
  assert.match(home, /Native when known/);
  assert.match(home, /content\/source-examples\.json/);
  assert.match(home, /current-law/);
  assert.match(home, /scrollWidth/);
  assert.match(home, /height<44/);
  assert.match(home, /Runtime\.exceptionThrown/);
  assert.match(home, /homepage-\$\{width\}x\$\{height\}\.png/);
});

test("browser smoke closes Chrome before deleting its profile", async () => {
  const smoke = await read("scripts/browser-smoke.mjs");
  const finallyStart = smoke.lastIndexOf("} finally {");
  const finallyEnd = smoke.indexOf("\n  }\n}\n\nmain()", finallyStart);
  assert.notEqual(finallyStart, -1, "browser smoke must retain one explicit teardown boundary");
  assert.notEqual(finallyEnd, -1, "browser smoke teardown boundary must remain inspectable");

  const teardown = smoke.slice(finallyStart, finallyEnd);
  const terminate = teardown.indexOf("await terminateChrome(chrome, cdp)");
  const remove = teardown.indexOf("await rm(profile");
  assert.notEqual(terminate, -1, "Chrome termination must be awaited");
  assert.notEqual(remove, -1, "temporary profile cleanup must remain explicit");
  assert.ok(terminate < remove, "Chrome must fully exit before its profile is removed");
  assert.match(teardown, /maxRetries:\s*[1-9]/, "profile cleanup must tolerate late filesystem release");
});

test("browser smoke publishes the immutable build authority in its native fixture", async () => {
  const smoke = await read("scripts/browser-smoke.mjs");
  assert.doesNotMatch(smoke, /browser-smoke-authority/, "a fake authority makes the exact Observatory refuse the response");
  assert.match(smoke, /runtime\/authority\.json/, "the smoke fixture must read the immutable built authority asset");
  assert.match(smoke, /const browserAuthority = Object\.freeze/, "the fixture must hold one immutable authority projection");
  assert.match(smoke, /authority:\s*browserAuthority/, "the native fixture must publish the exact authority it read");
  assert.match(smoke, /authority:\$\{JSON\.stringify\(browserAuthority\.commit\)\}/, "the browser config must project the same exact authority commit");
});
