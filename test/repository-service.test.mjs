import test from "node:test";
import assert from "node:assert/strict";
import { createRepositoryService } from "../shared/repository-service.js";

function memoryStore(commits = []) {
  const observations = new Map();
  const scaffolds = new Map();
  return {
    async commitObservation(record, audit) {
      commits.push({ kind: "observation", record, audit });
      const visible = { ...record.document, id: record.id, created_at: record.created_at };
      observations.set(record.id, { ...visible, __subject: record.subject });
      return visible;
    },
    async listObservations(subject) { return [...observations.values()].filter((item) => item.__subject === subject).map(({ __subject, ...item }) => item); },
    async getObservation(subject, id) { const item = observations.get(id); if (!item || item.__subject !== subject) return null; const { __subject, ...visible } = item; return visible; },
    async commitScaffold(record, audit) {
      commits.push({ kind: "scaffold", record, audit });
      const visible = { ...record.document, id: record.id, observation_id: record.observation_id, created_at: record.created_at };
      scaffolds.set(record.id, { ...visible, __subject: record.subject });
      return visible;
    },
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
  requested_ref: "HEAD",
  default_branch: "main",
  resolved_revision: "abc123",
  inventory: { file_count: 2, truncated: false, paths: ["package.json", "src/index.js"], build_systems: [], commands: [], tests: [], benchmarks: [] },
};

function bytes() { return new Uint8Array(12).fill(7); }
const authorityPin = { language: { repository: "clpi/idol", commit: "lang" }, native: { repository: "clpi/idol-native", commit: "native" } };

test("repository service commits each observation with its audit event atomically", async () => {
  const commits = [];
  const service = createRepositoryService({
    store: memoryStore(commits),
    authorityPin,
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: bytes,
  });
  const saved = await service.saveObservation(identity, observation);
  assert.match(saved.id, /^obs_/);
  assert.equal((await service.listObservations(identity)).length, 1);
  assert.equal((await service.getObservation(identity, saved.id)).resolved_revision, "abc123");
  assert.equal(commits.length, 1);
  assert.equal(commits[0].kind, "observation");
  assert.equal(commits[0].record.id, saved.id);
  assert.equal(commits[0].audit.target, saved.id);
  assert.equal(commits[0].audit.type, "repository.observed");
  assert.equal(commits[0].audit.metadata.file_count, 2);
});

test("repository service commits each scaffold with its audit event atomically", async () => {
  const commits = [];
  const store = memoryStore(commits);
  const service = createRepositoryService({
    store,
    authorityPin,
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
  assert.equal(commits.length, 2);
  assert.equal(commits[1].kind, "scaffold");
  assert.equal(commits[1].record.id, scaffold.id);
  assert.equal(commits[1].audit.target, scaffold.id);
  assert.equal(commits[1].audit.type, "repository.scaffold.previewed");
});

test("repository service propagates an atomic storage failure without a second audit path", async () => {
  let attempts = 0;
  const store = memoryStore();
  store.commitObservation = async () => { attempts += 1; throw new Error("atomic commit failed"); };
  const service = createRepositoryService({
    store,
    authorityPin,
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: bytes,
  });
  await assert.rejects(() => service.saveObservation(identity, observation), /atomic commit failed/);
  assert.equal(attempts, 1);
});

test("repository service never crosses subject ownership", async () => {
  const service = createRepositoryService({
    store: memoryStore(),
    authorityPin: { language: { commit: "lang" }, native: { commit: "native" } },
    now: () => "2026-08-26T12:00:00.000Z",
    randomBytes: bytes,
  });
  const saved = await service.saveObservation(identity, observation);
  await assert.rejects(() => service.getObservation({ subject: "other", email: "other@example.com" }, saved.id), /not found/);
});
