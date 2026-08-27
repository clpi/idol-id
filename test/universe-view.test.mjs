import test from "node:test";
import assert from "node:assert/strict";
import {
  UniverseError,
  catalogUniverseWorlds,
  createUniverseView,
  normaliseUniverseInput,
  publicUniverseView,
  universeViewSummary,
} from "../shared/universe.js";
import { createMemoryUniverseStore } from "../shared/universe-memory.js";

const timestamp = "2026-08-26T23:40:00.000Z";
const worlds = {
  schema: "idol.web.worlds.v1",
  worlds: [
    {
      name: "io",
      version: "0.1.0",
      summary: "input/output faces",
      publisher: "idol.id",
      graph_id: "9691001017719621744",
      tags: ["world", "effect"],
      stats: { source_hash: "e05390f3de9738d7" },
    },
    {
      name: "math",
      version: "0.1.0",
      summary: "numeric relations",
      publisher: "idol.id",
      graph_id: "5646163407124647803",
      tags: ["numeric"],
      stats: { source_hash: "11720398b0bc09ea" },
    },
  ],
};
const foreign = {
  schema: "idol.web.foreign.v1",
  worlds: [
    {
      slug: "wasm-wasi",
      name: "Wasm / WASI",
      version: "preview",
      semantic_id: null,
      identity_status: "not-published",
      provenance: { origin: { family: "wasm" } },
      uncertainty: ["component correspondence not witnessed"],
      projections: [
        {
          id: "wasi-preview",
          target: "wasi",
          status: "not-admitted",
          evidence: { status: "missing" },
          obligations: { world: ["wasi"] },
          refusal: { code: "ARTIFACT_NOT_ADMITTED" },
        },
      ],
    },
  ],
};

function input(overrides = {}) {
  return {
    title: "Boundary constellation",
    visibility: "private",
    lens: "constellation",
    query: "world target",
    policy: {
      require_evidence: true,
      deny_unpublished_identity: false,
      deny_unverified_projection: true,
    },
    selections: [
      { source: "published", key: "io@0.1.0" },
      { source: "foreign", key: "wasm-wasi" },
    ],
    ...overrides,
  };
}

function options(id = "uv_test_identifier") {
  return { id, createdAt: timestamp, updatedAt: timestamp };
}

test("universe views resolve exact origin-qualified worlds without fabricating identity", () => {
  const catalogs = catalogUniverseWorlds(worlds, foreign);
  const view = createUniverseView(input(), catalogs, options());
  assert.equal(view.schema, "idol.web.universe.view.v1");
  assert.equal(view.semantic_id, null);
  assert.equal(view.identity_status, "not-published");
  assert.equal(view.resolved.length, 2);
  assert.equal(view.resolved[0].source, "published");
  assert.equal(view.resolved[0].graph_id, "9691001017719621744");
  assert.equal(typeof view.resolved[0].graph_id, "string");
  assert.equal(view.resolved[1].source, "foreign");
  assert.equal(view.resolved[1].semantic_id, null);
  assert.equal(view.resolved[1].identity_status, "not-published");
  assert.equal(view.analysis.selection_count, 2);
  assert.equal(view.analysis.unpublished_identity_count, 1);
  assert.equal(view.boundary.composition, "not-proven");
  assert.equal(view.boundary.equivalence, "not-proven");
  assert.equal(view.boundary.authority_grant, "none");
});

test("unknown and duplicate selections fail closed before a view can be published", () => {
  const catalogs = catalogUniverseWorlds(worlds, foreign);
  assert.throws(
    () => createUniverseView(input({ selections: [{ source: "published", key: "missing@1.0.0" }] }), catalogs, options()),
    (error) => error instanceof UniverseError && error.code === "UNIVERSE_WORLD_NOT_FOUND",
  );
  assert.throws(
    () => normaliseUniverseInput(input({ selections: [
      { source: "published", key: "io@0.1.0" },
      { source: "published", key: "io@0.1.0" },
    ] })),
    (error) => error instanceof UniverseError && error.code === "UNIVERSE_SELECTION_DUPLICATE",
  );
});

test("policy violations are explicit refusals rather than compatibility or authority claims", () => {
  const catalogs = catalogUniverseWorlds(worlds, foreign);
  const view = createUniverseView(input({
    lens: "security",
    policy: {
      require_evidence: true,
      deny_unpublished_identity: true,
      deny_unverified_projection: true,
    },
  }), catalogs, options());
  assert.ok(view.analysis.violation_count >= 2, "expected unpublished-identity and unverified-projection refusals");
  assert.deepEqual(
    view.analysis.violations.map((entry) => entry.code).sort(),
    ["UNPUBLISHED_IDENTITY_REFUSED", "UNVERIFIED_PROJECTION_REFUSED"],
  );
  assert.equal("compatible" in view.analysis, false);
  assert.equal("composed" in view.analysis, false);
  assert.equal("grants" in view.analysis, false);
});

test("bounded and public projections omit full resolved and owner-private state", () => {
  const view = {
    ...createUniverseView(input({ visibility: "public" }), catalogUniverseWorlds(worlds, foreign), options()),
    subject: "user-1",
    actor_email: "user@example.com",
    secret: "must-not-publish",
  };
  const summary = universeViewSummary(view);
  assert.equal("resolved" in summary, false);
  assert.equal("policy" in summary, false);
  assert.equal(summary.selection_count, 2);
  const published = publicUniverseView(view);
  assert.equal(published.visibility, "public");
  assert.equal("subject" in published, false);
  assert.equal("actor_email" in published, false);
  assert.equal("secret" in published, false);
  assert.equal(published.resolved.length, 2);
  assert.equal(published.boundary.authority_grant, "none");
});

test("memory universe storage is subject-owned, bounded, and public only by visibility", async () => {
  const store = createMemoryUniverseStore();
  const privateView = createUniverseView(input(), catalogUniverseWorlds(worlds, foreign), options("uv_private_identifier"));
  const publicView = createUniverseView(input({ visibility: "public", title: "Public constellation" }), catalogUniverseWorlds(worlds, foreign), options("uv_public_identifier"));
  const event = (id) => ({ id: `audit_${id}`, subject: "user-1", actor_email: "user@example.com", type: "universe.view.saved", target: id, metadata: {}, created_at: timestamp });
  await store.commitView({ id: privateView.id, subject: "user-1", document: privateView, created_at: timestamp, updated_at: timestamp }, event(privateView.id));
  await store.commitView({ id: publicView.id, subject: "user-1", document: publicView, created_at: timestamp, updated_at: timestamp }, event(publicView.id));
  assert.equal((await store.listViews("user-1", 50)).length, 2);
  assert.equal((await store.listViews("user-2", 50)).length, 0);
  assert.equal(await store.getView("user-2", privateView.id), null);
  assert.equal(await store.getPublicView(privateView.id), null);
  const published = await store.getPublicView(publicView.id);
  assert.equal(published.id, publicView.id);
  assert.equal("subject" in published, false);
});
