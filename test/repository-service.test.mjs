import test from "node:test";
import assert from "node:assert/strict";
import { createRepositoryService } from "../shared/repository-service.js";

function memoryStore() {
  const observations = new Map();
  const scaffolds = new Map();
  return {
    async insertObservation(record) { observations.set(record.id, { ...record.document, __subject: record.subject }); return observations.get(record.id); },
    async listObservations(subject) { return [...observations.values()].filter((item) => item.__subject === subject).map(({ __subject, ...item }) => item); },
    async getObservation(subject, id) { const item = observations.get(id); if (!item || item.__subject !== subject) return null; const { __subject, ...visible } = item; return visible; },
    async insertScaffold(record) { scaffolds.set(record.id, { ...record.document, __subject: record.subject }); return scaffolds.get(record.id); },
    async listScaffolds(subject) { return [...scaffolds.values()].filter((item) => item.__subject === subject).map(({ __subject, ...item }) => item); },
    async getScaffold(subject, id) { const item = scaffolds.get(id); if (!item || item.__subject !== subject) return null; const { __subject, ...visible } = item; return visible; },
  };
}

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
  inventory: { file_count: 2, truncated: false, paths: ["package.json", "src/index.js"], build_systems: [], commands: [], tests: [], benchmarks: [] },
};

function bytes() { return new Uint8Array(12).fill(7); }

test("repository service persists subject-owned observations and audit facts", async () => {
  const events = [];
  const service = createRepositoryService({
    store: memoryStore(),
    appendAudit: async (event) => events.push(event),
    authorityPin: { language: { repository: "clpi/idol", commit: "lang" }, native: { repository: "clpi/idol-native", commit: "native" } },
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: bytes,
  });
  const saved = await service.saveObservation(identity, observation);
  assert.match(saved.id, /^obs_/);
  assert.equal((await service.listObservations(identity)).length, 1);
  assert.equal((await service.getObservation(identity, saved.id)).resolved_revision, "abc123");
  assert.equal(events[0].type, "repository.observed");
  assert.equal(events[0].metadata.file_count, 2);
});

test("repository service creates stored review-only scaffold previews", async () => {
  const store = memoryStore();
  const events = [];
  const service = createRepositoryService({
    store,
    appendAudit: async (event) => events.push(event),
    authorityPin: { language: { repository: "clpi/idol", commit: "lang" }, native: { repository: "clpi/idol-native", commit: "native" } },
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: bytes,
  });
  const saved = await service.saveObservation(identity, observation);
  const scaffold = await service.createScaffold(identity, saved.id, { capabilities: ["authority", "ci", "build"] });
  assert.match(scaffold.id, /^scf_/);
  assert.equal(scaffold.status, "preview");
  assert.equal(scaffold.repository_written, false);
  assert.equal(scaffold.files.length, 4);
  assert.match(scaffold.patch, /\.github\/workflows\/idol\.yml/);
  assert.equal((await service.listScaffolds(identity)).length, 1);
  assert.equal(events.at(-1).type, "repository.scaffold.previewed");
});

test("repository service never crosses subject ownership", async () => {
  const service = createRepositoryService({
    store: memoryStore(),
    appendAudit: async () => {},
    authorityPin: { language: { commit: "lang" }, native: { commit: "native" } },
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: bytes,
  });
  const saved = await service.saveObservation(identity, observation);
  await assert.rejects(() => service.getObservation({ subject: "other", email: "other@example.com" }, saved.id), /not found/);
});
