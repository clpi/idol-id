import test from "node:test";
import assert from "node:assert/strict";
import {
  deterministicLayout,
  edgePresentation,
  publishedGraphModel,
  selectionNeighbourhood,
} from "../shared/graph-model.js";

const graph = {
  nodes: [
    { id: "application:a", kind: "application", name: "a" },
    { id: "relation:r", kind: "relation", name: "r" },
    { id: "value:s", kind: "value", name: "s" },
    { id: "value:o", kind: "value", name: "o" },
    { id: "value:q", kind: "value", name: "q" },
  ],
  edges: [
    { id: "edge:r", from: "application:a", to: "relation:r", role: "relation" },
    { id: "edge:s", from: "application:a", to: "value:s", role: "subject" },
    { id: "edge:o", from: "application:a", to: "value:o", role: "operand" },
    { id: "edge:q", from: "application:a", to: "value:q", role: "result" },
  ],
  applications: [{ application: "application:a", relation: "relation:r", subject: "value:s" }],
};

test("canonical graph model contains only compiler-published nodes and edges", () => {
  const model = publishedGraphModel(graph);
  assert.equal(model.nodes.length, 5);
  assert.equal(model.edges.length, 4);
  assert.deepEqual(model.edges.map((edge) => edge.id), ["edge:r", "edge:s", "edge:o", "edge:q"]);
  assert.equal(model.edges.some((edge) => edge.synthetic === true), false);
  assert.equal(model.application_records.length, 1);
  assert.notEqual(model.application_records, model.edges);
});

test("deterministic layout is byte-stable and requires no force simulation", () => {
  const model = publishedGraphModel(graph);
  const first = deterministicLayout(model, { width: 900, height: 560 });
  const second = deterministicLayout(model, { width: 900, height: 560 });
  assert.deepEqual(first, second);
  assert.deepEqual([...first.keys()], [...second.keys()]);
  for (const point of first.values()) {
    assert.equal(Number.isFinite(point.x), true);
    assert.equal(Number.isFinite(point.y), true);
    assert.equal(Number.isInteger(point.layer), true);
  }
});

test("edge presentation reports the exact published field and never guesses an operation role", () => {
  assert.deepEqual(edgePresentation({ role: "subject" }), {
    label: "subject",
    field: "role",
    status: "published",
  });
  assert.deepEqual(edgePresentation({ relation: "read" }), {
    label: "read",
    field: "relation",
    status: "published-unclassified",
  });
  assert.deepEqual(edgePresentation({}), {
    label: "role not published",
    field: null,
    status: "not-published",
  });
});

test("reverse traversal and neighbourhood are derived indexes rather than duplicate semantic edges", () => {
  const model = publishedGraphModel(graph);
  const neighbourhood = selectionNeighbourhood(model, "relation:r");
  assert.deepEqual(neighbourhood.nodes.map((node) => node.id), ["application:a", "relation:r"]);
  assert.deepEqual(neighbourhood.edges.map((edge) => edge.id), ["edge:r"]);
  assert.deepEqual(model.incoming.get("relation:r").map((edge) => edge.id), ["edge:r"]);
  assert.equal(model.edges.length, graph.edges.length);
});

test("malformed published graph endpoints fail closed", () => {
  assert.throws(
    () => publishedGraphModel({ nodes: [{ id: "a" }], edges: [{ id: "bad", from: "a", to: "missing", role: "member" }] }),
    /unknown graph endpoint/,
  );
  assert.throws(
    () => publishedGraphModel({ nodes: [{ id: 9007199254740992 }], edges: [] }),
    /unsafe numeric graph node identity/,
  );
});
