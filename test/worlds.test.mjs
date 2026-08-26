import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyWorld,
  compareWorlds,
  filterWorlds,
  graphUrl,
  normaliseWorld,
  registryUrl,
  worldCoordinate,
} from "../shared/worlds.js";

const provided = {
  name: "io",
  version: "0.1.0",
  summary: "input/output faces",
  publisher: "idol.id",
  graph_id: 9691001017719621744n,
  tags: ["world", "effect"],
  stats: { lines: 27, bytes: 500, source_hash: "e05390f3de9738d7" },
  provenance: {},
};

const foreign = {
  name: "rust",
  version: "1.84",
  summary: "Rust foreign boundary projection",
  publisher: "interop-lab",
  graph_id: "rust-world-v1",
  tags: ["abi", "foreign"],
  stats: { lines: 90, bytes: 4400, source_hash: "foreignhash" },
  provenance: { origin: { family: "rust", repository: "example/rust" } },
};

const published = {
  name: "gpu",
  version: "0.3.0",
  summary: "GPU execution facts",
  publisher: "compute-org",
  graph_id: "gpu-graph",
  tags: ["hardware", "device"],
  stats: { lines: 120, bytes: 6000, source_hash: "gpuhash" },
  provenance: {},
};

test("world qualifications are presentation facts derived from published provenance", () => {
  assert.equal(classifyWorld(provided), "provided");
  assert.equal(classifyWorld(foreign), "foreign");
  assert.equal(classifyWorld(published), "published");
});

test("normalisation preserves exact published identities as strings", () => {
  const world = normaliseWorld(provided);
  assert.equal(world.graph_id, "9691001017719621744");
  assert.equal(world.source_hash, "e05390f3de9738d7");
  assert.equal(world.category, "provided");
  assert.deepEqual(world.tags, ["world", "effect"]);
});

test("world search spans identity, provenance, tags, version and graph facts", () => {
  const worlds = [provided, foreign, published];
  assert.deepEqual(filterWorlds(worlds, "rust", "all").map((x) => x.name), ["rust"]);
  assert.deepEqual(filterWorlds(worlds, "effect", "all").map((x) => x.name), ["io"]);
  assert.deepEqual(filterWorlds(worlds, "0.3.0", "all").map((x) => x.name), ["gpu"]);
  assert.deepEqual(filterWorlds(worlds, "gpu-graph", "all").map((x) => x.name), ["gpu"]);
  assert.deepEqual(filterWorlds(worlds, "interop-lab", "foreign").map((x) => x.name), ["rust"]);
  assert.deepEqual(filterWorlds(worlds, "", "provided").map((x) => x.name), ["io"]);
});

test("comparison reports published field differences without compatibility claims", () => {
  const rows = compareWorlds(provided, { ...provided, version: "0.2.0", tags: ["world", "effect", "stream"] });
  const changed = rows.filter((row) => !row.equal);
  assert.deepEqual(changed.map((row) => row.field), ["version", "tags"]);
  assert.equal(rows.some((row) => "compatible" in row), false);
});

test("world links and coordinates encode display provenance safely", () => {
  const world = { ...published, name: "vendor/io world" };
  assert.equal(worldCoordinate(world), "vendor/io world@0.3.0");
  assert.equal(registryUrl(world), "https://lib.idol.id/#vendor%2Fio%20world");
  assert.equal(graphUrl(world), "https://graph.idol.id/?world=vendor%2Fio%20world");
});
