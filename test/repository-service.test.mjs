import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryRepositoryStore } from "../shared/repository-memory.js";
import { createRepositoryService } from "../shared/repository-service.js";

const identity = { subject: "user-1", email: "user@example.com" };
const observation = {
  schema: "idol.web.repository.observation.v1",
  semantic_id: null,
  identity_status: "not-published",
  provider: "github",
  namespace: "acme",
  repository: "demo",
  coordinate: "github:acme/demo",
  resolved_revision: "abc123",
  inventory: {
    file_count: 2,
    truncated: false,
    paths: ["package.json", "src/index.js"],
    build_systems: [],
    commands: [],
    tests: [],
    benchmarks: [],
  },
};

const authorityPin = {
  language: { repository: "clpi/idol", commit: "lang" },
  native: { repository: "clpi/idol-native", commit: "native" },
};

function bytes() {
  return new Uint8Array(12).fill(7);
}

function serviceWith(store) {
  return createRepositoryService({
    store,
    authorityPin,
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: bytes,
  });
}

test("repository service atomically persists subject-owned observations and audit facts", async () => {
  const store = createMemoryRepositoryStore();
  const service = serviceWith(store);
  const saved = await service.saveObservation(identity, observation);
  assert.match(saved.id, /^obs_/);

  const summaries = await service.listObservations(identity);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].schema, "idol.web.repository.observation.summary.v1");
  assert.equal(summaries[0].inventory.file_count, 2);

  assert.equal((await service.getObservation(identity, saved.id)).resolved_revision, "abc123");
  const events = await store.listAudit(identity.subject);
  assert.equal(events[0].type, "repository.observed");
  assert.equal(events[0].metadata.file_count, 2);
});

test("repository service atomically persists review-only scaffold previews and audits", async () => {
  const store = createMemoryRepositoryStore();
  const service = serviceWith(store);
  const saved = await service.saveObservation(identity, observation);
  const scaffold = await service.createScaffold(identity, saved.id, { capabilities: ["authority", "ci", "build"] });
  assert.match(scaffold.id, /^scf_/);
  assert.equal(scaffold.status, "preview");
  assert.equal(scaffold.repository_written, false);
  assert.equal(scaffold.files.length, 4);
  assert.match(scaffold.patch, /\.github\/workflows\/idol\.yml/);
  assert.equal((await service.listScaffolds(identity)).length, 1);

  const events = await store.listAudit(identity.subject);
  assert.equal(events[0].type, "repository.observed");
  assert.equal(events[1].type, "repository.scaffold.previewed");
});

test("repository service never crosses subject ownership", async () => {
  const service = serviceWith(createMemoryRepositoryStore());
  const saved = await service.saveObservation(identity, observation);
  await assert.rejects(
    () => service.getObservation({ subject: "other", email: "other@example.com" }, saved.id),
    /not found/,
  );
});
