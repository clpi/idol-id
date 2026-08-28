import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryLiveStore } from "../shared/live-memory.js";
import { createLiveService } from "../shared/live-service.js";
import { LiveError, projectLiveGraph } from "../shared/live.js";

const owner = Object.freeze({ subject: "subject-owner", email: "owner@example.test" });
const other = Object.freeze({ subject: "subject-other", email: "other@example.test" });

function deterministicBytes() {
  let cursor = 1;
  return (length) => Uint8Array.from({ length }, () => (cursor++ * 29 + 7) & 255);
}

function fixture() {
  const store = createMemoryLiveStore();
  const universe = {
    async getView(identity, id) {
      if (identity.subject !== owner.subject || id !== "uv_exact_world_view") {
        throw new Error("universe view not found");
      }
      return Object.freeze({
        id,
        subject: identity.subject,
        semantic_id: null,
        identity_status: "not-published",
        boundary: Object.freeze({ semantic_universes: 1, authority_grant: "none" }),
      });
    },
  };
  const service = createLiveService({
    store,
    universe,
    now: () => "2026-08-28T19:30:00.000Z",
    randomBytes: deterministicBytes(),
  });
  return { store, service };
}

test("Live owns one causal collaboration history and one admitted frontier without minting Idol semantics", async () => {
  const { service } = fixture();
  const project = await service.createProject(owner, {
    name: "Idol compiler",
    slug: "idol",
    summary: "Coordinate compiler work without parallel semantic authorities.",
    visibility: "private",
  });

  assert.match(project.id, /^lp_[A-Za-z0-9_-]{12,}$/);
  assert.equal(project.semantic_id, null);
  assert.equal(project.identity_status, "not-published");
  assert.equal(project.boundary.semantic_universes, 1);
  assert.equal(project.boundary.accepted_frontiers, 1);
  assert.equal(project.boundary.semantic_authority, false);
  assert.equal(project.boundary.dispatcher_access, false);

  const goal = await service.createNode(owner, project.id, {
    category: "goal",
    label: "semantic graph sovereignty",
    summary: "Move meaning ownership to exact compiler graph facts.",
    data: { outcome: "one graph" },
  });
  const task = await service.createNode(owner, project.id, {
    category: "task",
    label: "publish exact application facts",
    summary: "Expose relation, subject, packs, demand, worlds, and witnesses.",
    data: {},
  });
  const application = await service.createApplication(owner, project.id, {
    relation: "requires",
    subject: task.id,
    target: goal.id,
    operands: [],
    results: [],
    worlds: [],
    witnesses: [],
    demand: {},
    provenance: { origin: "owner-delegation" },
  });

  const graph = await service.graph(owner, project.id);
  assert.equal(graph.schema, "idol.web.live.graph.v1");
  assert.equal(graph.nodes.some((node) => node.id === goal.id), true);
  assert.equal(graph.applications[0].relation, "requires");
  assert.deepEqual(graph.edges.map((edge) => edge.role), ["provenance", "relation", "subject", "target"]);
  assert.equal(graph.edges.some((edge) => edge.role === "requires"), false, "operation identity must never become an edge kind");
  assert.equal(graph.indexes.incoming[goal.id].length, 1);
  assert.equal(graph.indexes.outgoing[application.id].length, 4);

  const first = await service.appendEvent(owner, project.id, {
    kind: "attempted",
    predecessor_ids: [],
    intent_id: null,
    application_ids: [application.id],
    payload: { note: "first exact attempt" },
  });
  await service.setFrontier(owner, project.id, { event_id: first.id, state: "admitted", reason: "witnessed" });

  const second = await service.appendEvent(owner, project.id, {
    kind: "attempted",
    predecessor_ids: [first.id],
    intent_id: null,
    application_ids: [],
    payload: { note: "dependent attempt" },
  });
  const third = await service.appendEvent(owner, project.id, {
    kind: "attempted",
    predecessor_ids: [second.id],
    intent_id: null,
    application_ids: [],
    payload: { note: "depends on held event" },
  });

  await assert.rejects(
    () => service.setFrontier(owner, project.id, { event_id: third.id, state: "admitted", reason: "too early" }),
    (error) => error instanceof LiveError && error.code === "LIVE_FRONTIER_CAUSAL_GAP",
  );
  await service.setFrontier(owner, project.id, { event_id: second.id, state: "admitted", reason: "predecessor admitted" });
  await service.setFrontier(owner, project.id, { event_id: third.id, state: "admitted", reason: "causally closed" });

  const finalGraph = await service.graph(owner, project.id);
  assert.deepEqual(finalGraph.frontier.admitted_event_ids, [first.id, second.id, third.id]);
  assert.equal(finalGraph.history.length, 3);
  assert.equal(finalGraph.frontier.causally_closed, true);
});

test("Live project world management binds an existing Universe View as a projection and grants no authority", async () => {
  const { service } = fixture();
  const project = await service.createProject(owner, {
    name: "World-bound project",
    slug: "world-bound",
    summary: "A project selects a view without copying or authorizing worlds.",
    visibility: "private",
  });
  const updated = await service.bindUniverseView(owner, project.id, "uv_exact_world_view");
  assert.equal(updated.universe_view_id, "uv_exact_world_view");
  assert.equal(updated.world_binding.kind, "operational-projection-reference");
  assert.equal(updated.world_binding.semantic_universes, 1);
  assert.equal(updated.world_binding.authority_grant, "none");
  assert.equal(updated.world_binding.world_publication, false);
});

test("Live stores are subject-owned and project lists are bounded summaries", async () => {
  const { service } = fixture();
  const project = await service.createProject(owner, {
    name: "Private project",
    slug: "private-project",
    summary: "Owned by one Access subject.",
    visibility: "private",
  });
  const listed = await service.listProjects(owner, 10);
  assert.equal(listed.length, 1);
  assert.deepEqual(Object.keys(listed[0]).sort(), [
    "created_at", "frontier_admitted_count", "id", "name", "slug", "summary", "universe_view_id", "updated_at", "visibility",
  ]);
  await assert.rejects(
    () => service.getProject(other, project.id),
    (error) => error instanceof LiveError && error.code === "LIVE_PROJECT_NOT_FOUND",
  );
});

test("standalone graph projection refuses duplicate IDs and unknown application endpoints", () => {
  assert.throws(() => projectLiveGraph(
    { id: "lp_project", name: "project", slug: "project", semantic_id: null, identity_status: "not-published" },
    [
      { id: "ln_same", category: "goal", label: "a", data: {} },
      { id: "ln_same", category: "task", label: "b", data: {} },
    ],
    [],
    [],
    [],
  ), (error) => error instanceof LiveError && error.code === "LIVE_GRAPH_DUPLICATE_ID");

  assert.throws(() => projectLiveGraph(
    { id: "lp_project", name: "project", slug: "project", semantic_id: null, identity_status: "not-published" },
    [{ id: "ln_subject", category: "task", label: "subject", data: {} }],
    [{ id: "la_bad", relation: "requires", subject: "ln_subject", target: "ln_missing", operands: [], results: [], worlds: [], witnesses: [], demand: {}, provenance: {} }],
    [],
    [],
  ), (error) => error instanceof LiveError && error.code === "LIVE_GRAPH_ENDPOINT_MISSING");
});
