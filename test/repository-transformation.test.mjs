import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLATFORM_SCOPES } from "../shared/platform-auth.js";
import { createRepositoryTransformation } from "../shared/repository-transform.js";
import { createD1RepositoryStore } from "../shared/repository-d1.js";
import { createMemoryRepositoryStore } from "../shared/repository-memory.js";
import { createRepositoryService } from "../shared/repository-service.js";

const timestamp = "2026-08-26T23:00:00.000Z";
const identity = { subject: "user-a", email: "user@example.com" };
const authorityPin = {
  language: { repository: "clpi/idol", commit: "language" },
  native: { repository: "clpi/idol-native", commit: "native" },
};

function observation() {
  return {
    schema: "idol.web.repository.observation.v1",
    id: "obs_transform_identifier",
    semantic_id: null,
    identity_status: "not-published",
    authority: "repository provenance only",
    provider: "github",
    namespace: "acme",
    repository: "demo",
    coordinate: "github:acme/demo",
    source_url: "https://github.com/acme/demo",
    requested_ref: "main",
    default_branch: "main",
    resolved_revision: "abcdef123456",
    visibility: "public",
    observed_at: timestamp,
    created_at: timestamp,
    inventory: {
      file_count: 2,
      truncated: false,
      paths: ["Cargo.toml", "src/main.rs"],
      bytes: { known: 20, sized_files: 2, total_files: 2 },
      languages: { rust: 1, other: 1 },
      build_systems: [], manifests: [], tests: [], benchmarks: [], ci: [], commands: [],
    },
    candidate_world: {
      semantic_id: null,
      identity_status: "not-published",
      provenance: { provider: "github", coordinate: "github:acme/demo", revision: "abcdef123456" },
      requirements: [], uncertainty: [],
    },
  };
}

function scaffold(overrides = {}) {
  return {
    schema: "idol.web.repository.scaffold.v1",
    id: "scf_transform_identifier",
    observation_id: "obs_transform_identifier",
    status: "preview",
    semantic_id: null,
    identity_status: "not-published",
    authority: "repository provenance only",
    source: { provider: "github", coordinate: "github:acme/demo", revision: "abcdef123456" },
    capabilities: ["authority", "graph"],
    files: [
      { path: ".idol/authority.json", content: "{\"authority\":true}\n", bytes: 19 },
      { path: ".idol/project.json", content: "{\"project\":true}\n", bytes: 17 },
    ],
    patch: "full scaffold patch",
    created_at: timestamp,
    executed: false,
    repository_written: false,
    ...overrides,
  };
}

