import test from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot, parseRegistryProjection } from "../scripts/snapshot-worlds.mjs";

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
