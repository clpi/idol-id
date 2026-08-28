import test from "node:test";
import assert from "node:assert/strict";
import { remoteBundle } from "../shared/semantic-bundle.js";

const authority = Object.freeze({
  repository: "clpi/idol",
  commit: "cb2199dff026c1b2d3fbd0caa04d6d323370a9e8",
});

const source = "alpha + beta";
const lexical = [
  { s: 0, e: 5, v: "alpha", t: "name", f: "call" },
  { s: 6, e: 7, v: "+", t: "op" },
  { s: 8, e: 12, v: "beta", t: "name" },
];

test("sparse compiler token projections preserve every uncovered lexical source segment", () => {
  const bundle = remoteBundle({
    source,
    authority,
    tokens: lexical,
    response: {
      authority,
      tokens: [{
        token_id: "source-token-alpha-prefix",
        span: [0, 2],
        lexical_identity: "name",
        source_face: "declaration",
        semantic_id: "semantic:alpha",
        graph_ids: ["graph:alpha"],
      }],
      graph: { nodes: [], edges: [], applications: [] },
    },
  });

  assert.deepEqual(bundle.tokens.map((token) => token.span), [
    [0, 2],
    [2, 5],
    [6, 7],
    [8, 12],
  ]);
  assert.equal(bundle.tokens[0].binding.status, "published");
  assert.equal(bundle.tokens[0].semantic_id, "semantic:alpha");
  for (const token of bundle.tokens.slice(1)) {
    assert.equal(token.binding.status, "not-published");
    assert.equal(token.semantic_id, null);
  }
  assert.deepEqual(bundle.tokens.map((token) => source.slice(token.span[0], token.span[1])), ["al", "pha", "+", "beta"]);
});

test("compiler tokenization can replace multiple browser tokens without index coupling", () => {
  const bundle = remoteBundle({
    source,
    authority,
    tokens: lexical,
    response: {
      authority,
      tokens: [{
        token_id: "source-token-expression",
        span: [0, 12],
        lexical_identity: "expression",
        binding_status: "published",
        graph_ids: ["graph:expression"],
      }],
      graph: { nodes: [], edges: [], applications: [] },
    },
  });

  assert.equal(bundle.tokens.length, 1);
  assert.deepEqual(bundle.tokens[0].span, [0, 12]);
  assert.equal(bundle.tokens[0].binding.status, "published");
  assert.deepEqual(bundle.tokens[0].graph_ids, ["graph:expression"]);
});
