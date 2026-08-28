import test from "node:test";
import assert from "node:assert/strict";
import {
  bundleCapability,
  lexicalBundle,
  remoteBundle,
  tokenSelection,
} from "../shared/semantic-bundle.js";

const authority = Object.freeze({
  repository: "clpi/idol",
  commit: "cb2199dff026c1b2d3fbd0caa04d6d323370a9e8",
});

const source = "main() 0";
const lexicalTokens = [
  { s: 0, e: 4, v: "main", t: "name", f: "call", l: 1, c: 1 },
  { s: 4, e: 5, v: "(", t: "delim", l: 1, c: 5 },
  { s: 5, e: 6, v: ")", t: "delim", l: 1, c: 6 },
  { s: 7, e: 8, v: "0", t: "num", l: 1, c: 8 },
];

test("lexical preview keeps every token clickable without publishing semantic identity", () => {
  const bundle = lexicalBundle({ source, tokens: lexicalTokens, authority });
  assert.equal(bundle.schema, "idol.web.semantic.bundle.v1");
  assert.equal(bundle.authority.kind, "lexical-preview");
  assert.equal(bundle.authority.commit, authority.commit);
  assert.equal(bundleCapability(bundle), "lexical-preview");
  assert.equal(bundle.tokens.length, 4);
  assert.deepEqual(bundle.tokens[0].span, [0, 4]);
  assert.equal(bundle.tokens[0].lexical_identity, "name");
  assert.equal(bundle.tokens[0].source_face, "call");
  assert.equal(bundle.tokens[0].binding.status, "not-published");
  assert.equal(bundle.tokens[0].semantic_id, null);
  assert.deepEqual(bundle.tokens[0].graph_ids, []);
  assert.ok(Object.isFrozen(bundle));
  assert.ok(Object.isFrozen(bundle.tokens));
});

test("remote bundle preserves compiler-published exact identity and lowering facts as strings", () => {
  const response = {
    authority: { repository: "clpi/idol", commit: authority.commit },
    tokens: [{
      token_id: "source-token-1",
      span: [0, 4],
      lexical_identity: "name",
      source_face: "declaration",
      semantic_id: "semantic:main",
      graph_ids: [90071992547409931234n],
      application_ids: ["application:main"],
      provenance: { source: { path: "main.id", start: 0, end: 4 } },
      edges: [{ id: "edge:binding", relation: "binding", from: "semantic:main", to: "value:main" }],
      lowering: [{ id: "lowering:main", target: "native", range: [12, 28] }],
    }],
    graph: {
      nodes: [{ id: "semantic:main", kind: "func", name: "main" }],
      edges: [],
      applications: [{ application: "application:main", relation: "relation:call", subject: null, arguments: [], results: [] }],
    },
    explain: { knowledge_snapshot: { entities: [] } },
  };
  const bundle = remoteBundle({ source, response, authority, tokens: lexicalTokens });
  const selected = tokenSelection(bundle, 0);
  assert.equal(bundle.authority.kind, "remote-native");
  assert.equal(bundleCapability(bundle), "remote-native");
  assert.equal(selected.binding.status, "published");
  assert.equal(selected.semantic_id, "semantic:main");
  assert.deepEqual(selected.graph_ids, ["90071992547409931234"]);
  assert.deepEqual(selected.application_ids, ["application:main"]);
  assert.equal(selected.edges[0].id, "edge:binding");
  assert.equal(selected.lowering[0].id, "lowering:main");
  assert.equal(bundle.graph.nodes[0].id, "semantic:main");
  assert.equal(bundle.raw, response);
});

test("remote graph without an exact token projection never upgrades heuristic lexical bindings", () => {
  const response = {
    authority: authority.commit,
    graph: {
      nodes: [{ id: "node:main", kind: "func", name: "main", line: 1, col: 1 }],
      edges: [],
      applications: [],
    },
  };
  const bundle = remoteBundle({ source, response, authority, tokens: lexicalTokens });
  assert.equal(bundle.graph.nodes.length, 1);
  assert.equal(bundle.tokens.length, lexicalTokens.length);
  assert.equal(bundle.tokens[0].binding.status, "not-published");
  assert.equal(bundle.tokens[0].semantic_id, null);
  assert.deepEqual(bundle.tokens[0].graph_ids, []);
});

test("ambiguous compiler binding remains ambiguous and does not select one identity", () => {
  const response = {
    authority: authority.commit,
    tokens: [{
      span: [0, 4],
      lexical_identity: "name",
      binding_status: "ambiguous",
      semantic_id: null,
      graph_ids: ["node:a", "node:b"],
    }],
  };
  const selected = tokenSelection(remoteBundle({ source, response, authority }), 0);
  assert.equal(selected.binding.status, "ambiguous");
  assert.equal(selected.semantic_id, null);
  assert.deepEqual(selected.graph_ids, ["node:a", "node:b"]);
});

test("exact token projections reject overlap duplicate ids invalid spans and unsafe numeric identities", () => {
  const base = { authority: authority.commit };
  assert.throws(() => remoteBundle({
    source,
    authority,
    response: { ...base, tokens: [{ token_id: "a", span: [0, 4] }, { token_id: "b", span: [3, 6] }] },
  }), /overlap/);
  assert.throws(() => remoteBundle({
    source,
    authority,
    response: { ...base, tokens: [{ token_id: "same", span: [0, 4] }, { token_id: "same", span: [4, 5] }] },
  }), /duplicate exact token identity/);
  assert.throws(() => remoteBundle({
    source,
    authority,
    response: { ...base, tokens: [{ span: [-1, 4] }] },
  }), /invalid exact token span/);
  assert.throws(() => remoteBundle({
    source,
    authority,
    response: { ...base, tokens: [{ span: [0, 4], semantic_id: 9007199254740992 }] },
  }), /unsafe numeric semantic identity/);
});

test("authority and graph collection mismatches fail closed", () => {
  assert.throws(() => remoteBundle({
    source,
    authority,
    response: { authority: "other-commit", graph: { nodes: [], edges: [], applications: [] } },
  }), /authority mismatch/);
  assert.throws(() => remoteBundle({
    source,
    authority,
    response: { authority: authority.commit, graph: { nodes: {}, edges: [], applications: [] } },
  }), /graph nodes must be an array/);
  assert.throws(() => remoteBundle({
    source,
    authority,
    response: { authority: authority.commit, graph: { nodes: [{ id: 9007199254740992 }], edges: [], applications: [] } },
  }), /unsafe numeric graph node identity/);
});

test("token selection is bounded and immutable", () => {
  const bundle = lexicalBundle({ source, tokens: lexicalTokens, authority });
  assert.equal(tokenSelection(bundle, -1), null);
  assert.equal(tokenSelection(bundle, 100), null);
  const selected = tokenSelection(bundle, 1);
  assert.equal(selected.value, "(");
  assert.ok(Object.isFrozen(selected));
});