test("transformation preview isolates one derived world and hashes the selected exact delta", async () => {
  const preview = await createRepositoryTransformation(observation(), scaffold(), {
    intent: "adopt Idol graph surface",
    selected_files: [".idol/project.json"],
    evidence: ["semantic-diff", "build", "build"],
  }, { createdAt: () => timestamp });

  assert.equal(preview.schema, "idol.web.repository.transformation.v1");
  assert.equal(preview.status, "preview");
  assert.equal(preview.semantic_id, null);
  assert.equal(preview.identity_status, "not-published");
  assert.equal(preview.observation_id, observation().id);
  assert.equal(preview.scaffold_id, scaffold().id);
  assert.deepEqual(preview.selected_files, [".idol/project.json"]);
  assert.match(preview.patch, /\.idol\/project\.json/);
  assert.doesNotMatch(preview.patch, /\.idol\/authority\.json/);
  assert.match(preview.patch_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(preview.evidence.requested, ["build", "semantic-diff"]);
  assert.equal(preview.evidence.status, "unexecuted");
  assert.equal(preview.parent_world.revision, "abcdef123456");
  assert.equal(preview.derived_world.semantic_id, null);
  assert.equal(preview.derived_world.identity_status, "not-published");
  assert.equal(preview.derived_world.parent_observation_id, observation().id);
  assert.equal(preview.derived_world.isolation, "derived-preview");
  assert.equal(preview.required_grants.every((grant) => grant.status === "not-granted"), true);
  assert.equal(preview.executed, false);
  assert.equal(preview.source_world_mutated, false);
  assert.equal(preview.repository_written, false);
  assert.equal(preview.world_published, false);
});

test("transformation preview refuses a scaffold that never produced a lawful patch", async () => {
  const refused = await createRepositoryTransformation(observation(), scaffold({
    status: "refused",
    files: [],
    patch: "",
    refusal: { code: "SCAFFOLD_PATH_CONFLICT", detail: "conflict", paths: [".idol/project.json"] },
  }), { intent: "adopt Idol" }, { createdAt: () => timestamp });
  assert.equal(refused.status, "refused");
  assert.equal(refused.refusal.code, "TRANSFORMATION_SCAFFOLD_NOT_PREVIEW");
  assert.equal(refused.patch, "");
  assert.equal(refused.executed, false);
  assert.equal(refused.repository_written, false);
  assert.equal(refused.world_published, false);
});

test("repository service commits transformation preview and audit atomically", async () => {
  const observations = new Map([[observation().id, observation()]]);
  const scaffolds = new Map([[scaffold().id, scaffold()]]);
  let committed;
  const store = {
    async commitObservation() { throw new Error("unused"); },
    async listObservations() { return []; },
    async getObservation(_subject, id) { return observations.get(id) || null; },
    async commitScaffold() { throw new Error("unused"); },
    async listScaffolds() { return []; },
    async getScaffold(_subject, id) { return scaffolds.get(id) || null; },
    async commitTransformation(record, event) { committed = { record, event }; return record.document; },
    async listTransformations() { return []; },
    async getTransformation() { return null; },
  };
  const service = createRepositoryService({
    store,
    authorityPin,
    now: () => timestamp,
    randomBytes: () => new Uint8Array(12).fill(7),
  });
  const saved = await service.createTransformation(identity, scaffold().id, {
    intent: "adopt Idol graph surface",
    selected_files: [".idol/project.json"],
    evidence: ["test"],
  });
  assert.equal(saved.status, "preview");
  assert.match(saved.id, /^trn_/);
  assert.equal(committed.record.selected_file_count, 1);
  assert.equal(committed.record.evidence_status, "unexecuted");
  assert.equal(committed.record.refusal_code, null);
  assert.equal(committed.event.type, "repository.transformation.previewed");
  assert.equal(committed.event.target, saved.id);
});

test("memory transformation history is subject-owned, bounded, and summary-only", async () => {
  const store = createMemoryRepositoryStore();
  const full = {
    schema: "idol.web.repository.transformation.v1",
    id: "trn_memory_identifier",
    observation_id: observation().id,
    scaffold_id: scaffold().id,
    status: "preview",
    selected_files: [".idol/project.json"],
    patch: "large patch",
    patch_sha256: "a".repeat(64),
    evidence: { requested: ["test"], status: "unexecuted" },
    created_at: timestamp,
  };
  await store.commitTransformation({
    id: full.id,
    subject: "user-a",
    observation_id: full.observation_id,
    scaffold_id: full.scaffold_id,
    status: full.status,
    selected_file_count: 1,
    evidence_status: "unexecuted",
    refusal_code: null,
    document: full,
    created_at: timestamp,
  }, {
    id: "audit_transform_identifier",
    subject: "user-a",
    actor_email: "user@example.com",
    type: "repository.transformation.previewed",
    target: full.id,
    metadata: {},
    created_at: timestamp,
  });
  const listed = await store.listTransformations("user-a", 50);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].schema, "idol.web.repository.transformation.summary.v1");
  assert.equal(listed[0].selected_file_count, 1);
  assert.equal("patch" in listed[0], false);
  assert.equal(await store.getTransformation("user-b", full.id), null);
  assert.equal((await store.getTransformation("user-a", full.id)).patch, "large patch");
});

test("D1 transformation history selects bounded columns and migration creates an isolated table", async () => {
  let sql = "";
  const database = {
    prepare(statement) {
      sql = statement;
      return {
        bind() {
          return {
            async all() {
              return { results: [{
                id: "trn_d1_identifier",
                observation_id: observation().id,
                scaffold_id: scaffold().id,
                status: "preview",
                selected_file_count: 1,
                evidence_status: "unexecuted",
                refusal_code: null,
                created_at: timestamp,
              }] };
            },
          };
        },
      };
    },
  };
  const listed = await createD1RepositoryStore(database).listTransformations("user-a", 50);
  assert.doesNotMatch(sql, /\bdocument\b/i);
  assert.equal(listed[0].schema, "idol.web.repository.transformation.summary.v1");

  const migration = await readFile(new URL("../migrations/0005_repository_transformation.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_repository_transformation/);
  for (const field of ["subject", "observation_id", "scaffold_id", "status", "selected_file_count", "evidence_status", "refusal_code", "document", "created_at"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`), field);
  }
});

test("Program N transport scope is admitted without granting a world capability", () => {
  assert.equal(PLATFORM_SCOPES.includes("repository:transform"), true);
});
