import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("scaffold deep links load the full observation instead of reusing a bounded list summary", async () => {
  const source = await readFile("shared/repository-app.js", "utf8");
  const start = source.indexOf("async function selectScaffold");
  const end = source.indexOf("async function selectTransformation", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);

  const scaffoldBinding = /const\s+([A-Za-z_$][\w$]*)\s*=\s*await request\(`scaffolds\/\$\{encodeURIComponent\(id\)\}`\)/.exec(implementation);
  assert.ok(scaffoldBinding, "selectScaffold must fetch the exact scaffold detail");
  const scaffoldVariable = escapePattern(scaffoldBinding[1]);
  const observationRequest = new RegExp(
    'await request\\(`observations\\/\\$\\{encodeURIComponent\\('
      + scaffoldVariable
      + '\\.observation_id\\)\\}`\\)',
  );
  assert.match(
    implementation,
    observationRequest,
    "selectScaffold must hydrate the exact parent observation from the scaffold detail",
  );
  assert.doesNotMatch(implementation, /state\.observations\.find/);
});
