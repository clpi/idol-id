import test from "node:test";
import assert from "node:assert/strict";
import { lexicalBundle, remoteBundle } from "../shared/semantic-bundle.js";
import { renderSemanticTokens, semanticTokenClass, sourceTokenProjection } from "../shared/semantic-source.js";

const authority = { repository: "clpi/idol", commit: "authority" };
const source = "body:weight(kg)";
const lexicalTokens = [
  { s: 0, e: 4, v: "body", t: "name", f: null, l: 1, c: 1 },
  { s: 4, e: 5, v: ":", t: "delimiter", f: null, l: 1, c: 5 },
  { s: 5, e: 11, v: "weight", t: "name", f: null, l: 1, c: 6 },
  { s: 11, e: 12, v: "(", t: "delimiter", f: null, l: 1, c: 12 },
  { s: 12, e: 14, v: "kg", t: "name", f: null, l: 1, c: 13 },
  { s: 14, e: 15, v: ")", t: "delimiter", f: null, l: 1, c: 15 },
];

function publishedToken(projection, semanticId) {
  const token = projection.find((candidate) => candidate.semantic_id === semanticId);
  assert.ok(token, `missing compiler-published token ${semanticId}`);
  return token;
}

test("every lexical token renders as an expandable keyboard-focusable source object", () => {
  const bundle = lexicalBundle({ source, tokens: lexicalTokens, authority });
  const projection = sourceTokenProjection(bundle);
  const html = renderSemanticTokens(projection, source);

  assert.equal(projection.length, lexicalTokens.length);
  assert.equal((html.match(/class="semantic-token/g) || []).length, lexicalTokens.length);
  assert.equal((html.match(/tabindex="0"/g) || []).length, lexicalTokens.length);
  assert.equal((html.match(/role="button"/g) || []).length, lexicalTokens.length);
  assert.match(html, /data-binding-status="not-published"/);
  assert.match(html, /semantic identity not published/);
});

test("compiler-published source faces control highlighting without spelling inference", () => {
  const response = {
    authority,
    tokens: [
      { span: [0, 4], lexical_identity: "name", source_face: "subject", semantic_id: "value:body" },
      { span: [5, 11], lexical_identity: "name", source_face: "relation", semantic_id: "relation:weight" },
      { span: [12, 14], lexical_identity: "name", source_face: "projection", semantic_id: "unit:kg" },
    ],
  };
  const projection = sourceTokenProjection(remoteBundle({ source, response, authority, tokens: lexicalTokens }));
  const body = publishedToken(projection, "value:body");
  const weight = publishedToken(projection, "relation:weight");
  const kg = publishedToken(projection, "unit:kg");

  assert.match(semanticTokenClass(body), /sf-subject/);
  assert.match(semanticTokenClass(weight), /sf-relation/);
  assert.match(semanticTokenClass(kg), /sf-projection/);
  assert.doesNotMatch(semanticTokenClass(body), /keyword/);
  assert.equal(projection.find((token) => token.value === ":").binding.status, "not-published");
});

test("unknown source faces remain visible and exact instead of falling into a guessed class", () => {
  const response = {
    authority,
    tokens: [{ span: [5, 11], lexical_identity: "name", source_face: "future-face", semantic_id: "relation:weight" }],
  };
  const projection = sourceTokenProjection(remoteBundle({ source, response, authority, tokens: lexicalTokens }));
  const token = publishedToken(projection, "relation:weight");
  assert.match(semanticTokenClass(token), /sf-future-face/);
  assert.equal(token.source_face, "future-face");
});

test("rendering escapes exact source bytes and never injects compiler records as HTML", () => {
  const dangerous = '<name title="x">';
  const tokens = [{
    token_id: "token:dangerous",
    span: [0, dangerous.length],
    value: dangerous,
    lexical_identity: "name",
    source_face: "relation",
    semantic_id: "relation:<dangerous>",
    binding: { status: "published" },
    graph_ids: [], application_ids: [], world_ids: [], projection_ids: [], derivation_ids: [],
    transformation_ids: [], witness_ids: [], demand_ids: [], realization_ids: [], definition_ids: [], reference_ids: [],
    edges: [], lowering: [], provenance: {}, raw: {},
  }];
  const html = renderSemanticTokens(tokens, dangerous);
  assert.doesNotMatch(html, /<name/);
  assert.match(html, /&lt;name title=&quot;x&quot;&gt;/);
});
