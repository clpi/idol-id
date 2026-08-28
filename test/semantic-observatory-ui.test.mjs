import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Semantic Observatory uses the exact semantic bundle and synchronized source, graph, and rail surfaces", async () => {
  const [html, source, graph, index, css, syntax] = await Promise.all([
    read("apps/graph/index.html"), read("shared/semantic-source.js"), read("shared/graph.js"), read("shared/semantic-index.js"), read("shared/observatory.css"), read("shared/observatory-syntax.css"),
  ]);
  assert.match(html, /type="module"/);
  assert.match(html, /semantic-bundle\.js/);
  assert.match(html, /semantic-source\.js/);
  assert.match(html, /semantic-index\.js/);
  assert.match(html, /graph\.js/);
  assert.match(html, /class="app observatory/);
  assert.match(html, /id="semantic-rail"/);
  for (const lens of ["identity", "edges", "occurrences", "worlds", "projection", "witness", "realization"]) assert.match(html, new RegExp(`data-lens="${lens}"`));
  assert.match(html, /semantic identity not published/i);
  assert.match(html, /definition not published/i);
  assert.match(html, /world witness not published/i);
  assert.match(html, /selection history/i);
  assert.match(html, /compare selection/i);

  assert.match(source, /class SemanticSourceView/);
  assert.match(source, /role="button"/);
  assert.match(source, /keydown/);
  assert.match(source, /observatory-syntax\.css/);
  assert.match(graph, /class GraphView/);
  assert.match(graph, /selectEdge/);
  assert.match(graph, /setLens/);
  assert.match(graph, /setHighlights/);
  assert.match(graph, /selectNode\(id, reveal = false, notify = reveal\)/);
  assert.match(graph, /selectEdge\(id, reveal = false, notify = reveal\)/);
  assert.doesNotMatch(graph, /Math\.random/);
  assert.doesNotMatch(graph, /repulsion|O\(n²\)|synthetic:\s*true/);
  for (const word of ["definitions", "references", "worlds", "projections", "derivations", "realizations"]) assert.match(index, new RegExp(word));

  assert.match(css, /font-family:\s*var\(--sans\)/);
  assert.match(css, /font-family:\s*var\(--mono\)/);
  for (const lexical of ["lx-comment", "lx-string", "lx-number", "lx-operator", "lx-delimiter"]) assert.match(syntax, new RegExp(`\\.${lexical}`));
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*44px/);
});

test("Observatory uses the browser's exported lossless lexical segmenter", async () => {
  const [html, presentation] = await Promise.all([read("apps/graph/index.html"), read("shared/idol.js")]);
  assert.match(presentation, /global\.Idol = Object\.freeze\([\s\S]*?\blex,/);
  assert.match(html, /Idol\.lex\(state\.source\)/);
  assert.doesNotMatch(html, /Idol\.tokenize\(/);
});

test("Observatory never presents same spelling, paths, or names as definitions or semantic references", async () => {
  const [html, index, source] = await Promise.all([read("apps/graph/index.html"), read("shared/semantic-index.js"), read("shared/semantic-source.js")]);
  assert.match(html, /same spelling[^<]*lexical/i);
  assert.match(html, /published occurrences/i);
  assert.doesNotMatch(index, /findByName|nearest|fuzzy.*identity|sameSpelling.*reference/i);
  assert.doesNotMatch(source, /keyword(?:s|Table)|contextualKeyword|descriptorTable/i);
});

test("canonical graph rendering never fabricates application edges", async () => {
  const [graph, model] = await Promise.all([read("shared/graph.js"), read("shared/graph-model.js")]);
  assert.doesNotMatch(graph, /applications become/);
  assert.doesNotMatch(graph, /edges\.push\([^\n]*synthetic/);
  assert.match(graph, /publishedGraphModel/);
  assert.match(model, /application_records/);
});

test("mobile Observatory exposes full-width source, graph, and facts modes without horizontal document overflow", async () => {
  const [html, css] = await Promise.all([read("apps/graph/index.html"), read("shared/observatory.css")]);
  for (const mode of ["source", "graph", "facts"]) assert.match(html, new RegExp(`data-mobile-mode="${mode}"`));
  assert.match(html, /class="observatory-mobile-nav"/);
  assert.match(css, /overflow-x:\s*hidden/);
  for (const mode of ["source", "graph", "facts"]) assert.match(css, new RegExp(`\\.observatory\\[data-mobile-mode="${mode}"\\]`));
});
