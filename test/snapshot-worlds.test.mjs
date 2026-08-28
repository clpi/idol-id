import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildSnapshot,
  parseRegistryProjection,
  retainSnapshot,
  validateSnapshot,
} from "../scripts/snapshot-worlds.mjs";

const source = "https://registry.example/api/worlds";
const raw = `{
  "worlds": [
    {
      "name": "early",
      "version": "0.1.0",
      "publisher": "idol.id",
      "published_at": "2026-08-24T12:00:00Z",
      "graph_id": 18072376802677268630,
      "stats": { "source_hash": "a" }
    },
    {
      "name": "late",
      "version": "0.2.0",
      "publisher": "idol.id",
      "published_at": "2026-08-25T12:00:00Z",
      "graph_id": 9691001017719621744,
      "stats": { "source_hash": "b" }
    }
  ]
}`;

test("registry parsing preserves exact graph identities", () => {
  const payload = parseRegistryProjection(raw);
  assert.equal(payload.worlds[0].graph_id, "18072376802677268630");
  assert.equal(payload.worlds[1].graph_id, "9691001017719621744");
});

test("identical registry facts create byte-identical snapshot documents", () => {
  const payload = parseRegistryProjection(raw);
  const first = buildSnapshot(payload.worlds, source);
  const second = buildSnapshot(payload.worlds, source);
  assert.deepEqual(first, second);
  assert.equal(first.captured_at, "2026-08-25T12:00:00Z");
  assert.equal(`${JSON.stringify(first, null, 2)}\n`, `${JSON.stringify(second, null, 2)}\n`);
});

test("retained snapshot preserves exact published evidence without claiming a new revision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "idsem-worlds-"));
  const target = join(directory, "worlds.json");
  try {
    const document = buildSnapshot(parseRegistryProjection(raw).worlds, source);
    await writeFile(target, `${JSON.stringify(document, null, 2)}\n`);
    const retained = await retainSnapshot({ source, target });
    assert.deepEqual(retained, document);
    assert.equal(retained.captured_at, "2026-08-25T12:00:00Z");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retained snapshot rejects another source instead of laundering its provenance", () => {
  const document = buildSnapshot(parseRegistryProjection(raw).worlds, source);
  assert.throws(
    () => validateSnapshot(document, "https://other.example/api/worlds"),
    /source differs/,
  );
});

test("retained snapshot rejects missing source revision", () => {
  const document = buildSnapshot(parseRegistryProjection(raw).worlds, source);
  document.captured_at = "";
  assert.throws(() => validateSnapshot(document, source), /no source revision/);
});

test("retained snapshot rejects malformed world evidence", () => {
  const document = buildSnapshot(parseRegistryProjection(raw).worlds, source);
  document.worlds[0].name = "";
  assert.throws(() => validateSnapshot(document, source), /has no name/);
});
