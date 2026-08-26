import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("scaffold deep links load the full observation instead of reusing a bounded list summary", async () => {
  const source = await readFile("shared/repository-app.js", "utf8");
  const start = source.indexOf("async function selectScaffold");
  const end = source.indexOf("async function generateScaffold", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /await request\(`observations\/\$\{encodeURIComponent\(s\.observation_id\)\}`\)/);
  assert.doesNotMatch(implementation, /state\.observations\.find/);
});
