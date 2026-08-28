import test from "node:test";
import assert from "node:assert/strict";
import { remoteBundle } from "../shared/semantic-bundle.js";
import { buildSemanticIndex, selectionForToken } from "../shared/semantic-index.js";

const authority = Object.freeze({ repository: "clpi/idol", commit: "authority" });
const source = "thing:read(key)";
const lexicalTokens = [
  { s: 0, e: 5, v: "thing", t: "name", f: null, l: 1, c: 1 },
  { s: 5, e: 6, v: ":", t: "delimiter", f: null, l: 1, c: 6 },
  { s: 6, e: 10, v: "read", t: "name", f: null, l: 1, c: 7 },
  { s: 10, e: 11, v: "(", t: "delimiter", f: null, l: 1, c: 11 },
  { s: 11, e: 14, v: "key", t: "name", f: null, l: 1, c: 12 },
  { s: 14, e: 15, v: ")", t: "delimiter", f: null, l: 1, c: 15 },
];

function exactResponse() {
  return {
    authority,
    tokens: [
      {
        token_id: "token:thing",
        span: [0, 5],
        lexical_identity: "name",
        source_face: "subject",
        semantic_id: "value:thing",
        graph_ids: ["value:thing"],
        application_ids: ["application:read"],
        world_ids: ["world:current"],
        definition_ids: ["definition:thing"],
        reference_ids: ["reference:thing:1"],
        provenance: { source: { path: "main.id", start: 0, end: 5 } },
      },
      {
        token_id: "token:read",
        span: [6, 10],
        lexical_identity: "name",
        source_face: "relation",
        semantic_id: "relation:read",
        graph_ids: ["relation:read"],
        application_ids: ["application:read"],
        projection_ids: ["projection:read:key"],
        derivation_ids: ["derivation:read"],
        witness_ids: ["witness:read"],
        demand_ids: ["demand:read"],
        realization_ids: ["realization:read:native"],
      },
    ],
    graph: {
      schema: "idol.graph.test.v1",
      nodes: [
        { id: "application:read", kind: "application", name: "read occurrence" },
        { id: "relation:read", kind: "relation", name: "read" },
        { id: "value:thing", kind: "value", name: "thing" },
        { id: "value:key", kind: "value", name: "key" },
        { id: "value:result", kind: "value", name: "result" },
      ],
      edges: [
        { id: "edge:relation", from: "application:read", to: "relation:read", role: "relation" },
        { id: "edge:subject", from: "application:read", to: "value:thing", role: "subject" },
        { id: "edge:operand", from: "application:read", to: "value:key", role: "operand", position: 0 },
        { id: "edge:result", from: "application:read", to: "value:result", role: "result", position: 0 },
      ],
      applications: [{
        id: "application:read",
        application: "application:read",
        relation: "relation:read",
        subject: "value:thing",
        arguments: ["value:key"],
        results: ["value:result"],
        world: "world:current",
      }],
      worlds: [{ id: "world:current", stage: "runtime", authority: "not-published" }],
      projections: [{ id: "projection:read:key", source: "application:read", target: "value:key" }],
      derivations: [{ id: "derivation:read", from: "relation:read", to: "application:read" }],
      witnesses: [{ id: "witness:read", supports: "application:read" }],
      demands: [{ id: "demand:read", target: "value:result" }],
      realizations: [{ id: "realization:read:native", application: "application:read", target: "native" }],
      definitions: [{ id: "definition:thing", semantic_id: "value:thing", span: [0, 5] }],
      references: [{ id: "reference:thing:1", semantic_id: "value:thing", span: [0, 5] }],
    },
  };
}

function tokenIndex(bundle, tokenId) {
  const index = bundle.tokens.findIndex((token) => token.token_id === tokenId);
  assert.notEqual(index, -1, `missing exact token ${tokenId}`);
  return index;
}

test("semantic index links exact compiler IDs across tokens, graph, worlds, projections, derivations, and realization", () => {
  const bundle = remoteBundle({ source, response: exactResponse(), authority, tokens: lexicalTokens });
  const index = buildSemanticIndex(bundle);
  const selected = selectionForToken(index, tokenIndex(bundle, "token:read"));

  assert.equal(selected.token.value, "read");
  assert.equal(selected.token.semantic_id, "relation:read");
  assert.deepEqual(selected.nodes.map((record) => record.id), ["relation:read"]);
  assert.deepEqual(selected.applications.map((record) => record.id), ["application:read"]);
  assert.deepEqual(selected.projections.map((record) => record.id), ["projection:read:key"]);
  assert.deepEqual(selected.derivations.map((record) => record.id), ["derivation:read"]);
  assert.deepEqual(selected.witnesses.map((record) => record.id), ["witness:read"]);
  assert.deepEqual(selected.demands.map((record) => record.id), ["demand:read"]);
  assert.deepEqual(selected.realizations.map((record) => record.id), ["realization:read:native"]);

  assert.deepEqual(index.outgoing("application:read").map((record) => record.id), ["edge:relation", "edge:subject", "edge:operand", "edge:result"]);
  assert.deepEqual(index.incoming("relation:read").map((record) => record.id), ["edge:relation"]);
  assert.deepEqual(index.occurrences("relation:read").map((record) => record.token_id), ["token:read"]);
  assert.ok(Object.isFrozen(index));
  assert.ok(Object.isFrozen(selected));
});

test("definitions and references are never inferred from spelling or node names", () => {
  const response = exactResponse();
  response.tokens = response.tokens.map((token) => ({ ...token, definition_ids: [], reference_ids: [] }));
  response.graph = { ...response.graph, definitions: [], references: [] };
  const bundle = remoteBundle({ source, response, authority, tokens: lexicalTokens });
  const selected = selectionForToken(buildSemanticIndex(bundle), tokenIndex(bundle, "token:thing"));

  assert.deepEqual(selected.definitions, []);
  assert.deepEqual(selected.references, []);
  assert.equal(selected.same_spelling.length, 1);
});

test("unknown and unsafe explicit links fail closed instead of selecting a nearby record", () => {
  const response = exactResponse();
  response.tokens[0] = { ...response.tokens[0], world_ids: [9007199254740992] };
  assert.throws(() => remoteBundle({ source, response, authority, tokens: lexicalTokens }), /unsafe numeric world identity/);

  const valid = exactResponse();
  valid.tokens[0] = { ...valid.tokens[0], graph_ids: ["missing:node"] };
  const bundle = remoteBundle({ source, response: valid, authority, tokens: lexicalTokens });
  const selected = selectionForToken(buildSemanticIndex(bundle), tokenIndex(bundle, "token:thing"));
  assert.deepEqual(selected.nodes, []);
  assert.deepEqual(selected.unresolved.graph_ids, ["missing:node"]);
});
